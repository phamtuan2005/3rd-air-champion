import mongoose from "mongoose";

// One extra job (CleaningJob) scheduled onto one cleaner's VISIT — a cleaner
// on a morning — on top of the rooms they turn over that morning.
//
// Attached to the visit, not a room: "the windows" are not a room's, and hours
// are recorded per visit anyway (one total on the morning's first assignment),
// so the visit is where an extra explains the hours. Only on a morning the
// cleaner has at least one room (the host's rule: extras ride on a cleaning,
// never stand alone) — and taken away with the visit when the cleaner's last
// room that morning is unassigned or given to someone else.
//
// The job's name is copied in, so taking a job off the list later never
// rewrites what a past visit says was done.
const cleaningExtraSchema = new mongoose.Schema(
  {
    host: { type: mongoose.Schema.ObjectId, ref: "Host", required: true },
    date: { type: String, required: true }, // yyyy-MM-dd, the cleaning morning
    cleaner: { type: mongoose.Schema.ObjectId, ref: "Cleaner", required: true },
    job: { type: mongoose.Schema.ObjectId, ref: "CleaningJob", required: true },
    name: { type: String, required: true, maxlength: 40 },
    // The host's word on THIS visit's job — where, or what exactly: "in Cute &
    // King". The job's name stays general ("Baseboard") so it can be picked
    // again next time with a different note ("Chill & Cozy"); writing the rooms
    // into the name made a new job for every combination (host, 2026-10-07).
    note: { type: String, default: "", maxlength: 120 },
  },
  { timestamps: true }
);

cleaningExtraSchema.index({ host: 1, date: 1, cleaner: 1, job: 1 }, { unique: true });

cleaningExtraSchema.pre("validate", function (next) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String((this as any).date))) return next(new Error("date must be yyyy-MM-dd"));
  next();
});

export default mongoose.model("CleaningExtra", cleaningExtraSchema);
