import { describe, expect, it } from "vitest";
import { groupConsecutiveDates } from "./cartGrouping";

const CHILL = "chill";
const KING = "king";
const QUEEN = "queen";

// A stand-in for the calendar: which rooms are free on each night.
const freeOn = (table: Record<string, string[]>) => (dateKey: string) =>
  new Set(table[dateKey] ?? []);

describe("without availability, it just groups consecutive days", () => {
  it("joins a run", () => {
    const r = groupConsecutiveDates(new Set(["2026-09-07", "2026-09-08", "2026-09-09"]));
    expect(r).toEqual([{ start: "2026-09-07", end: "2026-09-09", nights: 3 }]);
  });

  it("breaks at a gap", () => {
    const r = groupConsecutiveDates(new Set(["2026-09-07", "2026-09-09"]));
    expect(r).toEqual([
      { start: "2026-09-07", end: "2026-09-07", nights: 1 },
      { start: "2026-09-09", end: "2026-09-09", nights: 1 },
    ]);
  });

  it("sorts before grouping", () => {
    const r = groupConsecutiveDates(new Set(["2026-09-09", "2026-09-07", "2026-09-08"]));
    expect(r).toEqual([{ start: "2026-09-07", end: "2026-09-09", nights: 3 }]);
  });
});

describe("a run no single room can cover is split", () => {
  it("splits Sep 7 (only Chill) from Sep 8 (only King)", () => {
    // The dead end: joined, this stay wants a room free on both nights, and
    // there is none — so two perfectly bookable nights offered no room at all.
    const r = groupConsecutiveDates(
      new Set(["2026-09-07", "2026-09-08"]),
      freeOn({ "2026-09-07": [CHILL], "2026-09-08": [KING] }),
    );
    expect(r).toEqual([
      { start: "2026-09-07", end: "2026-09-07", nights: 1 },
      { start: "2026-09-08", end: "2026-09-08", nights: 1 },
    ]);
  });

  it("keeps a run together when one room covers all of it", () => {
    const r = groupConsecutiveDates(
      new Set(["2026-09-07", "2026-09-08", "2026-09-09"]),
      freeOn({
        "2026-09-07": [CHILL, KING],
        "2026-09-08": [KING],
        "2026-09-09": [KING, QUEEN],
      }),
    );
    expect(r).toEqual([{ start: "2026-09-07", end: "2026-09-09", nights: 3 }]);
  });

  it("splits only where cover actually runs out", () => {
    // King covers the 7th and 8th; nothing covers the 9th with them.
    const r = groupConsecutiveDates(
      new Set(["2026-09-07", "2026-09-08", "2026-09-09"]),
      freeOn({
        "2026-09-07": [KING, CHILL],
        "2026-09-08": [KING],
        "2026-09-09": [CHILL],
      }),
    );
    expect(r).toEqual([
      { start: "2026-09-07", end: "2026-09-08", nights: 2 },
      { start: "2026-09-09", end: "2026-09-09", nights: 1 },
    ]);
  });

  it("still breaks at a gap, availability or not", () => {
    const r = groupConsecutiveDates(
      new Set(["2026-09-07", "2026-09-10"]),
      freeOn({ "2026-09-07": [KING], "2026-09-10": [KING] }),
    );
    expect(r).toEqual([
      { start: "2026-09-07", end: "2026-09-07", nights: 1 },
      { start: "2026-09-10", end: "2026-09-10", nights: 1 },
    ]);
  });

  it("does not choke on a night with nothing free", () => {
    // Should not happen — full nights are not addable — but a stay of its own
    // is far better than a crash or a silently swallowed date.
    const r = groupConsecutiveDates(
      new Set(["2026-09-07", "2026-09-08"]),
      freeOn({ "2026-09-07": [KING], "2026-09-08": [] }),
    );
    expect(r).toEqual([
      { start: "2026-09-07", end: "2026-09-07", nights: 1 },
      { start: "2026-09-08", end: "2026-09-08", nights: 1 },
    ]);
  });

  it("handles a month boundary", () => {
    const r = groupConsecutiveDates(
      new Set(["2026-09-30", "2026-10-01"]),
      freeOn({ "2026-09-30": [KING], "2026-10-01": [KING] }),
    );
    expect(r).toEqual([{ start: "2026-09-30", end: "2026-10-01", nights: 2 }]);
  });
});
