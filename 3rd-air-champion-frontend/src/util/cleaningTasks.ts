import { addDays, startOfToday } from "date-fns";
import { dayType } from "./types/dayType";
import { bookingType } from "./types/bookingType";

// How far back a vacated-but-never-cleaned room stays on the list.
export const CLEANING_LOOKBACK_DAYS = 14;

export interface CleaningItem {
  booking: bookingType; // the stay whose checkout dirtied the room
  checkoutKey: string; // last night of that stay (yyyy-MM-dd)
  // Scenario A: guest checks out this morning (turnover day).
  // Scenario B (false): room has sat empty since an earlier checkout.
  vacatedToday: boolean;
  isCompleted: boolean;
  completedDate: string | null;
  nextCheckIn: bookingType | null;
  nextCheckInDate: string | null;
  // Next guest arrives today — cleaning cannot be deferred.
  mustCleanToday: boolean;
}

export type CompletedTasks = Record<string, { completed: boolean; date: string | null }>;

export const getCompletedTasks = (): CompletedTasks =>
  JSON.parse(localStorage.getItem("completedTasks") || "{}");

export const cleaningTaskId = (endDate: string, roomId: string) => `clean-${endDate}-${roomId}`;

const dateKey = (d: Date) => d.toISOString().split("T")[0];

// Every room that currently needs cleaning. A room is dirty when its most recent
// stay (within the lookback window) has checked out, no guest occupies it tonight,
// and the cleaning task hasn't been completed. Today's checkouts are always listed
// (completed ones shown struck-through by the UI); older vacated rooms hide once
// their cleaning is marked done.
export const getCleaningItems = (
  monthMap: Map<string, dayType>,
  completed: CompletedTasks,
): CleaningItem[] => {
  const today = startOfToday();
  const todayKey = dateKey(today);
  const yesterdayKey = dateKey(addDays(today, -1));

  // Most recent checkout per room within the lookback window (soft holds excluded —
  // a lapsed reservation never occupied the room). daysAgo = how many days back the
  // stay's last night was (1 = last night, i.e. checkout this morning).
  const latestCheckout = new Map<string, { booking: bookingType; checkoutKey: string; daysAgo: number }>();
  for (let i = 1; i <= CLEANING_LOOKBACK_DAYS; i++) {
    const key = dateKey(addDays(today, -i));
    const day = monthMap.get(key);
    if (!day) continue;
    for (const b of day.bookings) {
      if (!b.room || b.reserved) continue;
      if (b.endDate.split("T")[0] !== key) continue; // last night of the stay
      if (!latestCheckout.has(b.room.id))
        latestCheckout.set(b.room.id, { booking: b, checkoutKey: key, daysAgo: i });
    }
  }

  const items: CleaningItem[] = [];
  latestCheckout.forEach(({ booking, checkoutKey, daysAgo }, roomId) => {
    // Skip only rooms re-occupied on a PREVIOUS night after the checkout — a guest
    // already slept there, so this cleaning cycle is moot. A guest arriving TODAY
    // does NOT skip: the room still needs cleaning before they check in.
    // Reserved bookings DO count as occupancy here (unlike the checkout scan above):
    // the hold bar flags unpaid CURRENT guests amber, and ignoring them listed
    // occupied rooms as "empty since checkout".
    for (let j = 1; j < daysAgo; j++) {
      const key = dateKey(addDays(today, -j));
      if (monthMap.get(key)?.bookings.some((b) => b.room?.id === roomId)) return;
    }

    const task = completed[cleaningTaskId(booking.endDate, roomId)];
    const isCompleted = !!task?.completed;
    const vacatedToday = checkoutKey === yesterdayKey;
    // Older vacated rooms disappear once cleaned; today's stay visible (struck through).
    if (isCompleted && !vacatedToday) return;

    // Find the next check-in for this room within 30 days.
    let nextCheckIn: bookingType | null = null;
    let nextCheckInDate: string | null = null;
    for (let i = 0; i <= 30; i++) {
      const key = dateKey(addDays(today, i));
      const day = monthMap.get(key);
      const found = day?.bookings.find(
        (b) => b.startDate.split("T")[0] === key && b.room?.id === roomId,
      );
      if (found) {
        nextCheckIn = found;
        nextCheckInDate = key;
        break;
      }
    }

    items.push({
      booking,
      checkoutKey,
      vacatedToday,
      isCompleted,
      completedDate: task?.date ?? null,
      nextCheckIn,
      nextCheckInDate,
      mustCleanToday: nextCheckInDate === todayKey,
    });
  });

  // Urgency order: earliest next check-in first (no check-in last); early
  // check-in requests float up, late checkouts sink within the same day.
  return items.sort((a, b) => {
    const keyOf = (it: CleaningItem) => it.nextCheckInDate ?? "9999-99-99";
    if (keyOf(a) !== keyOf(b)) return keyOf(a) < keyOf(b) ? -1 : 1;
    const prio = (it: CleaningItem) =>
      it.nextCheckIn?.earlyCheckin ? 0 : it.booking.lateCheckout ? 2 : 1;
    return prio(a) - prio(b);
  });
};

