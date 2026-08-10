import mongoose from "mongoose";

// Remembers that the check-in reminder for a stay has been TEXTED to the guest.
//
// This lived in one browser's localStorage, so Cindy could not see that
// Anh-Tuan had already sent it — and each of them saw an unticked box for work
// the other had done. Two people share this account; "did anyone send it yet"
// is an account-level fact, not a per-device one. Same reasoning as
// sentScheduleSchema.
//
// `taskId` is the client's stable identity for one stay's reminder
// (startDate-endDate-guestId-roomId). The server stores it opaquely rather than
// re-deriving it, so the two cannot disagree about what counts as "the same
// reminder".
const sentReminderSchema = new mongoose.Schema(
  {
    host: { type: mongoose.Schema.ObjectId, ref: "Host", required: true },
    taskId: { type: String, required: true },
    // Who pressed send, so the other person sees "Sent by Anh-Tuan" rather than
    // an anonymous tick and has to ask.
    sentBy: { type: String, default: "" },
  },
  { timestamps: true } // createdAt doubles as "sent at"
);

// One record per reminder per account: marking twice is idempotent rather than
// duplicating, which matters because the send button and the checkbox both
// write here.
sentReminderSchema.index({ host: 1, taskId: 1 }, { unique: true });

export default mongoose.model("SentReminder", sentReminderSchema);