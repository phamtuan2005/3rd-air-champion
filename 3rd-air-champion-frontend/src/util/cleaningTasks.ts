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
  checkoutBooking: bookingType; // stay vacating that morning
  sameDayCheckIn: bookingType | null; // confirmed turnover — hard deadline
}

export interface CleaningForecastDay {
  morningKey: string; // yyyy-MM-dd of the cleaning morning
  entries: ForecastEntry[];
}

// Cleaning workload for the next `horizon` mornings, starting tomorrow. Every
// checkout counts as a cleaning that morning regardless of whether a next
// check-in exists yet: at ~100% occupancy an empty night after a checkout is
// almost surely rebooked last-minute, so scheduling cleaners only for confirmed
// turnovers underestimates the workload.
export const getCleaningForecast = (
  monthMap: Map<string, dayType>,
  horizon = 7,
): CleaningForecastDay[] => {
  const today = startOfToday();
  const out: CleaningForecastDay[] = [];
  for (let d = 1; d <= horizon; d++) {
    const morningKey = dateKey(addDays(today, d));
    const lastNightKey = dateKey(addDays(today, d - 1));
    const lastNight = monthMap.get(lastNightKey);
    if (!lastNight) continue;
    const entries: ForecastEntry[] = [];
    for (const b of lastNight.bookings) {
      if (!b.room || b.reserved) continue;
      if (b.endDate.split("T")[0] !== lastNightKey) continue; // last night of the stay
      const sameDayCheckIn =
        monthMap
          .get(morningKey)
          ?.bookings.find(
            (n) => n.room?.id === b.room.id && n.startDate.split("T")[0] === morningKey,
          ) ?? null;
      entries.push({ checkoutBooking: b, sameDayCheckIn });
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