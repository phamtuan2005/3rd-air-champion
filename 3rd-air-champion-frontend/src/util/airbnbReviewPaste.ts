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
// AirBnB's later layout (Gail, Cozy, 2026-10-09) prints the stars as "Rating 5
// out of 5" and the name only ONCE, above the city:
//
//   Gail
//   Waco, TX
//   Rating 5 out of 5
//   ,·
//   Today
//   Anh was friendly, proactive and responsive …
//
// Read as the first layout, it had no rating line, so the whole block was saved
// as the review with no guest and no stars.
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

const RATING = /^rating,?\s*([1-5])\s*(?:stars?|out of 5)$/i;
// The line under a name that is NOT a name: "Waco, TX", "Medellín, Colombia",
// "9 years on Airbnb". A name has no comma.
const PLACE = /,|\bon airbnb\b/i;
const PUNCTUATION = /^[\s,.·•|–—-]+$/;
const DATE = /^((a|an|\d+) (day|week|month|year)s? ago|today|yesterday|[a-z]+ \d{4})$/i;
const LABEL = /^(stayed\b.*|show more|show less|translated?\b.*|show original)$/i;

// The same parts when the copy arrives as ONE line. Pasting on a phone can
// flatten the selection, and the stored text of both broken pastes (Lim
// 2026-10-07, Gail 2026-10-09) reads that way: "Gail Waco, TX Rating 5 out of 5
// ,· Today Anh was friendly …". Line rules alone find no rating line in that.
const INLINE_RATING = /\s*\b(rating,?\s*[1-5]\s*(?:stars?|out of 5))(?=\s|$|[,.·])\s*/gi;
const LEADING_DATE =
  /^((?:a|an|\d+) (?:day|week|month|year)s? ago|today|yesterday|(?:january|february|march|april|may|june|july|august|september|october|november|december) \d{4})\s+(?=\S)/i;
const LEADING_STAYED =
  /^stayed (?:one night|a night|a few nights|\d+ nights|with kids|with a pet|with pets|about a (?:week|month)|over a (?:week|month)|a week|a month|several (?:nights|weeks))\s+(?=\S)/i;

/** Breaks a flattened copy back into the lines AirBnB shows. */
const unflatten = (pasted: string) =>
  pasted.replace(INLINE_RATING, "\n$1\n").replace(/\s*,\s*[·•]\s*/g, "\n,·\n");

/**
 * The guest's name from the line above the stars. As lines, that is the name
 * itself, or — in the later layout — the city, with the name one line higher.
 * Flattened, it is the whole header on one line: "Gail Waco, TX",
 * "Lim 9 years on Airbnb Lim", "Leidy Johanna Medellín, Colombia Leidy Johanna".
 */
const nameFrom = (above: string, higher: string): string => {
  if (!PLACE.test(above)) return above;
  // The old layout repeats the name after the city: take the repeat.
  const afterYears = above.match(/\bon airbnb\s+(.+)$/i);
  if (afterYears) return afterYears[1];
  const words = above.split(/\s+/);
  for (let k = Math.floor(words.length / 2); k >= 1; k--) {
    const tail = words.slice(-k).join(" ");
    // The first word may have been cut by the selection ("eidy Johanna … Leidy
    // Johanna"): it need only END the repeat's first word.
    const head = words.slice(0, k);
    const rest = words.slice(-k);
    if (rest[0].endsWith(head[0]) && head.slice(1).join(" ") === rest.slice(1).join(" ")) return tail;
  }
  // The later layout: the words before the city, taken as the one word before
  // its comma. "San Jose, CA" would leave "Gail San" — the host sees it in the
  // Guest box before pressing Add. Nothing before the city: the line above.
  return above.split(",")[0].split(/\s+/).slice(0, -1).join(" ") || higher;
};

/**
 * The review in a pasted block, or null when it does not look like a copied
 * AirBnB review (no "Rating, N stars" line) — then the text is the host's own
 * and is left exactly as typed. `several` when the block holds more than one.
 */
export const parseAirbnbReview = (pasted: string, today: Date = new Date()): PastedReview | "several" | null => {
  const toLines = (t: string) => t.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  let lines = toLines(pasted);
  if (!lines.some((l) => RATING.test(l))) lines = toLines(unflatten(pasted));
  const ratings = lines.map((l, i) => (RATING.test(l) ? i : -1)).filter((i) => i >= 0);
  if (ratings.length === 0) return null;
  if (ratings.length > 1) return "several";
  const at = ratings[0];

  // The line just above the stars repeats the name, whole; the first line may
  // have been cut by the selection. In the later layout the line above is the
  // city and the name sits one higher. No line above: no name.
  const nameLine = (j: number) => (j >= 0 && !PUNCTUATION.test(lines[j]) ? lines[j] : "");
  const guestName = nameFrom(nameLine(at - 1), nameLine(at - 2)).slice(0, 120);
  const stars = Number(lines[at].match(RATING)![1]);

  let when = "";
  let i = at + 1;
  for (; i < lines.length; i++) {
    const l = lines[i];
    // Flattened: "Stayed …" runs straight into the guest's words — peeled off
    // BEFORE the label rule, which would drop the whole line, words and all.
    const stayed = l.match(LEADING_STAYED);
    if (stayed) {
      lines[i--] = l.slice(stayed[0].length);
      continue;
    }
    if (PUNCTUATION.test(l) || LABEL.test(l)) continue;
    if (!when && DATE.test(l)) {
      when = l;
      continue;
    }
    // Flattened: the date runs into what follows it.
    const date = !when ? l.match(LEADING_DATE) : null;
    if (date) {
      when = date[1];
      lines[i--] = l.slice(date[0].length);
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