export interface ForecastEntry {
  checkoutBooking: bookingType; // stay vacating that morning (or, for probable
  // entries, the arriving stay — it carries the room identity)
  sameDayCheckIn: bookingType | null; // confirmed turnover — hard deadline
  // Odds the cleaning happens: 1 when the checkout is confirmed, else the
  // room's trailing occupancy.
  rebookOdds: number;
  // True when no booking exists yet but the cleaning is expected anyway: the
  // night before a confirmed check-in is empty, and at high occupancy that
  // night almost surely sells last-minute. The gap-filler must leave on the
  // check-in morning, dirtying the room again right before the arrival.
  probable?: boolean;
}

export const OCCUPANCY_WINDOW_DAYS = 60;

// Measured odds that a sellable night ends up occupied, per room, over the
// trailing window — the data-driven estimate of last-minute demand. Blocked
// nights are excluded from the denominator; a missing Day doc means the night
// sat empty. Reserved (amber) stays count as occupied ([[project-reserved-not-vacancy]]).
export const getRoomOccupancyOdds = (
  monthMap: Map<string, dayType>,
  windowDays = OCCUPANCY_WINDOW_DAYS,
): Map<string, number> => {
  const today = startOfToday();
  const roomIds = new Set<string>();
  for (let i = 1; i <= windowDays; i++) {
    const day = monthMap.get(dateKey(addDays(today, -i)));
    if (!day) continue;
    day.bookings.forEach((b) => b.room && roomIds.add(b.room.id));
    day.blockedRooms?.forEach((r) => roomIds.add(r.id));
  }

  const odds = new Map<string, number>();
  roomIds.forEach((roomId) => {
    let booked = 0;
    let sellable = 0;
    for (let i = 1; i <= windowDays; i++) {
      const day = monthMap.get(dateKey(addDays(today, -i)));
      if (day?.isBlocked || day?.blockedRooms?.some((r) => r.id === roomId)) continue;
      sellable++;
      if (day?.bookings.some((b) => b.room?.id === roomId)) booked++;
    }
    if (sellable > 0) odds.set(roomId, booked / sellable);
  });
  return odds;
};

export interface CleaningForecastDay {
  morningKey: string; // yyyy-MM-dd of the cleaning morning
  entries: ForecastEntry[];
}

// How far ahead to look for the confirmed check-in that bounds an in-service
// gap — a room with a booking on the horizon is between guests, not retired.
const GAP_ARRIVAL_SCAN_DAYS = 60;

