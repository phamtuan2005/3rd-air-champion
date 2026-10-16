import mongoose from "mongoose";

// The house's word to a cleaner on one VISIT — a cleaner on a morning — written
// in TiMag's Clean screen and read by the cleaner in TiWork.
//
// Asked for by Cindy (2026-10-09): a cleaner had no way to hear how a visit
// went, so good work went unsaid and a miss was only fixed if someone happened
// to mention it. On the visit, not a room: hours are recorded per visit, and
// a comment can name the room it means ("Queen: mirror streaks").
//
// One per visit. Writing again replaces it — it is the house's current word on
// that morning, not a thread.
export const VERDICTS = ["great", "good", "fix"] as const;

const cleaningFeedbackSchema = new mongoose.Schema(
  {
    host: { type: mongoose.Schema.ObjectId, ref: "Host", required: true },
    date: { type: String, required: true }, // yyyy-MM-dd, the cleaning morning
    cleaner: { type: mongoose.Schema.ObjectId, ref: "Cleaner", required: true },
    // One tap: Great / Good / Needs a fix. Empty = a comment with no verdict.
    verdict: { type: String, enum: ["", ...VERDICTS], default: "" },
    text: { type: String, default: "", maxlength: 1000 },
    // When the cleaner first saw THIS wording in TiWork. Cleared on every
    // change, so an edited comment shows as new again rather than slipping by.
    seenAt: { type: Date, default: null },
    // The cleaner's answer, from TiWork (host, 2026-10-15: "When the cleaner
    // got a feedback, definitely they want to explain"). A "Needs a fix" that
    // asks "did you clean the bathroom next to Chill as well?" is a question,
    // and the cleaner had no way to answer it but to text. One reply, which
    // they can change, as the feedback itself is one word that can change.
    // It stays when the house edits its feedback: it is still their answer.
    reply: { type: String, default: "", maxlength: 1000 },
    repliedAt: { type: Date, default: null },
    // When the house first saw THIS reply in TiMag. Cleared on every change.
    replySeenAt: { type: Date, default: null },
  },
  { timestamps: true }
);

cleaningFeedbackSchema.index({ host: 1, date: 1, cleaner: 1 }, { unique: true });

cleaningFeedbackSchema.pre("validate", function (next) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String((this as any).date))) return next(new Error("date must be yyyy-MM-dd"));
  next();
});

export default mongoose.model("CleaningFeedback", cleaningFeedbackSchema);
