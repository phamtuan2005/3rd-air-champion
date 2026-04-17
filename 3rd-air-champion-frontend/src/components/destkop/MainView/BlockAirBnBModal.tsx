import { useState } from "react";
import { isAfter, startOfToday, format, parseISO, addDays, isBefore } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { dayType } from "../../../util/types/dayType";
import { roomType } from "../../../util/types/roomType";
import { bookingType } from "../../../util/types/bookingType";
import { getRoomColor } from "../../../util/getRoomColor";
import { markAirBnBBlocked } from "../../../util/bookingOperations";

type BlockedAirBnBDates = Record<string, { start: string; duration: number }[]>;

interface BlockAirBnBModalProps {
  monthMap: Map<string, dayType>;
  rooms: roomType[];
  blockedAirBnBDates?: BlockedAirBnBDates;
  token: string;
  onDaysUpdate: (updatedDays: dayType[]) => void;
}

function toRangeKey(booking: bookingType): string {
  return `${booking.room.id}|${booking.startDate}|${booking.endDate}`;
}

function isAlreadyBlockedOnAirBnB(
  booking: bookingType,
  blockedAirBnBDates: BlockedAirBnBDates,
  timeZone: string,
): boolean {
  const blocked = blockedAirBnBDates[booking.room.id];
  if (!blocked || blocked.length === 0) return false;
  const bookingStart = toZonedTime(booking.startDate, timeZone);
  const bookingEnd = toZonedTime(booking.endDate, timeZone);
  return blocked.some(({ start, duration }) => {
    const blockStart = toZonedTime(start, timeZone);
    const blockEnd = addDays(blockStart, duration);
    return isBefore(bookingStart, blockEnd) && isAfter(bookingEnd, blockStart);
  });
}

function formatDateRange(startDate: string, endDate: string, timeZone: string): string {
  const start = toZonedTime(startDate, timeZone);
  const end = toZonedTime(endDate, timeZone);
  const startStr = format(start, "MMM d");
  const endStr = format(end, "MMM d");
  if (startStr === endStr) return startStr;
  return format(start, "MMM") === format(end, "MMM")
    ? `${startStr}–${format(end, "d")}`
    : `${startStr}–${endStr}`;
}

const BlockAirBnBModal = ({ monthMap, rooms, blockedAirBnBDates, token, onDaysUpdate }: BlockAirBnBModalProps) => {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const today = startOfToday();

  // Selected dropdown value per room: roomId -> rangeKey
  const [selected, setSelected] = useState<Record<string, string>>({});
  // Optimistic: keys the user has marked done locally (instant UI feedback)
  const [localDone, setLocalDone] = useState<Set<string>>(new Set());

  const setBlocked = (bookingId: string, rangeKey: string) => {
    // Immediately hide the item
    setLocalDone((prev) => new Set(prev).add(rangeKey));
    markAirBnBBlocked({ id: bookingId, blocked: true }, token)
      .then((updatedDays: dayType[]) => {
        // Patch days state in place — no full reload, modal stays mounted
        onDaysUpdate(updatedDays);
      })
      .catch((err) => {
        // Revert on error so the item reappears
        setLocalDone((prev) => {
          const next = new Set(prev);
          next.delete(rangeKey);
          return next;
        });
        console.error("Failed to mark as blocked on AirBnB:", err);
      });
  };

  // Collect unique non-AirBnB bookings — dedup by ID then by (room, start, end)
  const uniqueById = new Map<string, bookingType>();
  for (const day of monthMap.values()) {
    for (const booking of day.bookings) {
      if (booking.guest.name !== "AirBnB" && !uniqueById.has(booking.id)) {
        uniqueById.set(booking.id, booking);
      }
    }
  }
  const seenRanges = new Map<string, bookingType>();
  for (const booking of uniqueById.values()) {
    const key = toRangeKey(booking);
    if (!seenRanges.has(key)) {
      seenRanges.set(key, booking);
    }
  }
  const uniqueBookings: bookingType[] = [...seenRanges.values()];

  // Upcoming + not auto-blocked by AirBnB sync + not already marked blocked on backend
  const actionable = uniqueBookings
    .filter((b) => {
      const end = toZonedTime(b.endDate, timeZone);
      return isAfter(end, today) || end.toDateString() === today.toDateString();
    })
    .filter((b) =>
      blockedAirBnBDates
        ? !isAlreadyBlockedOnAirBnB(b, blockedAirBnBDates, timeZone)
        : true,
    )
    .filter((b) => !b.airbnbBlocked && !localDone.has(toRangeKey(b)))
    .sort((a, b) => parseISO(a.startDate).getTime() - parseISO(b.startDate).getTime());

  // Group by active room
  const roomStats = rooms
    .filter((r) => r.active)
    .map((room) => ({
      room,
      bookings: actionable.filter((b) => b.room.id === room.id),
    }))
    .filter((s) => s.bookings.length > 0);

  const maxNameLen = Math.max(...roomStats.map((s) => s.room.name.length), 0);
  const roomBoxWidth = `${maxNameLen * 6.5 + 16}px`;

  return (
    <div className="p-3 flex flex-col gap-3 h-full overflow-y-auto">
      <h2 className="text-sm font-bold text-gray-700">
        Block AirBnB
        {roomStats.length > 0 && (
          <span className="ml-2 text-[10px] font-normal text-rose-500">
            {actionable.length} pending
          </span>
        )}
      </h2>

      {roomStats.length === 0 ? (
        <p className="text-xs text-emerald-600 font-medium mt-2">
          All non-AirBnB bookings are already blocked on AirBnB.
        </p>
      ) : (
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="text-left text-gray-500 border-b">
              <th className="pb-1 font-semibold">Room</th>
              <th className="pb-1 font-semibold" colSpan={2}>Dates</th>
            </tr>
          </thead>
          <tbody>
            {roomStats.map(({ room, bookings }) => {
              const currentKey = selected[room.id] ?? toRangeKey(bookings[0]);
              const currentBooking =
                bookings.find((b) => toRangeKey(b) === currentKey) ?? bookings[0];
              const isLoading = localDone.has(currentKey);

              return (
                <tr key={room.id} className="border-b border-gray-100">
                  <td className="py-2 pr-1 align-middle">
                    <span
                      className={`${getRoomColor(room.name)} text-white text-[10px] font-medium py-0.5 rounded inline-block text-center whitespace-nowrap`}
                      style={{ width: roomBoxWidth }}
                    >
                      {room.name}
                    </span>
                  </td>
                  <td className="py-2 pr-1 align-middle">
                    <select
                      className="text-[10px] border border-gray-200 rounded px-1 py-0.5 w-full max-w-[130px] bg-white"
                      value={currentKey}
                      onChange={(e) =>
                        setSelected((prev) => ({ ...prev, [room.id]: e.target.value }))
                      }
                    >
                      {bookings.map((b) => {
                        const key = toRangeKey(b);
                        return (
                          <option key={key} value={key}>
                            {formatDateRange(b.startDate, b.endDate, timeZone)}
                          </option>
                        );
                      })}
                    </select>
                  </td>
                  <td className="py-2 align-middle">
                    <button
                      type="button"
                      disabled={isLoading}
                      className="text-[10px] px-1.5 py-0.5 rounded text-white bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50"
                      onClick={() => setBlocked(currentBooking.id, currentKey)}
                    >
                      {isLoading ? "…" : "Done"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      <p className="text-[10px] text-gray-400 mt-auto">
        Select a date, press <span className="text-emerald-600 font-medium">Done</span> after
        blocking it on AirBnB. Synced across devices.
      </p>
    </div>
  );
};

export default BlockAirBnBModal;