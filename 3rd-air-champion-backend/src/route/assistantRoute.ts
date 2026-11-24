import express, { Request } from "express";
import { randomUUID } from "crypto";
import mongoose from "mongoose";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import Host from "../model/hostSchema";
import Room from "../model/roomSchema";
import TTReviews from "../model/ttReviewsSchema";
import { getRoomFacts, getRoomPhotos, houseBathrooms, houseKitchen, houseParking } from "../shared/generated/util/roomFactsData";
import { priceRangeOf, priceRangeText } from "../shared/generated/util/priceRange";
import { cancellationHeadline, formatCancellationPolicy } from "../shared/generated/util/cancellationPolicy";
import { addNights, houseToday, loadHouseNights } from "../util/houseNights";
import { MAX_NIGHTS, findRoomByName, phoneLooksReal, readBack, readStay } from "../util/assistantStay";
import { createBookingRequest } from "../util/createBookingRequest";
import { phoneKey } from "../util/usPhone";

// The TiBook connector: TiBook for AI assistants (Meta's Muse, ChatGPT, Claude
// and the like), at POST /api/assistant/mcp.
//
// Anh-Tuan's idea, approved 2026-11-24: TiBook is built for a person tapping a
// calendar, and an assistant booking for a guest clicks through it slowly and
// wrongly. This gives the assistant the same few things a guest can do on
// TiBook as direct actions, in MCP (Model Context Protocol), which Muse, ChatGPT
// and Claude all speak:
//
//   list_rooms               the rooms, their facts, photos and price range
//   check_availability       which rooms are free for a whole stay
//   house_info               rules, cancellation, check-in, what guests say
//   prepare_booking_request  the request read back in words, not yet sent
//   send_booking_request     sends it, after the guest has said yes
//
// What it must never do, and how it is kept from it:
//
// - BOOK. It sends a booking REQUEST, the same one TiBook's form and TT send
//   (util/createBookingRequest), and the host still confirms every stay in
//   TiMag. The send needs a confirmation id that only prepare hands out, with
//   the read-back the guest is to see, so an assistant cannot skip showing it.
// - SAY ANYTHING PRIVATE. Every answer is built from what TiBook shows a
//   stranger: free or taken, never who is staying; room facts, never the door
//   code (roomCode) or check-in instructions; the street address only once a
//   stay is confirmed. It never looks a guest up by phone: that would tell
//   anyone who asks whether a number has stayed here, so every guest gets the
//   public price range, and family $0 rates stay between the host and family.
// - DISAGREE WITH THE CALENDAR. Availability is util/houseNights, the rule the
//   calendar and the wish-list job use: held (reserved) requests and per-room
//   blocks count as taken.
//
// Public, like /booking-request: the guest's assistant has no login. It reads
// the database directly rather than through /graphql, which has no login in
// front of it and is not something to send a stranger's tool through.
//
// Stateless: a fresh MCP server per HTTP request, no sessions to keep. Only the
// confirmations live in memory (see `pending`).

const router = express.Router();

// One house per backend. The id is the one TiBook is built with
// (VITE_TI_BOOK_HOST_ID) and is not a secret, but it lives in the backend's
// .env rather than in the URL so the connector address is the same for every
// assistant and cannot be pointed at another host's calendar.
const houseId = () => process.env.TIBOOK_HOST_ID ?? "";

// The house's name as guests know it — the cancellation policy and TiBook say
// "TT House". The host's own name is a person's, not the house's.
const HOUSE_NAME = "TT House";

// ── Limits ───────────────────────────────────────────────────────────────────
//
// Anyone can call this, so anyone can script it. A sent request lands in the
// host's Requests screen, so sends are capped hardest — per phone, and per
// address. The per-address caps are generous for the reason ttGuestRoute
// gives: behind CloudFront, req.ip is the edge, which many guests share.
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

const limiter = (windowMs: number, max: number) => {
  const seen = new Map<string, { count: number; since: number }>();
  return {
    over(key: string) {
      const now = Date.now();
      if (seen.size > 5000) for (const [k, v] of seen) if (now - v.since > windowMs) seen.delete(k);
      const r = seen.get(key);
      if (!r || now - r.since > windowMs) {
        seen.set(key, { count: 1, since: now });
        return false;
      }
      r.count += 1;
      return r.count > max;
    },
    clear: () => seen.clear(),
  };
};

