import { isBefore, startOfToday } from "date-fns";
import { dayType } from "./types/dayType";
import { roomType } from "./types/roomType";

// What the guest calendar says about one night: free, partly taken, sold out,
// blocked, or gone.
//
// This was a function inside the month grid. It moved out when the calendar
// gained a day-by-day list, because the list has to answer "is this night
// free" and a second copy of the rule is how two screens end up disagreeing —
// the guest sees "3 rooms free" in one and "sold out" in the other
// (TIBOOK.md rule 1). Both views call this, so they cannot.

export type TileStatus = "available" | "partial" | "full" | "blocked" | "past";

export interface NightStatus {
  status: TileStatus;
  roomsLeft: number;
  // The rooms in scope a guest could still have that night, so the list can
  // name them rather than only count them.
  freeRooms: roomType[];
}

// The calendar's own key for a night — local date parts, as the grid builds
// its cells, so a key here finds the same day the grid would.
export const nightKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export const nightStatus = (
  date: Date,
  scopedRooms: roomType[],
  monthMap: Map<string, dayType>,
  reservedMap?: Map<string, Set<string>>,
  today: Date = startOfToday(),
): NightStatus => {
  if (isBefore(date, today)) return { status: "past", roomsLeft: 0, freeRooms: [] };
  const dateKey = nightKey(date);
  const day = monthMap.get(dateKey);
  if (day?.isBlocked) return { status: "blocked", roomsLeft: 0, freeRooms: [] };
  // Unavailable = booked + reserved + host-blocked rooms. Per-room blocks live in day.blockedRooms
  // (day.isBlocked only covers whole-day blocks); without them, blocked rooms stayed bookable here.
  // A reserved (R) hold is an unpaid stay, not a vacancy — it counts as taken.
  const unavailableIds = new Set<string>(day?.bookings.map((b) => b.room?.id).filter(Boolean) as string[] ?? []);
  reservedMap?.get(dateKey)?.forEach((id) => unavailableIds.add(id));
  day?.blockedRooms?.forEach((r) => { if (r?.id) unavailableIds.add(r.id); });
  const freeRooms = scopedRooms.filter((r) => !unavailableIds.has(r.id));
  const roomsLeft = freeRooms.length;
  if (roomsLeft === 0) return { status: "full", roomsLeft: 0, freeRooms };
  if (roomsLeft < scopedRooms.length) return { status: "partial", roomsLeft, freeRooms };
  return { status: "available", roomsLeft, freeRooms };
};
