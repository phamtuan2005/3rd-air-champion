import Host from "../model/hostSchema";
import Day from "../model/daySchema";
import { dayType } from "../shared/generated/util/types/dayType";

// The calendar, in the shape TiMag's cleaning rule reads.
//
// getCleaningEntriesFor (shared/generated — see scripts/sync-cleaning-rule.js)
// was written against the frontend's monthMap: a Map keyed by "yyyy-MM-dd"
// whose days hold bookings with a room OBJECT and ISO date strings. Mongo keeps
// room as an ObjectId and the dates as Dates, so something has to translate.
//
// That translation lives here rather than in the rule, so the rule stays
// byte-identical to the file TiMag runs and the drift test can prove it.
//
// Only the fields the rule actually reads are filled in: a booking's room id,
// its start and end, whether it is a held (reserved) stay, and the day's
// blocks. The cast is deliberate and narrow — inventing plausible values for
// price, guest or duration would be worse than leaving them out, because the
// next reader could not tell which fields are real.

// The rule looks 60 days BACK for a room's occupancy odds
// (OCCUPANCY_WINDOW_DAYS) and 60 days FORWARD for the next confirmed arrival
// (GAP_ARRIVAL_SCAN_DAYS). Loading less would change its answers, so these
// track those two numbers.
export const CLEANING_HISTORY_DAYS = 61;
export const CLEANING_LOOKAHEAD_DAYS = 60;

const dayKey = (d: Date | string): string => new Date(d).toISOString().slice(0, 10);

const shiftKey = (key: string, days: number): string => {
  const d = new Date(`${key}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return dayKey(d);
};

// Does this room still belong on a cleaner's list?
//
// The room turning over is TiMag's answer (getCleaningEntriesFor); these are
// the two cases where that answer must NOT be applied:
//
//  · Hours are already recorded. That work HAPPENED. The plan is not always
//    what happened, and a morning somebody is paid for must not disappear from
//    their record because the booking behind it was cancelled afterwards.
//  · The calendar could not be read at all — no day records came back. Then we
//    cannot tell, and hiding a cleaner's morning on the strength of an empty
//    query is the worse mistake: they turn up to nothing, or do not turn up.
//
// Unknown room, or a morning with no entry set computed, keeps the assignment
// for the same reason.
export const shouldListRoom = ({
  hoursRecorded,
  calendarKnown,
  turnsOverRoomIds,
  roomId,
}: {
  hoursRecorded: boolean;
  calendarKnown: boolean;
  turnsOverRoomIds: Set<string> | undefined;
  roomId: string;
}): boolean => {
  if (hoursRecorded) return true;
  if (!calendarKnown) return true;
  return turnsOverRoomIds?.has(roomId) ?? true;
};

// Does a DAY with no rooms left on it still belong on a cleaner's list?
//
// Every room on a day can drop off — the guest extended, the booking was
// cancelled, or the auto-planner's forecast came to nothing — and the day was
// kept regardless, so TiWork showed "Sat, Sep 26 · 0 rooms" as an upcoming
// shift. A cleaner reads that as a day they are wanted and nothing to do when
// they get there. A day with nothing to clean is not a shift.
//
// Two exceptions, the same shape as shouldListRoom's first: the work HAPPENED.
//  · Hours are on record for it — the host has paid, or will pay, for that day.
//  · The cleaner has claimed hours for it and is waiting on an answer.
// Neither can vanish because the rooms behind them were cancelled afterwards.
export const shouldListDay = ({
  roomCount,
  hoursRecorded,
  claimed,
}: {
  roomCount: number;
  hoursRecorded: boolean;
  claimed: boolean;
}): boolean => roomCount > 0 || hoursRecorded || claimed;

export const loadCleaningDays = async (
  hostId: unknown,
  fromKey: string,
  toKey: string,
): Promise<Map<string, dayType>> => {
  const map = new Map<string, dayType>();

  const host: any = await Host.findById(hostId).select("calendar");
  if (!host?.calendar) return map;

  const from = new Date(`${shiftKey(fromKey, -CLEANING_HISTORY_DAYS)}T00:00:00.000Z`);
  const to = new Date(`${shiftKey(toKey, CLEANING_LOOKAHEAD_DAYS)}T23:59:59.999Z`);

  const days: any[] = await Day.find({
    calendar: host.calendar,
    date: { $gte: from, $lte: to },
  }).select(
    "date isBlocked blockedRooms bookings.room bookings.startDate bookings.endDate bookings.reserved",
  );

  for (const day of days) {
    map.set(dayKey(day.date), {
      id: String(day._id),
      date: day.date,
      isBlocked: !!day.isBlocked,
      isAirBnB: false,
      numberOfGuests: 0,
      blockedRooms: (day.blockedRooms ?? []).map((r: unknown) => ({ id: String(r) })),
      bookings: (day.bookings ?? [])
        .filter((b: any) => b.room)
        .map((b: any) => ({
          room: { id: String(b.room) },
          startDate: new Date(b.startDate).toISOString(),
          endDate: new Date(b.endDate).toISOString(),
          reserved: !!b.reserved,
        })),
    } as unknown as dayType);
  }

  return map;
};
