import mongoose from "mongoose";

// Who is currently typing in a guest↔host conversation.
//
// One row per (conversation, side), rewritten every couple of seconds while
// somebody is composing. There is no socket in this app, so "is typing" is a
// timestamp the other side polls rather than an event it receives: a side counts
// as typing while `at` is inside TYPING_WINDOW_MS. That also means a browser
// closed mid-sentence stops showing as typing on its own, with nothing to clean
// up — which a boolean flag would not.
//
// Keyed on phoneKey (digits only), NOT on guestPhone as typed. The guest sends
// the number the way they typed it and the host's inbox sends it back the way it
// was stored, so "(408) 555-1234" and "4085551234" would otherwise be two rows
// and neither side would ever see the other type.
const chatTypingSchema = new mongoose.Schema(
  {
    host: { type: mongoose.Schema.ObjectId, ref: "Host", required: true },
    phoneKey: { type: String, required: true },
    sender: { type: String, required: true, enum: ["guest", "host"] },
    at: { type: Date, required: true, default: Date.now },
  },
  { timestamps: true }
);

chatTypingSchema.index({ host: 1, phoneKey: 1, sender: 1 }, { unique: true });

export default mongoose.model("ChatTyping", chatTypingSchema);
