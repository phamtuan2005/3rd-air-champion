import { describe, expect, it } from "vitest";
import { airbnbReservationDetails, dateTyped, matchesReservation, screensMatching, weekTyped, whenTyped, whoAndWhen, worthAsking } from "./ttIntents";

// What TT understands beyond names. A box that guesses wrong sends the host
// somewhere they did not ask to go, so each rule is pinned.

const today = new Date(2026, 9, 2); // 2 Oct 2026
const labels = (q: string) => screensMatching(q).map((s) => s.label);

describe("a screen, by a word for it", () => {
  it("finds a screen by the start of its name", () => {
    expect(labels("stat")).toEqual(["Stats"]);
    expect(labels("rates")).toEqual(["Rates"]);
    expect(labels("to do")).toEqual(["To Do"]);
  });

  it("finds a screen by another word a host would use", () => {
    expect(labels("payroll")).toEqual(["Staffing"]);
    expect(labels("occupancy")).toEqual(["Stats"]);
    expect(labels("inbox")).toEqual(["Messages"]);
    expect(labels("todo")).toEqual(["To Do"]);
    // "Can I also know API remaining credit?" — the spend is in TT's window.
    expect(labels("spend")).toEqual(["Ask TT"]);
    expect(labels("credit")).toEqual(["Ask TT"]);
  });

  it("offers both templates for the word they share", () => {
    expect(labels("template")).toEqual(["Reminder template", "Booking template"]);
  });

  // "ate" is inside Rates, "ean" inside Clean. A match in the middle of a word
  // would open screens for half of what is typed on the way to a guest's name.
  it("matches only the start of a word", () => {
    expect(labels("ate")).toEqual([]);
    expect(labels("ean")).toEqual([]);
  });

  it("needs two letters", () => {
    expect(labels("s")).toEqual([]);
    expect(labels("")).toEqual([]);
  });
});

describe("a date, typed", () => {
  it("reads the shapes a host writes", () => {
    expect(dateTyped("Oct 19", today)).toBe("2026-10-19");
    expect(dateTyped("10/19", today)).toBe("2026-10-19");
    expect(dateTyped("19 Oct", today)).toBe("2026-10-19");
    expect(dateTyped("tomorrow", today)).toBe("2026-10-03");
  });

  it("takes a month and day already gone as next year's, as the booking parser does", () => {
    expect(dateTyped("Jan 3", today)).toBe("2027-01-03");
  });

  it("reaches a past day when the year is given", () => {
    expect(dateTyped("9/15/2026", today)).toBe("2026-09-15");
  });

  // Half the point: a guest called May or June, a room, a phone number and a
  // reservation code must all stay findable.
  it("is not a date when it is a name, a number or a code", () => {
    expect(dateTyped("May", today)).toBeNull();
    expect(dateTyped("June", today)).toBeNull();
    expect(dateTyped("King", today)).toBeNull();
    expect(dateTyped("650 416", today)).toBeNull();
    expect(dateTyped("1234", today)).toBeNull();
    expect(dateTyped("HMABCD1234", today)).toBeNull();
  });

  it("is not a date when there are other words with it", () => {
    expect(dateTyped("Susan Oct 19", today)).toBeNull();
  });
});

describe("when to offer a question to TT", () => {
  it("offers a sentence, or anything with a question mark", () => {
    expect(worthAsking("how full is next week", true)).toBe(true);
    expect(worthAsking("occupancy?", true)).toBe(true);
  });

  it("does not offer a name that found somebody", () => {
    expect(worthAsking("Susan", true)).toBe(false);
    expect(worthAsking("King room", true)).toBe(false);
  });

  it("offers a word that found nothing, instead of a dead end", () => {
    expect(worthAsking("refunds", false)).toBe(true);
    expect(worthAsking("zz", false)).toBe(false);
  });
});

