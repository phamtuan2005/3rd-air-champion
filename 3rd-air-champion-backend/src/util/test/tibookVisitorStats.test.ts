import { tibookVisitorStats, addDays, VisitRow } from "../tibookVisitorStats";

// How TiBook is doing. The host reads these to decide whether the page is worth
// the effort, so a number that is plausible and wrong is the failure to fear.

const TODAY = "2026-09-14";
const v = (visitorId: string, day: string, continent = "North America"): VisitRow => ({
  visitorId,
  day,
  continent,
});
const span = (rows: VisitRow[], key: string) =>
  tibookVisitorStats(rows, TODAY).spans.find((s) => s.key === key)!;

describe("counting TiBook visitors", () => {
  it("counts people, not rows — one visitor on three days is one visitor", () => {
    const rows = [v("a", "2026-09-12"), v("a", "2026-09-13"), v("a", TODAY), v("b", TODAY)];
    expect(span(rows, "week").visitors).toBe(2);
    expect(span(rows, "today").visitors).toBe(2);
  });

  it("keeps each span to its own days, in UTC", () => {
    const rows = [v("a", TODAY), v("b", "2026-09-08"), v("c", "2026-09-07")];
    // 7 days is today and the six before it: Sep 8 is in, Sep 7 is not.
    expect(span(rows, "week").visitors).toBe(2);
    expect(span(rows, "month").visitors).toBe(3);
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("compares with the same length of time just before", () => {
    const rows = [v("a", TODAY), v("b", "2026-09-07"), v("c", "2026-09-01"), v("d", "2026-08-31")];
    const week = span(rows, "week");
    expect(week.visitors).toBe(1);
    expect(week.previousVisitors).toBe(2); // Sep 1 – Sep 7; Aug 31 is outside
    expect(span(rows, "all").previousVisitors).toBeNull();
  });

  // Seen on the first screenshot of this screen: "▲ 1520 vs the 12 months
  // before", against a year in which nothing was being counted.
  it("makes no comparison with a stretch from before counting began", () => {
    const rows = [v("a", "2026-09-10"), v("b", TODAY)];
    expect(span(rows, "week").previousVisitors).toBeNull();
    expect(span(rows, "today").previousVisitors).toBe(0); // Sep 13 was counted, and empty
    expect(span(rows, "year").previousVisitors).toBeNull();
  });
});

describe("who came back", () => {
  it("is someone who has opened TiBook on more than one day", () => {
    const rows = [v("once", TODAY), v("twice", "2026-09-10"), v("twice", TODAY)];
    const week = span(rows, "week");
    expect(week.visitors).toBe(2);
    expect(week.cameBack).toBe(1);
  });

  // The case a "first visit inside the window" rule gets wrong: this guest
  // first came months ago and only once this week. They came BACK.
  it("counts a visitor whose first day was before the span", () => {
    const rows = [v("old", "2026-05-02"), v("old", TODAY)];
    expect(span(rows, "today").cameBack).toBe(1);
  });

  it("does not count a first visit as a return, even with a later one outside the window", () => {
    const rows = [v("a", "2026-09-01"), v("a", TODAY)];
    const sep1 = span(rows, "month").series.find((p) => p.start === "2026-09-01")!;
    expect(sep1.visitors).toBe(1);
    expect(sep1.cameBack).toBe(0);
    const sep14 = span(rows, "month").series.find((p) => p.start === TODAY)!;
    expect(sep14.cameBack).toBe(1);
  });

  it("agrees between the span tile and its all-time chart", () => {
    const rows = [v("a", "2026-07-03"), v("a", "2026-07-20"), v("b", "2026-08-01"), v("c", "2026-09-02")];
    const all = span(rows, "all");
    expect(all.cameBack).toBe(1);
    // Two visits in July from someone new that month is still a return.
    expect(all.series.find((p) => p.start === "2026-07")).toEqual({ start: "2026-07", visitors: 1, cameBack: 1 });
  });
});

describe("where visitors are", () => {
  it("counts each visitor once, where they were last seen in the span", () => {
    const rows = [v("a", "2026-09-10", "Asia"), v("a", TODAY, "Europe"), v("b", TODAY, "Europe"), v("c", TODAY, "Asia")];
    expect(span(rows, "week").continents).toEqual([
      { continent: "Europe", visitors: 2 },
      { continent: "Asia", visitors: 1 },
    ]);
  });

  it("lists Unknown last, however many there are", () => {
    const rows = [v("a", TODAY, "Unknown"), v("b", TODAY, "Unknown"), v("c", TODAY, "Oceania")];
    expect(span(rows, "today").continents.map((c) => c.continent)).toEqual(["Oceania", "Unknown"]);
  });
});

describe("the chart buckets", () => {
  it("draws a bar per day for a week, including days nobody came", () => {
    const week = span([v("a", TODAY)], "week");
    expect(week.seriesUnit).toBe("day");
    expect(week.series).toHaveLength(7);
    expect(week.series[0]).toEqual({ start: "2026-09-08", visitors: 0, cameBack: 0 });
  });

  it("draws months for a year, the first clipped to the span", () => {
    // The span starts 2025-09-15, so a visit on 2025-09-03 is not in it.
    const year = span([v("a", "2025-09-03"), v("b", "2025-09-20"), v("c", TODAY)], "year");
    expect(year.seriesUnit).toBe("month");
    expect(year.series).toHaveLength(13); // Sep 2025 … Sep 2026
    expect(year.series[0]).toEqual({ start: "2025-09", visitors: 1, cameBack: 0 });
    expect(year.visitors).toBe(2);
  });

  it("has nothing to show before anything is recorded", () => {
    const stats = tibookVisitorStats([], TODAY);
    expect(stats.since).toBeNull();
    const all = stats.spans.find((s) => s.key === "all")!;
    expect(all.from).toBeNull();
    expect(all.series).toEqual([]);
    expect(stats.spans.find((s) => s.key === "week")!.visitors).toBe(0);
  });
});

describe("which guests visited", () => {
  // Only visits a guest agreed to have tied to them carry a number; everything
  // else is a count. These pin that a number is a person, not a row.
  const g = (visitorId: string, day: string, guestPhone: string): VisitRow => ({
    ...v(visitorId, day),
    guestPhone,
  });

  it("counts a guest's distinct days, across every device they used", () => {
    const rows = [
      g("phone", "2026-09-12", "(408) 555-1234"),
      g("laptop", "2026-09-12", "(408) 555-1234"), // same guest, same day
      g("phone", TODAY, "(408) 555-1234"),
    ];
    expect(span(rows, "week").guests).toEqual([
      { phone: "(408) 555-1234", days: 2, lastDay: TODAY },
    ]);
  });

  it("leaves anonymous visits out of the list but in the count", () => {
    const rows = [g("a", TODAY, "(408) 555-1234"), v("b", TODAY), g("c", TODAY, "")];
    const today = span(rows, "today");
    expect(today.visitors).toBe(3);
    expect(today.guests.map((x) => x.phone)).toEqual(["(408) 555-1234"]);
  });

  it("keeps each span to its own days", () => {
    const rows = [g("a", "2026-09-01", "(408) 555-1234")];
    expect(span(rows, "week").guests).toEqual([]);
    expect(span(rows, "month").guests).toHaveLength(1);
  });

  it("puts the most recent visitor first", () => {
    const rows = [g("a", "2026-09-10", "(650) 555-0001"), g("b", TODAY, "(408) 555-1234")];
    expect(span(rows, "week").guests.map((x) => x.phone)).toEqual([
      "(408) 555-1234",
      "(650) 555-0001",
    ]);
  });
});

