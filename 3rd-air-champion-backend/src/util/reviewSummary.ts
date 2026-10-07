import mongoose from "mongoose";
import TTReviewEntry from "../model/ttReviewEntrySchema";

// How many reviews the house has and their average stars — counted from the
// reviews kept on record, not typed in.
//
// The host typed both into My AirBnB by hand, and TiBook showed guests whatever
// was typed last ("430 reviews · 4.96"). With every review now on record, the
// numbers can be counted, so they cannot drift from the reviews themselves
// (host, 2026-10-07: "You should be able to calculate the # reviews and
// averaging stars … let's keep everything consistent"). The typed numbers stay
// as the fallback for a host with no reviews on record.
//
// The average is over the reviews that carry stars — the same rule as the room
// averages TT's box shows (util/reviewStats) — rounded to two places as AirBnB
// shows it.
export const reviewSummaryFor = async (hostId: unknown): Promise<{ count: number; average: number | null } | null> => {
  if (!hostId || !mongoose.isValidObjectId(String(hostId))) return null;
  const [row] = await TTReviewEntry.aggregate([
    { $match: { host: new mongoose.Types.ObjectId(String(hostId)) } },
    {
      $group: {
        _id: null,
        count: { $sum: 1 },
        rated: { $sum: { $cond: [{ $ifNull: ["$stars", false] }, 1, 0] } },
        sum: { $sum: { $ifNull: ["$stars", 0] } },
      },
    },
  ]);
  if (!row || !row.count) return null;
  return { count: row.count, average: row.rated ? Math.round((row.sum / row.rated) * 100) / 100 : null };
};
