import Host from "../model/hostSchema";
import Day from "../model/daySchema";
import { Arrival, LOOKAHEAD_DAYS, dayKey, shiftKey } from "./arrivingGuests";

// The arrivals on the books for a host, over the window a set of cleanings can
// see. The date arithmetic itself lives in util/arrivingGuests, tested there;
// this is only the trip to the database, shared by TiWork's rota and TiMag's
// Hours queue so the two cannot report different guests for the same morning.
//
// Scoped to the host's own calendar. TiWork once read across every host document
// in the database and told a cleaner about a room that was not theirs.
export const loadArrivals = async (
  hostId: unknown,
  cleanings: { date: string; roomId: string }[],
): Promise<Arrival[]> => {
  if (cleanings.length === 0) return [];

  const host: any = await Host.findById(hostId).select("calendar");
  if (!host?.calendar) return [];

  const dates = cleanings.map((c) => c.date).sort();
  const from = new Date(dates[0] + "T00:00:00.000Z");
  const to = new Date(shiftKey(dates[dates.length - 1], LOOKAHEAD_DAYS) + "T23:59:59.999Z");

  const days: any[] = await Day.find({
    calendar: host.calendar,
    date: { $gte: from, $lte: to },
  }).select("date bookings.room bookings.startDate bookings.numberOfGuests");

  // Arrivals only: a booking is written onto every night of its stay, and the
  // guests this cleaning is for are the ones whose stay STARTS — not the ones
  // already halfway through it.
  const out: Arrival[] = [];
  for (const day of days) {
    const key = dayKey(day.date);
    for (const b of day.bookings ?? []) {
      if (!b.room || !b.startDate) continue;
      if (dayKey(b.startDate) !== key) continue;
      out.push({ date: key, roomId: String(b.room), guests: b.numberOfGuests || 1 });
    }
  }
  return out;
};
