import mongoose from "mongoose";

const wishListSchema = new mongoose.Schema(
  {
    host: { type: mongoose.Schema.ObjectId, ref: "Host", required: true },
    guestPhone: { type: String, required: true },
    guestName: { type: String, required: true },
    dates: [{ type: Date }],
    status: { type: String, enum: ["waiting", "notified", "booked"], default: "waiting" },
    // What jobs/wishListNotify.ts has done for this guest, as yyyy-MM-dd night
    // keys. Telling a guest their night opened up used to wait on the host
    // noticing it in TiMag and texting by hand, and a night freed at 2pm was
    // sometimes still unannounced at 9pm — gone to nobody.
    //
    // `announcedNights`: free nights the guest has been told about, so the
    // job does not repeat itself every 30 minutes. A night that is taken again
    // drops out, and is announced again if it reopens.
    //
    // `default: undefined` is deliberate. "Never run on this entry" must look
    // different from "ran, nothing free": an entry the host had already marked
    // Notified by text before the job existed is adopted silently, rather than
    // the guest getting the same news twice.
    announcedNights: { type: [String], default: undefined },
    // Nights seen free on the last run but not announced yet. A night has to
    // be free on two runs in a row before anyone is told: the AirBnB sync has
    // briefly emptied the calendar before (2026-08-08, 93 bookings), and every
    // wish-list guest would have been told their night was free.
    freeLastRun: { type: [String], default: [] },
  },
  { timestamps: true }
);

wishListSchema.index({ host: 1, guestPhone: 1 }, { unique: true });

export default mongoose.model("WishList", wishListSchema);
