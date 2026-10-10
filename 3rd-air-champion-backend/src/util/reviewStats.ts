// The numbers behind the reviews the host keeps — worked out from the records,
// by arithmetic, with no model in the way. "What's the average rating for each
// room?" is a sum and a division; asking a model costs money and a few seconds
// and can only be wrong where code cannot (the host: "I don't want to use API
// for such trivial questions").

export interface ReviewRow {
  // The review's own id, so a tap on it in TiMag can open it to edit.
  id?: string;
  room: string; // room id
  roomName: string;
  guestName: string;
  stars: number | null;
  /** yyyy-MM-dd, the night the stay started, when the host entered it. */
  stayDate: string;
  /** yyyy-MM, the month the review is dated. */
  reviewMonth: string;
  text: string;
}

export interface RoomAverage {
  room: string;
  name: string;
  reviews: number;
  withStars: number;
  /** Two decimals, or null when no review of the room has stars. */
  average: number | null;
}

/** Reviews, how many carry stars, and the average of those, per room — by room name. */
export const roomAverages = (rows: ReviewRow[]): RoomAverage[] => {
  const by = new Map<string, { name: string; n: number; rated: number; sum: number }>();
  for (const r of rows) {
    const t = by.get(r.room) ?? { name: r.roomName, n: 0, rated: 0, sum: 0 };
    t.n++;
    if (r.stars != null) {
      t.rated++;
      t.sum += r.stars;
    }
    by.set(r.room, t);
  }
  return [...by]
    .map(([room, t]) => ({
      room,
      name: t.name,
      reviews: t.n,
      withStars: t.rated,
      average: t.rated ? Math.round((t.sum / t.rated) * 100) / 100 : null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
};

// How recent a review is, for putting the newest first: the exact night where
// known, else the first of the month it is dated, else nothing (last).
const when = (r: ReviewRow) => r.stayDate || (r.reviewMonth ? `${r.reviewMonth}-01` : "");

/** Reviews of at most `max` stars (only those that HAVE stars), newest first. */
export const lowReviews = (rows: ReviewRow[], max = 3, limit = 12): ReviewRow[] =>
  rows
    .filter((r) => r.stars != null && r.stars <= max)
    .sort((a, b) => when(b).localeCompare(when(a)))
    .slice(0, limit);

/**
 * The newest reviews, whatever their stars. What the host asked to see first
 * (2026-10-08: "the most recent review, not 3 stars") — most recent ones are 5
 * stars, and each carries the cleaner lead, so a good stay can be credited.
 */
export const recentReviews = (rows: ReviewRow[], limit = 5): ReviewRow[] =>
  [...rows].sort((a, b) => when(b).localeCompare(when(a))).slice(0, limit);

/**
 * The nights a review's room should be looked up in the cleaning rota for.
 *
 * With the stay's start date: the night before and that night, since the room
 * is cleaned the morning of arrival (or the day before). With only a month: the
 * whole month. With neither: nothing — no date, no lead.
 */
export const cleaningWindow = (r: Pick<ReviewRow, "stayDate" | "reviewMonth">): { start: string; end: string } | null => {
  if (r.stayDate) {
    const d = new Date(`${r.stayDate}T00:00:00.000Z`);
    d.setUTCDate(d.getUTCDate() - 1);
    return { start: d.toISOString().slice(0, 10), end: r.stayDate };
  }
  if (r.reviewMonth) {
    const [y, m] = r.reviewMonth.split("-").map(Number);
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
    return { start: `${r.reviewMonth}-01`, end: `${r.reviewMonth}-${String(last).padStart(2, "0")}` };
  }
  return null;
};

// Subjects a host asks about, and the words that mean them. A fixed list on
// purpose: a typed word is matched against it, never searched for as written,
// so "noise" and "noisy" and "loud" are one question.
export const TOPICS: { key: string; label: string; pattern: RegExp }[] = [
  { key: "clean", label: "cleanliness", pattern: /\b(clean\w*|spotless|tidy|dirty|dust\w*|hygien\w*|stain\w*)\b/i },
  { key: "noise", label: "noise and quiet", pattern: /\b(nois\w*|loud|quiet|peaceful|thin walls?)\b/i },
  { key: "bed", label: "the bed", pattern: /\b(bed|beds|mattress|pillows?|sleep\w*|comfy|comfortable)\b/i },
  { key: "bathroom", label: "the bathroom", pattern: /\b(bathroom|shower|toilet|restroom|towels?)\b/i },
  { key: "location", label: "the location", pattern: /\b(location|neighbou?rhood|nearby|close to|walk\w*|easy access)\b/i },
  { key: "host", label: "the host", pattern: /\b(host|anh|cindy|welcom\w*|friendly|kind|helpful|responsive)\b/i },
  { key: "parking", label: "parking", pattern: /\b(parking|park)\b/i },
  { key: "smell", label: "smell", pattern: /\b(smell\w*|odou?r|stink\w*|fresh)\b/i },
  { key: "value", label: "value", pattern: /\b(value|price|cheap|affordable|worth)\b/i },
];

export const topicFor = (key: string) => TOPICS.find((t) => t.key === key);

export interface TopicMentions {
  key: string;
  label: string;
  rooms: { room: string; name: string; count: number }[];
  snippets: { roomName: string; guestName: string; stars: number | null; snippet: string }[];
}

/** How many reviews of each room mention the topic, with a few of the words around it. */
export const topicMentions = (rows: ReviewRow[], key: string, snippetLimit = 4): TopicMentions | null => {
  const topic = topicFor(key);
  if (!topic) return null;
  const counts = new Map<string, { name: string; count: number }>();
  const snippets: TopicMentions["snippets"] = [];
  for (const r of rows) {
    const m = topic.pattern.exec(r.text);
    if (!m) continue;
    const c = counts.get(r.room) ?? { name: r.roomName, count: 0 };
    c.count++;
    counts.set(r.room, c);
    if (snippets.length < snippetLimit) {
      const from = Math.max(0, m.index - 70);
      const to = Math.min(r.text.length, m.index + m[0].length + 90);
      snippets.push({
        roomName: r.roomName,
        guestName: r.guestName,
        stars: r.stars,
        snippet: `${from > 0 ? "…" : ""}${r.text.slice(from, to).replace(/\s+/g, " ").trim()}${to < r.text.length ? "…" : ""}`,
      });
    }
  }
  return {
    key: topic.key,
    label: topic.label,
    rooms: [...counts].map(([room, c]) => ({ room, name: c.name, count: c.count })).sort((a, b) => b.count - a.count),
    snippets,
  };
};
