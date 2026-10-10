import { MONTHS, parseDateText } from "./dateText";

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
  { key: "ttQuestions", label: "TT questions", hint: "What guests ask TT, and what it couldn't answer", words: ["questions", "guest questions", "unanswered", "tt log"] },
  { key: "reviews", label: "Guest reviews", hint: "Every review by room — search, add, edit", words: ["reviews", "airbnb reviews", "ratings", "review summary"] },
  { key: "misc", label: "Misc", hint: "Other expenses", words: ["expenses", "miscellaneous", "costs"] },
  { key: "charges", label: "Charges", hint: "Fees with no stay, such as a cancellation", words: ["fees", "cancellation", "charge"] },
  { key: "rates", label: "Rates", hint: "Guest and room rates", words: ["prices", "pricing", "rate"] },
  { key: "reminderTemplate", label: "Reminder template", hint: "The text a guest gets the day before", words: ["template", "reminder message", "reminder text"] },
  { key: "bookingTemplate", label: "Booking template", hint: "The confirmation text for a booking", words: ["template", "confirmation message", "booking message"] },
  // TT's own window, which also carries what TT has cost this month.
  { key: "assistant", label: "Ask TT", hint: "The assistant, and what it has cost this month", words: ["spend", "spending", "api cost", "api credit", "credit", "usage", "tt cost"] },
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
 * Only when the WHOLE query is a date. "Susan Oct 19" is Susan AND a day — see
 * whoAndWhen — not a request to leave for October on its own; and a guest
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

// ── A month, and a name with a time ─────────────────────────────────────────

/** Where the calendar should go: one day, or a whole month (its first day). */
export interface When {
  key: string;
  month: boolean;
}

const MONTH_WORD = new RegExp(`\\b(${Object.keys(MONTHS).join("|")})\\b\\.?(?:\\s+(\\d{4}))?`, "i");

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * A month named on its own — "Dec", "december", "Dec 2027" — as its first day.
 *
 * The date parser reads whole dates and leaves a bare month alone, since a
 * guest writing "December" has not yet said which nights. Here it is enough:
 * the host means the month's page of the calendar. A month already behind us
 * is the one coming round; the month we are in is this one.
 *
 * A guest can be called May, or June. Her name is still found — the box lists
 * the month AND the guest, and Enter takes the guest when the name is exact.
 */
export const monthTyped = (text: string, today: Date = new Date()): string | null => {
  const hit = text.match(MONTH_WORD);
  if (!hit) return null;
  const m = MONTHS[hit[1].toLowerCase()];
  const y = hit[2] ? Number(hit[2]) : m < today.getMonth() ? today.getFullYear() + 1 : today.getFullYear();
  return `${y}-${pad(m + 1)}-01`;
};

/**
 * The day or month a query names, when that is ALL it names.
 *
 * A date is read first ("Oct 19"), then a month alone ("Dec"). Either way the
 * rest of the query must be empty — a name beside it is a different thing, and
 * whoAndWhen reads that.
 */
export const whenTyped = (query: string, today: Date = new Date()): When | null => {
  const date = dateTyped(query, today);
  if (date) return { key: date, month: false };
  const q = query.trim();
  const hit = q.match(MONTH_WORD);
  if (!hit || hit[0].toLowerCase() !== q.toLowerCase()) return null;
  const month = monthTyped(q, today);
  return month ? { key: month, month: true } : null;
};

// Words that carry nothing once the name and the time are taken out: "Susan
// stay in Dec" is Susan and December. Whole words only, so "Austin" survives
// the "in".
const FILLER = /\b(in|on|for|at|during|of|the|a|stay|stays|staying|stayed|booking|bookings|booked|book|visit|visits|visiting|from|next|this|coming|and)\b/gi;

/**
 * A name with a time beside it — "Susan Dec", "King Oct 19", "Susan's stay in
 * December" — split into who to filter the calendar to and where to open it.
 *
 * Anh-Tuan's second example for TT (2026-10-02): "Susan stay in Dec". It is a
 * question the calendar answers on its own, instantly, if the box reads it as
 * a filter and a month rather than handing it to the assistant to look up.
 *
 * Null unless BOTH halves are there. A date alone is whenTyped's; a name alone
 * is a plain search.
 */
