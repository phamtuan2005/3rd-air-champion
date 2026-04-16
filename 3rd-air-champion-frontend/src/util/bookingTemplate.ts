import { bookingType } from "./types/bookingType";

export const BOOKING_TEMPLATE_KEY = "bookingMessageTemplate";

export const DEFAULT_BOOKING_TEMPLATE =
  "Hello {{name}}, your booking at TT House AirBnB is confirmed! Room: {{room}} ({{roomCode}}), from {{startDate}} to {{endDate}} ({{duration}} {{nightWord}}). The door code is {{doorCode}}. Total: ${{price}}. We look forward to hosting you!";

export const resolveBookingTemplate = (
  template: string,
  booking: bookingType,
  startDate: string,
  endDate: string,
  doorCode: string,
  airBnBName: string = "",
  airBnBAddress: string = "",
) =>
  template
    .replace(/\{\{name\}\}/g, booking.guest.alias || booking.alias || booking.guest.name)
    .replace(/\{\{duration\}\}/g, String(booking.duration))
    .replace(/\{\{nightWord\}\}/g, booking.duration === 1 ? "night" : "nights")
    .replace(/\{\{startDate\}\}/g, startDate)
    .replace(/\{\{endDate\}\}/g, endDate)
    .replace(/\{\{room\}\}/g, booking.room.name)
    .replace(/\{\{roomCode\}\}/g, booking.room.roomCode || "")
    .replace(/\{\{doorCode\}\}/g, doorCode)
    .replace(/\{\{price\}\}/g, booking.price ? String(booking.price * booking.duration) : "")
    .replace(/\{\{airBnBName\}\}/g, airBnBName)
    .replace(/\{\{airBnBAddress\}\}/g, airBnBAddress.split("\n").join(", "));