import mongoose from "mongoose";

// Someone hired to help run the business — the first is an AI prompt intern;
// engineers and others follow. Distinct from a Cleaner: a cleaner is paid per
// turnover from hours recorded against a room on a date, while staff are paid
// for a POST, hourly or on a fixed biweekly salary, whether or not a room
// changed hands that week.
const staffSchema = new mongoose.Schema(
  {
    host: { type: mongoose.Schema.ObjectId, ref: "Host", required: true },
    name: { type: String, required: true },
    // What they were hired to do ("AI prompt intern", "Software engineer").
    // Free text: the roles are not known in advance and a fixed list would need
    // a migration every time the business grows a new one.
    title: { type: String, default: "" },
    phone: { type: String, default: "" },
    email: { type: String, default: "" },
    // Same generated-avatar trick as Cleaner: only the description is stored.
    character: { type: String, default: "" },
    // yyyy-MM-dd. Nothing is owed before it, so it bounds every cost window.
    hiredOn: { type: String, required: true },
    // yyyy-MM-dd, set when they leave. "" = still with us. Kept rather than
    // deleted: their pay is part of what the business already spent, and
    // deleting the record would rewrite months that are closed.
    endedOn: { type: String, default: "" },
    // How the money is agreed, which decides how cost is derived:
    //   "hourly"   → rate × hours worked. Hours arrive from TiWork; until then
    //                an hourly staffer's cost is unknown, not zero.
    //   "biweekly" → a fixed amount every two weeks from hiredOn, owed whether
    //                or not any hours were logged.
    payType: { type: String, enum: ["hourly", "biweekly"], default: "hourly" },
    // Dollars: per hour when hourly, per two-week period when biweekly.
    payRate: { type: Number, default: 0 },
    // Scheduled changes, same shape and rule as Cleaner.rateHistory: the rate in
    // effect ON A DATE is used, so a raise never re-prices work already done.
    rateHistory: {
      type: [
        {
          rate: { type: Number, required: true },
          effectiveFrom: { type: String, required: true }, // yyyy-MM-dd
        },
      ],
      default: [],
    },
    // Dated notes rather than a single score. Performance is a history — "picked
    // up the booking-request prompts fast" in March means nothing if June has
    // overwritten it — and one number could not say what it was for.
    reviews: {
      type: [
        {
          date: { type: String, required: true }, // yyyy-MM-dd
          // 1–5, the host's own judgement.
          rating: { type: Number, min: 1, max: 5, required: true },
          note: { type: String, default: "" },
        },
      ],
      default: [],
    },
    // Running total actually paid out, mirroring Cleaner: earnings minus this is
    // what is owed, and staff claim on their own schedules.
    paidAmount: { type: Number, default: 0 },
    payments: {
      type: [
        {
          amount: { type: Number, required: true },
          paidOn: { type: String, required: true }, // yyyy-MM-dd
          note: { type: String, default: "" },
        },
      ],
      default: [],
    },
    // TiWork sign-in: they enter their phone plus this code. A shared secret
    // rather than a real login — but a phone number is not a secret, and these
    // entries become money owed, so something the host issues and can change is
    // the floor. Empty = they cannot sign in yet.
    accessCode: { type: String, default: "" },
    note: { type: String, default: "" },
  },
  { timestamps: true }
);

// Sign-in looks people up by phone. Not unique: a staff member could share a
// household number, and the code is what actually distinguishes them.
staffSchema.index({ phone: 1 });

// Deleting someone removes their work entries — an entry without a person is
// unreadable and would break populate on the host's review queue.
staffSchema.post("findOneAndDelete", async function (doc) {
  if (doc) {
    await mongoose.model("WorkEntry").deleteMany({ staff: doc._id });
  }
});

staffSchema.index({ host: 1, name: 1 }, { unique: true });

staffSchema.pre("validate", function (next) {
  if (this.payRate != null && this.payRate < 0)
    return next(new Error("Pay rate must be a positive number"));
  return next();
});

export default mongoose.model("Staff", staffSchema);
