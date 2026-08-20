import express, { Request } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { betaTool } from "@anthropic-ai/sdk/helpers/beta/json-schema";
import Host from "../model/hostSchema";
import Day from "../model/daySchema";
import Room from "../model/roomSchema";
import Guest from "../model/guestSchema";
import CleaningAssignment from "../model/cleaningAssignmentSchema";
import { dayKey } from "../util/arrivingGuests";

// TiMag's agent — a conversation with somebody who can actually see the books.
//
// Mounted AFTER the JWT middleware, so every request already carries a host.
// That matters more here than anywhere else in the app: the host id comes from
// the signed token and is applied to every query below, so the model cannot ask
// for another host's calendar however it is asked to. Nothing in the model's
// input decides whose data is read.
//
// READ ONLY, deliberately. There is no tool here that books, unbooks, prices or
// texts anyone. A wrong recommendation costs a conversation; a wrong write costs
// a guest standing at a door at 1am, which has already happened once.
const router = express.Router();

const MODEL = "claude-opus-5";

// Conversations here are short and occasional, and the answers steer real
// money decisions, so this runs at high effort rather than being tuned for cost.
const EFFORT = "high" as const;

const asKey = (d: unknown, fallback: string): string => {
  const s = String(d ?? "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : fallback;
};

const todayKey = () => new Date().toISOString().slice(0, 10);

const clampRange = (from: unknown, to: unknown) => {
  const start = asKey(from, todayKey());
  const end = asKey(to, start);
  return start <= end ? { start, end } : { start: end, end: start };
};

// ── The tools, all scoped to one host ────────────────────────────────────────
const buildTools = (hostId: string) => {
  const calendarId = async (): Promise<unknown | null> => {
    const host: any = await Host.findById(hostId).select("calendar");
    return host?.calendar ?? null;
  };

  const getCalendar = betaTool({
    name: "get_calendar",
    description:
      "Bookings on the calendar between two dates (inclusive), one entry per night. " +
      "Use this for occupancy, who is staying where, arrivals, departures and nightly " +
      "revenue. Dates are yyyy-MM-dd. Keep the range under ~60 days.",
    inputSchema: {
      type: "object",
      properties: {
        from: { type: "string", description: "First date, yyyy-MM-dd" },
        to: { type: "string", description: "Last date, yyyy-MM-dd" },
      },
      required: ["from", "to"],
      additionalProperties: false,
    },
    run: async (input: any) => {
      const cal = await calendarId();
      if (!cal) return JSON.stringify({ error: "No calendar for this host." });
      const { start, end } = clampRange(input?.from, input?.to);
      const days: any[] = await Day.find({
        calendar: cal,
        date: {
          $gte: new Date(start + "T00:00:00.000Z"),
          $lte: new Date(end + "T23:59:59.999Z"),
        },
      })
        .populate("bookings.room", "name")
        .populate("bookings.guest", "name phone")
        .sort({ date: 1 });

      return JSON.stringify(
        days.map((d) => ({
          date: dayKey(d.date),
          blocked: !!d.isBlocked,
          bookings: (d.bookings ?? []).map((b: any) => ({
            guest: b.guest?.name ?? "",
            room: b.room?.name ?? "",
            // A stay is written onto every night; this flags the night it began.
            arrivesToday: b.startDate ? dayKey(b.startDate) === dayKey(d.date) : false,
            nights: b.duration ?? 1,
            guests: b.numberOfGuests ?? 0,
            price: b.price ?? 0,
            airbnbPrice: b.airbnbPrice ?? 0,
            // reserved = held but NOT paid. An amber hold is not a vacancy and
            // must never be counted as an empty room.
            reservedUnpaid: !!b.reserved,
            notes: b.notes ?? "",
          })),
        })),
      );
    },
  });

  const getRooms = betaTool({
    name: "get_rooms",
    description: "Every room, its nightly rate, and whether it is currently in service.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    run: async () => {
      const rooms: any[] = await Room.find({ host: hostId });
      return JSON.stringify(
        rooms.map((r) => ({
          name: r.name,
          roomCode: r.roomCode ?? "",
          price: r.price ?? 0,
          active: r.active !== false,
        })),
      );
    },
  });

  const getGuests = betaTool({
    name: "get_guests",
    description:
      "The guest list: names, phones, whether they are returning guests, and any " +
      "per-room rate agreed with them. A blank rate means they pay the room's usual price.",
    inputSchema: {
      type: "object",
      properties: {
        search: { type: "string", description: "Optional name or phone fragment to filter by" },
      },
      additionalProperties: false,
    },
    run: async (input: any) => {
      const guests: any[] = await Guest.find({ host: hostId }).populate("pricing.room", "name");
      const q = String(input?.search ?? "").trim().toLowerCase();
      const rows = guests
        .filter((g) =>
          !q ||
          String(g.name ?? "").toLowerCase().includes(q) ||
          String(g.phone ?? "").replace(/\D/g, "").includes(q.replace(/\D/g, "")),
        )
        .map((g) => ({
          name: g.name,
          phone: g.phone ?? "",
          returning: !!g.returning,
          notes: g.notes ?? "",
          rates: (g.pricing ?? []).map((p: any) => ({
            room: p.room?.name ?? "",
            price: p.price,
          })),
        }));
      return JSON.stringify(rows.slice(0, 200));
    },
  });

  const getCleanings = betaTool({
    name: "get_cleanings",
    description:
      "Cleaning assignments between two dates: which cleaner, which room, which morning, " +
      "and the hours recorded against it (null where nothing has been recorded yet).",
    inputSchema: {
      type: "object",
      properties: {
        from: { type: "string", description: "First date, yyyy-MM-dd" },
        to: { type: "string", description: "Last date, yyyy-MM-dd" },
      },
      required: ["from", "to"],
      additionalProperties: false,
    },
    run: async (input: any) => {
      const { start, end } = clampRange(input?.from, input?.to);
      const rows: any[] = await CleaningAssignment.find({
        host: hostId,
        date: { $gte: start, $lte: end },
      })
        .populate("room", "name")
        .populate("cleaner", "name")
        .sort({ date: 1 });
      return JSON.stringify(
        rows.map((a) => ({
          date: a.date,
          room: a.room?.name ?? "",
          cleaner: a.cleaner?.name ?? "(unassigned)",
          hours: a.hours ?? null,
        })),
      );
    },
  });

  return [getCalendar, getRooms, getGuests, getCleanings];
};

