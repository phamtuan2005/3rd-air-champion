import { buildDateRange } from "../dateRange";

describe("buildDateRange", () => {
  const start = new Date("2026-05-01T00:00:00.000Z");

  it("returns a single date when duration is 1", () => {
    const result = buildDateRange(start, 1);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(start);
  });

  it("returns consecutive days for duration > 1", () => {
    const result = buildDateRange(start, 3);
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual(new Date("2026-05-01T00:00:00.000Z"));
    expect(result[1]).toEqual(new Date("2026-05-02T00:00:00.000Z"));
    expect(result[2]).toEqual(new Date("2026-05-03T00:00:00.000Z"));
  });

  it("returns empty array for duration 0", () => {
    expect(buildDateRange(start, 0)).toHaveLength(0);
  });

  it("correctly crosses month boundary", () => {
    const endOfMonth = new Date("2026-01-30T00:00:00.000Z");
    const result = buildDateRange(endOfMonth, 3);
    expect(result[1]).toEqual(new Date("2026-01-31T00:00:00.000Z"));
    expect(result[2]).toEqual(new Date("2026-02-01T00:00:00.000Z"));
  });

  it("correctly crosses year boundary", () => {
    const yearEnd = new Date("2026-12-30T00:00:00.000Z");
    const result = buildDateRange(yearEnd, 3);
    expect(result[2]).toEqual(new Date("2027-01-01T00:00:00.000Z"));
  });

  it("does not mutate the start date", () => {
    const original = new Date("2026-05-01T00:00:00.000Z");
    buildDateRange(original, 5);
    expect(original).toEqual(new Date("2026-05-01T00:00:00.000Z"));
  });
});