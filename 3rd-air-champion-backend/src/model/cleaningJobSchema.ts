import mongoose from "mongoose";

// The host's list of EXTRA cleaning jobs — work beyond turning a room over:
// windows, baseboards, the hallway, the ceiling. A name only.
//
// Why it exists (Anh-Tuan, 2026-10-07): a cleaner who also did the windows
// reported more hours than "2 rooms" seemed to justify, and Cindy, reading the
// hours, could not see why. An extra job is scheduled onto a cleaner's visit
// (CleaningExtra) so the cleaner knows the visit is longer — and paid longer,
// since pay is hours × rate — and the hours arrive with their reason beside
// them. No time estimate and no price: the host chose hours as the only
// measure.
const cleaningJobSchema = new mongoose.Schema(
  {
    host: { type: mongoose.Schema.ObjectId, ref: "Host", required: true },
    name: { type: String, required: true, trim: true, maxlength: 40 },
    // Lower-cased name, so "Windows" and "windows " are one job.
    key: { type: String, required: true },
  },
  { timestamps: true }
);

cleaningJobSchema.index({ host: 1, key: 1 }, { unique: true });

export default mongoose.model("CleaningJob", cleaningJobSchema);