// Cleaning workload for the next `horizon` mornings, starting tomorrow.
//
// Two sources feed each morning:
//  1. Confirmed checkouts — a stay's last night was yesterday (odds = 1, or the
//     room's rebooking odds if nothing has re-booked it yet).
//  2. Probable gap turnovers — a room sitting empty & sellable last night, still
//     inside an in-service gap (a confirmed check-in lies ahead). At the room's
//     occupancy rate that empty night sells last-minute and the guest checks out
//     THIS morning. This is modelled for EVERY interior night of the gap, not
//     just the one before the arrival: after a checkout the very next night is
//     the highest-demand one to re-sell, so its morning-after needs cleaning too
//     (e.g. a Sunday-night sale leaving Monday, well before Tuesday's arrival).
export const getCleaningForecast = (
  monthMap: Map<string, dayType>,
  horizon = 7,
): CleaningForecastDay[] => {
  const today = startOfToday();
  const occupancyOdds = getRoomOccupancyOdds(monthMap);

  // Every room the map has ever seen — the candidate pool for gap turnovers.
  const roomIds = new Set<string>();
  monthMap.forEach((day) => day.bookings.forEach((b) => b.room && roomIds.add(b.room.id)));

  // Reserved (amber) stays DO occupy a room ([[project-reserved-not-vacancy]]).
  const isOccupied = (roomId: string, nightKey: string) =>
    monthMap.get(nightKey)?.bookings.some((b) => b.room?.id === roomId) ?? false;
  const isBlockedNight = (roomId: string, nightKey: string) => {
    const day = monthMap.get(nightKey);
    return !!(day?.isBlocked || day?.blockedRooms?.some((r) => r.id === roomId));
  };
  // Next confirmed (non-reserved) arrival for a room at/after a day offset —
  // its presence means the room is still in service, bounding the gap.
  const nextConfirmedArrival = (roomId: string, fromOffset: number) => {
    for (let j = fromOffset; j <= fromOffset + GAP_ARRIVAL_SCAN_DAYS; j++) {
      const key = dateKey(addDays(today, j));
      const found = monthMap
        .get(key)
        ?.bookings.find(
          (b) => b.room?.id === roomId && !b.reserved && b.startDate.split("T")[0] === key,
        );
      if (found) return { arriving: found, offset: j };
    }
    return null;
  };

  const out: CleaningForecastDay[] = [];
  for (let d = 1; d <= horizon; d++) {
    const morningKey = dateKey(addDays(today, d));
    const lastNightKey = dateKey(addDays(today, d - 1));
    const lastNight = monthMap.get(lastNightKey);
    const entries: ForecastEntry[] = [];
    const covered = new Set<string>(); // rooms already given an entry this morning

    // 1. Confirmed checkouts. A missing prior-night Day doc just means nobody
    //    stayed — skip the checkout scan, but the gap loop below still runs.
    if (lastNight) {
      for (const b of lastNight.bookings) {
        if (!b.room || b.reserved) continue;
        if (b.endDate.split("T")[0] !== lastNightKey) continue; // last night of the stay
        const sameDayCheckIn =
          monthMap
            .get(morningKey)
            ?.bookings.find(
              (n) => n.room?.id === b.room.id && n.startDate.split("T")[0] === morningKey,
            ) ?? null;
        entries.push({
          checkoutBooking: b,
          sameDayCheckIn,
          rebookOdds: sameDayCheckIn ? 1 : occupancyOdds.get(b.room.id) ?? 1,
        });
        covered.add(b.room.id);
      }
    }

    // 2. Probable gap turnovers — every empty, sellable night inside a bounded
    //    in-service gap likely sold last-minute and checks out this morning.
    for (const roomId of roomIds) {
      if (covered.has(roomId)) continue;
      if (isOccupied(roomId, lastNightKey)) continue; // slept in → not a turnover
      if (isBlockedNight(roomId, lastNightKey)) continue; // couldn't sell that night
      const next = nextConfirmedArrival(roomId, d);
      if (!next) continue; // open-ended vacancy → not a gap, don't forecast
      entries.push({
        checkoutBooking: next.arriving, // carries the room identity for the chip
        sameDayCheckIn: next.offset === d ? next.arriving : null,
        rebookOdds: occupancyOdds.get(roomId) ?? 1,
        probable: true,
      });
      covered.add(roomId);
    }

    if (entries.length) out.push({ morningKey, entries });
  }
  return out;
};

// min = dirty rooms that must be cleaned before today's check-ins;
// max = every room currently needing cleaning.
export const getCleaningCounts = (items: CleaningItem[]) => {
  const pending = items.filter((it) => !it.isCompleted);
  return {
    min: pending.filter((it) => it.mustCleanToday).length,
    max: pending.length,
  };
};