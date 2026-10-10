// What the Guest reviews search box was asked: words to find, and a range of
// stars when the host typed one — "3 stars and below", "below 4 stars",
// "4 stars and up", "4+", "5 stars". Ask TT used to list the low reviews on
// their own; the host would rather type it here when it is wanted
// (2026-10-10: "when I need, I can type review 3 stars and below").

export interface ReviewSearch {
  words: string[];
  minStars?: number;
  maxStars?: number;
}

const BELOW = "(?:and|or)?\\s*(?:below|lower|less|under|fewer|or less|and less|max)";
const ABOVE = "(?:and|or)?\\s*(?:above|higher|more|up|over|better|plus|or more|and up)";

export const parseReviewSearch = (q: string): ReviewSearch => {
  let s = ` ${q.toLowerCase()} `;
  let minStars: number | undefined;
  let maxStars: number | undefined;
  const take = (re: RegExp, set: (n: number) => void) => {
    const m = s.match(re);
    if (!m) return;
    set(Number(m[1]));
    s = s.replace(m[0], " ");
  };
  // Longest phrasings first, so "3 stars and below" is not read as "3 stars".
  take(new RegExp(`\\b([1-5])\\s*(?:stars?|★)?\\s*${BELOW}\\b`), (n) => (maxStars = n));
  take(new RegExp(`\\b([1-5])\\s*(?:stars?|★)?\\s*${ABOVE}\\b`), (n) => (minStars = n));
  take(/(?:below|under|less than|fewer than)\s*([1-5])\s*(?:stars?|★)?/, (n) => (maxStars = n - 1));
  take(/(?:above|over|more than|better than)\s*([1-5])\s*(?:stars?|★)?/, (n) => (minStars = n + 1));
  take(/(?:<=|≤)\s*([1-5])\s*(?:stars?|★)?/, (n) => (maxStars = n));
  take(/(?:>=|≥)\s*([1-5])\s*(?:stars?|★)?/, (n) => (minStars = n));
  take(/\b([1-5])\s*\+\s*(?:stars?|★)?/, (n) => (minStars = n));
  if (minStars === undefined && maxStars === undefined) {
    take(/\b([1-5])\s*(?:stars?|★)/, (n) => (minStars = maxStars = n));
  }
  // "review", "reviews", "with", "stars" left over say nothing about the words.
  const FILLER = new Set(["review", "reviews", "with", "stars", "star", "rating", "rated", "and", "or"]);
  const words = s.split(/\s+/).filter((w) => w && !FILLER.has(w)).slice(0, 8);
  return { words, ...(minStars !== undefined ? { minStars } : {}), ...(maxStars !== undefined ? { maxStars } : {}) };
};

/** Whether a review's stars fit the range asked. A review with no stars fits only no range. */
export const starsFit = (stars: number | null | undefined, s: ReviewSearch): boolean => {
  if (s.minStars === undefined && s.maxStars === undefined) return true;
  if (stars == null) return false;
  return (s.minStars === undefined || stars >= s.minStars) && (s.maxStars === undefined || stars <= s.maxStars);
};
