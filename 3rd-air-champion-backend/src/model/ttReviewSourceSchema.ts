import mongoose from "mongoose";

// The AirBnB reviews the host sent for one room — the raw text a draft is
// written from, KEPT so it can be read again later (redrafted, counted,
// quantified) without being sent a second time.
//
// This reverses what the screen used to promise ("the pasted text isn't kept",
// 2026-10-06): the host asked for the files to stay on the server. Because the
// text names the reviewers, it is held to a stricter rule than a summary:
//  - it is only ever read behind the manager check (ttHostRoute), never by a
//    guest and never by TiBook's TT, which shows only what the host published;
//  - the list the screen loads carries the name, size and date, not the text;
//  - one set per room — a new file for a room REPLACES the last, since it is
//    the newest set of reviews — and the host can remove it at any time.
const ttReviewSourceSchema = new mongoose.Schema(
  {
    host: { type: mongoose.Schema.ObjectId, ref: "Host", required: true },
    room: { type: mongoose.Schema.ObjectId, ref: "Room", required: true },
    // The file's name, or "Pasted text". For the host to recognise it.
    name: { type: String, default: "Pasted text", maxlength: 200 },
    chars: { type: Number, default: 0 },
    text: { type: String, default: "" },
  },
  { timestamps: true }
);

ttReviewSourceSchema.index({ host: 1, room: 1 }, { unique: true });

export default mongoose.model("TTReviewSource", ttReviewSourceSchema);
