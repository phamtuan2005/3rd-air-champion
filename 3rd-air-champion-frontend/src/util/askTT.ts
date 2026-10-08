import { addDays, format, parseISO } from "date-fns";
import { roomType } from "./types/roomType";
import { parseDateText } from "./dateText";
import { getRoomFacts, houseBathrooms, houseKitchen, houseParking } from "./roomFacts";
import { cancellationHeadline, formatCancellationPolicy } from "./cancellationPolicy";
import { holidayLabel, usHolidayOn } from "./usHolidays";
import { checkoutReading, chooseRoom, maxGuestsOf, monthAsked, readStay, stayLine, wantsToBook } from "./ttBooking";

// TT, answering a GUEST.
//
// TiMag's Ask TT is a search box the host types into. TiBook's is the same
// name and the same badge talking to somebody else: a guest who wants to know
// whether a room is free on their dates, where to park, or what the bathroom is
// like — the questions the host otherwise answers by text, one guest at a time.
//
// Deliberately NOT a model, for the reason dateText.ts gives: no network, no
// cost, and no way for a public text box to spend anybody's money or say
// something the house never said. Every answer is assembled from what TiBook
// already shows — the availability rule, the room facts, the cancellation
// policy, the guest's own rate — so TT cannot disagree with the screen behind
// it. Anything it does not recognise goes to the host, by name, rather than
// being guessed at.
//
// The answer still needs no network. What IS sent, afterwards and without the
// guest waiting on it, is the question itself — scrubbed (layer 3 below) —
// with the topic it landed in and whether TT could answer (`category`,
// `answered`). The host asked for that log to see what TT should learn next;
// it is ttQuestionLog.ts, and only the host and cohosts can read it.
//
// ── Privacy, in three layers ────────────────────────────────────────────────
//
// TT is a text box on a PUBLIC page, so somebody will ask it who is staying in
// King, what the door code is, or what the API key is. None of those may ever
// get an answer, and "TT happens not to have a branch for that" is not a
// guarantee. So:
//
//  1. TT never HOLDS anything secret. A room reaches it as `TTRoom` — id, name
//     and listing link — stripped by `toTTRoom` at the boundary, so the door
//     code (`roomCode`, which the room record carries), the list price and the
//     check-in instructions are not in memory for any answer to reach. It is
//     handed "which rooms are free that night", never the day records, which
//     carry every guest's name, phone and email (see the stayPaid stopgap).
//     Of people it knows only the host's FIRST name and this guest's own
//     first name, usual room, wish list and agreed rates.
//  2. `privacyRefusal` turns down, before anything else is read, questions
//     about other people, codes and passwords, the system behind the page,
//     and attempts to talk TT out of its rules. A refusal says what TT CAN do
//     instead (TiBook's tone) and never repeats back what was asked for.
//  3. `scrub` runs over every line and label that leaves `askTT`, and removes
//     anything shaped like a door code, phone number, email, URL or IP
//     address — the backstop for house rules the host typed, and for any
//     future branch that forgets layer 1.

// The only parts of a room TT may see. Add a field here only if every guest
// may read it.
export type TTRoom = Pick<roomType, "id" | "name" | "airbnbUrl">;

// Copies ONLY the safe fields. A type alone would still let the whole room
// object — door code included — ride along at runtime.
export const toTTRoom = (r: roomType): TTRoom => ({ id: r.id, name: r.name, airbnbUrl: r.airbnbUrl });

export type TTAction =
  // Put these nights in the guest's selection, in this room or (null) any room.
  // `review` goes on to Review Request with them, for a returning guest who
  // knows how this works and came to book (see `pick` below).
  | { kind: "pick"; label: string; dates: string[]; roomId: string | null; review?: boolean }
  // Star nights that are sold out, so the house hears that they were wanted.
  | { kind: "wish"; label: string; dates: string[] }
  // Narrow the calendar to one room.
  | { kind: "room"; label: string; roomId: string }
  | { kind: "photos"; label: string; roomId: string }
  | { kind: "chat"; label: string }
  | { kind: "bookings"; label: string }
  | { kind: "request"; label: string }
  // A follow-up question, asked as if typed.
  | { kind: "ask"; label: string; query: string }
  // Book these nights in this room, here in the conversation (ttBooking.ts).
  // Handled by the sheet like "ask", never by TiBook: nothing is sent until the
  // guest has read the request back and said send.
  | { kind: "book"; label: string; dates: string[]; roomId: string; party: number | null; alt?: string[] }
  // A step inside a booking already under way — a party size, "Send", "Start
  // over". Also the sheet's own, and only live on the latest message.
  | { kind: "booking"; label: string; step: TTBookingAction };

export type TTBookingAction =
  | { do: "party"; n: number }
  | { do: "keepHolidays" }
  | { do: "dropHolidays" }
  | { do: "alt" }
  | { do: "notMe" }
  | { do: "send" }
  | { do: "form" }
  | { do: "cancel" };

// A booking TT can start straight away: the guest asked to book, and one room
// is free for the whole stay. The sheet opens the draft without another tap.
export interface TTBookingStart {
  roomId: string;
  dates: string[];
  party: number | null;
  alt?: string[];
}

// Which of TT's topics a question landed in. Logged with every question
// (ttQuestionLog) so the host can see what guests ask about; the backend keeps
// the same list (util/ttQuestions.ts) and files anything else under "other".
export type TTCategory =
  | "availability"
  | "wishList"
  | "rooms"
  | "reviews"
  | "checkIn"
  | "parking"
  | "cancellation"
  | "price"
  | "kitchen"
  | "bathroom"
  | "amenities"
  | "houseRules"
  | "location"
  | "contactHost"
  | "booking"
  | "myBookings"
  | "greeting"
  | "thanks"
  | "privacy"
  | "other";

// What a branch below hands back. `answered` is false when TT had nothing
// real to say and passed the guest to the host — the questions the host
// wants to see, so TT can be taught them. Left out, it means answered.
interface TTReply {
  lines: string[];
  actions: TTAction[];
  answered?: boolean;
  book?: TTBookingStart;
}

export interface TTAnswer {
  lines: string[];
  actions: TTAction[];
  category: TTCategory;
  // A privacy refusal counts as answered: TT did what it should.
  answered: boolean;
  book?: TTBookingStart;
}

const as = (category: TTCategory, r: TTReply): TTAnswer => ({
  lines: r.lines,
  actions: r.actions,
  category,
  answered: r.answered ?? true,
  ...(r.book ? { book: r.book } : {}),
});

export interface AskTTContext {
  today: Date;
  // Active rooms only.
  rooms: TTRoom[];
  // Rooms free on a yyyy-MM-dd night across the whole house — bookings,
  // reserved holds and per-room blocks all subtracted. TiBook.tsx's rule,
  // passed in, so there is still only one.
  freeRoomsOn: (key: string) => TTRoom[];
  // This guest's agreed rate per room id. Empty for a stranger.
  myRates: Map<string, number>;
  hostFirstName: string;
  cancellationFullRefundDays?: number;
  cancellationHalfRefundDays?: number;
  houseRules?: string;
  // A guest TiBook already knows — by the phone they gave on this device.
  // Absent for somebody new. Only ever THEIR OWN stays and wish list.
  guest?: ReturningGuest;
  // What guests say, as the host PUBLISHED it in TiMag (Guest reviews): a
  // summary for the house and one per room id, drafted from the AirBnB
  // reviews and read by the host before any guest sees it. Absent until the
  // host publishes, and TT says so rather than making anything up.
  reviews?: TTReviews;
}

export interface TTReviews {
  house: string;
  rooms: Record<string, string>;
  // The AirBnB figures the host already shows in the banner.
  rating?: number;
  count?: number;
}

