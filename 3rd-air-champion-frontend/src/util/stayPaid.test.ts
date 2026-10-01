import { describe, expect, it } from "vitest";
import { stayPaidFromNights } from "./stayPaid";
import { dayType } from "./types/dayType";
import { bookingType } from "./types/bookingType";

// What a guest is told they paid for a stay. Each case is a way the number
// could come out plausible and wrong.

const ME = "guest-me";
const KING = "room-king";

const booking = (guest: string, room: string, price: number, fees: { label: string; amount: number }[] = []) =>
  ({ guest: { id: guest }, room: { id: room }, price, fees } as unknown as bookingType);

const nights = (entries: Record<string, bookingType[]>) =>
  new Map<string, dayType>(
    Object.entries(entries).map(([k, bookings]) => [k, { id: k, date: new Date(k), bookings, blockedRooms: [], isBlocked: false, isAirBnB: false, numberOfGuests: 0 }]),
  );

describe("what a guest paid for a stay", () => {
  it("adds every night at its price, and the fees once", () => {
    const cleaning = [{ label: "Cleaning", amount: 25 }];
    const map = nights({
      "2026-10-03": [booking(ME, KING, 80, cleaning)],
      "2026-10-04": [booking(ME, KING, 80, cleaning)],
      "2026-10-05": [booking(ME, KING, 80, cleaning)],
    });
    expect(stayPaidFromNights("2026-10-03", 3, KING, ME, map, cleaning)).toBe(265);
  });

  it("uses each night's own price when the rate changed partway", () => {
    const map = nights({
      "2026-10-30": [booking(ME, KING, 60)],
      "2026-10-31": [booking(ME, KING, 65)],
    });
    expect(stayPaidFromNights("2026-10-30", 2, KING, ME, map)).toBe(125);
  });

  // Family stays at $0 on purpose: 0 is an answer, not a missing one.
  it("is 0 for a family stay", () => {
    const map = nights({ "2026-10-08": [booking(ME, KING, 0)] });
    expect(stayPaidFromNights("2026-10-08", 1, KING, ME, map)).toBe(0);
  });

  it("ignores other guests and other rooms on the same night", () => {
    const map = nights({
      "2026-10-03": [booking("someone-else", KING, 999), booking(ME, "room-queen", 999), booking(ME, KING, 80)],
    });
    expect(stayPaidFromNights("2026-10-03", 1, KING, ME, map)).toBe(80);
  });

  it("says nothing when a night is missing, rather than a partial total", () => {
    const map = nights({ "2026-10-03": [booking(ME, KING, 80)] });
    expect(stayPaidFromNights("2026-10-03", 2, KING, ME, map)).toBeUndefined();
  });

  // A cancelled stay can remain in a night's record beside the live one.
  it("says nothing when a night has two of this guest's bookings for the room", () => {
    const map = nights({ "2026-10-03": [booking(ME, KING, 80), booking(ME, KING, 90)] });
    expect(stayPaidFromNights("2026-10-03", 1, KING, ME, map)).toBeUndefined();
  });

  it("says nothing until the guest is known", () => {
    const map = nights({ "2026-10-03": [booking(ME, KING, 80)] });
    expect(stayPaidFromNights("2026-10-03", 1, KING, undefined, map)).toBeUndefined();
  });
});
