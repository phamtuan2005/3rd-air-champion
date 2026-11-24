import { describe, expect, it } from "vitest";
import { tibookStructuredData } from "./tibookStructuredData";
import { roomType } from "./types/roomType";
import { hostType } from "./types/hostType";

// TiBook described for AI assistants and search engines. What it must never do
// is say more than the room cards say to a stranger: the door code, the
// address, check-in instructions, or a guest's own rate.

const room = (over: Partial<roomType>): roomType => ({
  id: "r1",
  name: "King",
  price: 75,
  roomCode: "1224#",
  active: true,
  airbnbUrl: "https://www.airbnb.com/rooms/1586635483950294231",
  checkInInstructions: "Lockbox behind the gate",
  ...over,
});

const host = {
  id: "h1",
  email: "host@example.com",
  name: "Anh-Tuan Pham",
  calendar: "c1",
  doorCode: "9999#",
  airbnbAddress: "1 Secret Lane",
  airbnbRating: 4.9,
  airbnbReviewCount: 120,
} as hostType;

describe("TiBook's structured data", () => {
  const data = tibookStructuredData(
    host,
    [room({}), room({ id: "r2", name: "Cozy", price: 55, roomCode: "0205#", airbnbUrl: "https://www.airbnb.com/rooms/1177648203505001777" }), room({ id: "r3", name: "Old", active: false })],
    "https://example.com/book",
  );
  const json = JSON.stringify(data);

  it("describes each active room with the facts the cards show", () => {
    expect(data.containsPlace.map((p) => p.name)).toEqual(["King", "Cozy"]);
    const king: any = data.containsPlace[0];
    expect(king.occupancy.maxValue).toBe(3);
    expect(king.bed).toBe("1 queen bed, 1 sofa bed");
    // Cozy has no air conditioning; the facts must not borrow King's.
    const cozy: any = data.containsPlace[1];
    expect(cozy.amenityFeature.map((f: any) => f.name)).not.toContain("Air conditioning");
  });

  it("offers the public nightly range, never one figure", () => {
    expect(data.makesOffer[0].priceSpecification).toMatchObject({ minPrice: 75, maxPrice: 85, priceCurrency: "USD", unitText: "night" });
  });

  it("names the motto as the house's promise to its guests", () => {
    expect(data.description).toContain('Its promise to guests: "Your comfort. Our mission."');
  });

  it("leaves out the door codes, the address and check-in instructions", () => {
    expect(json).not.toMatch(/1224#|0205#|9999#|Secret Lane|Lockbox/);
  });

  it("gives a rating only when there is one to give", () => {
    expect(data.aggregateRating).toMatchObject({ ratingValue: 4.9, reviewCount: 120 });
    const none = tibookStructuredData({ ...host, airbnbRating: undefined }, [], "https://example.com/book");
    expect("aggregateRating" in none).toBe(false);
  });
});
