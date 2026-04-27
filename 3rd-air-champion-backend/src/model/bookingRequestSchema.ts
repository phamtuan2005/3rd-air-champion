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
    status: { type: String, required: true, enum: ["pending", "confirmed", "cancelled", "expired"] },
    notes: { type: String, default: "" },
  },
  { timestamps: true }
);

export default mongoose.model("BookingRequest", bookingRequestSchema);