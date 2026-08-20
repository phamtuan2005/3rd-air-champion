import { MessageReading } from "./urgentMessage";

// What to DO about a message, once it has been read.
//
// Split from the reading on purpose. Reading is about the guest's words; this is
// about a room and a night, and it is the half that can cost real money. The
// asymmetry runs through everything below: holding a room the guest abandons
// loses one night's revenue, while opening a room the guest walks into at 1am
// leaves two people with a claim on it and no good answer at the door. So
// nothing here recommends opening unless the message actually says so.

export type Verdict = "hold" | "open" | "ask";

export interface Recommendation {
  verdict: Verdict;
  // The sentence the host reads. Names the room, because that is the decision.
  headline: string;
  // Why, in one line.
  because: string;
  // Anything still unsettled, carried up from the reading.
  cautions: string[];
}

export interface StayContext {
  roomName: string;
  guestName: string;
  // "yyyy-MM-dd" the stay starts.
  startDate: string;
  // Weekday of startDate, 0=Sunday. Passed in rather than derived, so this stays
  // free of date-library and timezone concerns.
  startWeekday: number;
}

const WEEKDAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

/**
 * Turn a message reading into a recommendation about one stay.
 *
 * `stay` is the booking the host says this message is about. Matching a message
 * to a stay is not attempted here: getting that wrong is the same class of
 * mistake this whole tool exists to prevent.
 */
export const recommendAction = (
  reading: MessageReading,
  stay: StayContext,
): Recommendation => {
  const cautions = [...reading.notes];
  const room = stay.roomName;

  // A weekday in the message that is not the stay's own start day. Worth saying
  // out loud — it may be the wrong booking, or an arrival after midnight, which
  // lands on the day AFTER the night that was booked.
  if (reading.weekday != null && reading.weekday !== stay.startWeekday) {
    const said = WEEKDAY_NAMES[reading.weekday];
    const booked = WEEKDAY_NAMES[stay.startWeekday];
    const nextDay = (stay.startWeekday + 1) % 7;
    cautions.push(
      reading.afterMidnight && reading.weekday === nextDay
        ? `They say ${said}; the stay starts ${booked}. Consistent with arriving after midnight on the ${booked} night.`
        : `They say ${said}, but this stay starts ${booked} — check this is the right booking.`,
    );
  }

  if (reading.intent === "not-coming") {
    return {
      verdict: "open",
      headline: `Open the ${room}`,
      because: `${stay.guestName} says they are not coming.`,
      cautions: [
        ...cautions,
        `Once someone else books it, ${stay.guestName} cannot be let in. Open it only if you are sure.`,
      ],
    };
  }

  if (reading.intent === "arriving-late") {
    const when = reading.timeInWords ? ` — ${reading.timeInWords}` : "";
    return {
      verdict: "hold",
      headline: `Do NOT open the ${room}`,
      because: `${stay.guestName} is still coming, just late${when}.`,
      cautions: reading.timeInWords
        ? cautions
        : [...cautions, "They did not say how late — expect them at any hour."],
    };
  }

  return {
    verdict: "ask",
    headline: `Ask ${stay.guestName} before touching the ${room}`,
    because: "This message does not settle whether they are coming.",
    cautions: [
      ...cautions,
      `Leaving the ${room} as it is costs one night at most. Opening it wrongly cannot be undone once it sells.`,
    ],
  };
};
