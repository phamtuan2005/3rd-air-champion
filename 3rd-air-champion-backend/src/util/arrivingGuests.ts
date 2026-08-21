// Who arrives in a room after it is cleaned.
//
// A cleaner asked for this: beds and towels are laid out for a headcount, and
// without it they are guessing or texting to ask. The rule is the one TiMag's
// Clean → Plan tab already shows the host — the FIRST check-in for that room on
// or after the cleaning morning — so the two screens cannot quote different
// numbers for the same morning.
//
// Pure on purpose: the Day query lives in the route, the date arithmetic lives
// here where it can be tested without a database.

// Dates are stored as UTC midnight and every screen keys off the ISO day, so the
// day string is taken the same way here. Reading it in the server's local zone
// would move a booking a day west of the host and hand a cleaner the wrong
// arrival.
export const dayKey = (d: Date | string): string =>
  new Date(d).toISOString().slice(0, 10);

// A month. Long enough to find the next stay in a quiet room, short enough that
// a room with nothing on the books reads as empty rather than as some distant
// arrival the cleaner cannot act on.
export const LOOKAHEAD_DAYS = 30;

export const shiftKey = (key: string, days: number): string => {
  const d = new Date(key + "T00:00:00.000Z");
  d.setUTCDate(d.getUTCDate() + days);
  return dayKey(d);
};

export interface Arrival {
  date: string; // yyyy-MM-dd the stay STARTS
  roomId: string;
  guests: number;
  // A sofa bed to make up for this stay. Carried alongside the headcount
  // because it answers the same question — what does this room need doing to
  // it — and because a bed nobody mentioned is a bed nobody makes.
  sofaBed?: boolean;
}

export interface ArrivalNeed {
  guests: number;
  sofaBed: boolean;
}

// For each cleaning (date + room), the headcount of the next stay to begin in
// that room. Absent from the map where nothing is booked within the lookahead:
// "no arrival on the books" and "nobody is coming" are different things to tell
// a cleaner, so the caller sends null rather than 0.
export const arrivingNeeds = (
  arrivals: Arrival[],
  cleanings: { date: string; roomId: string }[],
  lookaheadDays: number = LOOKAHEAD_DAYS,
): Map<string, ArrivalNeed> => {
  const byDayRoom = new Map<string, ArrivalNeed>();
  for (const a of arrivals) {
    // A stay only ever starts once in a room on a day; the guard keeps the
    // EARLIEST reading if duplicates ever appear, rather than a silent overwrite.
    const k = `${a.date}|${a.roomId}`;
    if (!byDayRoom.has(k)) byDayRoom.set(k, { guests: a.guests || 1, sofaBed: !!a.sofaBed });
  }

  const out = new Map<string, ArrivalNeed>();
  for (const { date, roomId } of cleanings) {
    for (let i = 0; i <= lookaheadDays; i++) {
      // i = 0 is a same-day check-in: someone arrives the afternoon of the
      // morning being cleaned, which is exactly when this matters most.
      const hit = byDayRoom.get(`${shiftKey(date, i)}|${roomId}`);
      if (hit != null) {
        out.set(`${date}|${roomId}`, hit);
        break;
      }
    }
  }
  return out;
};

/** Headcount only — kept for callers that do not care about the rest. */
export const arrivingGuestCounts = (
  arrivals: Arrival[],
  cleanings: { date: string; roomId: string }[],
  lookaheadDays: number = LOOKAHEAD_DAYS,
): Map<string, number> =>
  new Map(
    [...arrivingNeeds(arrivals, cleanings, lookaheadDays)].map(([k, v]) => [k, v.guests]),
  );
