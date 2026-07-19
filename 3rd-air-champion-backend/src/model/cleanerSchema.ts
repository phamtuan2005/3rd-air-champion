import mongoose from "mongoose";

const cleanerSchema = new mongoose.Schema(
  {
    host: { type: mongoose.Schema.ObjectId, ref: "Host", required: true },
    name: { type: String, required: true },
    phone: { type: String, default: "" },
    // Hourly rate in dollars — pay is computed from recorded hours, not per job
    payRate: { type: Number, default: 0 },
    // Hours worked before assignment tracking started, counted toward the
    // month in baselineMonth ("yyyy-MM") only — stale baselines don't leak
    // into later months.
    baselineHours: { type: Number, default: 0 },
    baselineMonth: { type: String, default: "" },
    // Running total the host has paid out — balance owed is computed as
    // all-time earnings minus this. Cleaners claim on different schedules
    // (right away / bi-weekly / at a threshold), so owed must survive months.
    paidAmount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

cleanerSchema.index({ host: 1, name: 1 }, { unique: true });

cleanerSchema.pre("validate", function (next) {
  if (this.payRate != null && this.payRate < 0)
    return next(new Error("Pay rate must be a positive number"));
  return next();
});

// Deleting a cleaner removes their assignments — an assignment without a
// cleaner is meaningless and would break populate on fetch.
cleanerSchema.post("findOneAndDelete", async function (doc) {
  if (doc) {
    await mongoose.model("CleaningAssignment").deleteMany({ cleaner: doc._id });
  }
});

export default mongoose.model("Cleaner", cleanerSchema);
