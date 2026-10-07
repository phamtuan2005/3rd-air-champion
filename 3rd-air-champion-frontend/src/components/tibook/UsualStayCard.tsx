import { addDays, format, parseISO } from "date-fns";
import { useRoomChip, useTiBookTheme } from "../../contexts/TiBookThemeContext";
import type { Habit, Proposal } from "../../util/bookingHabit";

// TiBook coming forward to a regular: "your usual, the next weeks it is open,
// tap to request" — instead of waiting for them to find the dates themselves
// while their room's weekdays fill up (host, 2026-10-07: "TiBook should be
// proactive to help the returning guests, proposing the booking for them").
//
// A POPUP over the page, at TiBook's popup type scale (`tibook-type`): a strip
// under the header was too small to read and too easy to miss (host, same
// day). It opens once per visit, after anything else that opens on arrival.
//
// A proposal only ever opens the ordinary booking request, filled in; the guest
// still reads it and sends it. Nothing is booked from here.

const DAY = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** "Mon → Fri, 4 nights" or "Thursday night". */
export const habitLabel = (h: Habit) =>
  h.nights === 1 ? `${DAY[h.startWeekday]} night` : `${SHORT[h.startWeekday]} → ${SHORT[(h.startWeekday + h.nights) % 7]}, ${h.nights} nights`;

const stayDates = (p: Proposal) => {
  const a = parseISO(p.start);
  const out = addDays(a, p.nights.length);
  return p.nights.length === 1
    ? format(a, "EEE, MMM d")
    : a.getMonth() === out.getMonth()
      ? `${format(a, "EEE MMM d")} – ${format(out, "d")}`
      : `${format(a, "EEE MMM d")} – ${format(out, "MMM d")}`;
};

const UsualStayCard = ({
  firstName,
  habits,
  proposals,
  fill,
  roomOf,
  onRequest,
  onClose,
}: {
  firstName: string;
  habits: Habit[];
  proposals: Proposal[];
  /** How many of the coming weeks the guest's usual room is already taken on their nights. */
  fill: { taken: number; known: number };
  roomOf: (id: string) => { name: string; color?: string } | undefined;
  onRequest: (p: Proposal) => void;
  onClose: () => void;
}) => {
  const { theme } = useTiBookTheme();
  const roomChip = useRoomChip();
  const main = habits[0];
  const usual = roomOf(main.rooms[0]);
  // Said only when it is true and worth saying: at least three weeks seen, and
  // the room taken on half or more of them.
  const goingFast = fill.known >= 3 && fill.taken / fill.known >= 0.5;

  return (
    <div className={`tibook-type fixed inset-0 z-[130] flex items-end justify-center p-4 sm:items-center ${theme.scrim}`} onClick={onClose}>
      <div
        role="dialog"
        aria-label="Stays to book ahead"
        className={`w-full max-w-sm overflow-hidden rounded-2xl p-5 shadow-2xl ${theme.surface}`}
        onClick={(e) => e.stopPropagation()}
      >
        <p className={`text-xl font-bold ${theme.surfaceStrong}`}>{firstName ? `Welcome back, ${firstName}` : "Welcome back"}</p>
        {/* "TT noted that…", not "your habit" — the house's assistant noticing,
            the way a host who knows a regular would say it (host, 2026-10-07). */}
        <p className={`mt-1 text-base ${theme.surfaceText}`}>
          TT noted that you usually stay <span className="font-semibold">{habits.slice(0, 2).map(habitLabel).join(" and ")}</span>
          {usual ? (
            <>
              {" "}in{" "}
              <span className={`${roomChip(usual)} rounded-md px-1.5 py-0.5 font-bold text-black`}>{usual.name}</span>
            </>
          ) : null}
          .
        </p>
        <p className={`mt-2 text-sm ${theme.surfaceMuted}`}>
          {goingFast && usual
            ? `${usual.name} is already booked ${fill.taken} of the next ${fill.known} weeks on those nights. These are still open:`
            : "These are still open in the coming weeks — book ahead:"}
        </p>

        <div className="mt-3 flex flex-col gap-2">
          {proposals.map((p) => {
            const room = roomOf(p.roomId);
            return (
              <button
                key={`${p.start}-${p.roomId}`}
                type="button"
                onClick={() => onRequest(p)}
                className={`flex items-center justify-between gap-3 rounded-xl px-4 py-3 text-left text-base font-semibold text-white ${theme.btn} ${theme.btnHover}`}
              >
                <span>
                  {stayDates(p)}
                  {!p.usualRoom && usual && (
                    <span className="block text-xs font-normal opacity-90">{usual.name} is taken that week — another room you've stayed in</span>
                  )}
                </span>
                {room && (
                  <span className={`${roomChip(room)} shrink-0 rounded-md px-2 py-0.5 text-sm font-bold text-black`}>{room.name}</span>
                )}
              </button>
            );
          })}
        </div>

        <p className={`mt-3 text-xs ${theme.surfaceMuted}`}>Tap a stay to see the request — nothing is sent until you send it.</p>
        <button type="button" onClick={onClose} className={`mt-3 w-full rounded-xl py-2.5 text-base font-semibold ${theme.surfaceMuted}`}>
          Not now
        </button>
      </div>
    </div>
  );
};

export default UsualStayCard;
