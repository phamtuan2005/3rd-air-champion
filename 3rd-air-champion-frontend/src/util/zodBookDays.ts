import { z } from "zod";
import mongoose from "mongoose";

export const bookDaysZodObject = z.object({
  room: z.string().refine((val) => mongoose.Types.ObjectId.isValid(val), {
    message: "Invalid room",
  }),
  guest: z.string().refine((val) => mongoose.Types.ObjectId.isValid(val), {
    message: "Invalid guest",
  }),
  date: z.date({
    message: "Please select a date and time",
  }),
  duration: z
    .number("Must be a number")
    .min(1, { message: "Must stay for at least 1 day" }),
  numberOfGuests: z
    .number("Must be a number")
    .min(1, { message: "Must be at least 1 guest" }),
});

export type bookDaySchema = z.infer<typeof bookDaysZodObject>;
