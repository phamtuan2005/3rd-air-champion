import { z } from "zod";
import mongoose from "mongoose";

export const modifyBookingObject = z.object({
  room: z.string().refine((val) => mongoose.Types.ObjectId.isValid(val), {
    message: "Invalid room",
  }),
  startDate: z.date({
    message: "Please select a date and time",
  }),
  endDate: z.date({
    message: "Please select a date and time",
  }),
  duration: z
    .number("Must be a number")
    .min(1, { message: "Must stay for at least 1 day" }),
});

export type modifyBookingSchema = z.infer<typeof modifyBookingObject>;