export interface ReturningGuest {
  firstName: string;
  // The room they have spent the most nights in, if it is still let.
  usualRoomId?: string;
  // Every room they stay in, most-used first — the SAME list, in the same order,
  // the usual-stay popup names, so TT and the popup never describe a guest two
  // ways ("King, your usual room" beside "King, Cute, Queen and Chill" — host,
  // 2026-10-07). usualRoomId is its first. For a guest with no pattern yet it
  // is the room of their last stay alone, and `roomsAre` says so.
  usualRoomIds?: string[];
  roomsAre?: "usual" | "last";
  // Their wish-list nights still to come, and not already booked.
  wishList: string[];
}

// The room a returning guest has spent the most nights in. Nights, not stays:
// one month in Chill says more about a guest than two weekends in King.
export const usualRoomOf = (stays: { roomId: string; nights: number }[], rooms: TTRoom[]): string | undefined => {
  const nights = new Map<string, number>();
  stays.forEach((s) => nights.set(s.roomId, (nights.get(s.roomId) ?? 0) + s.nights));
  const live = [...nights.entries()].filter(([id]) => rooms.some((r) => r.id === id));
  live.sort((a, b) => b[1] - a[1]);
  return live[0]?.[0];
};

const WEEKDAY_NUM: Record<string, number> = {
  sunday: 0, sun: 0, monday: 1, mon: 1, tuesday: 2, tue: 2, tues: 2,
  wednesday: 3, wed: 3, thursday: 4, thu: 4, thur: 4, thurs: 4,
  friday: 5, fri: 5, saturday: 6, sat: 6,
};

// The most nights TT lists one by one. Past that a guest is better served by
// the calendar than by a paragraph.
const MAX_NIGHTS = 31;

const keyOf = (d: Date) => format(d, "yyyy-MM-dd");
// The year only when it is not this one: dateText reads a day already gone
// ("Oct 1" on the 2nd) as next year's, and the guest must see that it did.
const niceDay = (key: string, today: Date) =>
  format(parseISO(key), parseISO(key).getFullYear() === today.getFullYear() ? "EEE MMM d" : "EEE MMM d, yyyy");
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
const names = (rooms: TTRoom[]) => rooms.map((r) => r.name).join(", ");

const has = (q: string, ...words: string[]) =>
  words.some((w) => new RegExp(`\\b${w}`, "i").test(q));

// Runs of consecutive nights, each one stay as the guest would describe it.
const runsOf = (keys: string[]): string[][] => {
  const runs: string[][] = [];
  for (const k of keys) {
    const last = runs[runs.length - 1];
    if (last && keyOf(addDays(parseISO(last[last.length - 1]), 1)) === k) last.push(k);
    else runs.push([k]);
  }
  return runs;
};

// The dates a guest means, beyond what dateText reads: "this weekend", and a
// weekday on its own ("Friday"). dateText reads a weekday only after a month,
// where it means every such day; on its own a guest means the coming one.
export const datesAsked = (query: string, today: Date): { dates: string[]; past: string[] } => {
  const parsed = parseDateText(query, today);
  if (parsed.dates.length > 0 || parsed.past.length > 0) return parsed;

  const q = query.toLowerCase();
  const todayNum = today.getDay();
  // A weekend is two NIGHTS, Friday and Saturday — the nights a room is booked
  // for, which is what a guest asking about "the weekend" is asking about.
  if (/\bweekend\b/.test(q)) {
    const toFri = (5 - todayNum + 7) % 7;
    // Saturday: this weekend is tonight alone; Sunday: it has gone, so the next.
    let start = todayNum === 6 ? today : addDays(today, toFri);
    if (/\bnext weekend\b/.test(q)) start = addDays(start, todayNum === 6 ? 6 : 7);
    const nights = todayNum === 6 && !/\bnext weekend\b/.test(q) ? [start] : [start, addDays(start, 1)];
    return { dates: nights.map(keyOf), past: [] };
  }
  const day = q.match(/\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tues?|wed|thu(?:rs?)?|fri|sat)\b/);
  // A weekday WITH a month — "Tuesday Jan 2027", "a Friday in March" — is that
  // weekday in that month: every one of them still ahead, as "Jan Tuesday"
  // already reads, so the guest picks the night. It used to be read as the
  // weekday alone, which is the coming one: asked about a Tuesday in January
  // 2027, TT kept offering a Tuesday in October 2026 (host, 2026-10-07).
  const inMonth = day ? monthAsked(q, today) : null;
  if (day && inMonth) {
    const want = WEEKDAY_NUM[day[1]];
    return { dates: inMonth.filter((k) => parseISO(k).getDay() === want), past: [] };
  }
  if (day) {
    const want = WEEKDAY_NUM[day[1]];
    let ahead = (want - todayNum + 7) % 7;
    if (new RegExp(`\\bnext ${day[1]}`).test(q) && ahead === 0) ahead = 7;
    return { dates: [keyOf(addDays(today, ahead))], past: [] };
  }
  return { dates: [], past: [] };
};

