import { describe, expect, it } from "vitest";
import {
  LOYALTY_FEE_LABEL,
  carryFeesToNewSpan,
  loyaltyFee,
  mergeAdjustments,
  splitAdjustments,
  splitLoyalty,
} from "./loyaltyDiscount";

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

describe("keeping the discount apart from the other fees", () => {
  // Parking and cleaning are part of what the stay costs and stay itemised with
  // the rooms; the discount comes off the total afterwards. Mixing them would
  // either hide the discount in the room lines or double-count it.
  it("separates the loyalty discount from ordinary fees", () => {
    const { loyaltySum, otherFees } = splitLoyalty([
      { label: "Parking", amount: 20 },
      { label: LOYALTY_FEE_LABEL, amount: -30 },
      { label: "Cleaning", amount: 15 },
    ]);
    expect(loyaltySum).toBe(-30);
    expect(otherFees.map((f) => f.label)).toEqual(["Parking", "Cleaning"]);
  });

  it("adds up a discount spread across several stays", () => {
    const { loyaltySum } = splitLoyalty([
      { label: LOYALTY_FEE_LABEL, amount: -13.05 },
      { label: LOYALTY_FEE_LABEL, amount: -30 },
    ]);
    expect(loyaltySum).toBe(-43.05);
  });

  it("is zero when nobody has a discount", () => {
    const { loyaltySum, otherFees } = splitLoyalty([{ label: "Parking", amount: 20 }]);
    expect(loyaltySum).toBe(0);
    expect(otherFees).toHaveLength(1);
  });

  it("handles no fees at all", () => {
    expect(splitLoyalty([])).toEqual({ loyaltySum: 0, otherFees: [] });
  });
});

describe("typing a discount without typing a minus sign", () => {
  // The house has a second manager and the host was plain about why this
  // exists: "she would get confused adding a discount in the fee categories".
  // The editor shows two lists; the store keeps one. Every test here guards
  // the sign, because getting it backwards ADDS money to a guest's bill and
  // nothing on screen looks wrong.

  it("stores a discount typed as a plain positive as money OFF", () => {
    expect(mergeAdjustments([], [{ label: LOYALTY_FEE_LABEL, amount: "5" }])).toEqual([
      { label: LOYALTY_FEE_LABEL, amount: -5 },
    ]);
  });

  // The box is already labelled with a minus. Somebody will type one anyway.
  it("still means money off when a minus is typed as well", () => {
    expect(mergeAdjustments([], [{ label: "Goodwill", amount: "-5" }])).toEqual([
      { label: "Goodwill", amount: -5 },
    ]);
  });

  it("keeps fees positive and discounts negative in one list", () => {
    expect(
      mergeAdjustments(
        [{ label: "Parking", amount: "20" }],
        [{ label: LOYALTY_FEE_LABEL, amount: "5" }],
      ),
    ).toEqual([
      { label: "Parking", amount: 20 },
      { label: LOYALTY_FEE_LABEL, amount: -5 },
    ]);
  });

  it("drops a discount line left blank rather than writing a zero", () => {
    expect(mergeAdjustments([], [{ label: "Long stay", amount: "" }])).toEqual([]);
  });

  it("names an unlabelled discount rather than leaving it blank on the guest's text", () => {
    expect(mergeAdjustments([], [{ label: "  ", amount: "7.5" }])).toEqual([
      { label: "Discount", amount: -7.5 },
    ]);
  });

  it("reopens the editor with the discount shown as the number it was typed as", () => {
    expect(
      splitAdjustments([
        { label: "Parking", amount: 20 },
        { label: LOYALTY_FEE_LABEL, amount: -5 },
      ]),
    ).toEqual({
      fees: [{ label: "Parking", amount: "20" }],
      discounts: [{ label: LOYALTY_FEE_LABEL, amount: "5" }],
    });
  });

  // Open the editor, change nothing, save: the stay must be worth what it was.
  it("survives a round trip through the editor unchanged", () => {
    const stored = [
      { label: "Cleaning", amount: 35 },
      { label: LOYALTY_FEE_LABEL, amount: -13.05 },
    ];
    const { fees, discounts } = splitAdjustments(stored);
    expect(mergeAdjustments(fees, discounts)).toEqual(stored);
  });

  it("handles a stay with nothing on it", () => {
    expect(splitAdjustments(undefined)).toEqual({ fees: [], discounts: [] });
    expect(mergeAdjustments([], [])).toEqual([]);
  });
});


// Modify Booking deletes the stay and books it again, so the fees have to be
// carried over by hand. Stephanie's $5-a-night came off the moment her hold
// was confirmed this way; these guard the carry.
describe("carrying fees across a modified stay", () => {
  it("keeps ordinary fees as they were", () => {
    const fees = [{ label: "Parking", amount: 40 }];
    expect(carryFeesToNewSpan(fees, 6, 3)).toEqual(fees);
  });

  it("keeps the loyalty discount when the nights do not change", () => {
    const fees = [{ label: LOYALTY_FEE_LABEL, amount: -30 }];
    expect(carryFeesToNewSpan(fees, 6, 6)).toEqual(fees);
  });

  it("rebuilds the loyalty discount from its per-night rate when the nights change", () => {
    expect(carryFeesToNewSpan([{ label: LOYALTY_FEE_LABEL, amount: -30 }], 6, 4)).toEqual([
      { label: LOYALTY_FEE_LABEL, amount: -20 },
    ]);
  });

  it("keeps cents exact through the rebuild", () => {
    // $4.35 a night on 3 nights is -13.05; on 5 nights it must be -21.75, not
    // whatever floating point makes of 13.05 / 3 * 5.
    expect(carryFeesToNewSpan([{ label: LOYALTY_FEE_LABEL, amount: -13.05 }], 3, 5)).toEqual([
      { label: LOYALTY_FEE_LABEL, amount: -21.75 },
    ]);
  });

  it("puts the discount after the other fees, as the modal does", () => {
    expect(
      carryFeesToNewSpan(
        [{ label: LOYALTY_FEE_LABEL, amount: -30 }, { label: "Parking", amount: 40 }],
        6,
        6,
      ),
    ).toEqual([
      { label: "Parking", amount: 40 },
      { label: LOYALTY_FEE_LABEL, amount: -30 },
    ]);
  });

  it("is empty when there was nothing to carry", () => {
    expect(carryFeesToNewSpan(undefined, 6, 3)).toEqual([]);
    expect(carryFeesToNewSpan([], 6, 3)).toEqual([]);
  });
});
