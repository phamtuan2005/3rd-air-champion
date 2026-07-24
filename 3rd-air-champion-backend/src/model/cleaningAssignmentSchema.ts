import mongoose from "mongoose";

const cleaningAssignmentSchema = new mongoose.Schema(
  {
    host: { type: mongoose.Schema.ObjectId, ref: "Host", required: true },
    // yyyy-MM-dd of the cleaning morning. Stored as a plain string — calendar
    // math in this app is string-based to stay timezone-safe.
    date: { type: String, required: true },
    room: { type: mongoose.Schema.ObjectId, ref: "Room", required: true },
    cleaner: { type: mongoose.Schema.ObjectId, ref: "Cleaner", required: true },
    // Hours actually worked — recorded by the host after the cleaning; null
    // until then. Pay = hours × cleaner.payRate.
    hours: { type: Number, default: null },
    // What the AUTO-PLANNER drafted for this room, and when. A manual reassign
    // only changes `cleaner`, leaving these intact — so cleaner !== suggestedCleaner
    // is a measured correction (ground truth for grading the algorithm).
    suggestedCleaner: { type: mongoose.Schema.ObjectId, ref: "Cleaner", default: null },
    suggestedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// One cleaner per room per morning; assigning again replaces the cleaner.
cleaningAssignmentSchema.index({ host: 1, date: 1, room: 1 }, { unique: true });

cleaningAssignmentSchema.pre("validate", function (next) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(this.date as string))
    return next(new Error("date must be yyyy-MM-dd"));
  if (this.hours != null && (this.hours < 0 || this.hours > 24))
    return next(new Error("hours must be between 0 and 24"));
  return next();
});

export default mongoose.model("CleaningAssignment", cleaningAssignmentSchema);
