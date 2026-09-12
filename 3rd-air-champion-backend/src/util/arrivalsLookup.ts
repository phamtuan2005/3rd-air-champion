import Host from "../model/hostSchema";
import Day from "../model/daySchema";
import { Arrival, LOOKAHEAD_DAYS, dayKey, shiftKey } from "./arrivingGuests";
import { HISTORY_WINDOW_DAYS, NightSample, StaySample } from "./roomLikelihood";

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
  }).select("date bookings.room bookings.startDate bookings.numberOfGuests bookings.sofaBed");

  // Arrivals only: a booking is written onto every night of its stay, and the
  // guests this cleaning is for are the ones whose stay STARTS — not the ones
  // already halfway through it.
  const out: Arrival[] = [];
  for (const day of days) {
    const key = dayKey(day.date);
    for (const b of day.bookings ?? []) {
      if (!b.room || !b.startDate) continue;
      if (dayKey(b.startDate) !== key) continue;
      out.push({
        date: key,
        roomId: String(b.room),
        guests: b.numberOfGuests || 1,
        sofaBed: !!b.sofaBed,
      });
    }
  }
  return out;
};

// The trailing history the likely-headcount estimate is measured off: how often
// each room sold, and how many people came when it did.
//
// Same trip, same scoping rules as loadArrivals above. Separate because it
// looks BACKWARD and that one looks forward, and a single query covering both
// would pull a season of Day documents to answer a question about next Tuesday.
export const loadRoomHistory = async (
  hostId: unknown,
  endKey: string,
  windowDays: number = HISTORY_WINDOW_DAYS,
): Promise<{ nights: NightSample[]; stays: StaySample[] }> => {
  const host: any = await Host.findById(hostId).select("calendar");
  if (!host?.calendar) return { nights: [], stays: [] };

  const from = new Date(shiftKey(endKey, -windowDays) + "T00:00:00.000Z");
  const to = new Date(shiftKey(endKey, -1) + "T23:59:59.999Z");

  const days: any[] = await Day.find({
    calendar: host.calendar,
    date: { $gte: from, $lte: to },
  }).select("date isBlocked blockedRooms bookings.room bookings.startDate bookings.numberOfGuests");

  // Every room the window has seen, so a night with no booking still counts as
  // a night that room failed to sell. Without this the denominator would only
  // ever contain nights the room was occupied, and every room would read 100%.
  const roomIds = new Set<string>();
  for (const day of days) {
    for (const b of day.bookings ?? []) if (b.room) roomIds.add(String(b.room));
    for (const r of day.blockedRooms ?? []) roomIds.add(String(r));
  }

  const nights: NightSample[] = [];
  const stays: StaySample[] = [];
  for (const day of days) {
    const key = dayKey(day.date);
    const blockedHere = new Set((day.blockedRooms ?? []).map((r: unknown) => String(r)));
    const occupiedHere = new Set(
      (day.bookings ?? []).filter((b: any) => b.room).map((b: any) => String(b.room)),
    );

    roomIds.forEach((roomId) => {
      nights.push({
        roomId,
        occupied: occupiedHere.has(roomId),
        blocked: !!day.isBlocked || blockedHere.has(roomId),
      });
    });

    // ONE VOTE PER STAY: only the night the stay STARTS. A booking is written
    // onto every night it covers, so counting them all would weight a long stay
    // once per night -- see roomPartySizeOdds.
    for (const b of day.bookings ?? []) {
      if (!b.room || !b.startDate) continue;
      if (dayKey(b.startDate) !== key) continue;
      stays.push({ roomId: String(b.room), guests: b.numberOfGuests || 1 });
    }
  }

  return { nights, stays };
};
