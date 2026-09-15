import mongoose from "mongoose";

// One row per DEVICE per UTC DAY that opened TiBook — not per page load. The
// question the host asks is "how many people", and a guest reloading the
// calendar twenty times while they decide is one person having one look.
// Keeping it to a row a day also bounds the collection by people, not by
// reloads, however long a phone keeps TiBook open.
//
// No name, and no phone UNLESS the guest agreed. `visitorId` is a random id the
// device made up for itself. `guestPhone` is filled in only after the guest has
// said yes to TiBook remembering their number (guestConsent on the frontend):
// the house wants to see which guests visit, and a guest who agreed to be
// remembered has agreed to be recognised. Everyone else stays a count.
//
// Per ROW, so linking runs forward from the day they agreed. The same device's
// earlier, anonymous days are not rewritten into that guest's history.
const tibookVisitSchema = new mongoose.Schema(
  {
    host: { type: mongoose.Schema.ObjectId, ref: "Host", required: true },
    visitorId: { type: String, required: true },
    // yyyy-MM-dd, the UTC day, decided by the server — a phone's own clock and
    // zone are not trusted to say which day it is.
    day: { type: String, required: true },
    continent: { type: String, required: true, default: "Unknown" },
    // Kept alongside the continent so a mapping mistake can be corrected by
    // re-reading the zone, rather than being baked in forever.
    timeZone: { type: String, default: "" },
    // Normalised exactly as guest records are (normalizePhone), so TiMag can
    // look the name up by equality. "" when the visit is not tied to anyone.
    guestPhone: { type: String, default: "" },
  },
  { timestamps: true }
);

// The upsert's key. Unique, so two tabs opening at once make one row, not two.
tibookVisitSchema.index({ host: 1, visitorId: 1, day: 1 }, { unique: true });

export default mongoose.model("TiBookVisit", tibookVisitSchema);
