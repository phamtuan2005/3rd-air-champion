import mongoose from "mongoose";

// One day's work, entered by the staff member themselves in TiWork.
//
// Hours here are a CLAIM until the host approves them. Only approved hours
// reach payroll, so a mistyped 8 instead of 0.8 becomes a conversation rather
// than an overpayment — the same shape as cleaners, where the host records the
// hours, except the typing is delegated and the confirming is not.
const workEntrySchema = new mongoose.Schema(
  {
    host: { type: mongoose.Schema.ObjectId, ref: "Host", required: true },
    // Exactly ONE of these is set. Both kinds of worker log hours the same way
    // and land in the same review queue; they differ only in which record they
    // are paid from.
    staff: { type: mongoose.Schema.ObjectId, ref: "Staff", default: null },
    cleaner: { type: mongoose.Schema.ObjectId, ref: "Cleaner", default: null },

    // yyyy-MM-dd — the day worked, not the day submitted. Someone catching up on
    // Friday still logs Tuesday's hours against Tuesday.
    date: { type: String, required: true },
    hours: { type: Number, required: true },
    // The brief: what they actually did. Free text, deliberately short-form.
    report: { type: String, default: "" },
    // Rooms a cleaner says they did. Only used when no assignment exists for the
    // day — the planner never drafted it, or the host never got to it — so the
    // work would otherwise have no record of WHAT was cleaned. When assignments
    // do exist they are the authority and this stays empty.
    rooms: { type: [String], default: [] },
    // submitted → the staff member's claim, awaiting the host
    // approved  → counts toward pay
    // rejected  → seen and declined; kept, not deleted, so the person can see
    //             what happened to it rather than watching an entry vanish
    status: {
      type: String,
      enum: ["submitted", "approved", "rejected"],
      default: "submitted",
    },
    // The rate used when it was approved, captured at approval time. Frozen on
    // purpose: a later raise must not re-price work already approved and paid,
    // the same rule cleaners' rateOn enforces by date.
    approvedRate: { type: Number, default: 0 },
    approvedOn: { type: String, default: "" }, // yyyy-MM-dd
    // Why it was declined, so the staff member is told rather than left guessing.
    hostNote: { type: String, default: "" },
  },
  { timestamps: true }
);

// The host's review queue and a staff member's own history are the two ways this
// is ever read.
workEntrySchema.index({ host: 1, status: 1, date: -1 });
workEntrySchema.index({ staff: 1, date: -1 });
workEntrySchema.index({ cleaner: 1, date: -1 });
// One claim per cleaner per DAY. Hours are not tracked per room: a cleaner does
// several rooms in one visit and is paid for the visit, which is why the Clean
// panel records a cleaner-day and puts the whole total on the day's first
// assignment with 0 on the rest. Re-submitting a day therefore edits that day's
// claim rather than stacking a second one.
workEntrySchema.index(
  { cleaner: 1, date: 1 },
  { unique: true, partialFilterExpression: { cleaner: { $type: "objectId" } } },
);

workEntrySchema.pre("validate", function (next) {
  if (!this.staff && !this.cleaner)
    return next(new Error("An entry must belong to a staff member or a cleaner"));
  if (this.hours == null || this.hours <= 0)
    return next(new Error("Hours must be greater than zero"));
  // A day has 24 hours; anything beyond is a typo, and catching it here means
  // it never reaches the host's queue looking like a real claim.
  if (this.hours > 24) return next(new Error("Hours cannot exceed 24 in a day"));
  return next();
});

export default mongoose.model("WorkEntry", workEntrySchema);
