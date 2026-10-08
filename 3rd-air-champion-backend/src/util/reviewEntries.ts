import TTReviewEntry from "../model/ttReviewEntrySchema";
import TTReviewSource from "../model/ttReviewSourceSchema";
import { LatestReview, MAX_TOTAL_PASTE } from "./reviewDraft";
import { occurrenceKey } from "./reviewSplit";

// One guest's review, kept as its own record — the one place that does it, used
// by the form (one review typed in) and by the splitter (a whole page found in a
// paste), so both dedupe and describe a review the same way.

// Small enough that the request which carries it stays under the 8 KB CloudFront
// allows, even when every character weighs three bytes (see util/pasteUploads).
export const MAX_ENTRY_CHARS = 2000;

export interface EntryInput {
  roomId: string;
  guest?: string;
  guestName: string;
  /** yyyy-MM-dd, the night the stay started, when the host knows it. */
  stayDate: string;
  /** yyyy-MM, the month the review is dated, when only that is known. */
  reviewMonth: string;
  stars: number | null;
  text: string;
  /** Which copy of these words in the room this is (see occurrenceKey). 0 unless a page holds it twice. */
  occurrence?: number;
}

/**
 * Newest first, by the review's own date: the night the stay began where the
 * host entered it, else the first of the month the review is dated, else
 * nowhere (last). Then the latest added.
 *
 * Sorting by stayDate alone left every review from a split — which have only a
 * month — in the order they were added, the page's "most relevant" order: an
 * October 2025 review above a February 2026 one (host, 2026-10-07: "Sort in
 * descending time is what I like").
 */
export const reviewDateKey = (r: { stayDate?: string; reviewMonth?: string }) =>
  r.stayDate || (r.reviewMonth ? `${r.reviewMonth}-01` : "");

export const newestFirst = (a: any, b: any) =>
  reviewDateKey(b).localeCompare(reviewDateKey(a)) ||
  new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime();

/** The block a review is written into the room's file as: a heading of what is known, then the words. */
export const fileBlock = (e: Pick<EntryInput, "guestName" | "stayDate" | "reviewMonth" | "stars" | "text">) => {
  const head = [
    e.guestName && `Guest: ${e.guestName}`,
    e.stayDate && `Stay: ${e.stayDate}`,
    !e.stayDate && e.reviewMonth && `Month: ${e.reviewMonth}`,
    e.stars != null && `${e.stars} stars`,
  ]
    .filter(Boolean)
    .join(" · ");
  return head ? `— ${head} —\n${e.text}` : e.text;
};

/**
 * The room's file with one review's block taken out — only when that block is
 * there WHOLE, between blank lines (or at an end), so words that merely also
 * appear inside a pasted page are never cut out of it. Null when not found.
 */
export const withoutBlock = (file: string, block: string): string | null => {
  if (file === block) return "";
  if (file.startsWith(`${block}\n\n`)) return file.slice(block.length + 2);
  if (file.endsWith(`\n\n${block}`)) return file.slice(0, file.length - block.length - 2);
  const mid = file.indexOf(`\n\n${block}\n\n`);
  if (mid >= 0) return file.slice(0, mid) + file.slice(mid + block.length + 2);
  return null;
};

/**
 * Keeps the review unless the same words are already on file for that room.
 *
 * `appendToFile` also adds it to the end of the room's review file (what drafting
 * and Ask TiMag read). The form wants that; the splitter does NOT, because it
 * reads its reviews OUT of that file — appending them back would write every
 * review twice.
 */
export const saveEntry = async (hostId: string, e: EntryInput, opts: { appendToFile: boolean }): Promise<{ added: boolean }> => {
  const hash = occurrenceKey(e.text, e.occurrence ?? 0);
  if (await TTReviewEntry.exists({ host: hostId, room: e.roomId, hash })) return { added: false };

  await TTReviewEntry.create({
    host: hostId,
    room: e.roomId,
    ...(e.guest ? { guest: e.guest } : {}),
    guestName: e.guestName,
    stayDate: e.stayDate,
    reviewMonth: e.reviewMonth,
    ...(e.stars != null ? { stars: e.stars } : {}),
    text: e.text,
    hash,
    inFile: opts.appendToFile,
  });

  if (opts.appendToFile) {
    const block = fileBlock(e);
    const file: any = await TTReviewSource.findOne({ host: hostId, room: e.roomId }, { text: 1 }).lean();
    const next = file?.text ? `${file.text}\n\n${block}` : block;
    if (next.length <= MAX_TOTAL_PASTE) {
      await TTReviewSource.updateOne(
        { host: hostId, room: e.roomId },
        { $set: { text: next, chars: next.length }, $setOnInsert: { name: "Guest reviews" } },
        { upsert: true },
      );
    }
  }
  return { added: true };
};

/**
 * Each room's reviews ON RECORD as one text — every review headed with its
 * guest, date and stars, newest first — for what reads reviews as prose
 * (drafting the summaries, Ask TiMag's search).
 *
 * The individual reviews are the house's one record of what guests said (host,
 * 2026-10-07: "We have now individual reviews"). Drafting and Ask TiMag used to
 * read the pasted pages instead, which drifted from the record — a review
 * deleted from the record stayed in its page — and kept every reviewer's words
 * twice.
 */
export const roomTextsFromEntries = async (hostId: string, roomIds?: string[]): Promise<Map<string, string>> => {
  const rows: any[] = (await TTReviewEntry.find({ host: hostId, ...(roomIds ? { room: { $in: roomIds } } : {}) }).lean()).sort(
    newestFirst,
  );
  const by = new Map<string, string[]>();
  for (const r of rows) {
    const k = String(r.room);
    by.set(k, [
      ...(by.get(k) ?? []),
      fileBlock({ guestName: r.guestName ?? "", stayDate: r.stayDate ?? "", reviewMonth: r.reviewMonth ?? "", stars: r.stars ?? null, text: String(r.text ?? "") }),
    ]);
  }
  return new Map([...by].map(([k, blocks]) => [k, blocks.join("\n\n")]));
};

/**
 * Each room's NEWEST review on record that carries a date — what TiBook's TT
 * calls "the latest review" once it is summarised and published. A room whose
 * reviews are all undated has none: newestFirst puts undated reviews last, so
 * one at the top would mean "latest" was only the latest typed in.
 */
export const latestFromEntries = async (hostId: string, roomIds?: string[]): Promise<Map<string, LatestReview>> => {
  const rows: any[] = (await TTReviewEntry.find({ host: hostId, ...(roomIds ? { room: { $in: roomIds } } : {}) }).lean()).sort(
    newestFirst,
  );
  const out = new Map<string, LatestReview>();
  for (const r of rows) {
    const k = String(r.room);
    if (out.has(k) || !reviewDateKey(r)) continue;
    out.set(k, { text: String(r.text ?? ""), month: reviewDateKey(r).slice(0, 7), stars: r.stars ?? null });
  }
  return out;
};
