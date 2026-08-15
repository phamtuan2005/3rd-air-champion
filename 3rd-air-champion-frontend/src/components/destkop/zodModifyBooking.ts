import { z } from "zod";
import mongoose from "mongoose";

export const modifyBookingObject = z.object({
  room: z.string().refine((val) => mongoose.Types.ObjectId.isValid(val), {
    message: "Invalid room",
  }),
  startDate: z.date({
    message: "Please select a date",
  }),
  duration: z.number({ message: "Please enter duration" }).int().min(1, "At least 1 night"),
  numberOfGuests: z
    .number({ message: "Please enter number of guests" })
    .int()
    .min(1, "At least 1 guest"),
});

export type modifyBookingSchema = z.infer<typeof modifyBookingObject>;