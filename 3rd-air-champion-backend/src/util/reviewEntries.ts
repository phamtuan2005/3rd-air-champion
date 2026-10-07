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
  });

  if (opts.appendToFile) {
    const head = [
      e.guestName && `Guest: ${e.guestName}`,
      e.stayDate && `Stay: ${e.stayDate}`,
      !e.stayDate && e.reviewMonth && `Month: ${e.reviewMonth}`,
      e.stars != null && `${e.stars} stars`,
    ]
      .filter(Boolean)
      .join(" · ");
    const block = head ? `— ${head} —\n${e.text}` : e.text;
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
