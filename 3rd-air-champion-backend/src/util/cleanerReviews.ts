import { ROTA_STARTS, preparingClean } from "./reviewCleaners";

// What guests said about the rooms ONE cleaner prepared — TiWork's side of the
// review records, so the people who clean see that guests notice (Anh-Tri for
// the house, 2026-10-16: "show the cleaners that their work is not unnoticed").
//
// TiMag already walks a review to its cleaner (reviewCleaners.ts). This walks
// the other way, and through the same preparingClean, so a review the host sees
// "prepared by Henry" is the review Henry sees in TiWork, and nobody else does.
//
// Four deliberate limits:
//
// - Only reviews that give the NIGHT the stay began. A review dated only by
//   its month points at every clean of that room that month, which is a lead
//   for the host but would hand one cleaner praise for another's visit — and
//   it cannot be shown "on the day you cleaned", which is the whole idea.
// - Only POSITIVE reviews (4-5 stars). This is recognition. What went wrong on
//   a visit already reaches the cleaner as the house's own feedback on it, in
//   the house's words; a guest's complaint is often about noise, the bed or the
//   price, and shown here it would read as blame for something they did not do.
// - Only reviews that speak to the WORK — how clean the room was, the towels,
//   the sheets, a made bed, how it smelled. A five-star "great location" came
//   after their clean but says nothing about it, and shown to a cleaner as
//   praise for their visit it is praise they did not get (Anh-Tri, 2026-10-16:
//   "it should in some way be connected to the work done"). The words that
//   connect it are sent along, so the screen can show them.
// - The guest's FIRST name only. A review record names its reviewer and is
//   otherwise manager-only (ttReviewEntrySchema); a first name is what AirBnB
//   itself shows, and what TiBook shows guests.

export const POSITIVE_STARS = 4;
// "Many positive reviews": this many in this many days earns the cleaner a
// congratulation. Reviews arrive weeks after a stay and the host adds them in
// batches, so the window is two months rather than one, and three is a run of
// guests, not one kind one.
export const PRAISE_COUNT = 3;
export const PRAISE_DAYS = 60;

// What a cleaner's work is, in the words guests use for it: the room being
// clean, the linen they change, the bed they make, the smell they leave. Not
// "comfortable bed" (the mattress) or "lovely room" (the house) — those are
// true after anyone's clean. Praise words only: these are 4-5 star reviews,
// and "dirty" or "stain" in one is a guest saying there was none. Longer
// phrases first, so "fluffy towels" is caught whole rather than as "towels".
const WORK_WORDS = new RegExp(
  "\\b(?:" +
    [
      "spick and span",
      "not a speck of dust",
      "speck of dust",
      "smell\\w* (?:so )?(?:fresh|clean|nice|great|good|lovely|amazing)",
      "(?:fresh|clean|fluffy|soft|crisp|freshly washed) (?:towels|sheets|linens?|bedding)",
      "bed (?:was |were )?(?:perfectly |neatly )?made",
      "well[- ](?:kept|maintained|prepared)",
      "clean\\w*",
      "spotless",
      "tid(?:y|ied)",
      "immaculate",
      "neat\\w*",
      "pristine",
      "sparkl\\w*",
      "dust[- ]?free",
      "hygien\\w*",
      "towels?",
      "sheets",
      "linens?",
      "bedding",
    ].join("|") +
    ")\\b",
  "gi",
);

