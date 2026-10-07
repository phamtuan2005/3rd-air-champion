import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns";
import { MONTHS, parseDateText } from "./dateText";
import { getRoomFacts } from "./roomFacts";
import { cancellationHeadline } from "./cancellationPolicy";
import { holidayLabel, usHolidayOn } from "./usHolidays";
import type { AskTTContext, TTRoom } from "./askTT";

// Booking a stay by talking to TT.
//
// Until 2026-10-07 TT could tell a guest which rooms were free and put the
// nights on the calendar, and there it stopped: the guest still had to find
// the selection bar, open Review Request, and fill in the form TT had just
// been told everything for. The house asked for a guest to be able to say
// "book King Oct 10-12 for 2" and have it booked.
//
// Still no model, for the reasons askTT.ts gives. A stay is a room, a run of
// nights, a party size and who to text back — four things, each of which TT
// either read from what the guest typed or asks for in one line. Then it shows
// the whole request back and sends nothing until the guest says so
// (TIBOOK.md rule 3). What goes to the house is the SAME booking request the
// form sends (createBookingRequest), so the host's Requests screen cannot tell
// the two apart and nothing downstream needs a second path.
//
// Pure: the sheet (AskTT.tsx) keeps the draft and calls these.

// ── What the guest asked for ────────────────────────────────────────────────

// Words that mean "book it", not "is it free". A guest asking about THEIR
// booking, or about cancelling one, is not making a new one.
const BOOK_WORDS =
  /\b(?:book|reserve|request|hold)\b|\b(?:i'?d|i would|we'?d|we would) like\b|\b(?:i|we) (?:want|need|wanna)\b|\bcan (?:i|we) (?:get|have|stay|take)\b|\bsign me up\b/i;
const NOT_A_NEW_BOOKING =
  /\bmy (?:booking|bookings|reservation|reservations|stay|stays|request)\b|\bcancel|\brefund|\bbooked\b|\bhow (?:do|can) (?:i|we) book\b/i;
export const wantsToBook = (q: string): boolean => BOOK_WORDS.test(q) && !NOT_A_NEW_BOOKING.test(q);

// Rooms are booked by the NIGHT. The calendar, the cart and every request
// are lists of nights; a guest talks in check-in and check-out days. These
// turn the second into the first.

const pad = (n: number) => String(n).padStart(2, "0");
const keyOf = (d: Date) => format(d, "yyyy-MM-dd");
const nightsFrom = (first: string, count: number) =>
  Array.from({ length: count }, (_, i) => keyOf(addDays(parseISO(first), i)));

const WORD_NUM: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14,
};
const numberOf = (s: string) => WORD_NUM[s.toLowerCase()] ?? Number(s);

// "to", "until", "check out" — the day the guest LEAVES, so not a night.
// "to" is a common word ("I want to book"), which is why a side only counts
// when the text before it already holds a date.
const CHECKOUT = /\b(?:check(?:ing)?[\s-]?out(?:\s+on)?|leav(?:e|ing)(?:\s+on)?|depart(?:ing)?(?:\s+on)?|until|till|til|to)\b/gi;
// "through" — the guest is staying that night too.
const THROUGH = /\b(?:through|thru)\b/gi;
const N_NIGHTS = new RegExp(`\\b(\\d{1,2}|${Object.keys(WORD_NUM).join("|")})\\s*(?:nights?|nts?)\\b`, "i");
const N_WEEKS = /\b(?:(\d{1,2}|one|two|three|four)\s*weeks?|a week)\b/i;

// The first date a piece of text names, from the date parser — or, for the
// right-hand side of "Oct 10 to 12", a bare day number in the left's month.
const firstDate = (text: string, today: Date, after?: string): string | null => {
  const p = parseDateText(text, today);
  const all = [...p.past, ...p.dates].sort();
  if (all.length > 0) return all[0];
  if (!after) return null;
  const bare = text.match(/^\s*(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)?\b/i);
  if (!bare) return null;
  const a = parseISO(after);
  const d = Number(bare[1]);
  // "Oct 30 to 2" runs into the next month.
  const month = d > a.getDate() ? a.getMonth() : a.getMonth() + 1;
  const when = new Date(a.getFullYear(), month, d);
  return when.getDate() === d ? keyOf(when) : null;
};

export interface StayRead {
  // Nights, today or later, ascending and consecutive.
  dates: string[];
  // Nights that have already gone, said rather than dropped (as dateText does).
  past: string[];
}

