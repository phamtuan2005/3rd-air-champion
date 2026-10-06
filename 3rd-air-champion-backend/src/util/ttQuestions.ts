// The rules for TiBook's question log: what may be stored, and how the host
// sees it grouped. Pure, so each rule is pinned by a test.

// TT's topics, as askTT.ts names them on the frontend. Kept as an allowlist
// here rather than trusted from the request: the route is public, and a free
// text field would let anyone write anything into the host's statistics. A
// category this list does not know is stored as "other".
export const TT_CATEGORIES = [
  "availability",
  "wishList",
  "rooms",
  "reviews",
  "checkIn",
  "parking",
  "cancellation",
  "price",
  "kitchen",
  "bathroom",
  "amenities",
  "houseRules",
  "location",
  "contactHost",
  "booking",
  "myBookings",
  "greeting",
  "thanks",
  "privacy",
  "other",
] as const;
export type TTCategory = (typeof TT_CATEGORIES)[number];

export const asCategory = (c: unknown): TTCategory =>
  (TT_CATEGORIES as readonly string[]).includes(String(c)) ? (c as TTCategory) : "other";

// Longer than any real question to a booking helper. The cap is what stops the
// public route being used as free storage.
export const MAX_QUESTION = 300;

// The same shapes TiBook's own scrub removes (askTT.ts, layer 3), applied
// again here because the route cannot trust what the browser sent. A guest
// typing "my number is 415 555 0100, is King free" still has a question worth
// keeping; their number is not.
const SCRUBS: RegExp[] = [
  /\b\d{3,8}#/g, // a door code: "1224#"
  /[^\s@]+@[^\s@]+\.[^\s@]+/g, // an email
  /\bhttps?:\/\/\S+|\bwww\.\S+/gi, // a link
  /\b\d{1,3}(?:\.\d{1,3}){3}(?::\d+)?\b/g, // an IP address
  /(?:\+?\d[\s().-]*){7,}\d/g, // a phone number, or any long run of digits
  // A door code typed WITHOUT its "#" — "my code 4821 doesn't work". Four to
  // eight digits on their own; a year (19xx, 20xx) is kept, because guests
  // write one in their dates.
  /\b(?!(?:19|20)\d{2}\b)\d{4,8}\b/g,
];
export const scrubQuestion = (text: string): string =>
  SCRUBS.reduce((t, re) => t.replace(re, "(hidden)"), String(text ?? ""))
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_QUESTION);

// What is stored for a question TT turned down for privacy. Its words are, by
// definition, about somebody else — "is Eddie staying in King", "what is the
// cleaner's schedule" — and these questions are read by a guest the host gave
// the stats code to, as well as by the host. The topic still counts; the
// words are not kept.
export const PRIVATE_QUESTION = "(not kept — asked about other people or private details)";
export const storedQuestion = (text: string, category: TTCategory): string =>
  category === "privacy" ? PRIVATE_QUESTION : scrubQuestion(text);

export interface QuestionRow {
  question: string;
  answered: boolean;
  category: string;
  returning?: boolean;
  createdAt: Date | string;
}

// The same question asked again, however it was capitalised or punctuated.
// Rough on purpose: "Is there parking?" and "is there parking" are one
// question to the host, "parking near BART?" is another.
export const sameQuestion = (q: string) =>
  q
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();

export interface GroupedQuestion {
  question: string;
  // How many times it was asked in the span, and when last.
  count: number;
  lastAsked: string;
}

export interface CategoryGroup {
  category: TTCategory;
  count: number;
  questions: GroupedQuestion[];
}

export interface QuestionStats {
  total: number;
  answered: { count: number; categories: CategoryGroup[] };
  unanswered: { count: number; categories: CategoryGroup[] };
  // How many came from guests TiBook already knew.
  fromReturning: number;
}

const group = (rows: QuestionRow[]): CategoryGroup[] => {
  const byCategory = new Map<TTCategory, Map<string, GroupedQuestion>>();
  const counts = new Map<TTCategory, number>();
  for (const r of rows) {
    const cat = asCategory(r.category);
    counts.set(cat, (counts.get(cat) ?? 0) + 1);
    const qs = byCategory.get(cat) ?? new Map<string, GroupedQuestion>();
    byCategory.set(cat, qs);
    const key = sameQuestion(r.question);
    const at = new Date(r.createdAt).toISOString();
    const seen = qs.get(key);
    if (seen) {
      seen.count += 1;
      if (at > seen.lastAsked) {
        seen.lastAsked = at;
        // The newest wording stands for the group.
        seen.question = r.question;
      }
    } else qs.set(key, { question: r.question, count: 1, lastAsked: at });
  }
  return [...byCategory.entries()]
    .map(([category, qs]) => ({
      category,
      count: counts.get(category) ?? 0,
      // Most asked first, then most recent: the top of each list is what the
      // host should teach TT next.
      questions: [...qs.values()].sort((a, b) => b.count - a.count || b.lastAsked.localeCompare(a.lastAsked)),
    }))
    .sort((a, b) => b.count - a.count || a.category.localeCompare(b.category));
};

export const questionStats = (rows: QuestionRow[]): QuestionStats => {
  const answered = rows.filter((r) => r.answered);
  const unanswered = rows.filter((r) => !r.answered);
  return {
    total: rows.length,
    answered: { count: answered.length, categories: group(answered) },
    unanswered: { count: unanswered.length, categories: group(unanswered) },
    fromReturning: rows.filter((r) => r.returning).length,
  };
};