export const whoAndWhen = (query: string, today: Date = new Date()): { who: string; when: When } | null => {
  const q = query.trim();
  if (!q) return null;
  let when: When | null = null;
  let rest = "";
  const { dates, past, leftover } = parseDateText(q, today);
  const all = [...past, ...dates].sort();
  if (all.length > 0) {
    when = { key: all[0], month: false };
    rest = leftover;
  } else {
    const hit = q.match(MONTH_WORD);
    const month = hit ? monthTyped(q, today) : null;
    if (!hit || !month) return null;
    when = { key: month, month: true };
    rest = q.replace(hit[0], " ");
  }
  const who = rest
    .replace(/['’]s\b/g, "")
    .replace(FILLER, " ")
    .replace(/[\s,.;:!?-]+/g, " ")
    .trim();
  if (who.length < 2) return null;
  return { who, when };
};

// ── A week of cleaning ──────────────────────────────────────────────────────

// "next week", "this week", "week", or the words for a rota.
const WEEK_WORD = /\b(?:(this|next|coming)\s+)?(?:week['’]?s?|schedule|rota)\b/i;
// What is left of "Henry clean plan for next week" once the week and the
// filler are gone: the cleaner's name, or nothing when the whole week is meant.
const WEEK_FILLER = /\b(clean|cleans|cleaning|cleanings|plan|plans|shift|shifts|work|working|schedule|rota)\b/gi;

/**
 * A week of cleaning — "Henry next week", "next week", "Henry schedule" — as
 * the week to show and whose it is.
 *
 * Anh-Tuan, after TT answered Henry's week through the model: "Henry nxt week
 * schedule would work without API?" It does if the box reads it: the Clean
 * window's Week tab already shows this week and next with no model at all,
 * and it is instant, free, and the same screen the week is arranged on.
 *
 * `who` is left for the caller to match against the cleaners; "" means
 * everyone. The caller decides what to do with a name that is nobody's.
 */
export const weekTyped = (query: string): { offset: 0 | 1; who: string } | null => {
  const hit = query.match(WEEK_WORD);
  if (!hit) return null;
  const offset: 0 | 1 = hit[1] && hit[1].toLowerCase() !== "this" ? 1 : 0;
  const who = query
    .replace(hit[0], " ")
    .replace(/['’]s\b/g, "")
    .replace(WEEK_FILLER, " ")
    .replace(FILLER, " ")
    .replace(/[\s,.;:!?-]+/g, " ")
    .trim();
  return { offset, who };
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

// ── The guest reviews ───────────────────────────────────────────────────────

// Subjects the review stats can count mentions of, by the words a host types for
// them. The keys are the server's (util/reviewStats TOPICS).
const REVIEW_TOPICS: { key: string; pattern: RegExp }[] = [
  { key: "clean", pattern: /\b(clean\w*|spotless|tidy|dirty)\b/i },
  { key: "noise", pattern: /\b(nois\w*|quiet|loud)\b/i },
  { key: "bed", pattern: /\b(beds?|mattress|sleep\w*)\b/i },
  { key: "bathroom", pattern: /\b(bathroom|shower|toilet)\b/i },
  { key: "location", pattern: /\b(location|neighbou?rhood)\b/i },
  { key: "host", pattern: /\bhosts?\b/i },
  { key: "parking", pattern: /\bparking\b/i },
  { key: "smell", pattern: /\b(smell\w*|odou?r)\b/i },
  { key: "value", pattern: /\b(value|price|cheap)\b/i },
];

/**
 * Whether the host is asking about the guest reviews — their ratings, the low
 * ones, what guests say about something — and which subject, if any.
 *
 * Answered by the server's arithmetic (GET /tt-host/reviews/stats), NOT by the
 * model: "what's the average rating for each room" is a sum, and the host did
 * not want to pay for an AI call to add up stars. A review word is required, so
 * "clean" on its own still finds the Clean screen and nothing else.
 */
export const reviewsTyped = (query: string): { topic: string | null } | null => {
  const q = query.trim();
  if (q.length < 4) return null;
  if (!/\b(reviews?|ratings?|rated|stars?|complain\w*|feedback|guests? say|guests? think)\b/i.test(q)) return null;
  return { topic: REVIEW_TOPICS.find((t) => t.pattern.test(q))?.key ?? null };
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