const split = (nights: string[], todayKey: string): StayRead => ({
  dates: nights.filter((k) => k >= todayKey),
  past: nights.filter((k) => k < todayKey),
});

/**
 * A stay written the way people write stays: "Oct 20 to Oct 23", "from the
 * 20th until the 23rd", "check in Nov 3 check out Nov 5", "Dec 20 through Dec
 * 27", "Nov 3 for 2 nights", "Oct 10 for a week".
 *
 * The date parser reads none of these as a stay: "Oct 20 to Oct 23" came back
 * as two single nights, which TT then offered as two separate one-night stays
 * — the guest asked for three nights and was shown two (2026-10-07). Null when
 * the text is not one of these shapes, so the caller falls back to the plain
 * dates.
 */
export const readStay = (q: string, today: Date): StayRead | null => {
  const todayKey = keyOf(today);
  const text = q.replace(/[–—]/g, "-");

  // "Nov 3 for 2 nights" / "Nov 3 for a week": the count is lifted out
  // first, so its number is not read as a second day of the month.
  const nights = text.match(N_NIGHTS);
  const weeks = text.match(N_WEEKS);
  if (nights || weeks) {
    const count = nights ? numberOf(nights[1]) : 7 * (weeks![1] ? numberOf(weeks![1]) : 1);
    const start = firstDate(text.replace((nights ?? weeks)![0], " "), today);
    if (start && count >= 1 && count <= 90) return split(nightsFrom(start, count), todayKey);
  }

  for (const [re, inclusive] of [[THROUGH, true], [CHECKOUT, false]] as const) {
    re.lastIndex = 0;
    for (let m = re.exec(text); m; m = re.exec(text)) {
      const start = firstDate(text.slice(0, m.index), today);
      if (!start) continue;
      const end = firstDate(text.slice(m.index + m[0].length), today, start);
      if (!end || end <= start) continue;
      const count = differenceInCalendarDays(parseISO(end), parseISO(start)) + (inclusive ? 1 : 0);
      if (count < 1 || count > 90) continue;
      return split(nightsFrom(start, count), todayKey);
    }
  }
  return null;
};

/**
 * The other way to read "Oct 10-12".
 *
 * The date parser reads a dash as every night from the first day to the last
 * — three nights here — and the whole of TiBook agrees with it. A guest
 * booking a hotel often means check in the 10th, check out the 12th: two
 * nights. TT does not guess between them. It books the parser's reading, says
 * the check-out day in so many words, and offers this one on a button.
 */
export const checkoutReading = (q: string, dates: string[]): string[] | null => {
  if (dates.length < 2) return null;
  if (!/\d(?:st|nd|rd|th)?\s*[-–—]\s*\d/.test(q)) return null;
  return dates.slice(0, -1);
};

/**
 * A month named on its own — "anything in November?" — as its nights from
 * today on. Answered as a question about the month, never booked: thirty
 * nights is not a stay anybody asked for.
 */
export const monthAsked = (q: string, today: Date): string[] | null => {
  // A month alone, or with its YEAR ("Jan 2027") — four digits, so "Jan 20"
  // stays a date. Without the year the next such month is meant; with it, that
  // one. "anything in Jan 2027?" used to fall through: the digits after the
  // month read as a day and the month was not taken at all.
  const hit = q
    .toLowerCase()
    .match(new RegExp(`\\b(?:in|during|for|of|this|next)?\\s*(${Object.keys(MONTHS).join("|")})\\b(?:\\s+(\\d{4}))?(?!\\s*\\d)`));
  if (!hit) return null;
  const m = MONTHS[hit[1]];
  const y = hit[2] ? Number(hit[2]) : m < today.getMonth() ? today.getFullYear() + 1 : today.getFullYear();
  const days = new Date(y, m + 1, 0).getDate();
  const todayKey = keyOf(today);
  const out: string[] = [];
  for (let d = 1; d <= days; d++) {
    const k = `${y}-${pad(m + 1)}-${pad(d)}`;
    if (k >= todayKey) out.push(k);
  }
  return out.length > 0 ? out : null;
};

// ── The room ────────────────────────────────────────────────────────────────

export const maxGuestsOf = (room: TTRoom): number => getRoomFacts(room.airbnbUrl)?.maxGuests ?? 4;

