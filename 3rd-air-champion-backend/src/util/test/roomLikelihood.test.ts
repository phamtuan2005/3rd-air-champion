import {
  roomOccupancyOdds,
  roomPartySizeOdds,
  NightSample,
  StaySample,
} from "../roomLikelihood";

// What a room is likely to do, when nothing is booked to say.
//
// These pin the two rules a cleaner's headcount now depends on. Get either
// wrong and TiWork tells somebody to lay out the wrong number of beds — and it
// does it plausibly, with a number that looks like every other number there.

const night = (roomId: string, occupied: boolean, blocked = false): NightSample => ({
  roomId,
  occupied,
  blocked,
});
const stay = (roomId: string, guests: number): StaySample => ({ roomId, guests });

describe("odds a room sells", () => {
  it("is booked nights over sellable nights, per room", () => {
    const odds = roomOccupancyOdds([
      night("king", true),
      night("king", true),
      night("king", false),
      night("king", true),
      night("cozy", false),
      night("cozy", false),
    ]);
    expect(odds.get("king")).toBeCloseTo(0.75);
    expect(odds.get("cozy")).toBe(0);
  });

  it("leaves blocked nights out of both halves", () => {
    // A blocked night was never for sale. Counted as empty it would make the
    // room look worse at selling than it is, and the cleaner would be handed a
    // booked guest's headcount on a night that will actually sell.
    const odds = roomOccupancyOdds([
      night("king", true),
      night("king", false, true),
      night("king", false, true),
    ]);
    expect(odds.get("king")).toBe(1);
  });

  it("says nothing about a room with no sellable nights", () => {
    const odds = roomOccupancyOdds([night("king", false, true)]);
    expect(odds.has("king")).toBe(false);
  });
});

describe("party size a room usually takes", () => {
  it("takes the most common headcount, with its share and sample", () => {
    const odds = roomPartySizeOdds([
      stay("king", 2),
      stay("king", 3),
      stay("king", 3),
      stay("king", 3),
    ]);
    expect(odds.get("king")).toEqual({ guests: 3, p: 0.75, stays: 4 });
  });

  it("keeps rooms apart", () => {
    const odds = roomPartySizeOdds([stay("king", 3), stay("cozy", 1), stay("cozy", 1)]);
    expect(odds.get("king")?.guests).toBe(3);
    // Cozy takes one guest. A house-wide blend would have said otherwise.
    expect(odds.get("cozy")?.guests).toBe(1);
  });

  it("breaks a tie toward the larger party", () => {
    const odds = roomPartySizeOdds([stay("king", 2), stay("king", 3)]);
    expect(odds.get("king")?.guests).toBe(3);
  });

  it("reads a missing headcount as one guest, not as zero", () => {
    expect(roomPartySizeOdds([stay("king", 0)]).get("king")?.guests).toBe(1);
  });

  it("says nothing about a room with no stays", () => {
    expect(roomPartySizeOdds([]).get("king")).toBeUndefined();
  });
});
