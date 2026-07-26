import mongoose from "mongoose";

// Remembers the cleaning schedule last TEXTED to a cleaner for a given fixed
// week, so the host (or any cohost) can be warned when the live plan drifts
// from what the cleaner was actually told and a re-send is owed. Shared across
// the account — cohosts resend too, so this can't live in one browser.
const sentScheduleSchema = new mongoose.Schema(
  {
    host: { type: mongoose.Schema.ObjectId, ref: "Host", required: true },
    cleaner: { type: mongoose.Schema.ObjectId, ref: "Cleaner", required: true },
    // Monday (yyyy-MM-dd) of the fixed Mon–Sun week the text covered.
    weekMonday: { type: String, required: true },
    // Opaque signature of the schedule as sent (date|room|guestCount per row).
    // The client computes it; the server just stores & echoes it for comparison.
    signature: { type: String, default: "" },
  },
  { timestamps: true } // updatedAt doubles as "last sent at"
);

sentScheduleSchema.index({ host: 1, cleaner: 1, weekMonday: 1 }, { unique: true });

export default mongoose.model("SentSchedule", sentScheduleSchema);
