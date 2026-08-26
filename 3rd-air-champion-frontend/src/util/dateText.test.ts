import { describe, expect, it } from "vitest";
import { parseDateText } from "./dateText";

// A fixed "today" so the year-rolling rules are testable at all.
const TODAY = new Date(2026, 7, 20); // Thu 20 Aug 2026

const on = (text: string) => parseDateText(text, TODAY);

describe("the message this was built for", () => {
  it('reads "I need to book for Aug 23, 24, 25, 27, and Sept 2,3,4"', () => {
    const { dates } = on("I need to book for Aug 23, 24, 25, 27, and Sept 2,3,4");
    expect(dates).toEqual([
      "2026-08-23",
      "2026-08-24",
      "2026-08-25",
      "2026-08-27",
      "2026-09-02",
      "2026-09-03",
      "2026-09-04",
    ]);
  });

  it("keeps the numbers with the month most recently named", () => {
    // The 2,3,4 belong to September, not August — that is the whole trick.
    const { dates } = on("Aug 23, Sept 2,3,4");
    expect(dates).toEqual(["2026-08-23", "2026-09-02", "2026-09-03", "2026-09-04"]);
  });
});

describe("the shapes guests actually write", () => {
  it("reads the placeholder the box has always shown", () => {
    const { dates } = on("May 1, 3–5, 20–21");
    expect(dates).toEqual([
      "2027-05-01",
      "2027-05-03",
      "2027-05-04",
      "2027-05-05",
      "2027-05-20",
      "2027-05-21",
    ]);
  });

  it("reads a day before the month", () => {
    expect(on("23 Aug").dates).toEqual(["2026-08-23"]);
    expect(on("23rd August").dates).toEqual(["2026-08-23"]);
  });

  it("reads a range", () => {
    expect(on("Aug 23-25").dates).toEqual(["2026-08-23", "2026-08-24", "2026-08-25"]);
  });

  it("reads slashes, with and without a year", () => {
    expect(on("8/23").dates).toEqual(["2026-08-23"]);
    expect(on("8/23/2027").dates).toEqual(["2027-08-23"]);
  });

  it("reads tonight and tomorrow", () => {
    expect(on("can I come tonight?").dates).toEqual(["2026-08-20"]);
    expect(on("arriving tomorrow").dates).toEqual(["2026-08-21"]);
  });

  it("survives full month names, dots and capitals", () => {
    expect(on("SEPT. 2").dates).toEqual(["2026-09-02"]);
    expect(on("September 2").dates).toEqual(["2026-09-02"]);
  });
});

describe("the year is inferred, not assumed", () => {
  it("rolls to next year for a month already gone", () => {
    // January is behind us in August, so "Jan 3" is the January coming.
    expect(on("Jan 3").dates).toEqual(["2027-01-03"]);
  });

  it("keeps this year for a date still ahead", () => {
    expect(on("Dec 24").dates).toEqual(["2026-12-24"]);
  });

  it("rolls a day earlier this month to next year", () => {
    // The 5th of August has passed; the 25th has not.
    expect(on("Aug 5").dates).toEqual(["2027-08-05"]);
    expect(on("Aug 25").dates).toEqual(["2026-08-25"]);
  });
});

describe("what it refuses to invent", () => {
  it("drops an impossible day rather than rolling into the next month", () => {
    expect(on("Feb 30").dates).toEqual([]);
    expect(on("Sept 31").dates).toEqual([]);
  });

  it("finds nothing in a message with no dates", () => {
    const { dates, leftover } = on("do you have parking?");
    expect(dates).toEqual([]);
    expect(leftover).toBe("do you have parking?");
  });

  it("returns an empty result for empty input", () => {
    expect(on("   ")).toEqual({ dates: [], past: [], leftover: "" });
  });

  it("does not swallow a number that is not a date", () => {
    // "4 nights" is not the 4th of the month. The run of days ends at "and".
    const { dates } = on("Aug 23 and we need parking for 4 cars");
    expect(dates).toEqual(["2026-08-23"]);
  });
});

