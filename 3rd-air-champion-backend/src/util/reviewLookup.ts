// What TiMag's agent reads out of the review files the host keeps (see
// model/ttReviewSourceSchema), without handing it a million characters.
//
// A room's file can be hundreds of thousands of characters, and whatever a tool
// returns rides along on every later turn of the conversation, paid for again
// each time. So the agent gets a bounded view: the top of the file (AirBnB lists
// the newest reviews first), or the passages around a word it asked about —
// always with the size of the whole, so it can say "I read the newest part"
// rather than answer as if it had read everything.

export interface ReviewFile {
  room: string;
  name: string;
  chars: number;
  savedAt: Date | string | null;
  text: string;
}

// Characters of the top of a file returned when nothing is searched for.
export const HEAD_CHARS = 6000;
// Passages returned per room for a search, and the context kept either side.
export const MAX_PASSAGES = 8;
export const PASSAGE_RADIUS = 300;

const around = (text: string, at: number, length: number) => {
  const from = Math.max(0, at - PASSAGE_RADIUS);
  const to = Math.min(text.length, at + length + PASSAGE_RADIUS);
  return `${from > 0 ? "…" : ""}${text.slice(from, to).replace(/\s+/g, " ").trim()}${to < text.length ? "…" : ""}`;
};

/**
 * The files for the rooms whose name contains `room` (all rooms when blank),
 * each as a bounded view: the top of the file, or — with `search` — the
 * passages around every match (case-insensitive), capped, with the match count.
 */
export const lookupReviews = (files: ReviewFile[], opts: { room?: string; search?: string }) => {
  const roomQ = String(opts.room ?? "").trim().toLowerCase();
  const q = String(opts.search ?? "").trim();
  const chosen = files.filter((f) => !roomQ || f.room.toLowerCase().includes(roomQ));

  return chosen.map((f) => {
    const base = { room: f.room, file: f.name, characters: f.chars, savedAt: f.savedAt };
    if (!q) {
      const head = f.text.slice(0, HEAD_CHARS);
      return {
        ...base,
        excerpt: head,
        note: f.text.length > HEAD_CHARS
          ? `Showing the first ${HEAD_CHARS.toLocaleString()} of ${f.chars.toLocaleString()} characters (the newest reviews come first). Use 'search' to find something specific.`
          : "This is the whole file.",
      };
    }
    const lower = f.text.toLowerCase();
    const needle = q.toLowerCase();
    const passages: string[] = [];
    let matches = 0;
    let from = 0;
    let last = -Infinity;
    for (let i = lower.indexOf(needle, from); i !== -1; i = lower.indexOf(needle, from)) {
      matches++;
      // A match inside the passage just returned adds to the count, not a
      // second copy of the same words.
      if (i - last > PASSAGE_RADIUS * 2 && passages.length < MAX_PASSAGES) {
        passages.push(around(f.text, i, needle.length));
        last = i;
      }
      from = i + needle.length;
    }
    return {
      ...base,
      matches,
      passages,
      note: matches === 0
        ? `"${q}" does not appear in this file.`
        : matches > passages.length
          ? `${matches} matches; showing ${passages.length} passages. Narrow the search to see others.`
          : `${matches} match${matches === 1 ? "" : "es"}.`,
    };
  });
};
