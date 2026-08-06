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
    // Weekdays this cleaner can work (0=Sun … 6=Sat). Empty = no hard limit set,
    // so the auto-planner infers availability from history instead. A HARD
    // constraint when set (e.g. a weekend-only cleaner = [0, 6]).
    availableDays: { type: [Number], default: [] },
    // Temporarily out (vacation / leave). Kept on the team but skipped by the
    // auto-planner until they're back.
    paused: { type: Boolean, default: false },
    // Favorability 1–5 (3 = normal). The auto-planner gently prefers higher-
    // priority cleaners and gives them first claim on high-stakes (same-day)
    // turnovers — the host's quality judgment, since reviews aren't in the data.
    priority: { type: Number, default: 3, min: 1, max: 5 },
    // The host themselves (owner labor). Owners are EXCLUDED from the auto-draft
    // — they exist to be spared, not maximized — and assigned by hand only.
    isOwner: { type: Boolean, default: false },
    // Host-tuned per-cleaner trip size for the auto-planner:
    //   minRooms — the FEWEST rooms worth a trip; a cleaner who'd get fewer than
    //     this is not brought in (e.g. "won't come for < 2"). Default 1 = no floor.
    //   maxRooms — the MOST rooms they'll take in a day (e.g. "no more than 4").
    //     0 = no explicit cap → the planner uses its history-derived ceiling.
    minRooms: { type: Number, default: 1, min: 0 },
    maxRooms: { type: Number, default: 0, min: 0 },
    // Hourly rate in dollars — pay is computed from recorded hours, not per job.
    // This is the BASE rate: the rate in effect before any scheduled change in
    // rateHistory. A cleaning is always billed at the rate in effect ON ITS DATE
    // (see rateOn), so a raise never re-prices past work.
    payRate: { type: Number, default: 0 },
    // Scheduled rate changes: each { rate, effectiveFrom: "yyyy-MM-dd" } takes
    // effect on that date. Dates before the earliest entry use the base payRate.
    // e.g. a raise effective 8/1 = one entry { rate: new, effectiveFrom: "2026-08-01" }.
    rateHistory: {
      type: [{ rate: { type: Number, required: true }, effectiveFrom: { type: String, required: true } }],
      default: [],
    },
    // Hours worked before assignment tracking started, counted toward the
    // month in baselineMonth ("yyyy-MM") only — stale baselines don't leak
    // into later months.
    baselineHours: { type: Number, default: 0 },
    baselineMonth: { type: String, default: "" },
    // Running total the host has paid out — balance owed is computed as
    // all-time earnings minus this. Cleaners claim on different schedules
    // (right away / bi-weekly / at a threshold), so owed must survive months.
    paidAmount: { type: Number, default: 0 },
    // Every payout, itemised. paidAmount alone could not answer "what did I pay
    // and when", so a double-tap or a mis-typed figure was invisible afterwards
    // and could only be corrected by guessing an offsetting amount.
    //
    // paidAmount stays the authoritative total. Any part of it predating this
    // log shows as an opening figure (paidAmount − Σ payments) — so no backfill
    // is needed and nothing already recorded is lost.
    payments: {
      type: [
        {
          amount: { type: Number, required: true },
          paidOn: { type: String, required: true }, // yyyy-MM-dd, host's local date
          note: { type: String, default: "" },
        },
      ],
      default: [],
    },
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
