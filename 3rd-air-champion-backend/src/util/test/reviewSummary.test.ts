import mongoose from "mongoose";
import TTReviewEntry from "../../model/ttReviewEntrySchema";
import { reviewSummaryFor } from "../reviewSummary";
import { hostResolvers } from "../../graphql/resolvers/host";

// The two numbers TiBook shows every guest under the host's name. Counted from
// the reviews on record so they cannot drift from them; the typed numbers only
// when there are no reviews on record.

const entry = (host: mongoose.Types.ObjectId, stars: number | null, i: number) =>
  TTReviewEntry.create({
    host,
    room: new mongoose.Types.ObjectId(),
    text: `review ${i}`,
    hash: `h${i}`,
    ...(stars != null ? { stars } : {}),
  });

describe("reviewSummaryFor", () => {
  it("counts every review and averages only those with stars, to two places", async () => {
    const host = new mongoose.Types.ObjectId();
    await entry(host, 5, 1);
    await entry(host, 5, 2);
    await entry(host, 4, 3);
    await entry(host, null, 4);
    expect(await reviewSummaryFor(host)).toEqual({ count: 4, average: 4.67 });
  });

  it("is nothing for a host with no reviews on record, and never counts another host's", async () => {
    const host = new mongoose.Types.ObjectId();
    await entry(new mongoose.Types.ObjectId(), 5, 9);
    expect(await reviewSummaryFor(host)).toBeNull();
    expect(await reviewSummaryFor("not-an-id")).toBeNull();
  });
});

describe("Host review fields", () => {
  const H: any = (hostResolvers as any).Host;

  it("shows the counted numbers when reviews are on record, over what was typed", async () => {
    const _id = new mongoose.Types.ObjectId();
    await entry(_id, 5, 11);
    await entry(_id, 4, 12);
    const parent = { _id, airbnbReviewCount: 300, airbnbRating: 4.8 };
    expect(await H.airbnbReviewCount(parent)).toBe(2);
    expect(await H.airbnbRating(parent)).toBe(4.5);
    expect(await H.reviewsFromRecord(parent)).toBe(true);
  });

  it("falls back to the typed numbers when no review is on record", async () => {
    const parent = { _id: new mongoose.Types.ObjectId(), airbnbReviewCount: 300, airbnbRating: 4.8 };
    expect(await H.airbnbReviewCount(parent)).toBe(300);
    expect(await H.airbnbRating(parent)).toBe(4.8);
    expect(await H.reviewsFromRecord(parent)).toBe(false);
  });
});
