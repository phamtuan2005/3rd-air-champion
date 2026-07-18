import { bookingType } from "./types/bookingType";

export const TEMPLATE_KEY = "reminderMessageTemplate";

export const DEFAULT_TEMPLATE =
  "Hello {{name}}, I would like to remind you that you will stay at TT house AirBnB for {{stayDuration}} ({{startDate}}). Your room is {{room}} {{roomCode}}. The main entrance door code is {{doorCode}}. Many thanks for staying at TT House. I wish you a pleasant stay!";

export const resolveTemplate = (
  template: string,
  booking: bookingType,
  startDate: string,
  doorCode: string,
  airBnBName: string = "",
  airBnBAddress: string = "",
  houseRules: string = "",
) =>
  template
    // When there are no house rules, remove the placeholder along with the blank line
    // above it so the message doesn't end with stray newlines.
    .replace(/\n*\{\{houseRules\}\}/g, houseRules.trim() ? `\n\n${houseRules.trim()}` : "")
    .replace(/\{\{name\}\}/g, booking.guest.alias || booking.alias || booking.guest.name)
    .replace(/\{\{stayDuration\}\}/g, booking.duration === 1 ? "tomorrow night" : `${booking.duration} nights, starting tomorrow`)
    .replace(/\{\{duration\}\} \{\{nightWord\}\}, starting tomorrow/g, booking.duration === 1 ? "tomorrow night" : `${booking.duration} nights, starting tomorrow`)
    .replace(/\{\{duration\}\} \{\{nightWord\}\}/g, booking.duration === 1 ? "tomorrow night" : `${booking.duration} nights`)
    .replace(/\{\{duration\}\}/g, String(booking.duration))
    .replace(/\{\{nightWord\}\}/g, booking.duration === 1 ? "night" : "nights")
    .replace(/\{\{startDate\}\}/g, startDate)
    .replace(/\{\{room\}\}/g, booking.room.name)
    .replace(/\{\{roomCode\}\}/g, booking.room.roomCode || "")
    .replace(/\{\{doorCode\}\}/g, doorCode)
    .replace(/\{\{airBnBName\}\}/g, airBnBName)
    .replace(/\{\{airBnBAddress\}\}/g, airBnBAddress.split("\n").join(", "));