// "for 3 people", "2 guests", "three of us".
const WORD_NUM: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 };
export const partySizeAsked = (query: string): number | null => {
  const q = query.toLowerCase();
  const m = q.match(/\b(\d+|one|two|three|four|five|six)\s*(?:people|persons|person|guests?|adults?|of us|ppl|pax)\b/);
  if (m) return WORD_NUM[m[1]] ?? Number(m[1]);
  // "book Queen Oct 19-21 for 2" — a small number after "for", when it is not
  // nights, weeks or a time. Read as people the first time a guest tried it.
  const f = q.match(/\bfor (one|two|three|four|five|six|[1-6])\b(?!\s*(?:nights?|nts?|weeks?|days?|months?|am|pm|o'?clock|:))/);
  return f ? WORD_NUM[f[1]] ?? Number(f[1]) : null;
};

// A room named in the question. Longest name first, so "ChillChill" is not
// read as "Chill".
const roomAsked = (query: string, rooms: TTRoom[]): TTRoom | null => {
  const q = query.toLowerCase();
  const byLength = [...rooms].sort((a, b) => b.name.length - a.name.length);
  return byLength.find((r) => new RegExp(`\\b${r.name.toLowerCase()}\\b`).test(q)) ?? null;
};

const roomsFitting = (rooms: TTRoom[], party: number | null) =>
  party == null ? rooms : rooms.filter((r) => (getRoomFacts(r.airbnbUrl)?.maxGuests ?? 0) >= party);

// What this guest pays, in the gallery's own words. A stranger is never quoted
// the room's list price: TiBook leaves the price to a conversation with the
// host, and TT saying a number the gallery does not would be two screens
// disagreeing. A $0 rate is family, on purpose — said, never "corrected".
const rateLine = (room: TTRoom, ctx: AskTTContext): string | null => {
  const rate = ctx.myRates.get(room.id);
  if (rate == null) return null;
  return rate === 0 ? `${room.name}: family — no charge, agreed with ${ctx.hostFirstName}.` : `${room.name}: your price is $${rate}/night.`;
};

const chat = (ctx: AskTTContext, label?: string): TTAction => ({ kind: "chat", label: label ?? `Ask ${ctx.hostFirstName}` });

// How a reply was asked for. `booking` is set when the guest has said they
// want to BOOK — in this question, or in the one before it ("I'd like to book"
// … "Oct 10-12") — rather than only asked what is free.
interface Asked {
  booking: boolean;
  party: number | null;
  // The two-night reading of a dash range, carried onto a Book button.
  alt?: string[] | null;
}
const JUST_LOOKING: Asked = { booking: false, party: null };

// The button that takes nights. For somebody new who is only LOOKING it
// chooses them — the nights land on the calendar so they can see what they
// picked and learn how TiBook works. Somebody who asked to book, or a
// returning guest (who came to book), gets "Book", which books the stay here
// in the conversation (ttBooking.ts) — once they have read it back and said
// send. A stay with no one room ("any room") still goes the calendar's way,
// where the form gives each stay its own room.
const pick = (ctx: AskTTContext, what: string, dates: string[], roomId: string | null, asked: Asked = JUST_LOOKING): TTAction => {
  if (roomId && (ctx.guest || asked.booking)) {
    const alt = asked.alt && asked.alt.length > 0 && asked.alt.length === dates.length - 1 ? asked.alt : undefined;
    return { kind: "book", label: `Book ${what} →`, dates, roomId, party: asked.party, ...(alt ? { alt } : {}) };
  }
  return ctx.guest
    ? { kind: "pick", label: `Request ${what} →`, dates, roomId, review: true }
    : { kind: "pick", label: `Choose ${what}`, dates, roomId };
};

// The guest's usual room first, then the rest as they came.
const usualFirst = (rooms: TTRoom[], ctx: AskTTContext) =>
  [...rooms].sort((a, b) => Number(b.id === ctx.guest?.usualRoomId) - Number(a.id === ctx.guest?.usualRoomId));
const roomLabel = (r: TTRoom, ctx: AskTTContext) =>
  r.id === ctx.guest?.usualRoomId ? `${r.name} (your usual)` : r.name;

// ── Availability ─────────────────────────────────────────────────────────────
const answerDates = (
  dates: string[],
  past: string[],
  ctx: AskTTContext,
  room: TTRoom | null,
  party: number | null,
  asked: Asked = JUST_LOOKING,
): TTReply => {
  const nice = (key: string) => niceDay(key, ctx.today);
  const lines: string[] = [];
  const actions: TTAction[] = [];
  if (past.length > 0 && dates.length === 0) {
    return {
      lines: [`${past.length === 1 ? nice(past[0]) + " has" : "Those nights have"} already passed. Which dates are you thinking of next?`],
      actions: [{ kind: "ask", label: "This weekend", query: "this weekend" }],
    };
  }
  if (past.length > 0) lines.push(`${plural(past.length, "night")} you mentioned ${past.length === 1 ? "has" : "have"} already passed, so I've left ${past.length === 1 ? "it" : "them"} out.`);

  const askedNights = dates.slice(0, MAX_NIGHTS);
  // Said FIRST, before which rooms are free: a returning guest asking for
  // "Nov Mon-Tue" may not notice Thanksgiving week is in it, and TT's button
  // goes straight to Review Request. Review asks again; this is the earlier,
  // cheaper moment to notice (2026-10-05).
  const holidays = askedNights.filter((k) => usHolidayOn(k));
  if (holidays.length > 0) {
    lines.push(
      `Heads up — ${holidays.map((k) => `${nice(k)} is ${holidayLabel(usHolidayOn(k)!)}`).join(", ")}, a US holiday. Make sure you mean to stay ${holidays.length === 1 ? "that night" : "those nights"}.`,
    );
  }
  if (dates.length > MAX_NIGHTS) lines.push(`That's ${dates.length} nights — I've looked at the first ${MAX_NIGHTS}. The calendar shows the rest.`);

  // The rooms this question is about: the one named, else every room that
  // fits the party.
  const scope = room ? [room] : roomsFitting(ctx.rooms, party);
  if (party != null && !room && scope.length === 0) {
    return {
      lines: [`No single room here sleeps ${party}. ${ctx.hostFirstName} can tell you how to split the party across two rooms.`],
      actions: [chat(ctx)],
    };
  }
  if (party != null && !room) lines.push(`For ${plural(party, "guest")}: ${names(scope)}.`);
  const scopeIds = new Set(scope.map((r) => r.id));
  const freeIn = (key: string) => ctx.freeRoomsOn(key).filter((r) => scopeIds.has(r.id));

  const soldOut: string[] = [];
  for (const run of runsOf(askedNights)) {
    const span = run.length === 1 ? nice(run[0]) : `${nice(run[0])} – ${nice(run[run.length - 1])}`;
    const perNight = run.map((k) => ({ key: k, free: freeIn(k) }));
    const wholeStay = usualFirst(scope, ctx).filter((r) => perNight.every((n) => n.free.some((f) => f.id === r.id)));
    const fullNights = perNight.filter((n) => n.free.length === 0).map((n) => n.key);
    soldOut.push(...fullNights);
    const nightsWord = plural(run.length, "night");

    if (wholeStay.length > 0) {
      lines.push(
        room
          ? `${span} (${nightsWord}): ${room.name} is free ✓`
          : `${span} (${nightsWord}): free for the whole stay — ${wholeStay.map((r) => roomLabel(r, ctx)).join(", ")}.`,
      );
      const forSpan = askedNights.length > run.length ? ` for ${span}` : "";
      wholeStay.slice(0, 3).forEach((r) => actions.push(pick(ctx, r.name + forSpan, run, r.id, asked)));
      if (!room && wholeStay.length > 1) actions.push(pick(ctx, "any room" + forSpan, run, null, asked));
    } else if (fullNights.length === 0) {
      // Every night has a room, just not the same one. Two stays, said so
      // (TIBOOK.md rule 2) — the guest is not told "nothing is free".
      lines.push(`${span}: there's a room every night, but no one room for all ${nightsWord} — you'd move once. ${perNight.map((n) => `${nice(n.key)}: ${names(n.free)}`).join(" · ")}.`);
      actions.push(pick(ctx, `these ${nightsWord}`, run, null));
    } else if (fullNights.length === run.length) {
      lines.push(room ? `${span}: ${room.name} is taken.` : `${span}: sold out, I'm sorry.`);
      if (room) {
        const others = ctx.rooms.filter((r) => r.id !== room.id && run.every((k) => ctx.freeRoomsOn(k).some((f) => f.id === r.id)));
        if (others.length > 0) {
          lines.push(`Free instead for those nights: ${names(others)}.`);
          usualFirst(others, ctx).slice(0, 2).forEach((r) => actions.push(pick(ctx, r.name, run, r.id, asked)));
        }
      }
    } else {
      const open = perNight.filter((n) => n.free.length > 0);
      lines.push(`${span}: ${room ? `${room.name} is taken` : "sold out"} on ${fullNights.map(nice).join(", ")}. Free: ${open.map((n) => `${nice(n.key)} (${names(n.free)})`).join(" · ")}.`);
      const openKeys = open.map((n) => n.key);
      // A Book button only for nights that are still one stay; free nights
      // with a sold-out one between them go to the calendar, which splits them.
      const oneRun = runsOf(openKeys).length === 1;
      actions.push(pick(ctx, `the ${plural(open.length, "free night")}`, openKeys, room && oneRun ? room.id : null, asked));
    }
  }
  // A night nobody can have is still worth the host knowing about: the wish
  // list is how a guest says "tell me if this opens up". Added for them, not
  // described (rule 5).
  if (soldOut.length > 0) {
    actions.push({ kind: "wish", label: `★ Wish list the ${plural(soldOut.length, "full night")}`, dates: soldOut });
  }
  return { lines, actions };
};

// ── Booking ──────────────────────────────────────────────────────────────────
//
// The guest asked to BOOK, with dates. When one room is free for the whole
// stay — the one they named, their usual, or the only one that fits — TT
// starts the booking straight away (`book`), and the sheet asks for whatever
// is still missing. Anything else is the availability answer with Book
// buttons on it, so a taken room or a split stay is explained exactly as it
// always has been.
const answerBooking = (
  dates: string[],
  past: string[],
  ctx: AskTTContext,
  room: TTRoom | null,
  asked: Asked,
): TTReply => {
  const party = asked.party;
  if (room && party != null && maxGuestsOf(room) < party) {
    const fit = roomsFitting(ctx.rooms, party).filter((r) => dates.length > 0 && dates.every((k) => ctx.freeRoomsOn(k).some((f) => f.id === r.id)));
    return {
      lines: [
        `${room.name} sleeps up to ${maxGuestsOf(room)}, so it can't take ${party}.`,
        fit.length > 0 ? `Free for ${plural(party, "guest")} on those nights: ${names(fit)}.` : `${ctx.hostFirstName} can help you split the party across two rooms.`,
      ],
      actions: fit.length > 0 ? fit.slice(0, 3).map((r) => pick(ctx, r.name, dates, r.id, asked)) : [chat(ctx)],
    };
  }
  const choice = past.length === 0 ? chooseRoom(dates, ctx, room, party) : { kind: "none" as const };
  if (choice.kind === "room") {
    const r = choice.room;
    const alt = asked.alt && asked.alt.length === dates.length - 1 ? asked.alt : undefined;
    return {
      lines: [`${r.name} is free — ${stayLine(dates)}. Let's book it.`],
      actions: [],
      book: { roomId: r.id, dates, party, ...(alt ? { alt } : {}) },
    };
  }
  if (choice.kind === "choose") {
    return {
      lines: [`${stayLine(dates)}. Free for the whole stay: ${choice.rooms.map((r) => roomLabel(r, ctx)).join(", ")}. Which room would you like?`],
      actions: [
        ...usualFirst(choice.rooms, ctx).slice(0, 5).map((r) => pick(ctx, r.name, dates, r.id, asked)),
        { kind: "ask", label: "Compare the rooms", query: party ? `rooms for ${party} guests` : "rooms" },
      ],
    };
  }
  return answerDates(dates, past, ctx, room, party, asked);
};

// "Anything in November?" — the month at a glance, never thirty buttons.
const answerMonth = (nights: string[], ctx: AskTTContext, room: TTRoom | null): TTReply => {
  const month = format(parseISO(nights[0]), "MMMM");
  const free = (k: string) => ctx.freeRoomsOn(k).filter((r) => !room || r.id === room.id).length > 0;
  const full = nights.filter((k) => !free(k));
  const nice = (k: string) => format(parseISO(k), "MMM d");
  const who = room ? room.name : "a room";
  return {
    lines: [
      full.length === 0
        ? `${month}: ${who} is free every night ✓`
        : full.length === nights.length
          ? `${month}: ${room ? `${room.name} is taken` : "sold out"} every night, I'm sorry.`
          : `${month}: ${who} is free on ${nights.length - full.length} of ${nights.length} nights. Taken: ${runsOf(full).map((r) => (r.length === 1 ? nice(r[0]) : `${nice(r[0])}–${format(parseISO(r[r.length - 1]), "d")}`)).join(", ")}.`,
      `Tell me the nights — like “${format(parseISO(nights[0]), "MMM d")}-${format(addDays(parseISO(nights[0]), 2), "d")}” — and I'll book them.`,
    ],
    // Only house-wide sold-out nights: the wish list says "tell me if a room
    // opens", and a night only the named room is taken on has rooms open.
    actions: !room && full.length > 0 ? [{ kind: "wish", label: `★ Wish list the ${plural(full.length, "full night")}`, dates: full }] : [],
  };
};

// ── Rooms ────────────────────────────────────────────────────────────────────
const answerRoom = (room: TTRoom, ctx: AskTTContext): TTReply => {
  const facts = getRoomFacts(room.airbnbUrl);
  const lines: string[] = [];
  if (facts) {
    lines.push(`${room.name} sleeps up to ${facts.maxGuests} · ${facts.beds.map((b) => b.label).join(" + ")}.`);
    lines.push(facts.bathroom.replace(/ /g, " ") + ".");
    lines.push(facts.privacy + ".");
    lines.push(facts.highlights.join(" · "));
  } else {
    lines.push(`${room.name} is one of the ${ctx.rooms.length} rooms. ${ctx.hostFirstName} can tell you more about it.`);
  }
  const rate = rateLine(room, ctx);
  if (rate) lines.push(rate);
  return {
    lines,
    actions: [
      { kind: "photos", label: `See ${room.name}'s photos`, roomId: room.id },
      { kind: "room", label: `Show ${room.name}'s free nights`, roomId: room.id },
      { kind: "ask", label: `Is ${room.name} free this weekend?`, query: `${room.name} this weekend` },
      ...(ctx.reviews?.rooms[room.id] ? [reviewsOf(room)] : []),
    ],
    // A room the facts table does not know is one TT could not describe.
    answered: !!facts,
  };
};

// ── What guests say ──────────────────────────────────────────────────────────
//
// Only what the host PUBLISHED (see `reviews` on the context): Claude drafts
// it from the AirBnB reviews, the host reads and edits it in TiMag. TT adds
// nothing of its own — a guest choosing a room on the strength of a review
// must be reading what the house stands behind.
const REVIEW_WORDS =
  /\b(?:reviews?|reviewed|ratings?|rated|stars|feedback|testimonials?)\b|\bwhat (?:do|did|have) (?:other |previous |past |former )?(?:guests|people) (?:say|said|think|thought|write|written|like|liked)\b/;
const askedAboutReviews = (q: string) => REVIEW_WORDS.test(q.toLowerCase());

const reviewsOf = (room: TTRoom): TTAction => ({ kind: "ask", label: `What guests say about ${room.name}`, query: `${room.name} reviews` });

const ratingLine = (r: TTReviews | undefined): string | null =>
  r?.rating && r.count ? `Rated ${r.rating} ★ across ${plural(r.count, "AirBnB review")}.` : null;

const answerReviews = (ctx: AskTTContext, room: TTRoom | null): TTReply => {
  const r = ctx.reviews;
  const roomsWithReviews = ctx.rooms.filter((x) => r?.rooms[x.id]);
  if (room) {
    const said = r?.rooms[room.id];
    if (said) {
      return {
        lines: [`What guests say about ${room.name}:`, said],
        actions: [
          { kind: "photos", label: `See ${room.name}'s photos`, roomId: room.id },
          { kind: "room", label: `Show ${room.name}'s free nights`, roomId: room.id },
          ...(r?.house ? [{ kind: "ask" as const, label: "What guests say about the house", query: "reviews" }] : []),
        ],
      };
    }
    // Nothing for this room yet: what there is for the house is still worth
    // saying, but the question was not answered and the host should see it.
    return {
      lines: [
        `I don't have a summary of ${room.name}'s reviews yet.`,
        ...(r?.house ? ["Here's what guests say about the house:", r.house] : [`${ctx.hostFirstName} can tell you what guests think of it.`]),
      ],
      actions: [...roomsWithReviews.slice(0, 3).map(reviewsOf), chat(ctx)],
      answered: false,
    };
  }
  const rating = ratingLine(r);
  if (!r?.house) {
    return {
      lines: [
        ...(rating ? [rating] : []),
        `I don't have a summary of the reviews yet — ${ctx.hostFirstName} can tell you what guests say.`,
      ],
      actions: [...roomsWithReviews.slice(0, 3).map(reviewsOf), chat(ctx)],
      answered: false,
    };
  }
  return {
    lines: [...(rating ? [rating] : []), "What guests say about TT House:", r.house],
    // Each room's own summary one tap away, so a guest weighing two rooms
    // does not have to type the question twice.
    actions: roomsWithReviews.slice(0, 5).map(reviewsOf),
  };
};

const answerRooms = (ctx: AskTTContext, party: number | null): TTReply => {
  const fit = roomsFitting(ctx.rooms, party);
  if (fit.length === 0) {
    return { lines: [`No single room here sleeps ${party}. ${ctx.hostFirstName} can help you split the party across two.`], actions: [chat(ctx)] };
  }
  return {
    lines: [
      party != null ? `For ${plural(party, "guest")}:` : `There are ${ctx.rooms.length} rooms:`,
      ...fit.map((r) => {
        const f = getRoomFacts(r.airbnbUrl);
        return f ? `${r.name} — up to ${f.maxGuests}, ${f.bathroom.startsWith("Shared") ? "shared bathroom" : "private bathroom"}` : r.name;
      }),
    ],
    actions: fit.slice(0, 4).map((r) => ({ kind: "ask" as const, label: `About ${r.name}`, query: r.name })),
  };
};

// ── What is in the rooms ─────────────────────────────────────────────────────
//
// Things guests ask after, each checked against what every room's LISTING
// says (roomFacts.ts) — TT says what the listings say and no more. One with no
// `listed` pattern is something no listing mentions: TT names it and hands it
// to the host, so the guest knows they were understood and the host's log
// shows which thing is being asked about (it used to read "I'm not sure I
// understood that" for a towel).
//
// Order matters: "hair dryer" and "body wash" before the washer and dryer.
interface Amenity {
  asked: RegExp;
  label: string;
  listed?: RegExp;
  // A basic every guest expects. One listing mentioning it is not the others
  // going without, so a partial match is left for the host to confirm.
  basic?: boolean;
}
const AMENITIES: Amenity[] = [
  { asked: /\b(?:wi-?fi|internet)\b/i, label: "wifi", listed: /wifi/i },
  { asked: /\b(?:air ?con\w*|a\/c|ac|cooling)\b/i, label: "air conditioning", listed: /air conditioning/i },
  { asked: /\b(?:heat\w*|cold)\b/i, label: "heating", listed: /heating/i },
  { asked: /\b(?:tv|television|netflix|streaming)\b/i, label: "a TV", listed: /\btv\b/i },
  { asked: /\b(?:work from|working from|work remotely|desk|workspace|office|zoom)\b/i, label: "a dedicated workspace", listed: /workspace/i },
  { asked: /\bfans?\b/i, label: "a fan", listed: /\bfans?\b/i },
  { asked: /\b(?:locks?|lockable|locked)\b/i, label: "a lock on the door", listed: /lock on the door/i },
  { asked: /\b(?:balcony|backyard|yard|garden|patio|outdoor)\b/i, label: "outdoor space", listed: /backyard|balcony/i },
  { asked: /\b(?:towels?|linens?|sheets|bedding)\b/i, label: "towels and bed linen", listed: /towels|linen/i, basic: true },
  { asked: /\b(?:hair ?dryer|blow ?dryer)\b/i, label: "a hair dryer" },
  { asked: /\b(?:shampoo|conditioner|soap|body wash|toiletries|toothbrush|toothpaste)\b/i, label: "toiletries" },
  { asked: /\b(?:laundry|washer|washing machine|dryer|wash)\b/i, label: "a washer or dryer", listed: /washer|laundry/i },
  { asked: /\b(?:iron|ironing)\b/i, label: "an iron" },
  { asked: /\b(?:blankets?|pillows?|duvet)\b/i, label: "extra blankets and pillows" },
  { asked: /\b(?:closet|wardrobe|hangers?|drawers?)\b/i, label: "a closet" },
  { asked: /\b(?:curtains?|blackout|blinds)\b/i, label: "blackout curtains" },
  { asked: /\bwindows?\b/i, label: "a window" },
  { asked: /\b(?:crib|cot|high ?chair|pack ?n ?play)\b/i, label: "a crib" },
  { asked: /\b(?:gym|fitness)\b/i, label: "a gym" },
  { asked: /\b(?:pool|hot tub|jacuzzi|sauna)\b/i, label: "a pool or hot tub" },
  { asked: /\bbreakfast\b/i, label: "breakfast" },
  { asked: /\b(?:elevator|lift|stairs|wheelchair|accessible|step-free)\b/i, label: "step-free access" },
];

// ── The questions guests text the host ───────────────────────────────────────
const answerTopic = (q: string, ctx: AskTTContext, party: number | null): TTAnswer | null => {
  let category: TTCategory = "other";
  const reply = ((): TTReply | null => {
    const host = ctx.hostFirstName;

    // Staying longer is booking the extra nights — something TT can do now
    // (ttBooking.ts) — not a question about the stay already booked.
    if (has(q, "extend", "stay longer", "extra night", "more nights", "another night")) {
      category = "booking";
      return {
        lines: ["Tell me the extra nights — like “Oct 13-14” — and I'll check your room is free and book them."],
        actions: [{ kind: "bookings", label: "See my stays" }],
      };
    }
    // Cancelling comes before "my booking": "I need to cancel my booking" is
    // asking about the terms, and was being sent to the bookings list alone.
    if (has(q, "cancel", "refund", "change my", "money back")) {
      category = "cancellation";
      const full = ctx.cancellationFullRefundDays;
      const half = ctx.cancellationHalfRefundDays;
      const mine: TTAction[] = has(q, "my booking", "my stay", "my reservation") ? [{ kind: "bookings", label: "Open Your bookings" }] : [];
      return full != null && half != null
        ? { lines: [cancellationHeadline(full) + ".", formatCancellationPolicy(full, half)], actions: [...mine, chat(ctx)] }
        : { lines: [`TT House is flexible when plans change — tell ${host} what's happening and you'll work it out together.`], actions: [...mine, chat(ctx)] };
    }
    if (has(q, "my booking", "my stay", "my reservation", "booked", "confirm")) {
      category = "myBookings";
      return { lines: ["Your stays, holds and wish list are all under Your bookings — just your phone number opens them."], actions: [{ kind: "bookings", label: "Open Your bookings" }] };
    }
    // Bags before and after a stay: nothing on the page says, so it goes to
    // the host — filed under check-in, where the host will look for it.
    if (has(q, "luggage", "bags?\\b", "suitcase", "baggage")) {
      category = "checkIn";
      return { lines: [`${host} can tell you whether your bags can stay before check-in or after check-out.`], actions: [chat(ctx)], answered: false };
    }
    if (has(q, "check-in", "check in", "checkin", "arriv", "check-out", "check out", "checkout", "late", "early", "get in\\b", "let myself in", "keys\\b")) {
      category = "checkIn";
      // The house has no check-in or check-out TIME written down anywhere TT
      // can read. Self check-in is the true answer to "how do I get in"; it
      // is not an answer to "what time", and saying it as one left guests
      // asking twice. The time goes to the host, and the log shows it.
      const askingTime = has(q, "what time", "when", "time", "hour", "o'clock");
      return {
        lines: [
          "Every room has self check-in.",
          "Your door code and the address come in Your bookings once your stay is confirmed.",
          ...(askingTime ? [`${host} will confirm your check-in and check-out times with your booking.`] : []),
          `Arriving after midnight? Book the night BEFORE — 1am Tuesday is the Monday night. If you're unsure, ${host} will sort it out.`,
        ],
        actions: [{ kind: "bookings", label: "Open Your bookings" }, chat(ctx)],
        answered: !askingTime,
      };
    }
    if (has(q, "\\bev\\b", "charger", "charging", "electric car", "tesla")) {
      category = "parking";
      return { lines: [`${houseParking}.`, `None of the listings mention a charger — ${host} will know.`], actions: [chat(ctx)], answered: false };
    }
    if (has(q, "park", "car", "garage", "driv")) {
      category = "parking";
      return { lines: [`${houseParking}.`], actions: [] };
    }
    // How to pay, deposits, fees, receipts: none of it is written anywhere TT
    // reads, and a wrong word about money is the expensive kind. Filed under
    // price for the host, who answers and can teach it.
    if (has(q, "cash", "venmo", "zelle", "paypal", "credit card", "debit", "card\\b", "deposit", "cleaning fee", "fees?\\b", "receipt", "invoice", "how (?:do|can|should) i pay", "payment")) {
      category = "price";
      return {
        lines: [`${host} sorts out payment with you directly — ask about it in a message and you'll have a straight answer.`],
        actions: [chat(ctx, `Ask ${host} about payment`)],
        answered: false,
      };
    }
    // A long stay is two questions: is a room free the whole time (TT can
    // check) and what does it cost (the host's, like every price).
    if (has(q, "month", "monthly", "long term", "long-term", "longer stay", "weekly", "a week")) {
      category = "price";
      return {
        lines: [
          "Tell me the dates — like “Nov 1 for 30 nights” — and I'll check a room is free the whole time.",
          `The rate for a longer stay is agreed with ${host}: send the dates and ${host} will come back with one.`,
        ],
        actions: [chat(ctx, `Ask ${host} about a long stay`)],
      };
    }
    // TiBook takes a request for any number of nights; the host decides each.
    if (has(q, "minimum", "min stay", "maximum", "max stay", "shortest", "longest", "(?:just|only) (?:one|1|a single) night")) {
      category = "booking";
      return {
        lines: [`You can ask for any number of nights here, even one. ${host} confirms each request.`],
        actions: [{ kind: "ask", label: "This weekend", query: "book this weekend" }],
      };
    }
    if (has(q, "price", "cost", "how much", "rate", "cheap", "discount", "pay", "dollar")) {
      category = "price";
      const rates = ctx.rooms.map((r) => rateLine(r, ctx)).filter(Boolean) as string[];
      return rates.length > 0
        ? { lines: [`Your prices, agreed with ${host}:`, ...rates], actions: [chat(ctx, `Talk to ${host} about price`)] }
        : { lines: [`The price is something you settle with ${host} directly — send your dates and ${host} will give you a rate.`], actions: [chat(ctx, `Ask ${host} for a price`)] };
    }
    if (has(q, "kitchen", "cook", "fridge", "refrigerator", "microwave", "coffee", "food", "kettle")) {
      category = "kitchen";
      const withIt = (re: RegExp) => ctx.rooms.filter((r) => getRoomFacts(r.airbnbUrl)?.highlights.some((h) => re.test(h)));
      const fridge = withIt(/fridge/i);
      const micro = withIt(/microwave/i);
      const coffee = withIt(/coffee/i);
      return {
        lines: [
          `${houseKitchen}.`,
          ...(fridge.length ? [`Mini fridge in: ${names(fridge)}.`] : []),
          ...(micro.length ? [`Microwave in: ${names(micro)}.`] : []),
          ...(coffee.length ? [`Coffee maker in: ${names(coffee)}.`] : []),
        ],
        actions: [],
      };
    }
    if (has(q, "bath", "toilet", "shower", "restroom", "bidet", "hot water")) {
      category = "bathroom";
      const shared = ctx.rooms.filter((r) => getRoomFacts(r.airbnbUrl)?.bathroom.startsWith("Shared"));
      const own = ctx.rooms.filter((r) => { const f = getRoomFacts(r.airbnbUrl); return f && !f.bathroom.startsWith("Shared"); });
      return {
        lines: [
          `${houseBathrooms}.`,
          ...(own.length ? [`Private bathroom: ${names(own)}.`] : []),
          ...(shared.length ? [`Shared bathroom with a bathtub and hot water: ${names(shared)}.`] : []),
        ],
        actions: [],
      };
    }
    const amenity = AMENITIES.find((a) => a.asked.test(q));
    if (amenity) {
      category = "amenities";
      // What each room's listing says, all of it: the highlights, and the
      // bathroom and privacy lines ("with a lock on the door", "hot water").
      const listed = (r: TTRoom) => {
        const f = getRoomFacts(r.airbnbUrl);
        return f ? [...f.highlights, f.bathroom, f.privacy].join(" · ") : "";
      };
      const withIt = amenity.listed ? ctx.rooms.filter((r) => amenity.listed!.test(listed(r))) : [];
      // Not when there are no rooms to read: none of none is not "every".
      if (withIt.length > 0 && withIt.length === ctx.rooms.length) return { lines: [`Every room has ${amenity.label} ✓`], actions: [] };
      if (withIt.length > 0) {
        return {
          // A basic (towels) listed for one room is a listing that happened to
          // mention it, not the other rooms going without. Said that way, and
          // left for the host to settle.
          lines: amenity.basic
            ? [`${names(withIt)}'s listing mentions ${amenity.label}. The others don't say — ${host} can confirm.`]
            : [`Rooms with ${amenity.label}: ${names(withIt)}.`],
          actions: amenity.basic ? [chat(ctx)] : [],
          answered: !amenity.basic,
        };
      }
      // Named, so the guest knows TT understood the question and the host's
      // log shows which thing guests are asking after.
      return { lines: [`None of the room listings mention ${amenity.label} — ${host} will know for sure.`], actions: [chat(ctx)], answered: false };
    }
    if (
      has(q, "pet", "dog", "cat", "smok", "party", "parties", "quiet", "loud", "nois", "rule", "visitor", "friend", "kid", "child", "baby", "babies", "infant", "toddler") ||
      /\b(?:have|bring|invite)\b.*\b(?:a guest|guests|someone|somebody|people|partner|over)\b/i.test(q)
    ) {
      category = "houseRules";
      const rules = ctx.houseRules?.trim();
      return rules
        ? { lines: ["The house rules:", rules], actions: [chat(ctx, `Ask ${host} about something else`)] }
        : { lines: [`${host} will tell you straight — just ask.`], actions: [chat(ctx)], answered: false };
    }
    if (has(q, "where", "address", "location", "near", "airport", "transit", "caltrain", "bart", "how far", "distance", "minutes", "sjc", "sfo", "stanford", "google", "apple\\b", "downtown", "safe\\b", "neighbo", "area\\b", "shuttle", "pick me up", "pick up", "uber\\b", "lyft", "bus\\b", "train\\b")) {
      category = "location";
      // "Where is it" is answered: Silicon Valley, address once confirmed.
      // "How far to Stanford", "is the area safe", "a store nearby" are not —
      // TT has no map — and are left in the host's to-teach pile.
      const onlyWhere = !has(q, "how far", "distance", "minutes", "near", "safe", "neighbo", "area", "shuttle", "pick", "uber", "lyft", "bus", "train", "sjc", "sfo", "stanford", "google", "apple", "downtown");
      return {
        lines: [
          "TT House is in Silicon Valley. The exact address comes in Your bookings once your stay is confirmed.",
          onlyWhere
            ? `${host} can tell you how to get here from the airport or the station.`
            : `${host} knows the area best and will answer that — send a message.`,
        ],
        actions: [chat(ctx)],
        answered: onlyWhere,
      };
    }
    if (has(q, "photo", "picture", "pics?\\b", "image", "look like", "see the room", "see inside")) {
      category = "rooms";
      return {
        lines: ["Pick a room to see its photos:"],
        actions: ctx.rooms.slice(0, 5).map((r) => ({ kind: "photos" as const, label: `${r.name} photos`, roomId: r.id })),
      };
    }
    if (has(q, "host", "human", "person", "talk", "call", "text", "contact", "message", "speak")) {
      category = "contactHost";
      return { lines: [`${host} lives here and reads every message personally.`], actions: [chat(ctx, `Message ${host}`)] };
    }
    if (has(q, "book", "reserve", "request", "want a room", "need a room")) {
      category = "booking";
      const usual = ctx.rooms.find((r) => r.id === ctx.guest?.usualRoomId);
      if (ctx.guest) {
        return {
          lines: [
            `Tell me your dates — like “Oct 10-12”, “this weekend” or “Nov 3 for 2 nights” — and I'll book them${usual ? ` in ${usual.name}, or any room that's free` : ""}. You check the request before it's sent.`,
          ],
          actions: [
            ...(ctx.guest.wishList.length > 0 ? [{ kind: "ask" as const, label: "My wish list", query: "my wish list" }] : []),
            { kind: "ask", label: usual ? `${usual.name} this weekend` : "This weekend", query: usual ? `book ${usual.name} this weekend` : "book this weekend" },
          ],
        };
      }
      return {
        lines: [
          "Happy to book it for you. Tell me your dates — like “Oct 10-12”, “this weekend” or “Nov 3 for 2 nights” — and how many of you there are.",
          "You'll see the whole request before anything is sent.",
        ],
        actions: [{ kind: "ask", label: "This weekend", query: "book this weekend" }, { kind: "request", label: "Use the booking form" }],
      };
    }
    if (has(q, "room", "bed", "sleep", "fit", "capacity", "how many") || party != null) {
      category = "rooms";
      return answerRooms(ctx, party);
    }
    // Whole words: "hi" as a prefix greeted a guest asking whether a fee was hidden.
    // Guests here greet in Vietnamese and Spanish too; TT answers in English,
    // but it should know it was greeted.
    if (has(q, "hi\\b", "hello", "hey\\b", "good morning", "good afternoon", "good evening", "hola\\b", "xin ch[aà]o", "ch[aà]o\\b", "bonjour", "yo\\b")) {
      category = "greeting";
      return { lines: ["Hello! Ask me about dates, rooms, parking, check-in — anything about staying here."], actions: [] };
    }
    if (has(q, "thank", "thx", "great", "perfect", "awesome")) {
      category = "thanks";
      return { lines: ["You're welcome. “Your comfort. Our mission.” is TT House's promise to you."], actions: [] };
    }
    return null;
  })();
  return reply ? as(category, reply) : null;
};

// ── Layer 2: what TT will not be asked ───────────────────────────────────────
//
// Checked before ANY other reading of the question, so a date or a room name
// inside it cannot route it to an answer first ("who is in King Oct 10" is a
// question about a person, not about Oct 10). Broad on purpose: a guest whose
// honest question trips one of these is sent to the host, which costs them a
// message; a question about somebody else that slips through costs that
// person their privacy.
//
// No refusal repeats what was asked for, names anyone, or says whether the
// thing asked about exists.

// Other people: who is staying, who booked, other guests, the team.
//
// Each pattern is about SOMEBODY ELSE. The guest's own questions — "3 guests
// staying Oct 10", "are kids allowed", "show me my bookings" — must not trip
// them, so none matches on "guests" or "kids" alone.
const ABOUT_OTHERS = [
  /\bwho(?:m|'s|s)?\b/,
  /\bwhose\b/,
  /\b(?:other|another|previous|next|last|current|existing) (?:guests?|person|people|tenants?|bookings?|reservations?)\b/,
  /\b(?:someone|somebody|anyone|anybody) (?:else|staying|booked|there|in)\b/,
  // "is Eddie staying", "are the Nguyens arriving" — up to three words of
  // somebody between the verb and the stay. Not the guest's own party: "are
  // two of us staying", "are 3 guests arriving".
  /\b(?:is|are|was|were) (?!(?:it|there|you|we|i|my|our|us|two|three|four|five|six|\d+)\b)(?:the )?(?![a-z]* ?(?:guests?|people|of us|adults|kids)\b)[a-z'-]+(?: [a-z'-]+){0,2} (?:staying|booked|checking in|coming|arriving|leaving)\b/,
  /\bnames? of\b/,
  /\bthe (?:guest|person|people|man|woman|guy|lady|family|couple) (?:in|at|staying|who|booked|from)\b/,
  /\bbooked by\b/,
  /\b(?:guest|booking|reservation) (?:list|names?|history|records?)\b/,
  /\b(?:all|every|everyone's|other people's) (?:bookings?|reservations?|stays|guests'?s? (?:names|details|bookings))\b/,
  /\bhow many (?:people|guests|others) (?:are|will be|were) (?:staying|there|here|booked|in)\b/,
  /\b(?:their|his|her) (?:name|names|phone|number|email|booking|bookings|address|details|dates)\b/,
  /\b(?:neighbou?rs?|roommates?|housemates?|tenants?|occupants?)\b/,
  /\b(?:cleaners?|cleaning (?:lady|staff|crew|person)|housekeep\w*|staff|employees?|workers?|team members?|interns?|cohosts?|co-hosts?)\b/,
  /\b(?:last name|surname|full name|maiden name)\b/,
];
// The host's personal life. The page says who the host is and that they live
// here; nothing beyond that.
const hostPersonal = (s: string, hostFirst: string) =>
  new RegExp(`\\b(?:host|owner|${hostFirst.toLowerCase().replace(/[^a-z-]/g, "")})\\b`).test(s) &&
  // Not "kids", "family" or "partner": "does the host allow kids" is a guest
  // asking about their OWN party.
  /\b(?:age|old is|birthday|born|married|wife|husband|girlfriend|boyfriend|salary|income|religion|politics|employer|job|work(?:s)? (?:at|for)|company|school|studies|nationality|from where|where (?:is|does) (?:the )?\w+ (?:from|work|live))\b/.test(s);
// Contact details, anyone's — the host's included. The Message button reaches
// the host without a number ever being shown.
const CONTACT = /\b(?:phone|cell|mobile|whatsapp|telephone|e-?mail|emails|contact (?:info|information|details)|home address|social media|instagram|facebook|linkedin)\b/;
// Codes and passwords. Zip, promo and coupon codes are not secrets.
const SECRETS = /(?<!zip |postal |promo |coupon |discount )\b(?:codes?|pass ?(?:word|code)s?|pins?|combination|combo|lock ?box|key ?pad|key ?safe)\b/;
// The system behind the page, and attempts to talk TT out of these rules.
const SYSTEM = [
  /\b(?:api|apis|api key|backend|back-end|server|servers|database|databases|db|mongo\w*|graphql|endpoint|admin\w*|tokens?|jwt|credentials?|source code|env|\.env|environment variables?|secrets?|ip address|hack\w*|exploit\w*|vulnerab\w*|sql|json|aws|ec2|vite|config\w*|devtools|dev tools|console|debug\w*|localstorage|cookies?|user ?agent)\b/,
  /\b(?:prompt|system prompt|your (?:rules|instructions|code|programming)|how (?:are|were) you (?:built|made|programmed|coded))\b/,
  /\b(?:ignore|disregard|forget|override|bypass) (?:all |the |your |any |previous |prior |above )*(?:rules|instructions|prompts?|restrictions|guidelines)\b/,
  /\b(?:pretend|act as|you are now|roleplay|role-play|jailbreak|developer mode|dan mode)\b/,
];

const privacyRefusal = (q: string, ctx: AskTTContext): TTAnswer | null => {
  const s = q.toLowerCase();
  const host = ctx.hostFirstName;
  // "Who is the host?" is the one "who" with a public answer: the host's
  // name and face are at the top of the page.
  if (/^\W*who(?:'s| is)(?: the| your| my)? (?:host|owner)\W*$/.test(s)) {
    return as("contactHost", { lines: [`Your host is ${host}, who lives here.`], actions: [chat(ctx, `Message ${host}`)] });
  }
  if (SYSTEM.some((re) => re.test(s))) {
    return as("privacy", {
      lines: [
        "That's not something I can help with. I'm TT House's booking helper — I can tell you about the rooms, which nights are free, and staying here.",
      ],
      actions: [{ kind: "ask", label: "What's free this weekend?", query: "this weekend" }],
    });
  }
  if (SECRETS.test(s)) {
    return as("privacy", {
      lines: [
        "I never give out door codes, passwords or PINs.",
        "Once your stay is confirmed, your own check-in details are in Your bookings, opened with your phone number.",
      ],
      actions: [{ kind: "bookings", label: "Open Your bookings" }],
    });
  }
  if (CONTACT.test(s)) {
    return as("privacy", {
      lines: [`I don't share anyone's contact details. To reach ${host}, send a message here — it goes straight to ${host}.`],
      actions: [chat(ctx, `Message ${host}`)],
    });
  }
  // "What did previous guests say about King?" reads as a question about
  // other guests, and is really one about the room. Let it through to the
  // reviews — unless it asks WHO, or for names, which are still refused.
  const aboutReviews = askedAboutReviews(s) && !/\bwho|\bnames?\b/.test(s);
  if ((ABOUT_OTHERS.some((re) => re.test(s)) && !aboutReviews) || hostPersonal(s, host)) {
    return as("privacy", {
      lines: [
        "I keep everyone at TT House private — guests, the host and the team. I can't say who is staying, who booked, or anything about them.",
        "I can tell you which rooms are free on your dates.",
      ],
      actions: [{ kind: "ask", label: "What's free this weekend?", query: "this weekend" }],
    });
  }
  return null;
};

// ── Layer 3: nothing private leaves, whatever produced it ────────────────────
//
// Shapes, not values: TT does not hold the door codes to look for, which is
// the point of layer 1. A house-rules note the host typed with a number in it
// is the case this is mostly for.
const SCRUBS: RegExp[] = [
  /\b\d{3,8}#/g, // a door code: "1224#"
  /[^\s@]+@[^\s@]+\.[^\s@]+/g, // an email
  /\bhttps?:\/\/\S+|\bwww\.\S+/gi, // a link
  /\b\d{1,3}(?:\.\d{1,3}){3}(?::\d+)?\b/g, // an IP address
  /(?:\+?\d[\s().-]*){7,}\d/g, // a phone number, or any long run of digits
];
export const scrub = (text: string) => SCRUBS.reduce((t, re) => t.replace(re, "(hidden)"), text);
const scrubAction = (a: TTAction): TTAction =>
  a.kind === "ask" ? { ...a, label: scrub(a.label), query: scrub(a.query) } : { ...a, label: scrub(a.label) };

export interface AskOptions {
  // The guest said they want to book in the turn before this one ("I'd like
  // to book"), so dates on their own now mean "book these".
  booking?: boolean;
}

const answer = (query: string, ctx: AskTTContext, opts: AskOptions): TTAnswer => {
  const q = query.trim();
  const usual = ctx.rooms.find((r) => r.id === ctx.guest?.usualRoomId) ?? null;
  // "my usual room", "same room as last time", "King again" — a returning
  // guest saying which room without naming it.
  const room = roomAsked(q, ctx.rooms) ?? (usual && has(q, "usual", "same room", "my room", "again", "as last time") ? usual : null);
  const party = partySizeAsked(q);
  // Their wish list: the nights they already told the house they wanted. TT
  // checks them all at once, which is the shortest way from "I wanted these"
  // to a request for them.
  if (ctx.guest && has(q, "wish")) {
    if (ctx.guest.wishList.length === 0) {
      return as("wishList", {
        lines: ["Your wish list is empty. Tell me the dates you'd like — “Oct 10-12”, “Nov Mon-Tue” — and I'll check them."],
        actions: [{ kind: "ask", label: "This weekend", query: "this weekend" }],
      });
    }
    return as("wishList", answerDates(ctx.guest.wishList, [], ctx, room, party));
  }
  // Dates first: "is King free Oct 10" is a question about Oct 10, with King
  // narrowing it. Stripping the party size first keeps "3 people" from being
  // read as anything else.
  //
  // A stay written with its check-out ("Oct 20 to Oct 23", "Nov 3 for 2
  // nights") is read as one first: the plain parser sees two loose days there.
  const stay = readStay(q, ctx.today);
  const { dates, past } = stay ?? datesAsked(q, ctx.today);
  if (dates.length > 0 || past.length > 0) {
    const booking = !!opts.booking || wantsToBook(q);
    // A stay read from its check-out day is unambiguous; "Oct 10-12" is not.
    const asked: Asked = { booking, party, alt: stay ? null : checkoutReading(q, dates) };
    return booking
      ? as("booking", answerBooking(dates, past, ctx, room, asked))
      : as("availability", answerDates(dates, past, ctx, room, party, asked));
  }
  // A month on its own. Only with a word about staying, or alone: "may" is
  // also a verb, and "May I bring a dog?" is about the dog.
  const month = monthAsked(q, ctx.today);
  if (month && (has(q, "free", "availab", "open", "vacan", "book", "stay", "room", "anything") || q.split(/\s+/).length <= 3)) {
    return as("availability", answerMonth(month, ctx, room));
  }
  // Before the room and the price: "King reviews" is not a tour of King, and
  // "rated" begins with "rate", which the price question would take.
  if (askedAboutReviews(q)) return as("reviews", answerReviews(ctx, room));
  if (room && !has(q, "park", "cancel", "refund", "price", "cost", "how much", "rate")) return as("rooms", answerRoom(room, ctx));
  const topic = answerTopic(q, ctx, party);
  if (topic) return topic;
  // Not understood. Said plainly, and the guest is handed to the host with
  // their question rather than told to rephrase it.
  return as("other", {
    lines: [`I'm not sure I understood that. ${ctx.hostFirstName} can answer it — or try dates like “Oct 10-12”, a room name, or “parking”.`],
    actions: [chat(ctx, `Ask ${ctx.hostFirstName}`)],
    answered: false,
  });
};

// The only way in. The guard first, then the answer, then the scrub — no
// caller can reach `answer` without both.
export const askTT = (query: string, ctx: AskTTContext, opts: AskOptions = {}): TTAnswer => {
  const q = query.trim();
  if (!q) return { lines: [], actions: [], category: "other", answered: false };
  const a = privacyRefusal(q, ctx) ?? answer(q, ctx, opts);
  return { ...a, lines: a.lines.map(scrub), actions: a.actions.map(scrubAction) };
};

// Suggested first questions, shown before anything is typed.
export const ttStarters = (ctx: AskTTContext): TTAction[] => {
  const g = ctx.guest;
  if (g) {
    // A returning guest came to book. Their usual room and their wish list
    // lead, ready to check, rather than the questions a stranger has.
    const usual = ctx.rooms.find((r) => r.id === g.usualRoomId);
    return [
      ...(g.wishList.length > 0 ? [{ kind: "ask" as const, label: `My wish list (${plural(g.wishList.length, "night")})`, query: "my wish list" }] : []),
      usual
        ? { kind: "ask" as const, label: `${usual.name} this weekend`, query: `${usual.name} this weekend` }
        : { kind: "ask" as const, label: "This weekend", query: "this weekend" },
      usual
        ? { kind: "ask" as const, label: `${usual.name} next weekend`, query: `${usual.name} next weekend` }
        : { kind: "ask" as const, label: "Next weekend", query: "next weekend" },
      { kind: "bookings", label: "My bookings" },
      ...reviewStarter(ctx),
      chat(ctx, `Message ${ctx.hostFirstName}`),
    ];
  }
  return newGuestStarters(ctx);
};

// Offered only when there is something to show: a button that answers "I
// don't have that yet" is a button that wastes a guest's tap.
const reviewStarter = (ctx: AskTTContext): TTAction[] =>
  ctx.reviews?.house || ratingLine(ctx.reviews) ? [{ kind: "ask", label: "What guests say", query: "reviews" }] : [];

const newGuestStarters = (ctx: AskTTContext): TTAction[] => [
  // First: TT can book now, and saying so is the quickest way in.
  { kind: "ask", label: "Book a stay", query: "I'd like to book a stay" },
  { kind: "ask", label: "Anything free this weekend?", query: "this weekend" },
  { kind: "ask", label: "Which rooms fit 2?", query: "2 guests" },
  { kind: "ask", label: "Parking", query: "parking" },
  { kind: "ask", label: "Check-in", query: "check in" },
  { kind: "ask", label: "Cancellation", query: "cancel" },
  ...reviewStarter(ctx),
  chat(ctx, `Message ${ctx.hostFirstName}`),
];