const consecutive = (dates: string[]) =>
  dates.every((k, i) => i === 0 || keyOf(addDays(parseISO(dates[i - 1]), 1)) === k);

export type RoomChoice =
  // One room, free every night: book it.
  | { kind: "room"; room: TTRoom }
  // Several free and the guest did not say which: they choose.
  | { kind: "choose"; rooms: TTRoom[] }
  // Not one stay TT can book in a single request.
  | { kind: "none" };

/**
 * Which room a booking goes into, when the guest asked to book.
 *
 * The room they named, if it is free every night and holds the party. Then
 * their usual room, if it is. Then, when exactly one room fits, that one.
 * When several fit TT ASKS: the rooms differ — a shared bathroom, a sofa bed —
 * and picking for a guest who did not say is choosing something they will
 * live with for the stay.
 */
export const chooseRoom = (
  dates: string[],
  ctx: AskTTContext,
  named: TTRoom | null,
  party: number | null,
): RoomChoice => {
  if (dates.length === 0 || !consecutive(dates)) return { kind: "none" };
  const fits = (r: TTRoom) => party == null || maxGuestsOf(r) >= party;
  const freeAll = ctx.rooms.filter((r) => fits(r) && dates.every((k) => ctx.freeRoomsOn(k).some((f) => f.id === r.id)));
  if (named) return freeAll.some((r) => r.id === named.id) ? { kind: "room", room: named } : { kind: "none" };
  const usual = freeAll.find((r) => r.id === ctx.guest?.usualRoomId);
  if (usual) return { kind: "room", room: usual };
  if (freeAll.length === 1) return { kind: "room", room: freeAll[0] };
  if (freeAll.length > 1) return { kind: "choose", rooms: freeAll };
  return { kind: "none" };
};

// ── The conversation ────────────────────────────────────────────────────────

export interface TTBookingDraft {
  // Each booking TT starts gets its own id, so a button left on an earlier
  // message cannot act on a later booking.
  id: number;
  roomId: string;
  dates: string[];
  // The two-night reading of "Oct 10-12", when there is one.
  alt?: string[];
  party: number | null;
  name: string;
  phone: string;
  // The guest said yes to the US holiday nights in the stay.
  holidaysKept: boolean;
}

export type TTBookingStep = "party" | "contact" | "name" | "holiday" | "confirm";

const phoneDigits = (phone: string) => phone.replace(/\D/g, "");
export const phoneLooksReal = (phone: string) => {
  const n = phoneDigits(phone).length;
  return n >= 7 && n <= 15;
};

export const holidaysIn = (dates: string[]) => dates.filter((k) => usHolidayOn(k));

/** What TT still needs before the request can be shown back for sending. */
export const nextStep = (d: TTBookingDraft): TTBookingStep => {
  if (d.party == null) return "party";
  if (!phoneLooksReal(d.phone)) return "contact";
  if (!d.name.trim()) return "name";
  if (!d.holidaysKept && holidaysIn(d.dates).length > 0) return "holiday";
  return "confirm";
};

/**
 * A name and a phone number out of one line — "Mai, 408 555 0123", "I'm Mai
 * Tran and my number is (408) 555-0123".
 *
 * Whatever is not the number and not a filler word is the name. Kept as typed:
 * the host reads it, and "mai tran" is how Mai writes her name.
 */
