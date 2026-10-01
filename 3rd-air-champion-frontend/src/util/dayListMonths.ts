// The months TiBook's day-by-day list draws, and where each one sits.
//
// Every night from the 1st of THIS month to the end of the range — the same
// days the month grid shows. The list's first version began at tonight,
// reasoning that a guest has no use for nights already gone. Anh-Tuan found
// the list then had no way to the earlier days of the month while the grid
// beside it showed all of them, and a guest mid-stay lost the start of their
// own stay: one that began three nights ago was cut at today, its "Paid" line
// sitting on a stay the list drew shorter than it was. (2026-09-30)
//
// What to draw and where to open are different questions. The list still
// opens on tonight's row — `todayTop` — so the first thing a guest sees is
// unchanged, and the nights before it are one scroll up.
//
// Offsets are px from the top of the list, and exact, because every heading
// and every row in the list is a fixed height (see GuestDayList).

export interface ListMonth {
  month: Date;
  days: Date[];
  // Where the month's heading starts in the list, px.
  top: number;
}

/**
 * @param today         local midnight today
 * @param monthsForward how many months past this one the list goes
 * @param headH         a month heading's height, px
 * @param rowH          a night's row height, px
 */
export const dayListMonths = (
  today: Date,
  monthsForward: number,
  headH: number,
  rowH: number,
): { sections: ListMonth[]; todayTop: number } => {
  const sections: ListMonth[] = [];
  let top = 0;
  for (let i = 0; i <= monthsForward; i++) {
    const month = new Date(today.getFullYear(), today.getMonth() + i, 1);
    const last = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const days: Date[] = [];
    for (let d = 1; d <= last; d++) {
      days.push(new Date(month.getFullYear(), month.getMonth(), d));
    }
    sections.push({ month, days, top });
    top += headH + days.length * rowH;
  }
  // This month's heading, then one row for each night before tonight.
  const todayTop = headH + (today.getDate() - 1) * rowH;
  return { sections, todayTop };
};
