import { localDay, readerTimeZone, visitsByLocalDay, HOUSE_TIME_ZONE, StoredVisit } from "../visitLocalDays";
import { tibookVisitorStats } from "../tibookVisitorStats";

// The visitors screen counted in UTC days, so in California "Today" turned over
// at 4 pm and an evening visit showed up on tomorrow (host, 2026-11-14).

const LA = "America/Los_Angeles";
const row = (visitorId: string, day: string, createdAt: string, updatedAt = createdAt): StoredVisit => ({
  visitorId,
  day,
  continent: "",
  country: "US",
  createdAt: new Date(createdAt),
  updatedAt: new Date(updatedAt),
});

describe("the local day of a TiBook visit", () => {
  it("puts a California evening visit on that evening, not on tomorrow", () => {
    // 6 pm Friday Nov 13 in California is already Saturday Nov 14 in UTC.
    const rows = [row("a", "2026-11-14", "2026-11-14T02:00:00Z")];
    expect(visitsByLocalDay(rows, LA).map((r) => r.day)).toEqual(["2026-11-13"]);
  });

  it("keeps Today on the reader's day after 4 pm Pacific", () => {
    const now = new Date("2026-11-14T02:30:00Z"); // 6:30 pm Friday in California
    const today = localDay(now, LA);
    expect(today).toBe("2026-11-13");
    const rows = visitsByLocalDay(
      [row("a", "2026-11-13", "2026-11-13T20:00:00Z"), row("b", "2026-11-14", "2026-11-14T02:00:00Z")],
      LA,
    );
    const stats = tibookVisitorStats(rows, today);
    expect(stats.spans.find((s) => s.key === "today")!.visitors).toBe(2);
  });

  it("counts a device on both local days when its looks fall either side of midnight", () => {
    // One UTC day, Nov 14: first seen 5 pm Friday Pacific, again noon Saturday.
    const rows = [row("a", "2026-11-14", "2026-11-14T01:00:00Z", "2026-11-14T20:00:00Z")];
    expect(visitsByLocalDay(rows, LA).map((r) => r.day)).toEqual(["2026-11-13", "2026-11-14"]);
  });

  it("counts one device once when two UTC rows fall on the same local day", () => {
    const rows = visitsByLocalDay(
      [row("a", "2026-11-13", "2026-11-13T20:00:00Z"), row("a", "2026-11-14", "2026-11-14T02:00:00Z")],
      LA,
    );
    const stats = tibookVisitorStats(rows, "2026-11-13");
    const today = stats.spans.find((s) => s.key === "today")!;
    expect(today.visitors).toBe(1);
    // Two rows, one day: not somebody who "came back".
    expect(today.cameBack).toBe(0);
  });

  it("reads the same visits in the reader's zone, wherever that is", () => {
    const rows = [row("a", "2026-11-13", "2026-11-13T20:00:00Z")];
    // Noon Friday in California is 5 am Saturday in Seoul.
    expect(visitsByLocalDay(rows, "Asia/Seoul")[0].day).toBe("2026-11-14");
  });

  it("leaves a row with no timestamps on the day it was stored under", () => {
    const rows: StoredVisit[] = [{ visitorId: "a", day: "2026-11-13", continent: "", country: "US" }];
    expect(visitsByLocalDay(rows, LA)[0].day).toBe("2026-11-13");
  });

  it("falls back to the house's zone for a zone it cannot read", () => {
    expect(readerTimeZone("Asia/Seoul")).toBe("Asia/Seoul");
    expect(readerTimeZone("Not/AZone")).toBe(HOUSE_TIME_ZONE);
    expect(readerTimeZone(undefined)).toBe(HOUSE_TIME_ZONE);
    expect(readerTimeZone("")).toBe(HOUSE_TIME_ZONE);
  });
});
