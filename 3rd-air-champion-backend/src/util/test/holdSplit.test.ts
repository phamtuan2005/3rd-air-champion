import { splitStay } from "../holdSplit";

// Soft-holding some nights of a stay (host, 2026-10-10).
const nights = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => `2026-10-${String(from + i).padStart(2, "0")}`);

describe("splitStay", () => {
  it("cuts the stay at the nights picked, held parts and as-it-was parts in turn", () => {
    const parts = splitStay(nights(19, 31), new Set(["2026-10-19", "2026-10-20", "2026-10-26", "2026-10-27"]));
    expect(parts.map((p) => [p.nights[0], p.nights[p.nights.length - 1], p.held])).toEqual([
      ["2026-10-19", "2026-10-20", true],
      ["2026-10-21", "2026-10-25", false],
      ["2026-10-26", "2026-10-27", true],
      ["2026-10-28", "2026-10-31", false],
    ]);
  });

  it("keeps the stay's fees on ONE part — the first not being held — so they are counted once", () => {
    const parts = splitStay(nights(19, 31), new Set(["2026-10-19", "2026-10-20"]));
    expect(parts.map((p) => p.keepsFees)).toEqual([false, true]);
  });

  it("holding the last nights leaves the fees with the start", () => {
    const parts = splitStay(nights(19, 25), new Set(["2026-10-24", "2026-10-25"]));
    expect(parts.map((p) => [p.held, p.keepsFees])).toEqual([
      [false, true],
      [true, false],
    ]);
  });

  it("every night picked is one held part with its own fees", () => {
    expect(splitStay(nights(19, 20), new Set(nights(19, 20)))).toEqual([
      { nights: ["2026-10-19", "2026-10-20"], held: true, keepsFees: true },
    ]);
  });
});