// A guest saying the cleaning fell short. Four or five stars is no guarantee
// against one — "great stay, but the room could have been cleaner" — and
// WORK_WORDS alone finds "cleaner" in that and shows it to the cleaner, in
// bold, as praise for their visit: exactly the blame this card must never
// carry. Any of these and the review is not praise for the work at all.
//
// Negated praise, unless it is "not only" / "not just" (still praise).
// "Not a speck of dust" is praise and passes: "speck" is not a work word.
// "n't" is not behind \b — the "n" belongs to "wasn" — so it is spelled out.
// The trouble words — dirty, stained — count unless the guest said there were
// none: "no stains anywhere", "nothing dirty", "not dusty at all".
const WORK_COMPLAINT = new RegExp(
  [
    "(?:\\bnot|\\bnever|\\bhardly|\\bbarely|n't)\\s+(?!only\\b|just\\b)(?:\\w+\\s+){0,2}?(?:clean\\w*|tidy|spotless|immaculate|neat|fresh)\\b",
    "\\bcould\\s+(?:have\\s+been|be|use|do\\s+with)\\s+(?:\\w+\\s+){0,2}?(?:clean\\w*|tidier)\\b",
    "\\b(?:towels?|sheets|linens?|bedding)\\s+(?:was|were)\\s+(?:missing|dirty|stained)\\b",
    "\\bno\\s+(?:clean\\s+)?(?:towels?|sheets|linens?|bedding)\\b",
    "(?<!\\b(?:no|not|nothing|never|without|n't)\\s+(?:\\w+\\s+)?)\\b(?:dirty|dusty|stain(?:s|ed)?|grimy|mou?ldy|musty|smelly)\\b",
  ].join("|"),
  "i",
);

/** The words in a review that are about the cleaning work, as written — none if it complains about the work. */
export const workWords = (text: string): string[] => {
  const t = String(text ?? "");
  if (WORK_COMPLAINT.test(t)) return [];
  return [...new Set(t.match(WORK_WORDS) ?? [])];
};

export interface ReviewRow {
  id: string;
  room: string;
  stayDate: string;
  stars: number | null;
  text: string;
  guestName: string;
}

export interface CleanerReview {
  id: string;
  // The morning they cleaned the room this guest then stayed in.
  cleanDate: string;
  stayDate: string;
  roomName: string;
  roomColor: string;
  guestFirstName: string;
  stars: number;
  text: string;
  // The words that make this review about the work (workWords) — never empty,
  // or the review would not be here.
  workWords: string[];
}

const firstName = (name: string) => String(name ?? "").trim().split(/\s+/)[0] ?? "";

/** The positive, night-dated reviews that praise the work, of stays this cleaner prepared, newest clean first. */
export const reviewsForCleaner = (
  cleanerId: string,
  reviews: ReviewRow[],
  // findAssignments rows for the host — EVERY cleaner, not just this one, or
  // a later clean by someone else would not take the stay off them.
  rota: { room?: any; date: string; cleaner?: any }[],
): CleanerReview[] => {
  const out: CleanerReview[] = [];
  for (const r of reviews) {
    if (!r.stayDate || r.stayDate < ROTA_STARTS) continue;
    if (r.stars == null || r.stars < POSITIVE_STARS) continue;
    const words = workWords(r.text);
    if (!words.length) continue;
    const clean = preparingClean(rota, r.room, r.stayDate);
    if (!clean || String(clean.cleaner?._id ?? clean.cleaner) !== String(cleanerId)) continue;
    out.push({
      id: r.id,
      cleanDate: clean.date,
      stayDate: r.stayDate,
      roomName: String(clean.room?.name ?? ""),
      roomColor: String(clean.room?.color ?? ""),
      guestFirstName: firstName(r.guestName),
      stars: r.stars,
      text: r.text,
      workWords: words,
    });
  }
  return out.sort((a, b) => b.cleanDate.localeCompare(a.cleanDate) || b.stayDate.localeCompare(a.stayDate));
};

export interface Praise {
  count: number;
  fiveStars: number;
  days: number;
}

/** A congratulation, when there have been PRAISE_COUNT or more in the last PRAISE_DAYS. */
export const praiseFor = (reviews: CleanerReview[], today: string): Praise | null => {
  const since = new Date(`${today}T00:00:00.000Z`);
  since.setUTCDate(since.getUTCDate() - PRAISE_DAYS);
  const from = since.toISOString().slice(0, 10);
  const recent = reviews.filter((r) => r.cleanDate >= from && r.cleanDate <= today);
  if (recent.length < PRAISE_COUNT) return null;
  return { count: recent.length, fiveStars: recent.filter((r) => r.stars === 5).length, days: PRAISE_DAYS };
};
