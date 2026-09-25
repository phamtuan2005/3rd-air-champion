// Which month TiBook opens on: the first one, from today, that has a night a
// guest could actually book.
//
// A guest opening TiBook while this month is booked solid used to land on a
// wall of "sold out" and nothing to press, which reads as "the house is full"
// when next month may be wide open. The house asked for TiBook to open on the
// first month with a free night instead: show the guest what they can have,
// not what they cannot.
//
// A month counts as sold out only if EVERY night from today to its end has no
// room free in the whole house. Nights already past do not count as free —
// nobody can book them — so a month whose remaining nights are all taken is
// skipped even if its first week was empty.
//
// "Free" is decided by the caller, through the same rule the calendar uses to
// print "sold out", so the month TiBook opens on can never disagree with what
// the grid shows (TIBOOK.md rule 1).

// The calendar's own key for a night — local date parts, exactly as the grid
// builds them, so a key here finds the same day the grid would.
const keyOf = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/**
 * The first of the month TiBook should open on.
 *
 * @param today         local midnight today
 * @param monthsForward how far ahead the calendar goes — never look past it
 * @param freeRoomsOn   rooms free across the WHOLE house on a yyyy-MM-dd night
 *
 * Returns this month when nothing in range is free: better the month the
 * guest expects than a jump three years out to a month nobody has entered yet.
 */
export const firstOpenMonth = (
  today: Date,
  monthsForward: number,
  freeRoomsOn: (key: string) => number,
): Date => {
  const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  for (let i = 0; i <= monthsForward; i++) {
    const month = new Date(today.getFullYear(), today.getMonth() + i, 1);
    const last = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const firstDay = i === 0 ? today.getDate() : 1;
    for (let d = firstDay; d <= last; d++) {
      if (freeRoomsOn(keyOf(new Date(month.getFullYear(), month.getMonth(), d))) > 0) return month;
    }
  }
  return thisMonth;
};