describe("nights that have already gone", () => {
  // A guest typing a stay that started before today is not making a mistake
  // worth scolding — part of what they asked for is simply behind us. These
  // came back as bookable nights, and a night in the past cannot be booked.

  it("keeps a whole run in one year instead of tearing it across two", () => {
    // Thu 20 Aug 2026 is TODAY. The 18th and 19th have gone; the rest have not.
    // This used to answer with the 20th-25th of 2026 AND the 18th-19th of 2027
    // — one span, eleven months apart, from a guest who asked for one stay.
    const { dates, past } = on("Aug 18-25");
    expect(past).toEqual(["2026-08-18", "2026-08-19"]);
    expect(dates).toEqual([
      "2026-08-20",
      "2026-08-21",
      "2026-08-22",
      "2026-08-23",
      "2026-08-24",
      "2026-08-25",
    ]);
  });

  it("separates a listed day that has gone from the ones that have not", () => {
    const { dates, past } = on("Aug 19, 21, 22");
    expect(past).toEqual(["2026-08-19"]);
    expect(dates).toEqual(["2026-08-21", "2026-08-22"]);
  });

  it("treats a spelled-out past year as past, not as next year", () => {
    // With the year written down there is nothing to infer: they mean that day.
    const { dates, past } = on("8/1/2026");
    expect(past).toEqual(["2026-08-01"]);
    expect(dates).toEqual([]);
  });

  it("counts today itself as still bookable", () => {
    // Tonight is a night that can still be had.
    expect(on("tonight").dates).toEqual(["2026-08-20"]);
    expect(on("tonight").past).toEqual([]);
    expect(on("Aug 20").dates).toEqual(["2026-08-20"]);
  });

  it("still rolls a run wholly behind us into next year", () => {
    // Unchanged, and the reason the year is inferred at all: nobody typing
    // "Aug 5" in late August means the one that has gone.
    expect(on("Aug 5").dates).toEqual(["2027-08-05"]);
    expect(on("Aug 3-5").dates).toEqual(["2027-08-03", "2027-08-04", "2027-08-05"]);
    expect(on("Aug 3-5").past).toEqual([]);
  });
});

describe("what the guest said that was not a date", () => {
  it("hands back the rest of the message, cleaned of the leftovers", () => {
    const { dates, leftover } = on("Aug 23, 24 — and we'll have a dog with us");
    expect(dates).toEqual(["2026-08-23", "2026-08-24"]);
    expect(leftover).toBe("and we'll have a dog with us");
  });

  it("is empty when the message was only dates", () => {
    expect(on("Aug 23, 24, 25").leftover).toBe("");
  });
});

describe("tidiness", () => {
  it("removes duplicates and sorts", () => {
    expect(on("Aug 25, Aug 23, Aug 25").dates).toEqual(["2026-08-23", "2026-08-25"]);
  });

  it("reads a backwards range rather than producing nothing", () => {
    expect(on("Aug 25-23").dates).toEqual(["2026-08-23", "2026-08-24", "2026-08-25"]);
  });
});

// A guest on fixed shift days says it this way: the same nights, every week,
// all month. Reading it as a single Monday would book a quarter of what they
// asked for, and nobody would find out until somebody arrived to a let room.
describe("a weekday named after a month", () => {
  it('reads "Oct Monday & Tuesday" as every Mon and Tue in October', () => {
    expect(on("Oct Monday & Tuesday").dates).toEqual([
      "2026-10-05", "2026-10-06",
      "2026-10-12", "2026-10-13",
      "2026-10-19", "2026-10-20",
      "2026-10-26", "2026-10-27",
    ]);
  });

  it("takes short forms and plurals", () => {
    expect(on("Nov mondays").dates).toEqual([
      "2026-11-02", "2026-11-09", "2026-11-16", "2026-11-23", "2026-11-30",
    ]);
    expect(on("Sept weds").dates).toEqual([
      "2026-09-02", "2026-09-09", "2026-09-16", "2026-09-23", "2026-09-30",
    ]);
  });

  it("does not read 'tuesday' as 'tue' with letters left over", () => {
    expect(on("Oct tuesday").leftover).toBe("");
  });

  it("stops at the first word that is not a weekday", () => {
    const { dates, leftover } = on("Oct mon and we have a dog");
    expect(dates.length).toBe(4);
    expect(leftover).toBe("we have a dog");
  });

  it("a month already gone is the one coming round again", () => {
    // TODAY is Aug 2026, so "Jan fridays" means January 2027.
    expect(on("Jan fridays").dates[0]).toBe("2027-01-01");
  });

  it("leaves plain day numbers exactly as they were", () => {
    expect(on("Aug 23, 24, 25, 27, and Sept 2,3,4").dates).toEqual([
      "2026-08-23", "2026-08-24", "2026-08-25", "2026-08-27",
      "2026-09-02", "2026-09-03", "2026-09-04",
    ]);
  });
});