const callsPerAddress = limiter(HOUR, 600);
const sendsPerAddress = limiter(HOUR, 30);
const sendsPerPhone = limiter(DAY, 3);

// ── Confirmations ────────────────────────────────────────────────────────────
//
// What prepare read back, waiting for the guest's yes. Kept in memory: losing
// them on a restart costs one more prepare, and the assistant is told so.
interface Pending {
  room: { id: string; name: string };
  nights: string[];
  checkOut: string;
  guests: number;
  guestName: string;
  guestPhone: string;
  notes: string;
  expires: number;
}
const CONFIRM_MS = 30 * 60 * 1000;
const pending = new Map<string, Pending>();

export const resetAssistantState = () => {
  callsPerAddress.clear();
  sendsPerAddress.clear();
  sendsPerPhone.clear();
  pending.clear();
};

// ── Reading the house ────────────────────────────────────────────────────────

const loadHost = async () => {
  const id = houseId();
  if (!mongoose.isValidObjectId(id)) return null;
  return (await Host.findById(id).lean()) as any;
};

const activeRooms = async (hostId: string) =>
  (await Room.find({ host: hostId, active: true }).lean()).map((r: any) => ({
    id: String(r._id),
    name: String(r.name),
    price: Number(r.price),
    airbnbUrl: String(r.airbnbUrl ?? ""),
    photos: (r.photos ?? []) as string[],
  }));

type HouseRoom = Awaited<ReturnType<typeof activeRooms>>[number];

const firstName = (name: unknown) => String(name ?? "").trim().split(/\s+/)[0] || "The host";

const priceText = (room: HouseRoom) => {
  const range = priceRangeOf(room.price);
  return range ? priceRangeText(range) : null;
};

/** What TiBook says about a room — nothing a stranger may not see. */
const roomCard = (room: HouseRoom) => {
  const facts = getRoomFacts(room.airbnbUrl);
  const price = priceText(room);
  return {
    name: room.name,
    max_guests: facts?.maxGuests ?? null,
    beds: facts?.beds.map((b) => b.label) ?? [],
    bathroom: facts?.bathroom ?? null,
    privacy: facts?.privacy ?? null,
    amenities: facts?.highlights ?? [],
    price_per_night_usd: price
      ? `${price} — the exact price is agreed with the host by text`
      : "The host texts the price for the nights asked for",
    photos: getRoomPhotos({ ...room, roomCode: "", active: true } as any),
    airbnb_listing: room.airbnbUrl || null,
  };
};

// ── The tools ────────────────────────────────────────────────────────────────

const text = (value: unknown) => ({
  content: [{ type: "text" as const, text: typeof value === "string" ? value : JSON.stringify(value, null, 2) }],
});
const refuse = (message: string) => ({ ...text(message), isError: true });

const NOT_SET_UP = "This connector is not set up yet: the house has not been configured on the server. Book on TiBook instead.";
const TOO_MANY = "Too many requests from here just now. Try again in a few minutes.";

const dayKey = z.string().describe("A calendar day, yyyy-MM-dd, e.g. 2026-12-01.");

const INSTRUCTIONS = [
  `${HOUSE_NAME} is a five-room short-stay house in Silicon Valley, California. The host lives in the house.`,
  `Its promise to guests: "Your comfort. Our mission."`,
  "",
  "How to book for a guest:",
  "1. check_availability with the guest's check-in and check-out days. The check-out day is the morning they leave; it is not a night.",
  "2. prepare_booking_request with the room, dates, party size, the guest's name and phone number.",
  "3. Show the guest the read_back exactly as given and ask them to confirm.",
  "4. Only after the guest says yes, send_booking_request with the confirmation_id.",
  "",
  "A sent request is not a booking. The host confirms each one by text to the guest's phone.",
  "Arrivals after midnight belong to the night before: a guest arriving at 1am on Tuesday is booked from Monday night.",
  "Prices are a nightly range; the host texts the exact price. Never quote a figure the tools did not give.",
].join("\n");

