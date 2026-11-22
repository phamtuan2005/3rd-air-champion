import { describe, expect, it } from "vitest";
import { withAirbnbStays } from "./airbnbPastStays";

describe("withAirbnbStays", () => {
  // Irina: one TiBook stay in Dec 2026, one AirBnB stay in Cozy before it. TiMag
  // said "1 stay since Dec 2026" (host, 2026-11-22).
  it("adds the AirBnB stays to the count and dates the guest from the first of them", () => {
    const cozy = { start: "2026-03-03", end: "2026-03-06", nights: 3, roomId: "c", alias: "Irina", payout: 55, matchedBy: "phone" as const };
    expect(withAirbnbStays(1, "2026-12-05T00:00:00.000Z", [cozy])).toEqual({ count: 2, first: "2026-03-03", airbnb: 1 });
  });
  it("leaves a guest with no AirBnB stays as they were", () => {
    expect(withAirbnbStays(3, "2025-01-10", [])).toEqual({ count: 3, first: "2025-01-10", airbnb: 0 });
  });
});
