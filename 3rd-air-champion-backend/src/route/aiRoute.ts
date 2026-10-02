import express, { Request } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { betaTool } from "@anthropic-ai/sdk/helpers/beta/json-schema";
import Host from "../model/hostSchema";
import Day from "../model/daySchema";
import Room from "../model/roomSchema";
import Guest from "../model/guestSchema";
import { dayKey } from "../util/arrivingGuests";
import { findAssignments } from "../util/assignmentQuery";
import { loadCleaningDays } from "../util/cleaningDays";
import { cleaningPlan, UNASSIGNED } from "../util/cleaningPlan";

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

// A hard ceiling, not advice. A model asked about "this year" will ask for a
// year, and that answer then rides along on every later turn of the
// conversation — paid for again each time.
const MAX_RANGE_DAYS = 62;

const clampRange = (from: unknown, to: unknown) => {
  const a = asKey(from, todayKey());
  const b = asKey(to, a);
  const start = a <= b ? a : b;
  let end = a <= b ? b : a;
  const ceiling = new Date(start + "T00:00:00.000Z");
  ceiling.setUTCDate(ceiling.getUTCDate() + MAX_RANGE_DAYS);
  const capped = ceiling.toISOString().slice(0, 10);
  if (end > capped) end = capped;
  return { start, end };
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
      "revenue. Dates are yyyy-MM-dd. Ranges longer than 62 days are cut to 62 — " +
      "ask for the window you need, not the whole year. Days with no bookings are " +
      "left out of the reply.",
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

      // Trimmed hard, because every byte returned here is re-sent with every
      // follow-up question in the conversation — a fat tool result is not paid
      // for once, it is paid for again on each turn after it.
      //
      // So: empty days are dropped, and a field only appears when it says
      // something. `false` and `0` cost the same as a real answer and carry
      // less.
      const rows = days
        .map((d: any) => {
          const date = dayKey(d.date);
          const bookings = (d.bookings ?? []).map((b: any) => {
            const row: Record<string, unknown> = {
              guest: b.guest?.name ?? "",
              room: b.room?.name ?? "",
              price: b.price ?? 0,
            };
            // A stay is written onto every night; this marks the night it began.
            if (b.startDate && dayKey(b.startDate) === date) {
              row.arrives = true;
              row.nights = b.duration ?? 1;
              if (b.numberOfGuests) row.guests = b.numberOfGuests;
            }
            if (b.airbnbPrice) row.airbnbPrice = b.airbnbPrice;
            // reserved = held but NOT paid. An amber hold is not a vacancy and
            // must never be counted as an empty room.
            if (b.reserved) row.reservedUnpaid = true;
            // Long notes are the single biggest thing in this payload and are
            // rarely what the question is about. Enough to see there IS a note.
            if (b.notes) row.notes = String(b.notes).slice(0, 120);
            return row;
          });
          if (bookings.length === 0 && !d.isBlocked) return null;
          return d.isBlocked ? { date, blocked: true, bookings } : { date, bookings };
        })
        .filter(Boolean);

      // Days with nothing on them are absent, so say so rather than leaving the
      // model to infer it from a gap.
      return JSON.stringify({
        range: { from: start, to: end },
        note: "Dates absent from this list have no bookings and are not blocked.",
        days: rows,
      });
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
        .map((g) => {
          const row: Record<string, unknown> = { name: g.name };
          if (g.phone) row.phone = g.phone;
          if (g.returning) row.returning = true;
          if (g.notes) row.notes = String(g.notes).slice(0, 120);
          // "King:60" rather than an object per room — same information, a
          // fraction of the tokens.
          const rates = (g.pricing ?? [])
            .filter((p: any) => p?.room?.name)
            .map((p: any) => `${p.room.name}:${p.price}`);
          if (rates.length) row.rates = rates;
          return row;
        });
      // Unfiltered, the whole list is a large payload that then rides along on
      // every later turn. Cut it — but say so, rather than cutting silently and
      // letting the model answer "everyone" from a partial list.
      const CAP = 60;
      return JSON.stringify(
        rows.length > CAP
          ? {
              guests: rows.slice(0, CAP),
              note: `${rows.length} guests in total; showing the first ${CAP}. Use 'search' to narrow.`,
            }
          : { guests: rows },
      );
    },
  });

  const getCleanings = betaTool({
    name: "get_cleanings",
    description:
      "The cleaning plan between two dates, one entry per morning: each room that turns " +
      "over, who is assigned to it, and the hours recorded. This is what Clean → Plan " +
      "shows and what a cleaner sees in TiWork. No 'hours' field means none recorded yet. " +
      "'likely: true' means no booking ends that morning — the night before is empty and " +
      "expected to sell — so it is a forecast, not a booked clean. 'arrivalSameDay: true' " +
      "means a guest checks in that day. Cleaner '(unassigned)' means the room turns over " +
      "and nobody is on it. Mornings with nothing to clean are left out.",
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
      // The assignments table is NOT the plan — the auto-planner writes its
      // forecasts into it as real rows. This used to return the table, and
      // would have told the host Henry was cleaning a room whose guest was
      // staying on. cleaningPlan runs TiMag's own rule over it instead; the
      // why, with the morning it was measured on, is at the top of that file.
      const [assignments, dayMap, rooms] = await Promise.all([
        findAssignments({ host: hostId, start, end }),
        loadCleaningDays(hostId, start, end),
        Room.find({ host: hostId }).select("name"),
      ]);
      const days = cleaningPlan({
        dayMap,
        from: start,
        to: end,
        roomNames: new Map((rooms as any[]).map((r) => [String(r._id), r.name ?? ""])),
        assignments: (assignments as any[]).map((a) => ({
          date: a.date,
          roomId: a.room?._id ? String(a.room._id) : "",
          room: a.room?.name ?? "",
          cleaner: a.cleaner?.name ?? UNASSIGNED,
          hours: a.hours ?? null,
        })),
      });
      return JSON.stringify({
        range: { from: start, to: end },
        note: "Mornings absent from this list have nothing to clean.",
        days,
      });
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
    "HOW TO FORMAT",
    "- PLAIN TEXT ONLY. The panel does not render Markdown, so asterisks, hashes",
    "  and pipes appear on screen exactly as you type them.",
    "- No **bold**, no headings, no Markdown tables. A table is unreadable in a",
    "  column the width of a phone even when it does render.",
    "- For several items, use one short line each, starting with a dash:",
    "    - King, 2 guests, $180, arrives today",
    "  Put the room first — it is what the host scans for.",
    "- Write dates the way a person says them: 'Fri 21 Aug', not '2026-08-21'.",
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
    "- A stay is stored on every night it covers; 'arrives' marks the night it",
    "  began. Count arrivals with 'arrives', not with every row.",
    "- An arrival in the small hours belongs to the night BEFORE that calendar",
    "  day. A guest saying '1am Tuesday' usually means the Monday night booking.",
    "  Twelve-hour misreadings of a guest's message have cost this house a room",
    "  before, so if a time could be read two ways, say so rather than pick one.",
    "- A cleaning marked likely is a forecast: no guest is booked to leave that",
    "  morning, the night before is only expected to sell. Say 'likely' on that",
    "  line. A cleaner may be told this plan, and a forecast told as a booking",
    "  is a wasted drive.",
    "- A room that turns over with cleaner '(unassigned)' has nobody on it. Say",
    "  so plainly, even when the question was about one cleaner — it is the",
    "  line the host most needs. It is fixed in Clean, on the Plan tab.",
    "- When asked about a week, say which dates you looked at.",
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

  // ── Server-sent events, because the answer takes longer than the CDN waits ──
  //
  // CloudFront gives an origin 30 seconds to START responding, then returns its
  // own 504 — which is what this route did on its first real question. A model
  // running several tool calls over a month of calendar is simply slower than
  // that, and raising the timeout only moves the wall (60s is the ceiling).
  //
  // So the response opens IMMEDIATELY and keeps a heartbeat flowing while the
  // work happens. The connection is never idle, so there is nothing to time
  // out, and the wait stops being a gamble against a stopwatch.
  //
  // Everything that can fail cheaply — no key, no message — is answered as
  // ordinary JSON above this line. Once the stream opens the status code is
  // already sent and cannot be taken back.
  res.status(200);
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  // no-transform matters as much as no-cache: it tells the CDN not to buffer
  // the body, which would defeat the whole point of streaming it.
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();

  const send = (event: string, payload: unknown) =>
    res.write(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`);

  // A comment line every few seconds. Invisible to the client's parser, but it
  // is bytes on the wire, which is the only thing the CDN is counting.
  const heartbeat = setInterval(() => res.write(": working\n\n"), 5000);

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

    // Each iteration is one model turn. Reporting the tool calls as they happen
    // shows the host it is reading rather than composing — and turns a blank
    // thirty seconds into something legible.
    for await (const message of runner) {
      const used = (message?.content ?? [])
        .filter((b: any) => b.type === "tool_use")
        .map((b: any) => b.name);
      if (used.length > 0) send("progress", { tools: used });
    }

    const final = await runner.done();
    const text = (final?.content ?? [])
      .filter((b: any) => b.type === "text")
      .map((b: any) => b.text)
      .join("\n")
      .trim();

    send("reply", {
      reply: text || "I could not put an answer together for that one.",
      usage: {
        input: final?.usage?.input_tokens ?? 0,
        output: final?.usage?.output_tokens ?? 0,
      },
    });
  } catch (error: any) {
    // Most specific first — the difference between "no credit" and "try again"
    // is the difference between a task and a wait. These travel as events now,
    // since the 200 has already gone out.
    const message =
      error instanceof Anthropic.AuthenticationError
        ? "The server's API key was rejected."
        : error instanceof Anthropic.RateLimitError
          ? "Too many requests just now — try again shortly."
          : error instanceof Anthropic.APIError
            ? `The assistant is unavailable (${error.status}).`
            : (error?.message ?? "Something went wrong.");
    send("failed", { error: message });
  } finally {
    clearInterval(heartbeat);
    res.end();
  }
});

export default router;
