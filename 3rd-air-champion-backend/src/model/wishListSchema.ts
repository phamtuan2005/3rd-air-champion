import mongoose from "mongoose";

const wishListSchema = new mongoose.Schema(
  {
    host: { type: mongoose.Schema.ObjectId, ref: "Host", required: true },
    guestPhone: { type: String, required: true },
    guestName: { type: String, required: true },
    dates: [{ type: Date }],
    status: { type: String, enum: ["waiting", "notified", "booked"], default: "waiting" },
  },
  { timestamps: true }
);

wishListSchema.index({ host: 1, guestPhone: 1 }, { unique: true });

export default mongoose.model("WishList", wishListSchema);