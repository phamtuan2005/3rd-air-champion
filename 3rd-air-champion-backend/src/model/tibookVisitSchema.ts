import mongoose from "mongoose";

// One row per DEVICE per UTC DAY that opened TiBook — not per page load. The
// question the host asks is "how many people", and a guest reloading the
// calendar twenty times while they decide is one person having one look.
// Keeping it to a row a day also bounds the collection by people, not by
// reloads, however long a phone keeps TiBook open.
//
// There is no name or phone here on purpose. `visitorId` is a random id the
// device made up for itself; it is never joined to the phone a guest gives when
// they book, so this collection cannot say who anyone is — only how many.
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
  },
  { timestamps: true }
);

// The upsert's key. Unique, so two tabs opening at once make one row, not two.
tibookVisitSchema.index({ host: 1, visitorId: 1, day: 1 }, { unique: true });

export default mongoose.model("TiBookVisit", tibookVisitSchema);
