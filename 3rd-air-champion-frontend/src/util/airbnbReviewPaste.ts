// ONE AirBnB review, as select-all-and-copy gives it, taken apart into who,
// how many stars, when, and the words — by plain rules, no model.
//
// The host pasted a copied review into the one-guest form and it was saved as
// it came (2026-10-07): "Lim 9 years on Airbnb Lim Rating, 5 stars ,· 2 days
// ago …" as the review, with no guest and no stars. One review's layout is
// known (it is the host's own two samples below), so the form reads it when it
// is pasted and fills the fields; the host still sees them before pressing Add.
//
//   Leidy Johanna          ← name (the FIRST line is sometimes cut short)
//   Medellín, Colombia     ← city — or "9 years on Airbnb"
//   Leidy Johanna          ← name again: the reliable copy
//   Rating, 5 stars
//   ,·
//   1 week ago             ← or "February 2025"
//   ,·
//   Stayed one night
//   From the moment we opened the door …
//
// A whole PAGE of reviews is not this function's to read: it says so
// (`several`), and the page goes in the big box to be split.

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

const ym = (year: number, month0: number) => `${year}-${String(month0 + 1).padStart(2, "0")}`;

/**
 * yyyy-MM from a date as AirBnB printed it: "February 2025" as is; "1 week ago",
 * "3 months ago", "yesterday" counted back from `today` (the day of pasting).
 * "" for anything else — no month rather than an invented one. The same rule as
 * the server's (util/reviewSplit monthFromShown), on UTC fields like every date
 * in this app.
 */
export const monthFromShown = (shown: string, today: Date = new Date()): string => {
  const t = shown.trim().toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
  const exact = t.match(/^([a-z]+) (\d{4})$/);
  if (exact) {
    const m = MONTHS.indexOf(exact[1]);
    return m >= 0 ? ym(Number(exact[2]), m) : "";
  }
  if (t === "today" || t === "yesterday") {
    const d = new Date(today.getTime() - (t === "yesterday" ? 86_400_000 : 0));
    return ym(d.getUTCFullYear(), d.getUTCMonth());
  }
  const rel = t.match(/^(a|an|\d+) (day|week|month|year)s? ago$/);
  if (!rel) return "";
  const n = rel[1] === "a" || rel[1] === "an" ? 1 : Number(rel[1]);
  const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  if (rel[2] === "day") d.setUTCDate(d.getUTCDate() - n);
  else if (rel[2] === "week") d.setUTCDate(d.getUTCDate() - 7 * n);
  else if (rel[2] === "month") d.setUTCMonth(d.getUTCMonth() - n);
  else d.setUTCFullYear(d.getUTCFullYear() - n);
  return ym(d.getUTCFullYear(), d.getUTCMonth());
};

export interface PastedReview {
  guestName: string;
  stars: number | null;
  /** The date as printed, "2 days ago". */
  when: string;
  /** yyyy-MM, or "". */
  reviewMonth: string;
  text: string;
}

const RATING = /^rating,?\s*([1-5])\s*stars?$/i;
const PUNCTUATION = /^[\s,.·•|–—-]+$/;
const DATE = /^((a|an|\d+) (day|week|month|year)s? ago|today|yesterday|[a-z]+ \d{4})$/i;
const LABEL = /^(stayed\b.*|show more|show less|translated?\b.*|show original)$/i;

/**
 * The review in a pasted block, or null when it does not look like a copied
 * AirBnB review (no "Rating, N stars" line) — then the text is the host's own
 * and is left exactly as typed. `several` when the block holds more than one.
 */
export const parseAirbnbReview = (pasted: string, today: Date = new Date()): PastedReview | "several" | null => {
  const lines = pasted.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const ratings = lines.map((l, i) => (RATING.test(l) ? i : -1)).filter((i) => i >= 0);
  if (ratings.length === 0) return null;
  if (ratings.length > 1) return "several";
  const at = ratings[0];

  // The line just above the stars repeats the name, whole; the first line may
  // have been cut by the selection. No line above: no name.
  const guestName = at >= 1 && !PUNCTUATION.test(lines[at - 1]) ? lines[at - 1].slice(0, 120) : "";
  const stars = Number(lines[at].match(RATING)![1]);

  let when = "";
  let i = at + 1;
  for (; i < lines.length; i++) {
    const l = lines[i];
    if (PUNCTUATION.test(l) || LABEL.test(l)) continue;
    if (!when && DATE.test(l)) {
      when = l;
      continue;
    }
    break;
  }
  const body: string[] = [];
  for (; i < lines.length; i++) {
    // The host's reply under a review is not the guest's words.
    if (/^response from\b/i.test(lines[i])) break;
    if (LABEL.test(lines[i]) || PUNCTUATION.test(lines[i])) continue;
    body.push(lines[i]);
  }

  return { guestName, stars, when, reviewMonth: monthFromShown(when, today), text: body.join("\n") };
};
