import { z } from "zod";
import mongoose from "mongoose";

export const ANY_ROOM_SENTINEL = "__any__";

const bookingItemSchema = z.object({
  rooms: z
    .array(
      z.string().refine(
        (val) => val === ANY_ROOM_SENTINEL || mongoose.Types.ObjectId.isValid(val),
        { message: "Invalid room" }
      )
    )
    .min(1, { message: "Select at least one room" }),
  date: z.date({
    message: "Please select a date",
  }),
  duration: z
    .number("Must be a number")
    .min(1, { message: "Must stay for at least 1 day" }),
});

export const bookDaysZodObject = z.object({
  guest: z.string().refine((val) => mongoose.Types.ObjectId.isValid(val), {
    message: "Invalid guest",
  }),
  numberOfGuests: z
    .number("Must be a number")
    .min(1, { message: "Must be at least 1 guest" }),
  bookings: z
    .array(bookingItemSchema)
    .min(1, { message: "Add at least one booking" }),
});

export type bookDaySchema = z.infer<typeof bookDaysZodObject>;
export type bookingItemSchema = z.infer<typeof bookingItemSchema>;