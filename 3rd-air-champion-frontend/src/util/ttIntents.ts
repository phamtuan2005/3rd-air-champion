import { parseDateText } from "./dateText";

// What TT understands, beyond names.
//
// The header's one box began as a filter, became a search, and was named TT,
// the house's assistant (2026-10-02). Anh-Tuan's point about it: "with this
// new design, I can navigate to what I need in a much faster and more
// convenient way" — and then the list of what still needed a button: a date,
// the screens themselves, an AirBnB reservation code, and a real question.
// These are the rules for the first three and the hand-off for the fourth.
//
// Pure, so each rule is pinned by a test. A box that guesses wrong is worse
// than a menu: it sends the host somewhere they did not ask to go.

// ── Screens ─────────────────────────────────────────────────────────────────

export interface TTScreen {
  key: string;
  // What the menu calls it, so TT and the menu use one name.
  label: string;
  // What it is for, under the name.
  hint: string;
  // Other words a host might type for it.
  words: string[];
}

export const TT_SCREENS: TTScreen[] = [
  { key: "book", label: "Book a stay", hint: "Add a booking", words: ["booking", "new booking", "reserve", "add stay"] },
  { key: "requests", label: "Requests", hint: "Booking requests from TiBook", words: ["booking requests", "tibook requests", "wish list"] },
  { key: "messages", label: "Messages", hint: "What guests have written", words: ["inbox", "guest messages", "chat"] },
  { key: "blockAirbnb", label: "Block AirBnB", hint: "Nights to block on AirBnB", words: ["airbnb block"] },
  { key: "checkAirbnb", label: "Check AirBnB", hint: "AirBnB stays missing a payout", words: ["airbnb payout", "payouts", "airbnb check"] },
  { key: "blockRooms", label: "Block Rooms", hint: "Take a room off sale", words: ["room block", "unblock"] },
  { key: "todo", label: "To Do", hint: "Today's reminders and tasks", words: ["todo", "tasks", "reminders", "to-do"] },
  { key: "clean", label: "Clean", hint: "Cleaning rota, hours and pay", words: ["cleaning", "cleaners", "rota", "cleaner pay"] },
  { key: "urgent", label: "Urgent Action", hint: "What needs doing now", words: ["urgent", "action"] },
  { key: "staffing", label: "Staffing", hint: "The team, their hours and payroll", words: ["staff", "team", "hours", "payroll", "paycheck"] },
  { key: "stats", label: "Stats", hint: "Occupancy, profit and open nights", words: ["statistics", "occupancy", "profit", "availability", "trend"] },
  { key: "visitors", label: "TiBook visitors", hint: "Who has looked at TiBook", words: ["visitors", "tibook visits", "traffic"] },
  { key: "misc", label: "Misc", hint: "Other expenses", words: ["expenses", "miscellaneous", "costs"] },
  { key: "charges", label: "Charges", hint: "Fees with no stay, such as a cancellation", words: ["fees", "cancellation", "charge"] },
  { key: "rates", label: "Rates", hint: "Guest and room rates", words: ["prices", "pricing", "rate"] },
  { key: "reminderTemplate", label: "Reminder template", hint: "The text a guest gets the day before", words: ["template", "reminder message", "reminder text"] },
  { key: "bookingTemplate", label: "Booking template", hint: "The confirmation text for a booking", words: ["template", "confirmation message", "booking message"] },
];

/**
 * The screens a typed word means.
 *
 * A word matches the START of a word in the screen's name or its other words —
 * "stat" finds Stats, "pay" finds Staffing through payroll — never the middle,
 * so "ate" does not find Rates. Two letters at least: one letter matches a
 * third of the menu.
 */
export const screensMatching = (query: string): TTScreen[] => {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const starts = (phrase: string) => {
    const p = phrase.toLowerCase();
    return p.startsWith(q) || p.split(/[\s-]+/).some((w) => w.startsWith(q));
  };
  return TT_SCREENS.filter((s) => starts(s.label) || s.words.some(starts));
};

// ── A date ──────────────────────────────────────────────────────────────────

/**
 * The day a query names, as yyyy-MM-dd, or null when it is not a date.
 *
 * Read by the same parser TiBook and the booking modal use, so "Oct 19",
 * "10/19", "19 Oct 2026" and "tomorrow" all mean here what they mean there. A
 * day already past is a real answer — the host looks back as often as forward.
 *
 * Only when the WHOLE query is a date. "Susan Oct 19" is a search for Susan
 * with something after it, not a request to leave for October; and a guest
 * called May or June must still be findable by name.
 */
export const dateTyped = (query: string, today: Date = new Date()): string | null => {
  const q = query.trim();
  if (q.length < 3) return null;
  const { dates, past, leftover } = parseDateText(q, today);
  const all = [...past, ...dates].sort();
  if (all.length === 0) return null;
  if (leftover.replace(/[\s,.;-]/g, "") !== "") return null;
  return all[0];
};

// ── A question ──────────────────────────────────────────────────────────────

/**
 * Whether to offer the query to TT as a question.
 *
 * A name is a word or two; a question is a sentence. So: a question mark, or
 * three words and more — or anything of three letters or more that found
 * nothing at all, since "nothing matches" is a dead end and "ask TT" is not.
 */
export const worthAsking = (query: string, foundAnything: boolean): boolean => {
  const q = query.trim();
  if (q.length < 3) return false;
  if (q.includes("?")) return true;
  if (q.split(/\s+/).length >= 3) return true;
  return !foundAnything;
};

// ── An AirBnB reservation ───────────────────────────────────────────────────

/** The reservation code and the phone's last four digits, from what AirBnB's feed writes on a booking. */
export const airbnbReservationDetails = (description: string | undefined): { code: string; last4: string } => {
  const text = description ?? "";
  return {
    code: text.match(/reservations\/details\/([A-Za-z0-9]+)/)?.[1]?.toUpperCase() ?? "",
    last4: text.match(/Last 4 Digits\)?\s*:?\s*(\d{4})/i)?.[1] ?? "",
  };
};

/**
 * Whether a query is a reservation code or the last four digits of a phone,
 * and matches one of these.
 *
 * A code matches from its start, case ignored, and needs four characters: they
 * all begin "HM", so two letters would match every stay the house has had.
 * The four digits must be exactly four — AirBnB gives no more of the number —
 * so "1234" finds the guest and "123" finds nobody.
 */
export const matchesReservation = (query: string, codes: string[], last4s: string[]): "code" | "last4" | null => {
  const q = query.trim();
  if (/^\d{4}$/.test(q)) return last4s.includes(q) ? "last4" : null;
  if (/^[A-Za-z0-9]{4,}$/.test(q) && codes.some((c) => c.startsWith(q.toUpperCase()))) return "code";
  return null;
};
