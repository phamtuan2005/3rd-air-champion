import { useState } from "react";
import { isAfter, startOfToday, format, parseISO, addDays, isBefore } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { dayType } from "../../../util/types/dayType";
import { roomType } from "../../../util/types/roomType";
import { bookingType } from "../../../util/types/bookingType";
import RoomBadge from "../../shared/RoomBadge";
import { markAirBnBBlocked } from "../../../util/bookingOperations";

type BlockedAirBnBDates = Record<string, { start: string; duration: number }[]>;

interface BlockAirBnBModalProps {
  monthMap: Map<string, dayType>;
  rooms: roomType[];
  blockedAirBnBDates?: BlockedAirBnBDates;
  token: string;
  onDaysUpdate: (updatedDays: dayType[]) => void;
}

type ChecklistItem =
  | { kind: "booking"; key: string; label: string; bookingId: string }
  | { kind: "block"; key: string; label: string };

function toRangeKey(booking: bookingType): string {
  return `${booking.room?.id ?? ""}|${booking.startDate}|${booking.endDate}`;
}

function isAlreadyBlockedOnAirBnB(
  booking: bookingType,
  blockedAirBnBDates: BlockedAirBnBDates,
  timeZone: string,
): boolean {
  if (!booking.room) return false;
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

function getBlockedRoomRanges(
  monthMap: Map<string, dayType>,
  timeZone: string,
  today: Date,
): Map<string, { startDate: string; endDate: string }[]> {
  const roomDateMap = new Map<string, string[]>();
  for (const [dateStr, day] of monthMap.entries()) {
    const localDate = toZonedTime(dateStr, timeZone);
    if (isBefore(localDate, today) && localDate.toDateString() !== today.toDateString()) continue;
    for (const room of day.blockedRooms) {
      if (!roomDateMap.has(room.id)) roomDateMap.set(room.id, []);
      roomDateMap.get(room.id)!.push(dateStr);
    }
  }

  const result = new Map<string, { startDate: string; endDate: string }[]>();
  for (const [roomId, dates] of roomDateMap.entries()) {
    const sorted = [...dates].sort();
    const ranges: { startDate: string; endDate: string }[] = [];
    let i = 0;
    while (i < sorted.length) {
      let j = i;
      while (
        j + 1 < sorted.length &&
        format(addDays(toZonedTime(sorted[j], timeZone), 1), "yyyy-MM-dd") === sorted[j + 1]
      ) j++;
      ranges.push({ startDate: sorted[i], endDate: sorted[j] });
      i = j + 1;
    }
    result.set(roomId, ranges);
  }
  return result;
}

const BlockAirBnBModal = ({ monthMap, rooms, blockedAirBnBDates, token, onDaysUpdate }: BlockAirBnBModalProps) => {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const today = startOfToday();

  const [selected, setSelected] = useState<Record<string, string>>({});
  const [localDone, setLocalDone] = useState<Set<string>>(new Set());

  const markBookingBlocked = (bookingId: string, rangeKey: string) => {
    setLocalDone((prev) => new Set(prev).add(rangeKey));
    markAirBnBBlocked({ id: bookingId, blocked: true }, token)
      .then((updatedDays: dayType[]) => {
        onDaysUpdate(updatedDays);
        // Remove from localDone now that airbnbBlocked=true will handle filtering.
        // Keeping it would silently hide future bookings sharing the same range key.
        setLocalDone((prev) => { const next = new Set(prev); next.delete(rangeKey); return next; });
      })
      .catch((err) => {
        setLocalDone((prev) => { const next = new Set(prev); next.delete(rangeKey); return next; });
        console.error("Failed to mark as blocked on AirBnB:", err);
      });
  };

  const markLocalDone = (key: string) => setLocalDone((prev) => new Set(prev).add(key));

  // --- Bookings ---
  const uniqueById = new Map<string, bookingType>();
  for (const day of monthMap.values()) {
    for (const booking of day.bookings) {
      if (!booking.room) continue;
      if (booking.guest.name !== "AirBnB" && !uniqueById.has(booking.id))
        uniqueById.set(booking.id, booking);
    }
  }
  const seenRanges = new Map<string, bookingType>();
  for (const booking of uniqueById.values()) {
    const key = toRangeKey(booking);
    if (!seenRanges.has(key)) seenRanges.set(key, booking);
  }
  const actionableBookings = [...seenRanges.values()]
    .filter((b) => {
      const end = toZonedTime(b.endDate, timeZone);
      return isAfter(end, today) || end.toDateString() === today.toDateString();
    })
    .filter((b) => blockedAirBnBDates ? !isAlreadyBlockedOnAirBnB(b, blockedAirBnBDates, timeZone) : true)
    .filter((b) => !b.airbnbBlocked && !localDone.has(toRangeKey(b)))
    .sort((a, b) => parseISO(a.startDate).getTime() - parseISO(b.startDate).getTime());

  // --- Blocked room ranges ---
  const blockedRangesByRoom = getBlockedRoomRanges(monthMap, timeZone, today);

  // --- Build per-room checklist items ---
  const roomStats = rooms
    .filter((r) => r.active)
    .map((room) => {
      const bookingItems: ChecklistItem[] = actionableBookings
        .filter((b) => b.room?.id === room.id)
        .map((b) => ({
          kind: "booking" as const,
          key: toRangeKey(b),
          label: formatDateRange(b.startDate, b.endDate, timeZone),
          bookingId: b.id,
        }));

      const blockItems: ChecklistItem[] = (blockedRangesByRoom.get(room.id) ?? [])
        .filter(({ startDate, endDate }) => {
          const key = `block|${room.id}|${startDate}|${endDate}`;
          return !localDone.has(key);
        })
        .map(({ startDate, endDate }) => ({
          kind: "block" as const,
          key: `block|${room.id}|${startDate}|${endDate}`,
          label: `${formatDateRange(startDate, endDate, timeZone)} 🔒`,
        }));

      const items: ChecklistItem[] = [...bookingItems, ...blockItems];
      return { room, items };
    })
    .filter((s) => s.items.length > 0);

  const totalPending = roomStats.reduce((sum, s) => sum + s.items.length, 0);

  return (
    <div className="p-3 flex flex-col gap-3 h-full overflow-y-auto">
      <h2 className="text-sm font-bold text-gray-700">
        Block AirBnB
        {blockedAirBnBDates && totalPending > 0 && (
          <span className="ml-2 text-[10px] font-normal text-rose-500">
            {totalPending} pending
          </span>
        )}
      </h2>

      {!blockedAirBnBDates ? (
        // Until the sync returns we can't tell what's already reflected on AirBnB —
        // listing everything as pending here would mirror the bogus first-load badge.
        <p className="text-xs text-gray-400 font-medium mt-2 animate-pulse">
          Syncing with AirBnB…
        </p>
      ) : roomStats.length === 0 ? (
        <p className="text-xs text-emerald-600 font-medium mt-2">
          All bookings and blocked rooms are already reflected on AirBnB.
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
            {roomStats.map(({ room, items }) => {
              const currentKey = selected[room.id] ?? items[0].key;
              const currentItem = items.find((i) => i.key === currentKey) ?? items[0];
              const isLoading = localDone.has(currentKey);

              return (
                <tr key={room.id} className="border-b border-gray-100">
                  <td className="py-2 pr-1 align-middle">
                    <RoomBadge room={room} rooms={roomStats.map(s => s.room)} />
                  </td>
                  <td className="py-2 pr-1 align-middle">
                    <select
                      className="text-[10px] border border-gray-200 rounded px-1 py-0.5 w-full max-w-[130px] bg-white"
                      value={currentKey}
                      onChange={(e) =>
                        setSelected((prev) => ({ ...prev, [room.id]: e.target.value }))
                      }
                    >
                      {items.map((item) => (
                        <option key={item.key} value={item.key}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2 align-middle">
                    <button
                      type="button"
                      disabled={isLoading}
                      className="text-[10px] px-1.5 py-0.5 rounded text-white bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50"
                      onClick={() => {
                        if (currentItem.kind === "booking") {
                          markBookingBlocked(currentItem.bookingId, currentKey);
                        } else {
                          markLocalDone(currentKey);
                        }
                      }}
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