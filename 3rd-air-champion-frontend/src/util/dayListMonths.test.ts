import { describe, expect, it } from "vitest";
import { dayListMonths } from "./dayListMonths";

// The day-by-day list used to begin at tonight, and a guest could not see the
// earlier days of the month that the grid showed — nor the start of a stay
// they were in the middle of. These hold the list to the grid's days while
// keeping tonight as the row it opens on.

const HEAD = 36;
const ROW = 60;
const today = new Date(2026, 8, 30); // 30 Sep 2026, local midnight
const key = (d: Date) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

describe("the months the day list draws", () => {
  it("begins this month on the 1st, not on today", () => {
    const { sections } = dayListMonths(today, 36, HEAD, ROW);
    expect(key(sections[0].days[0])).toBe("2026-9-1");
    expect(sections[0].days).toHaveLength(30);
  });

  it("draws this month and every month asked for after it, each in full", () => {
    const { sections } = dayListMonths(today, 36, HEAD, ROW);
    expect(sections).toHaveLength(37);
    expect(key(sections[1].days[0])).toBe("2026-10-1");
    // The year turns over without a gap.
    expect(key(sections[3].month)).toBe("2026-12-1");
    expect(key(sections[4].month)).toBe("2027-1-1");
    // Lengths come from the calendar: Feb 2028 is a leap month.
    expect(sections[17].days).toHaveLength(29);
    const last = sections[36];
    expect(key(last.days[last.days.length - 1])).toBe("2029-9-30");
  });

  // Every height is fixed, so each month's top is the sum of everything above
  // it. The scrollbar, the jump to a month and the hold stripes all rely on it.
  it("places each month exactly below the one before", () => {
    const { sections } = dayListMonths(today, 3, HEAD, ROW);
    expect(sections[0].top).toBe(0);
    for (let i = 1; i < sections.length; i++) {
      const prev = sections[i - 1];
      expect(sections[i].top).toBe(prev.top + HEAD + prev.days.length * ROW);
    }
  });

  it("says where tonight's row is, so the list can open there", () => {
    const { sections, todayTop } = dayListMonths(today, 36, HEAD, ROW);
    const rowIndex = (todayTop - HEAD) / ROW;
    expect(key(sections[0].days[rowIndex])).toBe("2026-9-30");
  });

  it("opens on the heading when today is the 1st", () => {
    const { todayTop } = dayListMonths(new Date(2026, 9, 1), 36, HEAD, ROW);
    expect(todayTop).toBe(HEAD);
  });
});
