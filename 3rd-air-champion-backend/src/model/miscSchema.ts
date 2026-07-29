import mongoose from "mongoose";

// A miscellaneous house expense the host keys in (supplies, utilities,
// maintenance, etc.). Purely a bookkeeping log — NOT netted against rental
// income anywhere; totals live only inside the Misc tool.
const miscSchema = new mongoose.Schema(
  {
    host: { type: mongoose.Schema.ObjectId, ref: "Host", required: true },
    // Preset bucket: "Supplies" | "Utilities" | "Maintenance" | "Other".
    // Free-form is allowed so the client can add buckets later without a migration.
    category: { type: String, required: true, default: "Other" },
    // Free-text description ("Costco paper towels"); for "Other" it also names
    // the custom category.
    label: { type: String, default: "" },
    amount: { type: Number, required: true },
    // yyyy-MM-dd — the expense date, or the FIRST occurrence for a recurring one.
    date: { type: String, required: true },
    // Repeats every month from `date`'s month onward (e.g. a utility bill).
    recurring: { type: Boolean, default: false },
    // yyyy-MM — last month a recurring expense applies (inclusive). "" = ongoing.
    endMonth: { type: String, default: "" },
    note: { type: String, default: "" },
  },
  { timestamps: true }
);

miscSchema.index({ host: 1, date: 1 });

miscSchema.pre("validate", function (next) {
  if (this.amount != null && this.amount < 0)
    return next(new Error("Amount must be a positive number"));
  return next();
});

export default mongoose.model("Misc", miscSchema);
