import mongoose from "mongoose";

// A guest the host has let read TiBook's visitor numbers — for helping develop
// the site, not as a feature for guests in general.
//
// Its own collection, NOT a field on the guest. Guest records are reachable
// through /graphql, which has no login in front of it; a code hash sitting on
// the guest would be one resolver change away from being downloadable by
// anyone. Kept apart, nothing that serves guests ever loads it.
//
// The code itself is never stored, only its SHA-256. The code is random and
// long (see tibookStatsAccessRoute), so a fast hash is enough — bcrypt's
// slowness protects guessable passwords, and nobody chose this one.
const tibookStatsGrantSchema = new mongoose.Schema(
  {
    host: { type: mongoose.Schema.ObjectId, ref: "Host", required: true },
    guest: { type: mongoose.Schema.ObjectId, ref: "Guest", required: true },
    codeHash: { type: String, required: true },
    // Who gave it, from the token — a cohost's grant should say so.
    grantedBy: { type: String, default: "" },
  },
  { timestamps: true }
);

// One grant per guest per house. Giving access again replaces the code, which
// is how a lost or leaked code is changed.
tibookStatsGrantSchema.index({ host: 1, guest: 1 }, { unique: true });
tibookStatsGrantSchema.index({ codeHash: 1 }, { unique: true });

export default mongoose.model("TiBookStatsGrant", tibookStatsGrantSchema);
