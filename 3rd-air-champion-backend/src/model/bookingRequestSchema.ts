import mongoose from "mongoose";

const bookingRequestSchema = new mongoose.Schema(
  {
    host: { type: mongoose.Schema.ObjectId, ref: "Host", required: true },
    guestName: { type: String, required: true },
    guestPhone: { type: String, required: true },
    date: { type: Date, required: true },
    room: { type: mongoose.Schema.ObjectId, ref: "Room", required: true },
    duration: { type: Number, required: true },
    numberOfGuests: { type: Number, required: true },
    status: { type: String, required: true, enum: ["pending", "confirmed", "cancelled", "expired", "reserved"] },
    notes: { type: String, default: "" },
    // Which door the request came in by: "" for TiBook (its form and TT), or
    // "assistant" for an AI assistant booking through the TiBook connector
    // (route/assistantRoute). Set by the server, so the host can trust it when
    // counting how many guests now book through assistants.
    source: { type: String, default: "" },
  },
  { timestamps: true }
);

export default mongoose.model("BookingRequest", bookingRequestSchema);