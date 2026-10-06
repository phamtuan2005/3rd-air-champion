import { describe, expect, it } from "vitest";
import { holidayLabel, usHolidayOn, usHolidaysInMonth } from "./usHolidays";

// Checked against the US Office of Personnel Management's published dates.

describe("usHolidayOn", () => {
  it("finds the 2026 holidays on their days", () => {
    const expected: Record<string, string> = {
      "2026-01-01": "New Year's Day",
      "2026-01-19": "Martin Luther King Jr. Day",
      "2026-02-16": "Presidents' Day",
      "2026-05-25": "Memorial Day",
      "2026-06-19": "Juneteenth",
      "2026-07-04": "Independence Day",
      "2026-09-07": "Labor Day",
      "2026-10-12": "Columbus Day",
      "2026-11-11": "Veterans Day",
      "2026-11-26": "Thanksgiving",
      "2026-12-25": "Christmas Day",
    };
    for (const [key, name] of Object.entries(expected)) {
      expect(usHolidayOn(key)).toEqual({ name, observed: false });
    }
  });

  // July 4 2026 is a Saturday: kept on Friday the 3rd.
  it("marks the weekday a weekend holiday is observed on", () => {
    expect(usHolidayOn("2026-07-03")).toEqual({ name: "Independence Day", observed: true });
    expect(holidayLabel(usHolidayOn("2026-07-03")!)).toBe("Independence Day (observed)");
    // Christmas 2027 is a Saturday, New Year 2028 too — the latter observed in 2027.
    expect(usHolidayOn("2027-12-24")).toEqual({ name: "Christmas Day", observed: true });
    expect(usHolidayOn("2027-12-31")).toEqual({ name: "New Year's Day", observed: true });
    // Juneteenth 2027 is a Saturday, 2022's a Sunday.
    expect(usHolidayOn("2027-06-18")?.observed).toBe(true);
    expect(usHolidayOn("2022-06-20")?.observed).toBe(true);
  });

  it("gets the floating ones right across years", () => {
    expect(usHolidayOn("2027-11-25")?.name).toBe("Thanksgiving");
    expect(usHolidayOn("2027-05-31")?.name).toBe("Memorial Day");
    expect(usHolidayOn("2028-09-04")?.name).toBe("Labor Day");
  });

  it("has nothing on an ordinary day, or Juneteenth before it was federal", () => {
    expect(usHolidayOn("2026-10-13")).toBeUndefined();
    expect(usHolidayOn("2020-06-19")).toBeUndefined();
  });
});

describe("usHolidaysInMonth", () => {
  it("lists a month's holidays in order", () => {
    expect(usHolidaysInMonth(2026, 10).map((h) => h.key)).toEqual(["2026-11-11", "2026-11-26"]);
    expect(usHolidaysInMonth(2026, 6).map((h) => h.key)).toEqual(["2026-07-03", "2026-07-04"]);
    expect(usHolidaysInMonth(2026, 2)).toEqual([]);
  });
});
