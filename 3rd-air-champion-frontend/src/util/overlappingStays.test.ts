import { describe, expect, it } from "vitest";
import { mergeOverlappingStays } from "./overlappingStays";
import type { GuestBooking } from "../components/tibook/MyBookingsSheet";

// Susan, 2026-09-27: a two-night King stay written twice, which the backend
// handed TiBook as three stays. TiBook must read it as TiMag does — one
// two-night booking — without touching the backend.

const stay = (date: string, duration: number, extra: Partial<GuestBooking> = {}): GuestBooking => ({
  id: "x", guestName: "Susan", date: `${date}T00:00:00.000Z`, room: "king", duration,
  numberOfGuests: 1, status: "confirmed", createdAt: "", fees: [], ...extra,
});
const span = (b: GuestBooking) => `${b.date.slice(0, 10)}+${b.duration}`;

describe("a guest's stays written twice", () => {
  it("folds the three splits of a duplicated two-night stay into one", () => {
    const out = mergeOverlappingStays([
      stay("2026-10-19", 1, { total: 75 }),
      stay("2026-10-19", 2, { total: 150 }),
      stay("2026-10-20", 1, { total: 75 }),
    ]);
    expect(out.map(span)).toEqual(["2026-10-19+2"]);
  });

  // The widest split priced every night once; adding the splits would charge
  // the duplicate twice, and the guest is told what they paid.
  it("keeps the whole stay's total, never the sum of the splits", () => {
    const out = mergeOverlappingStays([
      stay("2026-10-19", 1, { total: 75 }),
      stay("2026-10-19", 2, { total: 150 }),
      stay("2026-10-20", 1, { total: 75 }),
    ]);
    expect(out[0].total).toBe(150);
  });

  it("folds a duplicated one-night stay", () => {
    const out = mergeOverlappingStays([stay("2026-10-19", 1), stay("2026-10-19", 1)]);
    expect(out.map(span)).toEqual(["2026-10-19+1"]);
  });

  it("leaves two stays in one room that only touch as two", () => {
    const out = mergeOverlappingStays([stay("2026-10-19", 2), stay("2026-10-21", 1)]);
    expect(out.map(span)).toEqual(["2026-10-19+2", "2026-10-21+1"]);
  });

  // A hold is never shown as confirmed, so a held night overlapping a paid
  // one in the same room is not the same stay.
  it("never folds a hold into a paid stay", () => {
    const out = mergeOverlappingStays([
      stay("2026-10-19", 2),
      stay("2026-10-20", 1, { status: "reserved" }),
    ]);
    expect(out.map((b) => `${span(b)} ${b.status}`)).toEqual(["2026-10-19+2 confirmed", "2026-10-20+1 reserved"]);
  });

  it("keeps stays in different rooms apart", () => {
    const out = mergeOverlappingStays([stay("2026-10-19", 2), stay("2026-10-19", 2, { room: "queen" })]);
    expect(out).toHaveLength(2);
  });

  it("is a no-op on a clean list", () => {
    const out = mergeOverlappingStays([stay("2026-11-02", 3), stay("2026-10-19", 2)]);
    expect(out.map(span)).toEqual(["2026-10-19+2", "2026-11-02+3"]);
  });
});
