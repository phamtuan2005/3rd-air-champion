// What a room is LIKELY to do, when nothing is booked to say.
//
// TiWork's Coming tab showed a cleaner the headcount of the next stay on the
// books, however far ahead that was. On a night with nothing booked and a good
// chance of selling, that is the wrong party: the room gets a walk-in first,
// and the number on the cleaner's phone belongs to somebody arriving days
// later. Same fault TiMag's Plan tab had, fixed the same way.
//
// Pure, like arrivingGuests beside it: the Day query lives in the route, the
// arithmetic lives here where it can be tested without a database.

// Trailing window for both measurements. Sixty days is what TiMag uses, and the
// two must agree — a cleaner and the host looking at the same morning cannot be
// shown numbers drawn from different periods.
export const HISTORY_WINDOW_DAYS = 60;

// Below this, the night probably stays empty and the next booked arrival really
// is the next occupant, so its headcount is the useful one. Above it, whoever
// sleeps there next is a stranger.
export const LIKELY_TO_SELL = 0.5;

export interface NightSample {
  roomId: string;
  occupied: boolean;
  // Blocked nights were never for sale, so they belong in neither half of the
  // fraction. Counting them as empty would make every room look worse at
  // selling than it is.
  blocked: boolean;
}

// Odds a sellable night ends up occupied, per room. Reserved (amber) holds are
// occupancy, not vacancy — the caller marks them occupied.
export const roomOccupancyOdds = (nights: NightSample[]): Map<string, number> => {
  const seen = new Map<string, { booked: number; sellable: number }>();
  for (const n of nights) {
    if (n.blocked) continue;
    const t = seen.get(n.roomId) ?? { booked: 0, sellable: 0 };
    t.sellable += 1;
    if (n.occupied) t.booked += 1;
    seen.set(n.roomId, t);
  }
  const odds = new Map<string, number>();
  seen.forEach((t, roomId) => {
    if (t.sellable > 0) odds.set(roomId, t.booked / t.sellable);
  });
  return odds;
};

export interface StaySample {
  roomId: string;
  guests: number;
}

export interface PartySizeOdds {
  guests: number; // the headcount that came up most often
  p: number; // its share of that room's stays, 0-1
  stays: number; // how many stays that share is based on
}

// ONE VOTE PER STAY. The caller must pass stays, not nights: a booking is
// written onto every night it covers, so counting rows would weight a long stay
// once per night and the answer would describe length of stay as much as party
// size.
//
// That room's own history only. Rooms differ in exactly the way this measures —
// one takes a single guest, another sleeps three — so a house-wide average is
// the wrong room's answer.
export const roomPartySizeOdds = (stays: StaySample[]): Map<string, PartySizeOdds> => {
  const counts = new Map<string, Map<number, number>>();
  for (const s of stays) {
    const guests = s.guests || 1;
    const byGuests = counts.get(s.roomId) ?? new Map<number, number>();
    byGuests.set(guests, (byGuests.get(guests) ?? 0) + 1);
    counts.set(s.roomId, byGuests);
  }

  const out = new Map<string, PartySizeOdds>();
  counts.forEach((byGuests, roomId) => {
    let total = 0;
    byGuests.forEach((n) => (total += n));
    if (total === 0) return;

    let best = 0;
    let bestN = 0;
    byGuests.forEach((n, guests) => {
      // Ties go to the LARGER party: a spare towel costs nothing, a missing bed
      // is a guest standing in a room at 11pm.
      if (n > bestN || (n === bestN && guests > best)) {
        best = guests;
        bestN = n;
      }
    });
    out.set(roomId, { guests: best, p: bestN / total, stays: total });
  });
  return out;
};
