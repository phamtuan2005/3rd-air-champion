import { formatInTimeZone } from "date-fns-tz";
import Room from "../model/roomSchema";
import Day from "../model/daySchema";
import BookingRequest from "../model/bookingRequestSchema";
import { nightStatus } from "../shared/generated/util/nightStatus";

// Which rooms are free on which night, read the way TiBook's calendar reads it.
//
// This was inside the wish-list job (jobs/wishListNotify) until the TiBook
// connector for AI assistants (route/assistantRoute) needed the same answer. Two
// copies of "load the nights, then ask nightStatus" is how an assistant would
// come to offer a guest a night the wish-list chat calls taken, so both read it
// from here.
//
// Taken means booked, held (a "reserved" request is an unpaid stay, not a
// vacancy), blocked for the whole day, or blocked for that room. The rule
// itself is the frontend's nightStatus, copied in by
// scripts/sync-cleaning-rule.js.

const DAY_MS = 86_400_000;

// The house is in Silicon Valley. "Tonight" is the house's tonight, not the
// server's: on a UTC box, 5pm Pacific is already tomorrow, and tonight's
// freed room would count as past and never be offered.
export const HOUSE_TIME_ZONE = "America/Los_Angeles";
/** Today at the house, yyyy-MM-dd. */
export const houseToday = (now = new Date()) => formatInTimeZone(now, HOUSE_TIME_ZONE, "yyyy-MM-dd");

/** yyyy-MM-dd of a stored date, by its UTC day — how every date here is keyed. */
export const keyOf = (d: Date | string) => new Date(d).toISOString().slice(0, 10);
export const addNights = (key: string, n: number) =>
  keyOf(new Date(Date.parse(`${key}T00:00:00Z`) + n * DAY_MS));

// The shared rule reads a night by its LOCAL date parts (it was written for a
// browser), so a key goes in as local midnight of that same date.
export const localDate = (key: string) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
};

export interface HouseRoom {
  id: string;
  name: string;
}

export interface HouseNights {
  rooms: HouseRoom[];
  /** The calendar's days, keyed yyyy-MM-dd, in the shape nightStatus reads. Booking guests carry their phone. */
  monthMap: Map<string, any>;
  /** Pending and reserved requests, as stored. */
  requests: any[];
  /** The ACTIVE rooms free on a night, by name. Nights before `todayKey` have none. */
  freeRoomsOn: (night: string) => HouseRoom[];
}

/**
 * The house's nights from `fromKey` up to (not including) `untilKey`.
 * `todayKey` is the house's today: nights before it count as gone.
 */
export const loadHouseNights = async (
  hostId: any,
  calendarId: any,
  fromKey: string,
  untilKey: string,
  todayKey: string,
): Promise<HouseNights> => {
  const rooms: HouseRoom[] = (await Room.find({ host: hostId, active: true }).select("_id name").lean()).map(
    (r: any) => ({ id: String(r._id), name: r.name }),
  );
  const days = await Day.find({
    calendar: calendarId,
    date: { $gte: new Date(`${fromKey}T00:00:00Z`), $lt: new Date(`${untilKey}T00:00:00Z`) },
  })
    .populate("bookings.guest", "phone")
    .lean();
  // The shape the shared rule reads: rooms as { id }.
  const monthMap = new Map<string, any>();
  for (const day of days as any[]) {
    monthMap.set(keyOf(day.date), {
      isBlocked: day.isBlocked,
      bookings: (day.bookings ?? []).map((b: any) => ({ room: b.room ? { id: String(b.room) } : null, guest: b.guest })),
      blockedRooms: (day.blockedRooms ?? []).map((r: any) => ({ id: String(r) })),
    });
  }

  // A "reserved" request is an unpaid hold: taken, as on the calendar.
  const requests = await BookingRequest.find({ host: hostId, status: { $in: ["pending", "reserved"] } }).lean();
  const reservedMap = new Map<string, Set<string>>();
  for (const r of requests as any[]) {
    if (r.status !== "reserved") continue;
    for (let i = 0; i < r.duration; i++) {
      const night = addNights(keyOf(r.date), i);
      if (!reservedMap.has(night)) reservedMap.set(night, new Set());
      reservedMap.get(night)!.add(String(r.room));
    }
  }

  const today = localDate(todayKey);
  const freeRoomsOn = (night: string) =>
    nightStatus(localDate(night), rooms as any, monthMap, reservedMap, today).freeRooms.map((r: any) => ({
      id: r.id as string,
      name: r.name as string,
    }));

  return { rooms, monthMap, requests: requests as any[], freeRoomsOn };
};
