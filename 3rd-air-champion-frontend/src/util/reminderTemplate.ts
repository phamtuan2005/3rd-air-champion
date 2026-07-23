import { addDays, format } from "date-fns";
import { bookingType } from "./types/bookingType";

export const TEMPLATE_KEY = "reminderMessageTemplate";

// {{itinerary}} expands to the room for a single-room stay, or a night-by-night
// room breakdown when the guest's stay rolls across multiple rooms.
export const DEFAULT_TEMPLATE =
  "Hello {{name}}, I would like to remind you that you will stay at TT House for {{stayDuration}} ({{startDate}}).\n{{itinerary}}\nThe main entrance door code is {{doorCode}}. Many thanks for staying at TT House. I wish you a pleasant stay!";

const parseLocal = (s: string) => new Date(s.split("T")[0] + "T00:00:00");

// One line per booking in the stay: date (or date range) + room + room code.
const itineraryLines = (chain: bookingType[]) =>
  chain.map((b) => {
    const start = parseLocal(b.startDate);
    const nights = b.duration || 1;
    const label =
      nights === 1
        ? format(start, "EEE MMM d")
        : `${format(start, "EEE MMM d")} – ${format(addDays(start, nights - 1), "EEE MMM d")}`;
    return `• ${label}: ${b.room.name}${b.room.roomCode ? ` (${b.room.roomCode})` : ""}`;
  });

const buildItinerary = (chain: bookingType[]) => {
  const first = chain[0];
  if (chain.length === 1) {
    return `Your room is ${first.room.name}${first.room.roomCode ? ` ${first.room.roomCode}` : ""}.`;
  }
  return `Your stay is in a different room each part of your visit:\n${itineraryLines(chain).join("\n")}\nEach new room is ready after 2 PM. If you head out earlier, feel free to leave your belongings — our cleaning team will happily move them to your next room for you.`;
};

export const resolveTemplate = (
  template: string,
  // A single booking, or the rolled-up chain of the guest's consecutive stays
  // across rooms (chain[0] = the arriving booking, the rest = later nights).
  bookingOrChain: bookingType | bookingType[],
  startDate: string,
  doorCode: string,
  airBnBName: string = "",
  airBnBAddress: string = "",
  houseRules: string = "",
) => {
  const chain = Array.isArray(bookingOrChain) ? bookingOrChain : [bookingOrChain];
  const primary = chain[0];
  const totalNights = chain.reduce((sum, b) => sum + (b.duration || 1), 0);
  const stayDuration =
    totalNights === 1 ? "tomorrow night" : `${totalNights} nights, starting tomorrow`;

  let message = template
    // When there are no house rules, remove the placeholder along with the blank
    // line above it so the message doesn't end with stray newlines.
    .replace(/\n*\{\{houseRules\}\}/g, houseRules.trim() ? `\n\n${houseRules.trim()}` : "")
    .replace(/\{\{name\}\}/g, primary.guest.alias || primary.alias || primary.guest.name)
    .replace(/\{\{itinerary\}\}/g, buildItinerary(chain))
    .replace(/\{\{stayDuration\}\}/g, stayDuration)
    .replace(/\{\{duration\}\} \{\{nightWord\}\}, starting tomorrow/g, stayDuration)
    .replace(
      /\{\{duration\}\} \{\{nightWord\}\}/g,
      totalNights === 1 ? "tomorrow night" : `${totalNights} nights`,
    )
    .replace(/\{\{duration\}\}/g, String(totalNights))
    .replace(/\{\{nightWord\}\}/g, totalNights === 1 ? "night" : "nights")
    .replace(/\{\{startDate\}\}/g, startDate)
    .replace(/\{\{room\}\}/g, primary.room.name)
    .replace(/\{\{roomCode\}\}/g, primary.room.roomCode || "")
    .replace(/\{\{doorCode\}\}/g, doorCode)
    .replace(/\{\{airBnBName\}\}/g, airBnBName)
    .replace(/\{\{airBnBAddress\}\}/g, airBnBAddress.split("\n").join(", "));

  // Backward-compat: a multi-room stay under a template that has no
  // {{itinerary}} placeholder still gets the room-by-room breakdown appended,
  // so no room is ever left off the reminder.
  if (chain.length > 1 && !template.includes("{{itinerary}}")) {
    message += `\n\nYour room changes during the stay:\n${itineraryLines(chain).join("\n")}`;
  }

  return message;
};
