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
});

export type modifyBookingSchema = z.infer<typeof modifyBookingObject>;