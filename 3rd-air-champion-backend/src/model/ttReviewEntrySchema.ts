import mongoose from "mongoose";

// ONE guest's review of one room, kept as its own record.
//
// The host passes reviews in a guest at a time. Each is kept here with what
// ties it to the business — which room, which guest, which stay, how many stars
// — so that a complaint can be traced to the room and the cleaner who prepared
// it (the cleaning rota has date + room + cleaner), and a 5-star stay can be
// counted toward rewarding them. The same words are ALSO appended to the room's
// review file (ttReviewSourceSchema), because that file is what drafting the
// summaries and Ask TiMag read; this record is the structured copy.
//
// Like the file, it names a reviewer, so it is manager-only and never reaches a
// guest or TiBook's TT.
const ttReviewEntrySchema = new mongoose.Schema(
  {
    host: { type: mongoose.Schema.ObjectId, ref: "Host", required: true },
    room: { type: mongoose.Schema.ObjectId, ref: "Room", required: true },
    // The guest on the host's list, when the review is theirs to be matched to.
    guest: { type: mongoose.Schema.ObjectId, ref: "Guest" },
    // As typed: AirBnB reviewers are often first names, not anyone on the list.
    guestName: { type: String, default: "", maxlength: 120 },
    // yyyy-MM-dd, the night the stay STARTED, when the host knows it. A review
    // itself only says a month; the host knows the night.
    stayDate: { type: String, default: "" },
    stars: { type: Number, min: 1, max: 5 },
    text: { type: String, required: true, maxlength: 2000 },
    // Of the words, lower-cased and spaces collapsed: the same review pasted
    // twice is the same review.
    hash: { type: String, required: true },
  },
  { timestamps: true }
);

ttReviewEntrySchema.index({ host: 1, room: 1, hash: 1 }, { unique: true });
ttReviewEntrySchema.index({ host: 1, room: 1, stayDate: 1 });

export default mongoose.model("TTReviewEntry", ttReviewEntrySchema);
