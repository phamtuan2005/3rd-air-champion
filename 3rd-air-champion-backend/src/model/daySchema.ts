import mongoose from "mongoose";
import { isBefore, startOfToday } from "date-fns";
import { toZonedTime } from "date-fns-tz";

const daySchema = new mongoose.Schema(
  {
    calendar: {
      type: mongoose.Schema.ObjectId,
      ref: "Calendar",
      required: true,
    },
    date: { type: Date, required: true },
    isAirBnB: { type: Boolean, default: false },
    isBlocked: { type: Boolean, default: false },
    bookings: [
      {
        alias: { type: String, default: "" },
        notes: { type: String, default: "" },
        earlyCheckin: { type: Boolean, default: false },
        lateCheckout: { type: Boolean, default: false },
        room: { type: mongoose.Schema.ObjectId, ref: "Room" },
        guest: { type: mongoose.Schema.ObjectId, ref: "Guest" },
        price: { type: Number, default: "0" },
        description: { type: String, default: "" },
        duration: { type: Number, default: 1 },
        numberOfGuests: { type: Number, default: 0 },
        startDate: { type: Date },
        endDate: { type: Date },
      },
    ],
    blockedRooms: [{ type: mongoose.Schema.ObjectId, ref: "Room" }],
  },
  { timestamps: true }
);

daySchema.index({ calendarId: 1, date: 1 }, { unique: true });
daySchema.index({ isAirBnB: 1 });
daySchema.index({ isBlocked: 1 });

daySchema.pre(
  ["updateOne", "updateMany", "findOneAndUpdate"],
  async function (next) {
    const dayId = this.getQuery()._id;
    const dayUpdate = this.getUpdate();
    const day = await mongoose.model("Day").findById(dayId);

    if (
      dayUpdate &&
      typeof dayUpdate === "object" &&
      !Array.isArray(dayUpdate)
    ) {
      if ("bookings" in dayUpdate) {
        if (day.isBlocked)
          return next(
            new Error("A blocked day cannot have a guest or a room assigned.")
          );
      }
    }
  }
);

daySchema.pre("save", function (next) {
  if (this.date) {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    this.date = toZonedTime(this.date, timeZone);
  }

  if (this.isBlocked && this.bookings.length > 0) {
    return next(
      new Error("A blocked day cannot have a guest or a room assigned.")
    );
  }
  next();
});

export default mongoose.model("Day", daySchema);
