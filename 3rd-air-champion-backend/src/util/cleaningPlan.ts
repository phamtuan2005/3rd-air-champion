import { dayType } from "../shared/generated/util/types/dayType";
import {
  getCleaningEntriesFor,
  getRoomOccupancyOdds,
} from "../shared/generated/util/cleaningTasks";
import { shouldListRoom } from "./cleaningDays";

// The cleaning plan, as TT tells it.
//
// TT's first answer to "what is Henry cleaning next week" came straight from
// the assignments table. Measured against the live house on 2026-10-02, that
// table put Henry on Cozy for Sat Oct 10 — a room whose guest was not leaving —
// and said nothing about three rooms that DID turn over on Tue and Wed with
// nobody on them. Clean → Plan showed neither mistake, because it never counts
// assignments: it walks the rooms that turn over and credits whoever is
// assigned to each. The auto-planner writes its forecasts as real rows
// (see the note in workRoute's /schedule), so the table alone is not the plan.
//
// TiWork hit exactly this and now runs TiMag's own rule. This does the same,
// through the same two functions, so the host asking TT, the host reading
// Plan, and the cleaner reading TiWork are told one thing about one morning.
//
// Pure: the calendar and the assignments are handed in, so every case below
// the route is pinned by a test without a database.

export interface PlanAssignment {
  date: string; // yyyy-MM-dd, the cleaning morning
  roomId: string; // "" when the room has since been deleted
  room: string;
  cleaner: string;
  hours: number | null; // null = none recorded
}

export interface PlanRoom {
  room: string;
  cleaner: string;
  // Present only when recorded. Absent means no hours yet.
  hours?: number;
  // No booking ends that morning: the night before is empty and expected to
  // sell. A forecast, and it must be SAID as one.
  likely?: true;
  // A guest checks in that same day, so the clean has a deadline.
  arrivalSameDay?: true;
}

export interface PlanDay {
  date: string;
  // Sent rather than left to be worked out: a weekday computed from a date
  // string is the kind of small sum a model gets wrong one time in fifty, and
  // a cleaner told the wrong day is a room not cleaned.
  day: string;
  rooms: PlanRoom[];
}

// A room that turns over with nobody on it. Named in words because it is the
// line the host most needs to notice.
export const UNASSIGNED = "(unassigned)";

// How many rooms the plan holds over the range, in all and per cleaner.
//
// Sent with the plan rather than left for the model to add up. Its first live
// answer listed twenty rooms for Henry and headed them "21 rooms" — the rows
// were right and the sum was not. A count the host repeats to a cleaner has to
// come from arithmetic, not from a model's.
export const planCounts = (days: PlanDay[]): { rooms: number; byCleaner: Record<string, number> } => {
  const byCleaner: Record<string, number> = {};
  let rooms = 0;
  for (const d of days)
    for (const r of d.rooms) {
      rooms++;
      byCleaner[r.cleaner] = (byCleaner[r.cleaner] ?? 0) + 1;
    }
  return { rooms, byCleaner };
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const nextKey = (key: string): string => {
  const d = new Date(`${key}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};

export const cleaningPlan = ({
  dayMap,
  assignments,
  from,
  to,
  roomNames,
}: {
  dayMap: Map<string, dayType>;
  assignments: PlanAssignment[];
  from: string;
  to: string;
  // id → name, for a room that turns over and has no assignment to name it.
  roomNames: Map<string, string>;
}): PlanDay[] => {
  // No day records at all means the calendar could not be read, not that the
  // house is empty. Then the assignments are all there is to go on, and they
  // are passed through untouched — the same exception shouldListRoom makes.
  const calendarKnown = dayMap.size > 0;

  // Worked out once. The rule would otherwise rescan sixty days of history
  // for every morning in the range.
  const occupancyOdds = getRoomOccupancyOdds(dayMap);
  const roomIds = new Set<string>();
  dayMap.forEach((day) => day.bookings.forEach((b) => b.room && roomIds.add(b.room.id)));

  const byDate = new Map<string, PlanAssignment[]>();
  for (const a of assignments) byDate.set(a.date, [...(byDate.get(a.date) ?? []), a]);

  const out: PlanDay[] = [];
  for (let date = from; date <= to; date = nextKey(date)) {
    const entries = calendarKnown
      ? getCleaningEntriesFor(dayMap, date, { occupancyOdds, roomIds })
      : [];
    const entryByRoom = new Map(entries.map((e) => [e.checkoutBooking.room.id, e]));
    const turnsOver = calendarKnown ? new Set(entryByRoom.keys()) : undefined;

    const rooms: PlanRoom[] = [];
    const assigned = new Set<string>();

    for (const a of byDate.get(date) ?? []) {
      assigned.add(a.roomId);
      const keep = shouldListRoom({
        hoursRecorded: a.hours != null,
        calendarKnown,
        turnsOverRoomIds: turnsOver,
        roomId: a.roomId,
      });
      if (!keep) continue;
      const entry = entryByRoom.get(a.roomId);
      const row: PlanRoom = { room: a.room, cleaner: a.cleaner };
      if (a.hours != null) row.hours = a.hours;
      // Work with hours on it happened; it is not "likely" any more.
      if (entry?.probable && a.hours == null) row.likely = true;
      if (entry?.sameDayCheckIn) row.arrivalSameDay = true;
      rooms.push(row);
    }

    // The rooms the plan has and the table does not. Left out, TT would answer
    // "who cleans on Tuesday" with a full-sounding list that is two rooms short.
    for (const [roomId, entry] of entryByRoom) {
      if (assigned.has(roomId)) continue;
      const row: PlanRoom = { room: roomNames.get(roomId) ?? "", cleaner: UNASSIGNED };
      if (entry.probable) row.likely = true;
      if (entry.sameDayCheckIn) row.arrivalSameDay = true;
      rooms.push(row);
    }

    if (rooms.length === 0) continue;
    out.push({
      date,
      day: WEEKDAYS[new Date(`${date}T12:00:00.000Z`).getUTCDay()],
      rooms,
    });
  }
  return out;
};
