import { describe, expect, it } from "vitest";
import { nightsPhrase } from "./UsualStayCard";

// How TiBook says a regular's nights to them. Written after "Tue → Thu, 2
// nights and Wednesday night" — two patterns in program terms — which a guest
// could not read.
const h = (startWeekday: number, nights: number) => ({ startWeekday, nights, rooms: ["r"], times: 2 });

describe("nightsPhrase", () => {
  it("joins overlapping patterns into the nights a person would name", () => {
    // Tuesday for 2 nights, and Wednesday alone: Tuesday and Wednesday nights.
    expect(nightsPhrase([h(2, 2), h(3, 1)])).toBe("Tuesday and Wednesday nights");
  });
  it("says a run of three or more as 'through'", () => {
    expect(nightsPhrase([h(1, 4)])).toBe("Monday through Thursday nights");
  });
  it("lists nights that are apart", () => {
    expect(nightsPhrase([h(1, 1), h(4, 1)])).toBe("Monday and Thursday nights");
    expect(nightsPhrase([h(1, 1), h(3, 1), h(5, 1)])).toBe("Monday, Wednesday and Friday nights");
  });
  it("says a single night plainly", () => {
    expect(nightsPhrase([h(3, 1)])).toBe("Wednesday nights");
  });
  it("puts the week in order from Monday, Sunday last", () => {
    expect(nightsPhrase([h(5, 3)])).toBe("Friday through Sunday nights");
  });
});