const buildServer = (ip: string) => {
  const server = new McpServer({ name: "tibook", version: "1.0.0" }, { instructions: INSTRUCTIONS });

  // Typed loosely on purpose. The SDK infers each tool's arguments from its
  // zod schema, and with five tools that inference ran tsc out of memory
  // (heap exhausted at 2 GB). The handlers below spell their argument types
  // out instead, and the SDK still validates every call against the schema.
  const register = server.registerTool.bind(server) as unknown as (
    name: string,
    config: { title: string; description: string; inputSchema: Record<string, z.ZodTypeAny>; annotations: Record<string, boolean> },
    run: (args: any) => Promise<unknown>,
  ) => void;

  // Every tool goes through here: the house must exist, and one address may
  // not run the connector flat out.
  const guarded =
    <A,>(run: (args: A, host: any) => Promise<ReturnType<typeof text>>) =>
    async (args: A) => {
      if (callsPerAddress.over(ip)) return refuse(TOO_MANY);
      try {
        const host = await loadHost();
        if (!host) return refuse(NOT_SET_UP);
        return await run(args, host);
      } catch (err: any) {
        console.error("[Assistant] tool failed:", err?.message);
        return refuse("Something went wrong on the house's side. Try again in a minute, or book on TiBook.");
      }
    };

  register(
    "list_rooms",
    {
      title: "List the rooms",
      description:
        "The house's rooms: how many guests each fits, beds, bathroom (private or shared), privacy, amenities, photos and the nightly price range. Call this before choosing a room for a guest.",
      inputSchema: {},
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    guarded(async (_args: Record<string, never>, host) => {
      const rooms = await activeRooms(String(host._id));
      return text({
        house: HOUSE_NAME,
        rooms: rooms.map(roomCard),
        shared_by_every_room: [houseKitchen, houseParking, houseBathrooms, "Self check-in"],
      });
    }),
  );

  register(
    "check_availability",
    {
      title: "Check availability",
      description: `Which rooms are free for EVERY night of a stay, and which are free for only some of them. Give the check-in day and the check-out day (the morning the guest leaves). Up to ${MAX_NIGHTS} nights at a time.`,
      inputSchema: {
        check_in: dayKey.describe("The first night of the stay, yyyy-MM-dd. A guest arriving after midnight starts the night before."),
        check_out: dayKey.describe("The morning the guest leaves, yyyy-MM-dd. Not a night."),
        guests: z.number().int().min(1).max(10).optional().describe("How many people are staying, if known. Rooms too small are left out."),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    guarded(async (args: { check_in: string; check_out: string; guests?: number }, host) => {
      const today = houseToday();
      const stay = readStay(args.check_in, args.check_out, today);
      if (!stay.ok) return refuse(stay.error);
      const hostId = String(host._id);
      const rooms = (await activeRooms(hostId)).filter((r) => {
        const max = getRoomFacts(r.airbnbUrl)?.maxGuests;
        return !args.guests || !max || args.guests <= max;
      });
      const nights = await loadHouseNights(hostId, host.calendar, stay.nights[0], args.check_out, today);
      const freeOn = new Map(stay.nights.map((n) => [n, new Set(nights.freeRoomsOn(n).map((r) => r.id))]));
      const whole = rooms.filter((r) => stay.nights.every((n) => freeOn.get(n)!.has(r.id)));
      const some = rooms
        .filter((r) => !whole.includes(r))
        .map((r) => ({ room: r.name, free_nights: stay.nights.filter((n) => freeOn.get(n)!.has(r.id)) }))
        .filter((r) => r.free_nights.length > 0);
      return text({
        check_in: args.check_in,
        check_out: args.check_out,
        nights: stay.nights.length,
        free_for_the_whole_stay: whole.map((r) => ({
          room: r.name,
          max_guests: getRoomFacts(r.airbnbUrl)?.maxGuests ?? null,
          price_per_night_usd: priceText(r),
        })),
        free_for_some_nights: some,
        ...(whole.length === 0
          ? {
              if_nothing_fits:
                "No room is free for every night. The guest can take a room for the nights it is free, or add the nights to their wish list on TiBook and be told there if a room opens up.",
            }
          : {}),
      });
    }),
  );

  register(
    "house_info",
    {
      title: "House information",
      description:
        "House rules, the cancellation policy, check-in, location, and what past guests say. Use it to answer a guest's questions before or after they book.",
      inputSchema: {},
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    guarded(async (_args: Record<string, never>, host) => {
      const hostId = String(host._id);
      const [rooms, reviews]: [HouseRoom[], any] = await Promise.all([
        activeRooms(hostId),
        TTReviews.findOne({ host: hostId }, { published: 1 }).lean(),
      ]);
      const nameOf = new Map(rooms.map((r) => [r.id, r.name]));
      const full = host.cancellationFullRefundDays;
      const half = host.cancellationHalfRefundDays;
      // Published summaries only: a draft is the host's to change (ttGuestRoute).
      const p = reviews?.published;
      return text({
        house: HOUSE_NAME,
        promise_to_guests: "Your comfort. Our mission.",
        host: `${firstName(host.name)}, an engineer who lives in the house`,
        location: "Silicon Valley, California. The street address is sent once the host confirms the stay.",
        check_in: `Every room has self check-in. ${firstName(host.name)} confirms check-in and check-out times with the booking.`,
        house_rules: String(host.houseRules ?? "").trim() || `${firstName(host.name)} will go over the house rules with the guest.`,
        cancellation:
          full != null && half != null
            ? formatCancellationPolicy(full, half)
            : `${firstName(host.name)} explains the cancellation terms with the booking.`,
        shared_by_every_room: [houseKitchen, houseParking, houseBathrooms],
        airbnb_rating:
          host.airbnbRating != null ? { stars: host.airbnbRating, reviews: host.airbnbReviewCount ?? null } : null,
        what_guests_say: {
          house: p?.house || null,
          rooms: (p?.rooms ?? [])
            .filter((r: any) => r?.summary && nameOf.has(String(r.room)))
            .map((r: any) => ({ room: nameOf.get(String(r.room)), summary: r.summary })),
        },
      });
    }),
  );

  register(
    "prepare_booking_request",
    {
      title: "Prepare a booking request",
      description:
        "Checks a stay and returns it read back in words, with a confirmation_id. Nothing is sent. Show the guest the read_back exactly as given; call send_booking_request only after they confirm it.",
      inputSchema: {
        room: z.string().describe("The room's name, as list_rooms gives it."),
        check_in: dayKey.describe("The first night, yyyy-MM-dd. A guest arriving after midnight starts the night before."),
        check_out: dayKey.describe("The morning the guest leaves, yyyy-MM-dd."),
        guests: z.number().int().min(1).max(10).describe("How many people are staying."),
        guest_name: z.string().min(1).max(80).describe("The guest's name, as they want the host to see it."),
        guest_phone: z.string().min(7).max(25).describe("The guest's phone number. The host confirms by text to this number."),
        notes: z.string().max(500).optional().describe("Anything the guest wants the host to know, in their words."),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    guarded(
      async (
        args: { room: string; check_in: string; check_out: string; guests: number; guest_name: string; guest_phone: string; notes?: string },
        host,
      ) => {
        const today = houseToday();
        const stay = readStay(args.check_in, args.check_out, today);
        if (!stay.ok) return refuse(stay.error);
        const hostId = String(host._id);
        const rooms = await activeRooms(hostId);
        const room = findRoomByName(rooms, args.room);
        if (!room) return refuse(`There is no room called "${args.room}". The rooms are: ${rooms.map((r) => r.name).join(", ")}.`);
        const max = getRoomFacts(room.airbnbUrl)?.maxGuests;
        if (max && args.guests > max)
          return refuse(`${room.name} fits ${max} guest${max === 1 ? "" : "s"}. Check list_rooms for a room that fits ${args.guests}.`);
        const name = args.guest_name.trim();
        if (!name) return refuse("Send the guest's name.");
        if (!phoneLooksReal(args.guest_phone)) return refuse("Send the guest's phone number, with its area code.");

        const nights = await loadHouseNights(hostId, host.calendar, stay.nights[0], args.check_out, today);
        const taken = stay.nights.filter((n) => !nights.freeRoomsOn(n).some((r) => r.id === room.id));
        if (taken.length > 0)
          return refuse(`${room.name} is taken on ${taken.join(", ")}. Call check_availability for rooms free on these nights.`);

        const id = randomUUID();
        if (pending.size > 1000) for (const [k, v] of pending) if (v.expires < Date.now()) pending.delete(k);
        pending.set(id, {
          room: { id: room.id, name: room.name },
          nights: stay.nights,
          checkOut: args.check_out,
          guests: args.guests,
          guestName: name,
          guestPhone: args.guest_phone.trim(),
          notes: (args.notes ?? "").trim(),
          expires: Date.now() + CONFIRM_MS,
        });
        const full = host.cancellationFullRefundDays;
        return text({
          confirmation_id: id,
          read_back: readBack({
            roomName: room.name,
            nights: stay.nights,
            checkOut: args.check_out,
            guests: args.guests,
            guestName: name,
            guestPhone: args.guest_phone.trim(),
            hostFirstName: firstName(host.name),
            priceRange: priceText(room),
            cancellation: full != null ? cancellationHeadline(full) : "",
          }),
          next: "Show the guest the read_back word for word. If they confirm, call send_booking_request with this confirmation_id within 30 minutes. If anything is wrong, prepare again with the corrected details.",
        });
      },
    ),
  );

  register(
    "send_booking_request",
    {
      title: "Send the booking request",
      description:
        "Sends a prepared request to the host. Call it ONLY after the guest has seen the read_back and said yes. The host confirms by text; nothing is booked until then.",
      inputSchema: {
        confirmation_id: z.string().describe("The confirmation_id prepare_booking_request returned."),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    guarded(async (args: { confirmation_id: string }, host) => {
      const p = pending.get(args.confirmation_id);
      if (!p || p.expires < Date.now()) {
        pending.delete(args.confirmation_id);
        return refuse("That confirmation has expired or is unknown. Call prepare_booking_request again and show the guest the new read_back.");
      }
      if (sendsPerAddress.over(ip) || sendsPerPhone.over(phoneKey(p.guestPhone))) return refuse(TOO_MANY);

      // Again, now: a room free when the guest read the request may have gone
      // while they were deciding.
      const hostId = String(host._id);
      const today = houseToday();
      const nights = await loadHouseNights(hostId, host.calendar, p.nights[0], p.checkOut, today);
      const taken = p.nights.filter((n) => n < today || !nights.freeRoomsOn(n).some((r) => r.id === p.room.id));
      if (taken.length > 0) {
        pending.delete(args.confirmation_id);
        return refuse(`${p.room.name} was taken on ${taken.join(", ")} while the guest was deciding. Call check_availability again.`);
      }

      const request = await createBookingRequest(
        {
          host: hostId,
          guestName: p.guestName,
          guestPhone: p.guestPhone,
          date: p.nights[0],
          room: p.room.id,
          duration: p.nights.length,
          numberOfGuests: p.guests,
          // Said in the notes as well as in `source`, so the host sees it on the
          // request card today without TiMag having to learn a new field.
          notes: ["Sent by the guest's AI assistant through the TiBook connector.", p.notes].filter(Boolean).join("\n"),
        },
        "assistant",
      );
      pending.delete(args.confirmation_id);
      console.log(`[Assistant] request ${request._id} sent: ${p.room.name}, ${p.nights.length} night(s) from ${p.nights[0]}`);
      return text({
        sent: true,
        message: `Sent. ${firstName(host.name)} will confirm by text to ${p.guestPhone}. Nothing is booked until then.`,
        stay: { room: p.room.name, check_in: p.nights[0], check_out: addNights(p.nights[p.nights.length - 1], 1) },
      });
    }),
  );

  return server;
};

router.post("/mcp", async (req: Request, res: any) => {
  const server = buildServer(req.ip ?? "");
  // No session id: each request stands alone (see the top of this file).
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  res.on("close", () => {
    transport.close();
    server.close();
  });
  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err: any) {
    console.error("[Assistant] request failed:", err?.message);
    if (!res.headersSent)
      res.status(500).json({ jsonrpc: "2.0", error: { code: -32603, message: "Internal server error" }, id: null });
  }
});

// Stateless, so there is no stream to open and no session to end.
const notAllowed = (_req: Request, res: any) =>
  res.status(405).json({ jsonrpc: "2.0", error: { code: -32000, message: "Method not allowed." }, id: null });
router.get("/mcp", notAllowed);
router.delete("/mcp", notAllowed);

export default router;
