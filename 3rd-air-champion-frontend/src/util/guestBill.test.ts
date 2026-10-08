import { describe, expect, it } from "vitest";
import { guestBillForMonth } from "./guestBill";

// The figure beside the month when TiMag is filtered to one guest. Written for
// Shuhui's December 2026: three stays, the first starting Nov 30; at $73 a
// night her eleven December nights are $803 — it read $584, the stays that
// STARTED in December.

const queen = { id: "q", name: "Queen" } as any;
const king = { id: "k", name: "King" } as any;
const night = (_date: string, start: string, extra: Record<string, unknown> = {}) =>
  ({ room: queen, guest: { name: "Shuhui" }, price: 73, startDate: start, duration: 4, ...extra }) as any;

const add = (map: Map<string, any>, date: string, ...bookings: any[]) =>
  map.set(date, { date, bookings: [...(map.get(date)?.bookings ?? []), ...bookings] });

const stay = (map: Map<string, any>, start: string, nights: string[], extra: Record<string, unknown> = {}) =>
  nights.forEach((d) => add(map, d, night(d, start, extra)));

describe("guestBillForMonth", () => {
  it("counts every night of the guest's that falls in the month — Shuhui's December is $803", () => {
    const m = new Map<string, any>();
    stay(m, "2026-11-30", ["2026-11-30", "2026-12-01", "2026-12-02", "2026-12-03"]);
    stay(m, "2026-12-07", ["2026-12-07", "2026-12-08", "2026-12-09", "2026-12-10"]);
    stay(m, "2026-12-14", ["2026-12-14", "2026-12-15", "2026-12-16", "2026-12-17"]);
    expect(guestBillForMonth(m, "Shuhui", "2026-12")).toBe(803);
    expect(guestBillForMonth(m, "Shuhui", "2026-11")).toBe(73);
  });

  it("counts a stay's fees once, on its start night, not once per night", () => {
    const m = new Map<string, any>();
    stay(m, "2026-12-07", ["2026-12-07", "2026-12-08"], { fees: [{ label: "Parking", amount: 10 }] });
    expect(guestBillForMonth(m, "Shuhui", "2026-12")).toBe(73 * 2 + 10);
  });

  it("bills the live booking only when a cancelled one shares the room and night", () => {
    const m = new Map<string, any>();
    add(m, "2026-12-07", night("2026-12-07", "2026-12-07", { bookedOn: "2026-10-01", price: 99 }));
    add(m, "2026-12-07", night("2026-12-07", "2026-12-07", { bookedOn: "2026-10-05" }));
    expect(guestBillForMonth(m, "Shuhui", "2026-12")).toBe(73);
  });

  it("leaves out other guests, and counts the guest in two rooms the same night", () => {
    const m = new Map<string, any>();
    add(m, "2026-12-07", night("2026-12-07", "2026-12-07"), { ...night("2026-12-07", "2026-12-07"), room: king, price: 80 });
    add(m, "2026-12-07", { ...night("2026-12-07", "2026-12-07"), guest: { name: "Rostam" }, room: { id: "c", name: "Chill" } });
    expect(guestBillForMonth(m, "Shuhui", "2026-12")).toBe(153);
  });
});
