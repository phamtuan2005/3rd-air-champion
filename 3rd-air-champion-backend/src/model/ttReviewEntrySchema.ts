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
// Like the file, it names a reviewer, so it is manager-only. The one thing a
// guest sees from it: a room's newest review, with the reviewer's FIRST name
// as AirBnB shows it (host, 2026-10-09; it used to show no name at all).
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
    // yyyy-MM: the month the review is dated, when that is all the page said
    // ("February 2025", or "1 week ago" counted back to a month). Looser than
    // stayDate; used to find who cleaned the room around then.
    reviewMonth: { type: String, default: "" },
    stars: { type: Number, min: 1, max: 5 },
    text: { type: String, required: true, maxlength: 2000 },
    // Whether these words were also APPENDED to the room's review file (the
    // one-at-a-time form does that; a split does not — its reviews came out of
    // the file). Deleting the review takes its block back out only when true.
    inFile: { type: Boolean },
    // Of the words, lower-cased and spaces collapsed: the same review pasted
    // twice is the same review.
    hash: { type: String, required: true },
  },
  { timestamps: true }
);

ttReviewEntrySchema.index({ host: 1, room: 1, hash: 1 }, { unique: true });
ttReviewEntrySchema.index({ host: 1, room: 1, stayDate: 1 });

export default mongoose.model("TTReviewEntry", ttReviewEntrySchema);
