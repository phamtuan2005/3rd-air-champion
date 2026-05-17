import { z } from "zod";
import mongoose from "mongoose";

export const modifyBookingObject = z.object({
  room: z.string().refine((val) => mongoose.Types.ObjectId.isValid(val), {
    message: "Invalid room",
  }),
  startDate: z.date({
    message: "Please select a date",
  }),
  endDate: z.date({
    message: "Please select a date",
  }),
});

export type modifyBookingSchema = z.infer<typeof modifyBookingObject>;