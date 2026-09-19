import { describe, expect, it } from "vitest";
import { chooseHeadcount } from "./cleaningTasks";

// What a cleaner sets the room up for — the one decision TiMag and TiWork both
// run.
//
// They used to run their own versions, differing only in how far ahead they
// looked for an arrival: 2 nights in TiMag, 30 on the server. On most mornings
// the answers matched anyway, so the split went unnoticed until the host
// compared a rota with the Plan tab. These pin each branch so a copy cannot
// quietly reappear on one side.

const choose = (over: Partial<Parameters<typeof chooseHeadcount>[0]> = {}) =>
  chooseHeadcount({
    hasSameDayArrival: false,
    sellOdds: 0,
    hasNearArrival: false,
    hasEstimate: false,
    ...over,
  });

describe("choosing what a cleaner sets a room up for", () => {
  it("takes a same-day check-in over everything else", () => {
    // Even when the room is near-certain to sell first: somebody IS coming
    // today, and that is a fact, not a forecast.
    expect(choose({ hasSameDayArrival: true, sellOdds: 0.98, hasEstimate: true })).toBe("arrival");
  });

  it("prefers what the room usually takes when the night will likely sell", () => {
    // The King "(3, sofa)" case: a party of three booked for a later night,
    // while this night almost certainly sells to a walk-in first.
    expect(choose({ sellOdds: 0.98, hasNearArrival: true, hasEstimate: true })).toBe("estimate");
  });

  it("says nothing when the night will likely sell and the room has no history", () => {
    // Nothing honest to show. A booked arrival here belongs to a later night
    // and would be read as tonight's party.
    expect(choose({ sellOdds: 0.98, hasNearArrival: true, hasEstimate: false })).toBe("none");
  });

  it("uses a nearby booking when the night will probably stay empty", () => {
    expect(choose({ sellOdds: 0.1, hasNearArrival: true, hasEstimate: true })).toBe("arrival");
  });

  it("falls back to the room's usual party when nothing is booked nearby", () => {
    expect(choose({ sellOdds: 0.1, hasNearArrival: false, hasEstimate: true })).toBe("estimate");
  });

  it("says nothing when there is nothing to say", () => {
    expect(choose()).toBe("none");
  });

  // The boundary is inclusive — a room that sells exactly half the time is
  // treated as likely to sell, the same way both apps have always read it.
  it("treats even odds as likely to sell", () => {
    expect(choose({ sellOdds: 0.5, hasNearArrival: true, hasEstimate: true })).toBe("estimate");
    expect(choose({ sellOdds: 0.49, hasNearArrival: true, hasEstimate: true })).toBe("arrival");
  });
});
