import { addDays, format, parseISO } from "date-fns";
import { useRoomChip, useTiBookTheme } from "../../contexts/TiBookThemeContext";
import type { Habit, Proposal } from "../../util/bookingHabit";

// TiBook coming forward to a regular: "your usual, the next weeks it is open,
// tap to request" — instead of waiting for them to find the dates themselves
// while their room's weekdays fill up (host, 2026-10-07: "TiBook should be
// proactive to help the returning guests, proposing the booking for them").
//
// A proposal only ever opens the ordinary booking request, filled in; the guest
// still reads it and sends it. Nothing is booked from this card.

const DAY = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** "Mon → Fri, 4 nights" or "Thursday night". */
export const habitLabel = (h: Habit) =>
  h.nights === 1 ? `${DAY[h.startWeekday]} night` : `${SHORT[h.startWeekday]} → ${SHORT[(h.startWeekday + h.nights) % 7]}, ${h.nights} nights`;

const stayDates = (p: Proposal) => {
  const a = parseISO(p.start);
  const out = addDays(a, p.nights.length);
  return p.nights.length === 1
    ? format(a, "EEE MMM d")
    : a.getMonth() === out.getMonth()
      ? `${format(a, "MMM d")}–${format(out, "d")}`
      : `${format(a, "MMM d")}–${format(out, "MMM d")}`;
};

const UsualStayCard = ({
  firstName,
  habits,
  proposals,
  fill,
  roomOf,
  onRequest,
  onDismiss,
}: {
  firstName: string;
  habits: Habit[];
  proposals: Proposal[];
  /** How many of the coming weeks the guest's usual room is already taken on their nights. */
  fill: { taken: number; known: number };
  roomOf: (id: string) => { name: string; color?: string } | undefined;
  onRequest: (p: Proposal) => void;
  onDismiss: () => void;
}) => {
  const { theme } = useTiBookTheme();
  const roomChip = useRoomChip();
  const main = habits[0];
  const usual = roomOf(main.rooms[0]);
  // Said only when it is true and worth saying: at least three weeks seen, and
  // the room taken on half or more of them.
  const goingFast = fill.known >= 3 && fill.taken / fill.known >= 0.5;

  return (
    <div className={`mx-3 mt-2 shrink-0 rounded-xl border px-3 py-2 ${theme.surfaceSubtle} ${theme.surfaceBorder}`}>
      <div className="flex items-start justify-between gap-2">
        <p className={`text-sm ${theme.surfaceText}`}>
          <span className="font-bold">{firstName ? `${firstName}, your usual` : "Your usual"}:</span>{" "}
          {habits.slice(0, 2).map(habitLabel).join(" and ")}
          {usual ? ` in ${usual.name}` : ""}.
        </p>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Not now"
          className={`-mr-1 shrink-0 rounded px-1 text-lg leading-none ${theme.surfaceMuted}`}
        >
          ×
        </button>
      </div>
      <p className={`text-xs ${theme.surfaceMuted}`}>
        {goingFast && usual
          ? `${usual.name} is already booked ${fill.taken} of the next ${fill.known} weeks on those nights — these are still open:`
          : "Still open in the coming weeks — book ahead:"}
      </p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {proposals.map((p) => {
          const room = roomOf(p.roomId);
          return (
            <button
              key={`${p.start}-${p.roomId}`}
              type="button"
              onClick={() => onRequest(p)}
              title={p.usualRoom ? undefined : `${usual?.name ?? "Your usual room"} is taken that week`}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-semibold text-white ${theme.btn} ${theme.btnHover}`}
            >
              {stayDates(p)}
              {room && (
                <span className={`${roomChip(room)} rounded px-1.5 py-0.5 text-[11px] font-bold text-black`}>{room.name}</span>
              )}
            </button>
          );
        })}
      </div>
      {proposals.some((p) => !p.usualRoom) && usual && (
        <p className={`mt-1 text-[11px] ${theme.surfaceMuted}`}>
          Where {usual.name} is taken, another room you've stayed in is offered.
        </p>
      )}
    </div>
  );
};

export default UsualStayCard;
