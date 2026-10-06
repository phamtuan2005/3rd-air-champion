// US federal holidays, for TiBook's calendar.
//
// A guest planning a stay looks for the long weekends — that is when the house
// fills, and when a guest who works in Silicon Valley is free to come. Airbnb
// marks them; TiBook did not (2026-10-05).
//
// Computed, not listed: the rules are fixed by law (5 U.S.C. 6103), so there is
// no table to fall out of date and no year where the calendar goes quiet.
//
// Keys are yyyy-MM-dd built from LOCAL date parts, exactly as the calendar
// builds its cells (nightKey), so a key here finds the same cell the grid draws.
// A holiday is a date, not an instant: nothing here goes through a timezone.

export interface Holiday {
  name: string;
  // The weekday it is kept on when the date falls on a weekend: Friday for a
  // Saturday, Monday for a Sunday. Marked so the guest is not told the 3rd is
  // Independence Day.
  observed: boolean;
}

const pad = (n: number) => String(n).padStart(2, "0");
const keyOf = (y: number, m: number, d: number) => {
  // Through Date so day 0 or day 32 roll into the next/previous month.
  const dt = new Date(y, m, d);
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
};

// The nth given weekday of a month (n = 1..4), or the last one (n = -1).
const nthWeekday = (y: number, m: number, weekday: number, n: number): number => {
  if (n > 0) {
    const first = new Date(y, m, 1).getDay();
    return 1 + ((weekday - first + 7) % 7) + (n - 1) * 7;
  }
  const lastDate = new Date(y, m + 1, 0).getDate();
  const last = new Date(y, m, lastDate).getDay();
  return lastDate - ((last - weekday + 7) % 7);
};

const MON = 1;
const THU = 4;

const holidaysOf = (y: number): [string, Holiday][] => {
  const out: [string, Holiday][] = [];
  // A fixed date, plus the weekday it is observed on when it lands on a weekend.
  const fixed = (m: number, d: number, name: string) => {
    out.push([keyOf(y, m, d), { name, observed: false }]);
    const dow = new Date(y, m, d).getDay();
    if (dow === 6) out.push([keyOf(y, m, d - 1), { name, observed: true }]);
    if (dow === 0) out.push([keyOf(y, m, d + 1), { name, observed: true }]);
  };
  const floating = (m: number, weekday: number, n: number, name: string) =>
    out.push([keyOf(y, m, nthWeekday(y, m, weekday, n)), { name, observed: false }]);

  fixed(0, 1, "New Year's Day");
  floating(0, MON, 3, "Martin Luther King Jr. Day");
  // "Washington's Birthday" in the statute; what everyone calls it.
  floating(1, MON, 3, "Presidents' Day");
  floating(4, MON, -1, "Memorial Day");
  // Federal since 2021. Not shown for earlier years, when it was not one.
  if (y >= 2021) fixed(5, 19, "Juneteenth");
  fixed(6, 4, "Independence Day");
  floating(8, MON, 1, "Labor Day");
  floating(9, MON, 2, "Columbus Day");
  fixed(10, 11, "Veterans Day");
  floating(10, THU, 4, "Thanksgiving");
  fixed(11, 25, "Christmas Day");
  return out;
};

// One year's map, built once. A New Year's Day on a Saturday is observed on
// Dec 31 of the year BEFORE, so each year also takes in the next year's.
const cache = new Map<number, Map<string, Holiday>>();
const yearMap = (y: number): Map<string, Holiday> => {
  let map = cache.get(y);
  if (!map) {
    map = new Map();
    for (const [k, h] of [...holidaysOf(y), ...holidaysOf(y + 1), ...holidaysOf(y - 1)]) {
      if (k.startsWith(`${y}-`) && !map.has(k)) map.set(k, h);
    }
    cache.set(y, map);
  }
  return map;
};

// The holiday on a yyyy-MM-dd night, if any.
export const usHolidayOn = (key: string): Holiday | undefined => yearMap(Number(key.slice(0, 4))).get(key);

// Every holiday in a month, in date order — for the line above the grid.
export const usHolidaysInMonth = (year: number, month: number): { key: string; holiday: Holiday }[] => {
  const prefix = `${year}-${pad(month + 1)}-`;
  return [...yearMap(year).entries()]
    .filter(([k]) => k.startsWith(prefix))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, holiday]) => ({ key, holiday }));
};

// How a holiday is written: "Independence Day", or "Independence Day
// (observed)" on the weekday it is kept.
export const holidayLabel = (h: Holiday) => (h.observed ? `${h.name} (observed)` : h.name);
