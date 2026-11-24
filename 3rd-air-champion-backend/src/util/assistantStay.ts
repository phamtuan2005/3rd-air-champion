import { addNights } from "./houseNights";

// The rules an AI assistant's booking goes through, kept apart from the
// database so each can be tested on its own (route/assistantRoute is the
// connector that calls them).
//
// The assistant is a stranger to the house. It does not know that dates here
// are UTC-keyed yyyy-MM-dd strings, that a 1am arrival belongs to the night
// before, or that "Oct 10-12" could mean two nights or three. So it is given
// no room to guess: it sends exact check-in and check-out days, and gets back a
// read-back that names every night in words, which the guest sees before
// anything is sent.

/** The longest stay an assistant can ask for or look up in one go. */
export const MAX_NIGHTS = 60;
/** How far ahead an assistant can ask. The calendar holds no prices or blocks further out. */
export const MAX_DAYS_AHEAD = 365;

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;

/** A real yyyy-MM-dd day: "2026-02-30" is refused rather than rolled into March. */
export const isDayKey = (s: unknown): s is string => {
  if (typeof s !== "string" || !DAY_KEY.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
};

/** "Mon, Dec 1" — read by its UTC day, as every date here is keyed. */
export const dayWords = (key: string) =>
  new Date(`${key}T00:00:00Z`).toLocaleDateString("en-US", {
    timeZone: "UTC",
    weekday: "short",
    month: "short",
    day: "numeric",
  });

const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);

export type StayReading = { ok: true; nights: string[] } | { ok: false; error: string };

/**
 * The nights of a stay from its check-in and check-out days. The check-out day
 * is not a night: Dec 1 to Dec 4 is three nights, Dec 1, 2 and 3.
 *
 * Every refusal says what to send instead, because the assistant reads it and
 * tries again — a bare "invalid" leaves it guessing.
 */
export const readStay = (checkIn: unknown, checkOut: unknown, todayKey: string): StayReading => {
  if (!isDayKey(checkIn) || !isDayKey(checkOut))
    return { ok: false, error: "Send check_in and check_out as real calendar days, yyyy-MM-dd (for example 2026-12-01)." };
  const n = daysBetween(checkIn, checkOut);
  if (n < 1)
    return { ok: false, error: "check_out must be at least one day after check_in. The check-out day is the morning the guest leaves." };
  if (checkIn < todayKey)
    return { ok: false, error: `check_in is in the past. Today at the house (Pacific time) is ${todayKey}.` };
  if (daysBetween(todayKey, checkIn) > MAX_DAYS_AHEAD)
    return { ok: false, error: `The house takes requests up to ${MAX_DAYS_AHEAD} days ahead. Ask again for a check_in closer to today.` };
  if (n > MAX_NIGHTS)
    return {
      ok: false,
      error: `A stay can be up to ${MAX_NIGHTS} nights here. For longer, send the first ${MAX_NIGHTS} nights and say in the notes how long the guest wants to stay; the host arranges the rest.`,
    };
  return { ok: true, nights: Array.from({ length: n }, (_, i) => addNights(checkIn, i)) };
};

/** A room by the name TiBook shows, ignoring case and spaces around it. */
export const findRoomByName = <R extends { name: string }>(rooms: R[], name: unknown): R | undefined => {
  if (typeof name !== "string") return undefined;
  const want = name.trim().toLowerCase();
  return rooms.find((r) => r.name.trim().toLowerCase() === want);
};

/** Between 7 and 15 digits, as TT accepts (util/ttBooking phoneLooksReal). */
export const phoneLooksReal = (phone: unknown) => {
  if (typeof phone !== "string") return false;
  const n = phone.replace(/\D/g, "").length;
  return n >= 7 && n <= 15;
};

export interface ReadBackInput {
  roomName: string;
  nights: string[];
  checkOut: string;
  guests: number;
  guestName: string;
  guestPhone: string;
  hostFirstName: string;
  /** "$55–$65", or null when the room has no rate to show a range from. */
  priceRange: string | null;
  /** The cancellation headline, or "" when the host has not set the policy. */
  cancellation: string;
}

/**
 * The request in words, for the assistant to show the guest before sending.
 *
 * Says the first NIGHT by name and what that means for a late arrival. "1am
 * Tuesday" usually means the Monday-night booking, and getting that wrong
 * has already cost the house a room (CLAUDE.md). Spelled out here so it is the
 * guest who catches it, not the assistant who has to know.
 *
 * Never a guest's own rate: the connector does not look a guest up by phone
 * (that would tell a stranger who has stayed here), so the price is the range
 * TiBook shows anyone, and the host texts the exact figure — family rates
 * included, which stay between the host and the family.
 */
export const readBack = (r: ReadBackInput): string[] => {
  const first = r.nights[0];
  const last = r.nights[r.nights.length - 1];
  const n = r.nights.length;
  return [
    `${r.roomName} · ${n} night${n === 1 ? "" : "s"} · check-in ${dayWords(first)}, check-out ${dayWords(r.checkOut)}`,
    n === 1
      ? `The guest sleeps there the night of ${dayWords(first)}.`
      : `The guest sleeps there the nights of ${dayWords(first)} through ${dayWords(last)}.`,
    `Arriving after midnight still counts as the night before: a guest arriving at 1am on ${dayWords(addNights(first, 1))} needs check-in ${dayWords(first)}.`,
    `${r.guests} guest${r.guests === 1 ? "" : "s"} · under ${r.guestName}, ${r.guestPhone}`,
    r.priceRange
      ? `The price is flexible within ${r.priceRange} a night; ${r.hostFirstName} will text the guest one that works for both.`
      : `${r.hostFirstName} will text the guest the price for these nights.`,
    ...(r.cancellation ? [`${r.cancellation}.`] : []),
    `Nothing is booked until ${r.hostFirstName} confirms — the guest will hear back by text.`,
  ];
};
