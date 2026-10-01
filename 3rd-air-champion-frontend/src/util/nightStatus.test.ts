import { describe, expect, it } from "vitest";
import { nightStatus } from "./nightStatus";
import { dayType } from "./types/dayType";
import { roomType } from "./types/roomType";
import { bookingType } from "./types/bookingType";

// The one rule the month grid and the day-by-day list both print from. Each
// case below is a way a night once looked free to a guest when it was not.

const today = new Date(2026, 8, 25); // 25 Sep 2026, local midnight
const night = new Date(2026, 8, 27);
const key = "2026-09-27";

const room = (id: string, name: string): roomType =>
  ({ id, name, price: 0, roomCode: "", active: true });
const king = room("k", "King");
const queen = room("q", "Queen");
const chill = room("c", "Chill");
const house = [king, queen, chill];

const day = (over: Partial<dayType> = {}): dayType => ({
  id: key, blockedRooms: [], bookings: [], isBlocked: false, isAirBnB: false,
  date: night, numberOfGuests: 0, ...over,
});
const bookedIn = (r: roomType) => ({ room: r } as bookingType);

describe("what a guest is told about one night", () => {
  it("is free in every room when nothing is on it", () => {
    const s = nightStatus(night, house, new Map(), undefined, today);
    expect(s.status).toBe("available");
    expect(s.freeRooms.map((r) => r.name)).toEqual(["King", "Queen", "Chill"]);
  });

  it("names only the rooms still free when some are booked", () => {
    const s = nightStatus(night, house, new Map([[key, day({ bookings: [bookedIn(king)] })]]), undefined, today);
    expect(s.status).toBe("partial");
    expect(s.roomsLeft).toBe(2);
    expect(s.freeRooms.map((r) => r.name)).toEqual(["Queen", "Chill"]);
  });

  // A hold is an unpaid stay, not a vacancy.
  it("counts a reserved hold as taken", () => {
    const s = nightStatus(night, [queen], new Map(), new Map([[key, new Set(["q"])]]), today);
    expect(s.status).toBe("full");
  });

  // A room can be blocked on a day that is otherwise open.
  it("subtracts a room blocked on its own", () => {
    const s = nightStatus(night, house, new Map([[key, day({ blockedRooms: [chill] })]]), undefined, today);
    expect(s.freeRooms.map((r) => r.name)).toEqual(["King", "Queen"]);
  });

  it("is blocked when the whole day is", () => {
    const s = nightStatus(night, house, new Map([[key, day({ isBlocked: true })]]), undefined, today);
    expect(s.status).toBe("blocked");
    expect(s.freeRooms).toEqual([]);
  });

  it("is past before today, and tonight is not past", () => {
    expect(nightStatus(new Date(2026, 8, 24), house, new Map(), undefined, today).status).toBe("past");
    expect(nightStatus(today, house, new Map(), undefined, today).status).toBe("available");
  });

  // Scoped to one room, the others' bookings are none of this night's business.
  it("only looks at the rooms in scope", () => {
    const s = nightStatus(night, [queen], new Map([[key, day({ bookings: [bookedIn(king)] })]]), undefined, today);
    expect(s.status).toBe("available");
    expect(s.roomsLeft).toBe(1);
  });
});
