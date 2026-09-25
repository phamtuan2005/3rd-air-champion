import { describe, expect, it } from "vitest";
import { firstOpenMonth } from "./firstOpenMonth";

// For the guest who opens TiBook while the current month is booked solid: they
// should land on the first month with a free night, not a wall of "sold out".

const today = new Date(2026, 8, 25); // 25 Sep 2026, local midnight
const ym = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

// Every night in `full` has no room free; every other night has one.
const soldOutOn = (full: (key: string) => boolean) => (key: string) => (full(key) ? 0 : 1);

describe("which month TiBook opens on", () => {
  it("stays on this month when a night in it is still free", () => {
    const free = soldOutOn((k) => k !== "2026-09-30");
    expect(ym(firstOpenMonth(today, 36, free))).toBe("2026-09");
  });

  it("skips a month that is sold out for the rest of it", () => {
    const free = soldOutOn((k) => k.startsWith("2026-09"));
    expect(ym(firstOpenMonth(today, 36, free))).toBe("2026-10");
  });

  it("skips past more than one sold-out month", () => {
    const free = soldOutOn((k) => k.startsWith("2026-09") || k.startsWith("2026-10"));
    expect(ym(firstOpenMonth(today, 36, free))).toBe("2026-11");
  });

  // Nights before today cannot be booked, so they must not make a month look
  // open. Early September free, everything from the 25th on taken: sold out.
  it("does not count nights already past as free", () => {
    const free = soldOutOn((k) => k.startsWith("2026-09") && k >= "2026-09-25");
    expect(ym(firstOpenMonth(today, 36, free))).toBe("2026-10");
  });

  // Tonight is the first night looked at, not tomorrow.
  it("counts tonight", () => {
    const free = soldOutOn((k) => k.startsWith("2026-09") && k !== "2026-09-25");
    expect(ym(firstOpenMonth(today, 36, free))).toBe("2026-09");
  });

  it("crosses into the next year", () => {
    const dec = new Date(2026, 11, 20);
    const free = soldOutOn((k) => k.startsWith("2026-12"));
    expect(ym(firstOpenMonth(dec, 36, free))).toBe("2027-01");
  });

  // Nothing free anywhere in range: the guest gets the month they expect,
  // not a leap to the far end of the calendar.
  it("falls back to this month when nothing in range is free", () => {
    expect(ym(firstOpenMonth(today, 36, () => 0))).toBe("2026-09");
  });

  it("never looks past the calendar's range", () => {
    const seen: string[] = [];
    firstOpenMonth(today, 2, (k) => { seen.push(k); return 0; });
    expect(seen[seen.length - 1]).toBe("2026-11-30");
  });
});
