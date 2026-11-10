import { describe, expect, it } from "vitest";
import { priceRangeOf, priceRangeText } from "./priceRange";

describe("priceRangeOf", () => {
  // The house's own example: Cozy at $55 is shown to a new guest as $55–$65.
  it("runs from the room's rate to ten dollars above it", () => {
    expect(priceRangeOf(55)).toEqual({ min: 55, max: 65 });
    expect(priceRangeText(priceRangeOf(55)!)).toBe("$55–$65");
  });

  // A room with no rate would otherwise show "$0–$10", which reads as a bug.
  it("gives no range for a room with no rate", () => {
    expect(priceRangeOf(0)).toBeNull();
    expect(priceRangeOf(undefined)).toBeNull();
    expect(priceRangeOf(null)).toBeNull();
    expect(priceRangeOf(NaN)).toBeNull();
    expect(priceRangeOf(-5)).toBeNull();
  });

  it("prints cents only when there are some, without float noise", () => {
    expect(priceRangeText(priceRangeOf(54.9)!)).toBe("$54.90–$64.90");
  });
});