const systemPrompt = (today: string) =>
  [
    "You are the assistant inside TiMag, the app that runs TT House — a five-room",
    "short-stay house in Silicon Valley owned by Anh-Tuan and his wife Cindy.",
    "You are talking to the host.",
    "",
    `Today is ${today}. Dates are yyyy-MM-dd throughout.`,
    "",
    "HOW TO ANSWER",
    "- Look things up before answering. You have read-only tools over the real",
    "  calendar, rooms, guests and cleanings. Never estimate a number you could",
    "  have fetched, and never invent a guest, room or booking.",
    "- Be brief. The host reads this on a phone, often between other tasks.",
    "- Give the answer first, then the detail that supports it.",
    "- Money is real money. State amounts plainly and say what period they cover.",
    "",
    "WHAT YOU MUST NOT DO",
    "- You cannot change anything: no booking, unbooking, pricing or messaging.",
    "  If something needs doing, say what to do and where in TiMag to do it.",
    "- Do not guess when the data does not say. 'The calendar does not show that'",
    "  is a complete answer. The host has said he will act on what you tell him,",
    "  so a confident invention is worse than an admission.",
    "",
    "THINGS THIS BUSINESS KNOWS THAT YOU SHOULD NOT RE-DERIVE",
    "- A booking marked reservedUnpaid is HELD, not free. It is not a vacancy.",
    "- Some guests are on deliberate $0 rates (family). That is not an error.",
    "- A stay is stored on every night it covers; arrivesToday marks the night it",
    "  began. Count arrivals with arrivesToday, not with every row.",
    "- An arrival in the small hours belongs to the night BEFORE that calendar",
    "  day. A guest saying '1am Tuesday' usually means the Monday night booking.",
    "  Twelve-hour misreadings of a guest's message have cost this house a room",
    "  before, so if a time could be read two ways, say so rather than pick one.",
  ].join("\n");

router.post("/chat", async (req: Request, res: any) => {
  if (!("user" in req))
    return res.status(401).json({ error: "Invalid or expired token" });
  const { hostId } = req.user as any;

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({
      error:
        "The assistant is not configured on the server yet — ANTHROPIC_API_KEY is missing.",
    });
  }

  const history = Array.isArray(req.body?.messages) ? req.body.messages : [];
  if (history.length === 0) return res.status(400).json({ error: "No message sent." });

  // Only the two roles the API takes, and only text. Whatever the browser sends
  // is shaped here rather than trusted.
  const messages = history
    .filter((m: any) => m?.role === "user" || m?.role === "assistant")
    .map((m: any) => ({
      role: m.role as "user" | "assistant",
      content: String(m.content ?? "").slice(0, 8000),
    }))
    .slice(-24);

  try {
    const client = new Anthropic();
    const runner = client.beta.messages.toolRunner({
      model: MODEL,
      max_tokens: 8000,
      output_config: { effort: EFFORT },
      system: systemPrompt(todayKey()),
      tools: buildTools(String(hostId)),
      messages,
    });

    const final = await runner.done();
    const text = (final?.content ?? [])
      .filter((b: any) => b.type === "text")
      .map((b: any) => b.text)
      .join("\n")
      .trim();

    res.status(200).json({
      reply: text || "I could not put an answer together for that one.",
      // Shown in the panel so the host can see it actually looked things up
      // rather than answering from the air.
      usage: {
        input: final?.usage?.input_tokens ?? 0,
        output: final?.usage?.output_tokens ?? 0,
      },
    });
  } catch (error: any) {
    // Most specific first — the difference between "no credit" and "try again"
    // is the difference between a task and a wait.
    if (error instanceof Anthropic.AuthenticationError)
      return res.status(502).json({ error: "The server's API key was rejected." });
    if (error instanceof Anthropic.RateLimitError)
      return res.status(429).json({ error: "Too many requests just now — try again shortly." });
    if (error instanceof Anthropic.APIError)
      return res.status(502).json({ error: `The assistant is unavailable (${error.status}).` });
    res.status(500).json({ error: error?.message ?? "Something went wrong." });
  }
});

export default router;
