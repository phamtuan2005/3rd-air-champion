import mongoose from "mongoose";

// What guests say about TT House, in the words TiBook's TT shows a guest who
// asks — one summary for the house and one per room.
//
// The reviews themselves live on AirBnB, which has no API for them and whose
// pages may not be scraped. So the host pastes each listing's reviews into
// TiMag, Claude drafts the summaries, and the host reads and edits them before
// they are PUBLISHED. Only `published` ever reaches a guest; a draft is the
// host's to throw away. That keeps the promise TiBook's TT makes (askTT.ts):
// it never says anything the house did not say.
//
// The review text itself IS kept, in ttReviewSourceSchema (changed 2026-10-06 at
// the host's request: the reviews are the evidence for how well each room is
// kept, to be counted later). It names the reviewers, so it stays out of this
// document and out of every guest-facing route; a summary is all a guest is
// shown.
const summarySet = {
  house: { type: String, default: "" },
  rooms: [
    {
      room: { type: mongoose.Schema.ObjectId, ref: "Room" },
      summary: { type: String, default: "" },
      // The room's NEWEST review, summarised on its own, for a guest asking
      // "what did the last guest in King think?" — the overall summary
      // smooths over a room that has just changed, for better or worse.
      // Drafted and published with the rest, never shown unpublished. The
      // month and stars are copied from the record, not written by the
      // model, so the guest is told how recent "latest" is.
      latest: { type: String, default: "" },
      latestMonth: { type: String, default: "" }, // yyyy-MM
      latestStars: { type: Number, min: 1, max: 5 },
    },
  ],
};

const ttReviewsSchema = new mongoose.Schema(
  {
    host: { type: mongoose.Schema.ObjectId, ref: "Host", required: true, unique: true },
    published: {
      ...summarySet,
      at: { type: Date },
    },
    // The draft runs in the background (see ttHostRoute) because a model
    // reading a few hundred reviews can take longer than CloudFront's 30
    // seconds. TiMag polls this until it says ready or failed.
    draft: {
      ...summarySet,
      status: { type: String, enum: ["none", "drafting", "ready", "failed"], default: "none" },
      startedAt: { type: Date },
      error: { type: String, default: "" },
      // How many reviews the model counted in what was pasted, so the host can
      // see that a paste did not get cut off.
      reviewsRead: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

export default mongoose.model("TTReviews", ttReviewsSchema);
