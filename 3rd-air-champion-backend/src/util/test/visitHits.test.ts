import { visitsByLocalDay, StoredVisit } from "../visitLocalDays";
import { tibookVisitorStats, HITS_SINCE, VisitRow } from "../tibookVisitorStats";

// Hits beside visitors (host, 2026-11-15: "#hits is as important as
// #visitors"). A visitor is a device; a hit is one time it opened TiBook.

const LA = "America/Los_Angeles";
const stored = (
  visitorId: string,
  day: string,
  hitHours: Record<string, number> | undefined,
  createdAt: string,
  updatedAt = createdAt,
): StoredVisit => ({
  visitorId,
  day,
  continent: "",
  country: "US",
  hitHours,
  createdAt: new Date(createdAt),
  updatedAt: new Date(updatedAt),
});
const span = (rows: VisitRow[], today: string, key: string) =>
  tibookVisitorStats(rows, today).spans.find((s) => s.key === key)!;

describe("counting TiBook hits", () => {
  it("counts one device opening TiBook five times as one visitor and five hits", () => {
    const rows = visitsByLocalDay(
      [stored("a", "2026-11-20", { "18": 2, "20": 3 }, "2026-11-20T18:05:00Z", "2026-11-20T20:40:00Z")],
      LA,
    );
    const today = span(rows, "2026-11-20", "today");
    expect(today.visitors).toBe(1);
    expect(today.hits).toBe(5);
  });

  it("puts an evening's hits on that evening, not on the UTC day they were stored under", () => {
    // One UTC day, Nov 21. 02:00 UTC is 6 pm Friday Nov 20 in California;
    // 19:00 UTC is 11 am Saturday Nov 21.
    const rows = visitsByLocalDay(
      [stored("a", "2026-11-21", { "02": 4, "19": 1 }, "2026-11-21T02:10:00Z", "2026-11-21T19:30:00Z")],
      LA,
    );
    const week = span(rows, "2026-11-21", "week");
    const hitsOn = (day: string) => week.series.find((p) => p.start === day)!.hits;
    expect(hitsOn("2026-11-20")).toBe(4);
    expect(hitsOn("2026-11-21")).toBe(1);
    // Split across two days, never counted twice.
    expect(week.hits).toBe(5);
  });

  it("reads a row from before hits were counted as one hit — the device was there", () => {
    const rows = visitsByLocalDay([stored("a", "2026-10-02", undefined, "2026-10-02T20:00:00Z")], LA);
    expect(span(rows, "2026-10-02", "today").hits).toBe(1);
  });

  it("adds hits across days while the visitor stays one", () => {
    const rows = visitsByLocalDay(
      [
        stored("a", "2026-11-18", { "20": 2 }, "2026-11-18T20:00:00Z"),
        stored("a", "2026-11-19", { "20": 3 }, "2026-11-19T20:00:00Z"),
      ],
      LA,
    );
    const week = span(rows, "2026-11-19", "week");
    expect(week.visitors).toBe(1);
    expect(week.hits).toBe(5);
  });

  // Otherwise the first weeks would show hits "up" against a stretch where
  // every visitor could only ever be one hit.
  it("does not compare hits with a stretch from before they were counted", () => {
    const before: VisitRow[] = [{ visitorId: "old", day: "2026-11-01", continent: "", country: "US" }];
    const early = span([...before, { visitorId: "a", day: "2026-11-17", continent: "", country: "US", hits: 9 }], "2026-11-17", "week");
    expect(early.previousVisitors).not.toBeNull();
    expect(early.previousHits).toBeNull(); // Nov 4 – Nov 10 is before HITS_SINCE

    const later = span(
      [
        ...before,
        { visitorId: "a", day: "2026-11-16", continent: "", country: "US", hits: 2 },
        { visitorId: "a", day: "2026-11-25", continent: "", country: "US", hits: 9 },
      ],
      "2026-11-28",
      "week",
    );
    expect(HITS_SINCE).toBe("2026-11-15");
    expect(later.previousHits).toBe(2); // Nov 15 – Nov 21, counted in full
  });
});
