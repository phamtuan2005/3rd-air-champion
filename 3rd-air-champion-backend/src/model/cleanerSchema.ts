import mongoose from "mongoose";

const cleanerSchema = new mongoose.Schema(
  {
    host: { type: mongoose.Schema.ObjectId, ref: "Host", required: true },
    name: { type: String, required: true },
    phone: { type: String, default: "" },
    // Small, client-compressed square avatar stored as a data URL (or a public
    // asset path like "Anh-Tuan.jpg" for the owner photos already in the app).
    photo: { type: String, default: "" },
    // A short free-text description ("cheerful 24yo, glasses, short black hair").
    // The illustrated avatar is generated deterministically from this + the name;
    // only the text is stored, never the rendered image.
    character: { type: String, default: "" },
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
