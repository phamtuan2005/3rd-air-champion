import { describe, expect, it } from "vitest";
import { LOYALTY_FEE_LABEL, loyaltyFee } from "./loyaltyDiscount";

// Money off a stay for a guest who has earned it.
//
// The host types dollars per NIGHT; the booking stores one per-stay fee with a
// negative amount. Every test here guards that conversion, because three places
// read it — the input, the guest's confirmation text and the stored fee — and
// they must never disagree about what $5 a night on six nights comes to.

describe("turning a nightly discount into one stay's fee", () => {
  it("multiplies by the nights and stores it as a negative amount", () => {
    expect(loyaltyFee(5, 6)).toEqual({ label: LOYALTY_FEE_LABEL, amount: -30 });
  });

  it("keeps cents exact", () => {
    // 4.35 * 3 is 13.049999999999999 in floating point, and this is money
    // somebody reconciles by hand.
    expect(loyaltyFee(4.35, 3)).toEqual({ label: LOYALTY_FEE_LABEL, amount: -13.05 });
  });

  it("is nothing at all when there is no discount", () => {
    expect(loyaltyFee(0, 6)).toBeNull();
    expect(loyaltyFee(Number.NaN, 6)).toBeNull();
  });

  // Nothing here may ever ADD money to a stay.
  it("refuses a negative rate rather than charging for it", () => {
    expect(loyaltyFee(-5, 6)).toBeNull();
  });

  it("is nothing when there are no nights to discount", () => {
    expect(loyaltyFee(5, 0)).toBeNull();
  });

  it("handles a single night", () => {
    expect(loyaltyFee(12.5, 1)).toEqual({ label: LOYALTY_FEE_LABEL, amount: -12.5 });
  });
});
