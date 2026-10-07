import TTReviewEntry from "../model/ttReviewEntrySchema";
import TTReviewSource from "../model/ttReviewSourceSchema";
import { MAX_TOTAL_PASTE } from "./reviewDraft";
import { hashOf } from "./reviewSplit";

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
}

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
  const hash = hashOf(e.text);
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