export const readContact = (text: string): { name: string; phone: string } => {
  // From a "+" or "(" if there is one, so "(408) 555-0123" comes back whole.
  const hit = text.match(/[+(]?\d(?:[\s().-]*\d){6,}/);
  const phone = hit ? hit[0].trim() : "";
  const name = (hit ? text.replace(hit[0], " ") : text)
    .replace(/\b(?:my name is|my name's|name is|name|i am|i'm|im|this is|it's|its|my|phone number|phone|number|cell|mobile|tel|is|and|call me|text me|at|on)\b:?/gi, " ")
    .replace(/[^\p{L}' -]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
  return { name, phone };
};

/** A party size typed on its own — "2", "two", "2 of us", "just me". */
export const readParty = (text: string): number | null => {
  const t = text.trim().toLowerCase();
  if (/^(?:just )?(?:me|myself|only me|1 person|alone)\b/.test(t)) return 1;
  if (/^(?:me and (?:my|a) \w+|the two of us|a couple|couple|us two)\b/.test(t)) return 2;
  const m = t.match(/^(?:we are |we're |there are |there'?ll be )?(\d{1,2}|one|two|three|four|five|six)\b/);
  return m ? numberOf(m[1]) : null;
};

const YES = /^(?:y|yes|yeah|yep|yup|sure|ok|okay|send|send it|confirm|confirmed|go|go ahead|do it|book it|please|yes please|sounds good|perfect|correct|that'?s right|looks good)\b/i;
const NO = /^(?:n|no|nope|cancel|stop|never ?mind|forget it|don'?t)\b/i;
export const readYesNo = (text: string): "yes" | "no" | null =>
  YES.test(text.trim()) ? "yes" : NO.test(text.trim()) ? "no" : null;

// ── What the guest reads ────────────────────────────────────────────────────

const day = (k: string) => format(parseISO(k), "EEE MMM d");
const checkOutOf = (dates: string[]) => keyOf(addDays(parseISO(dates[dates.length - 1]), 1));
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

/** "Check in Sat Oct 10 · check out Tue Oct 13 · 3 nights" — the stay in a guest's words. */
export const stayLine = (dates: string[]) =>
  `Check in ${day(dates[0])} · check out ${day(checkOutOf(dates))} · ${plural(dates.length, "night")}`;

/** The phone as the guest can recognise it without the whole number on screen. */
export const phoneHint = (phone: string) => `phone ending ${phoneDigits(phone).slice(-4)}`;

/**
 * The request, read back in full before it is sent.
 *
 * Everything that goes to the host is here — room, check-in, check-out,
 * nights, party, name, phone — plus what the guest is agreeing to: their own
 * rate if the house has one for them (never a list price, as askTT.ts), and
 * the cancellation terms.
 */
export const summaryLines = (d: TTBookingDraft, room: TTRoom, ctx: AskTTContext): string[] => {
  const rate = ctx.myRates.get(room.id);
  const host = ctx.hostFirstName;
  const holidays = holidaysIn(d.dates);
  return [
    "Here's your request — check it, then I'll send it:",
    `${room.name} · ${stayLine(d.dates)}`,
    `${plural(d.party ?? 1, "guest")} · under ${d.name.trim()}, ${phoneHint(d.phone)}`,
    ...(holidays.length > 0 ? [`Includes ${holidays.map((k) => `${day(k)} (${holidayLabel(usHolidayOn(k)!)})`).join(", ")}.`] : []),
    rate == null
      ? `${host} will text you the price for these nights.`
      : rate === 0
        ? `Family — no charge, as agreed with ${host}.`
        : `Your price: $${rate}/night, as agreed with ${host}.`,
    ...(ctx.cancellationFullRefundDays != null ? [cancellationHeadline(ctx.cancellationFullRefundDays) + "."] : []),
    `Nothing is booked until ${host} confirms — you'll hear back by text.`,
  ];
};

// ── Sending ─────────────────────────────────────────────────────────────────

// What createBookingRequest takes. Built here so the test can pin exactly what
// reaches the host.
export interface TTBookingRequest {
  host: string;
  guestName: string;
  guestPhone: string;
  date: string;
  room: string;
  duration: number;
  numberOfGuests: number;
  notes: string;
}

export const bookingRequestOf = (d: TTBookingDraft, room: TTRoom, hostId: string): TTBookingRequest => ({
  host: hostId,
  guestName: d.name.trim(),
  guestPhone: d.phone.trim(),
  date: d.dates[0],
  room: room.id,
  duration: d.dates.length,
  numberOfGuests: d.party ?? 1,
  // The form writes "Dates from calendar: …"; this says where the request
  // came from, and the stay in the guest's own check-in/check-out terms, so
  // the host reading Requests sees what the guest saw.
  notes: `Requested through Ask TT: ${room.name}, ${stayLine(d.dates)}.`,
});

/**
 * Whether TT's "Send" only pretends.
 *
 * On the dev server it always does unless told otherwise: `/api` there is the
 * PRODUCTION backend (vite.config.ts), and a developer trying TT's booking
 * would be filing real requests into the host's Requests screen. The same
 * rule visit counting and the question log follow. To watch a request land in
 * a LOCAL backend's TiMag, set VITE_TT_SEND_BOOKINGS_IN_DEV=true in
 * .env.development.local.
 */
export const ttBookingIsDryRun = (env: { dev: boolean; sendInDev: boolean }) => env.dev && !env.sendInDev;
