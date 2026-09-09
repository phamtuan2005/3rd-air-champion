import mongoose from "mongoose";

// One row per message. A "thread" is every row sharing a (host, guestPhone) —
// there is no thread document, because a guest is identified by their phone
// everywhere else in TiBook (wish lists, bookings, holds) and giving messages a
// second notion of identity would eventually disagree with the first.
//
// `sender` rather than `from`: `from` is a reserved word in enough query
// languages that it is not worth finding out which ones.
const guestMessageSchema = new mongoose.Schema(
  {
    host: { type: mongoose.Schema.ObjectId, ref: "Host", required: true },
    // Stored on every message, not looked up. A guest can write before they
    // have ever booked, so there may be no Guest record to join to, and the
    // name they gave when they wrote is the name they were called then.
    guestName: { type: String, required: true },
    guestPhone: { type: String, required: true },
    sender: { type: String, required: true, enum: ["guest", "host"] },
    body: { type: String, required: true },
    // Read state is per side, and each side only ever marks the OTHER side's
    // messages. Kept as two flags rather than one "read" so the host's unread
    // count cannot be cleared by the guest opening their own thread.
    readByHost: { type: Boolean, default: false },
    readByGuest: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// The two reads this collection serves: one guest's thread, and the host's
// whole inbox in arrival order.
guestMessageSchema.index({ host: 1, guestPhone: 1, createdAt: 1 });

export default mongoose.model("GuestMessage", guestMessageSchema);
