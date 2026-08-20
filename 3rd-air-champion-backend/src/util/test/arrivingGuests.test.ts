import { arrivingGuestCounts, dayKey, shiftKey } from "../arrivingGuests";

const R1 = "room-cozy";
const R2 = "room-queen";

describe("arrivingGuestCounts", () => {
  it("uses a same-day check-in — the morning cleaned for someone arriving that afternoon", () => {
    const counts = arrivingGuestCounts(
      [{ date: "2026-08-20", roomId: R1, guests: 3 }],
      [{ date: "2026-08-20", roomId: R1 }],
    );
    expect(counts.get(`2026-08-20|${R1}`)).toBe(3);
  });

  it("looks forward to the next stay when nobody arrives that day", () => {
    const counts = arrivingGuestCounts(
      [{ date: "2026-08-25", roomId: R1, guests: 2 }],
      [{ date: "2026-08-20", roomId: R1 }],
    );
    expect(counts.get(`2026-08-20|${R1}`)).toBe(2);
  });

  it("takes the FIRST arrival, not the largest or the last", () => {
    const counts = arrivingGuestCounts(
      [
        { date: "2026-08-28", roomId: R1, guests: 4 },
        { date: "2026-08-22", roomId: R1, guests: 1 },
      ],
      [{ date: "2026-08-20", roomId: R1 }],
    );
    expect(counts.get(`2026-08-20|${R1}`)).toBe(1);
  });

  it("never reads a stay that already began — only ones that start", () => {
    // The booking runs 18th–24th. It is not an arrival for the 20th, and the
    // room has nothing else booked, so there is no count to give.
    const counts = arrivingGuestCounts(
      [{ date: "2026-08-18", roomId: R1, guests: 5 }],
      [{ date: "2026-08-20", roomId: R1 }],
    );
    expect(counts.has(`2026-08-20|${R1}`)).toBe(false);
  });

  it("keeps rooms apart — another room's guests are not this room's", () => {
    const counts = arrivingGuestCounts(
      [{ date: "2026-08-21", roomId: R2, guests: 6 }],
      [{ date: "2026-08-20", roomId: R1 }],
    );
    expect(counts.has(`2026-08-20|${R1}`)).toBe(false);
  });

  it("gives nothing when the next arrival is beyond the lookahead", () => {
    const counts = arrivingGuestCounts(
      [{ date: "2026-10-01", roomId: R1, guests: 2 }],
      [{ date: "2026-08-20", roomId: R1 }],
    );
    expect(counts.has(`2026-08-20|${R1}`)).toBe(false);
  });

  it("includes the last day of the lookahead and excludes the one after", () => {
    const cleanings = [{ date: "2026-08-20", roomId: R1 }];
    expect(
      arrivingGuestCounts([{ date: "2026-09-19", roomId: R1, guests: 2 }], cleanings).get(
        `2026-08-20|${R1}`,
      ),
    ).toBe(2);
    expect(
      arrivingGuestCounts([{ date: "2026-09-20", roomId: R1, guests: 2 }], cleanings).has(
        `2026-08-20|${R1}`,
      ),
    ).toBe(false);
  });

  it("counts a booking with no headcount recorded as one person, not zero", () => {
    const counts = arrivingGuestCounts(
      [{ date: "2026-08-20", roomId: R1, guests: 0 }],
      [{ date: "2026-08-20", roomId: R1 }],
    );
    expect(counts.get(`2026-08-20|${R1}`)).toBe(1);
  });

  it("answers each cleaning in a multi-room day separately", () => {
    const counts = arrivingGuestCounts(
      [
        { date: "2026-08-20", roomId: R1, guests: 2 },
        { date: "2026-08-23", roomId: R2, guests: 4 },
      ],
      [
        { date: "2026-08-20", roomId: R1 },
        { date: "2026-08-20", roomId: R2 },
      ],
    );
    expect(counts.get(`2026-08-20|${R1}`)).toBe(2);
    expect(counts.get(`2026-08-20|${R2}`)).toBe(4);
  });
});

describe("date keys", () => {
  it("crosses a month end without slipping a day", () => {
    expect(shiftKey("2026-08-31", 1)).toBe("2026-09-01");
    expect(shiftKey("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("reads a stored date as its UTC day, the way every screen keys it", () => {
    expect(dayKey(new Date("2026-08-20T00:00:00.000Z"))).toBe("2026-08-20");
    expect(dayKey("2026-08-20T07:00:00.000Z")).toBe("2026-08-20");
  });
});
