// How a pile of chosen dates becomes stays.
//
// Lives here rather than in the modal so it can be tested without mounting a
// booking form: the rule below is subtle and got a guest to a dead end once.

export interface StayRange {
  start: string;
  end: string;
  nights: number;
}

/**
 * Consecutive dates, grouped into stays.
 *
 * `freeRoomsOn` splits a run that no single room can cover. Sep 7 with only
 * Chill free and Sep 8 with only King free are consecutive nights, but they are
 * NOT one stay — lumped together they ask for a room free on both, of which
 * there is none, and the guest reaches "No room free for these nights" for two
 * nights that are each perfectly bookable. Split there, and it is one night in
 * Chill and one in King.
 *
 * Omitting `freeRoomsOn` gives the plain consecutive grouping, which is right
 * for dates already committed to a specific room.
 */
export const groupConsecutiveDates = (
  dates: Set<string>,
  freeRoomsOn?: (dateKey: string) => Set<string>,
): StayRange[] => {
  const sorted = Array.from(dates).sort();
  if (sorted.length === 0) return [];
  const ranges: StayRange[] = [];
  let start = sorted[0];
  let end = sorted[0];
  // Rooms free on EVERY night of the run so far. Empty means "not tracking".
  let common: Set<string> | null = freeRoomsOn ? freeRoomsOn(sorted[0]) : null;
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(end);
    prev.setDate(prev.getDate() + 1);
    const isNextDay = prev.toISOString().split("T")[0] === sorted[i];
    // Would this night leave the run with no room that can take all of it?
    let stillCoverable = true;
    let merged: Set<string> | null = null;
    if (isNextDay && common) {
      const nextFree = freeRoomsOn!(sorted[i]);
      merged = new Set([...common].filter((id) => nextFree.has(id)));
      stillCoverable = merged.size > 0;
    }
    if (isNextDay && stillCoverable) {
      end = sorted[i];
      if (merged) common = merged;
    } else {
      const nights = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86400000) + 1;
      ranges.push({ start, end, nights });
      start = sorted[i];
      end = sorted[i];
      if (freeRoomsOn) common = freeRoomsOn(sorted[i]);
    }
  }
  const nights = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86400000) + 1;
  ranges.push({ start, end, nights });
  return ranges;
};