describe("an AirBnB reservation", () => {
  const desc = "Reservation URL: https://www.airbnb.com/hosting/reservations/details/HMABCD1234\nPhone Number (Last 4 Digits): 9448";

  it("reads the code and the last four digits from what the feed writes", () => {
    expect(airbnbReservationDetails(desc)).toEqual({ code: "HMABCD1234", last4: "9448" });
  });

  it("reads nothing from a hand-entered booking", () => {
    expect(airbnbReservationDetails("")).toEqual({ code: "", last4: "" });
    expect(airbnbReservationDetails(undefined)).toEqual({ code: "", last4: "" });
  });

  it("matches a code from its start, in any case", () => {
    expect(matchesReservation("hmabcd", ["HMABCD1234"], [])).toBe("code");
    expect(matchesReservation("HMABCD1234", ["HMABCD1234"], [])).toBe("code");
    expect(matchesReservation("ABCD", ["HMABCD1234"], [])).toBeNull();
  });

  // Every code begins HM: two letters would match every stay the house has had.
  it("needs four characters of a code", () => {
    expect(matchesReservation("HM", ["HMABCD1234"], [])).toBeNull();
    expect(matchesReservation("HMA", ["HMABCD1234"], [])).toBeNull();
  });

  it("matches the last four digits exactly, and nothing shorter", () => {
    expect(matchesReservation("9448", [], ["9448"])).toBe("last4");
    expect(matchesReservation("944", [], ["9448"])).toBeNull();
    expect(matchesReservation("9449", [], ["9448"])).toBeNull();
  });
});

describe("a month on its own", () => {
  it("reads a month as its first day, in the year it comes round", () => {
    expect(whenTyped("Dec", today)).toEqual({ key: "2026-12-01", month: true });
    expect(whenTyped("december", today)).toEqual({ key: "2026-12-01", month: true });
    // March has been and gone this year.
    expect(whenTyped("Mar", today)).toEqual({ key: "2027-03-01", month: true });
    // The month we are in is this one.
    expect(whenTyped("Oct", today)).toEqual({ key: "2026-10-01", month: true });
    expect(whenTyped("Mar 2026", today)).toEqual({ key: "2026-03-01", month: true });
  });

  it("still reads a whole date as a day", () => {
    expect(whenTyped("Oct 19", today)).toEqual({ key: "2026-10-19", month: false });
  });

  it("is not a month when there is a name beside it", () => {
    expect(whenTyped("Susan Dec", today)).toBeNull();
    expect(whenTyped("Decker", today)).toBeNull();
  });
});

describe("a name with a time beside it", () => {
  it("splits a name and a month", () => {
    expect(whoAndWhen("Susan Dec", today)).toEqual({ who: "Susan", when: { key: "2026-12-01", month: true } });
  });

  // Anh-Tuan's example, as typed.
  it("drops the words that carry nothing", () => {
    expect(whoAndWhen("Susan stay in Dec", today)?.who).toBe("Susan");
    expect(whoAndWhen("Susan's booking in December", today)?.who).toBe("Susan");
    expect(whoAndWhen("King in Dec", today)?.who).toBe("King");
  });

  it("splits a name and a day", () => {
    expect(whoAndWhen("Susan Oct 19", today)).toEqual({ who: "Susan", when: { key: "2026-10-19", month: false } });
    expect(whoAndWhen("Susan tomorrow", today)).toEqual({ who: "Susan", when: { key: "2026-10-03", month: false } });
  });

  it("is nothing without both halves", () => {
    expect(whoAndWhen("Susan", today)).toBeNull();
    expect(whoAndWhen("Dec", today)).toBeNull();
    expect(whoAndWhen("Oct 19", today)).toBeNull();
    expect(whoAndWhen("in Dec", today)).toBeNull();
    expect(whoAndWhen("Henry clean plan for next week", today)).toBeNull();
  });

  // "in" is a filler word; it is also most of "Austin".
  it("takes whole words out only", () => {
    expect(whoAndWhen("Austin Dec", today)?.who).toBe("Austin");
  });
});

describe("a week of cleaning", () => {
  // Anh-Tuan's question, as he typed it to TT.
  it("reads whose week, and which", () => {
    expect(weekTyped("Henry clean plan for next week")).toEqual({ offset: 1, who: "Henry" });
    expect(weekTyped("Henry next week")).toEqual({ offset: 1, who: "Henry" });
    expect(weekTyped("Henry's schedule")).toEqual({ offset: 0, who: "Henry" });
    expect(weekTyped("henry this week")).toEqual({ offset: 0, who: "henry" });
  });

  it("reads a week with nobody named as everyone's", () => {
    expect(weekTyped("next week")).toEqual({ offset: 1, who: "" });
    expect(weekTyped("cleaning schedule")).toEqual({ offset: 0, who: "" });
    expect(weekTyped("coming week")).toEqual({ offset: 1, who: "" });
  });

  it("is nothing without a week in it", () => {
    expect(weekTyped("Henry")).toBeNull();
    expect(weekTyped("Susan Dec")).toBeNull();
    expect(weekTyped("weekend rates")).toBeNull();
  });
});
