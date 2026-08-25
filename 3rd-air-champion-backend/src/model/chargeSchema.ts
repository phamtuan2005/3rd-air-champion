import mongoose from "mongoose";

// Money a guest owes that is NOT attached to a stay.
//
// Fees normally live on the booking (`bookings[].fees`) and are counted once on
// the stay's start night. But unbooking DELETES every night of a stay, so a
// cancellation fee died with the thing it was charged for — Eddie cancelled two
// nights, owed a fee, and there was nowhere in TiMag to put it. This is that
// place. It also covers anything discovered after a guest has gone: damage
// found during cleaning, a late checkout nobody logged at the time.
//
// The mirror of Misc (house money OUT); this is guest money IN, so it ADDS to a
// month's revenue rather than being subtracted from it.
const chargeSchema = new mongoose.Schema(
  {
    host: { type: mongoose.Schema.ObjectId, ref: "Host", required: true },
    // Who owes it. Required — an unattributed charge is a number nobody can
    // chase, and chasing it is the whole point.
    guest: { type: mongoose.Schema.ObjectId, ref: "Guest", required: true },
    // Preset bucket: "Cancellation" | "Damage" | "Late checkout" | "Other".
    // Free-form so new buckets need no migration.
    label: { type: String, required: true, default: "Other" },
    amount: { type: Number, required: true },
    // yyyy-MM-dd the charge falls in — which MONTH's money it belongs to.
    // String-keyed like every other date in this app, never a Date through a
    // local timezone.
    date: { type: String, required: true },
    // What it was for, in the host's own words ("2 nights, cancelled 3 days
    // out"). Carried into the guest's card so the reason survives the month.
    note: { type: String, default: "" },
    // Charged is not collected. A fee sits unpaid until the money arrives, and
    // the host needs to see which ones are still outstanding.
    paid: { type: Boolean, default: false },
    // Context the deleted stay would otherwise have carried — room and dates
    // are gone once unbooked, so they are copied here at the moment of
    // cancellation rather than looked up later, when there is nothing to find.
    roomName: { type: String, default: "" },
    stayStart: { type: String, default: "" }, // yyyy-MM-dd
    stayNights: { type: Number, default: 0 },
  },
  { timestamps: true }
);

chargeSchema.index({ host: 1, date: -1 });
chargeSchema.index({ host: 1, guest: 1 });

chargeSchema.pre("validate", function (next) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(this.date as string))
    return next(new Error("date must be yyyy-MM-dd"));
  // A refund is a booking-level concern (the refund policy already handles it),
  // so a charge is always money owed TO the house.
  if (this.amount == null || this.amount <= 0)
    return next(new Error("Amount must be a positive number"));
  return next();
});

export default mongoose.model("Charge", chargeSchema);
