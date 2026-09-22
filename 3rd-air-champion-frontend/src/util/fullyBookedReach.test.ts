import { describe, expect, it } from "vitest";
import { addDays, format, startOfToday } from "date-fns";
import { PLAN_DAYS_MAX, getFullyBookedReach, isNightFullyBooked } from "./cleaningTasks";
import { dayType } from "./types/dayType";

// The Plan window reaching a sold-out night on its own.
//
// Written when the window was a fixed eight days and the nights just past it
// were already full — every room turning over on a morning the tab did not
// show, so nobody had arranged a cleaner for it.

const key = (d: number) => format(addDays(startOfToday(), d), "yyyy-MM-dd");
const room = (id: string, active = true) => ({ id, name: id, active });
const rooms = [room("king"), room("queen"), room("cozy"), room("twin"), room("loft")];

const stay = (roomId: string) =>
  ({ id: `${roomId}-stay`, room: { id: roomId, name: roomId }, reserved: false }) as never;

const night = (
  map: Map<string, dayType>,
  d: number,
  booked: string[],
  extra: { blockedRooms?: string[]; isBlocked?: boolean } = {},
) =>
  map.set(key(d), {
    date: key(d),
    bookings: booked.map(stay),
    blockedRooms: (extra.blockedRooms ?? []).map((id) => ({ id, name: id })),
    isBlocked: extra.isBlocked ?? false,
  } as unknown as dayType);

describe("a fully booked night", () => {
  it("is every sellable room sold", () => {
    const map = new Map<string, dayType>();
    night(map, 9, ["king", "queen", "cozy", "twin", "loft"]);
    expect(isNightFullyBooked(map, rooms, key(9))).toBe(true);
  });

  it("is not a night with one room still open", () => {
    const map = new Map<string, dayType>();
    night(map, 9, ["king", "queen", "cozy", "twin"]);
    expect(isNightFullyBooked(map, rooms, key(9))).toBe(false);
  });

  it("still counts when the one unsold room is blocked", () => {
    const map = new Map<string, dayType>();
    night(map, 9, ["king", "queen", "cozy", "twin"], { blockedRooms: ["loft"] });
    expect(isNightFullyBooked(map, rooms, key(9))).toBe(true);
  });

  it("is not a night with every room blocked, nor a blocked day", () => {
    const map = new Map<string, dayType>();
    night(map, 9, [], { blockedRooms: rooms.map((r) => r.id) });
    night(map, 10, ["king", "queen", "cozy", "twin", "loft"], { isBlocked: true });
    expect(isNightFullyBooked(map, rooms, key(9))).toBe(false);
    expect(isNightFullyBooked(map, rooms, key(10))).toBe(false);
  });

  it("ignores rooms the house no longer sells", () => {
    const map = new Map<string, dayType>();
    night(map, 9, ["king", "queen", "cozy", "twin"]);
    expect(isNightFullyBooked(map, [...rooms.slice(0, 4), room("loft", false)], key(9))).toBe(true);
  });

  it("is never a night with no record", () => {
    expect(isNightFullyBooked(new Map(), rooms, key(9))).toBe(false);
  });
});

describe("how far the Plan reaches on its own", () => {
  it("is nothing when no night past the window is full", () => {
    const map = new Map<string, dayType>();
    night(map, 9, ["king", "queen"]);
    night(map, 10, ["king", "queen", "cozy", "twin"]);
    expect(getFullyBookedReach(map, rooms, 9)).toBeNull();
  });

  it("reaches the furthest full night, not just the first run", () => {
    const map = new Map<string, dayType>();
    night(map, 9, ["king"]);
    night(map, 10, ["king", "queen", "cozy", "twin", "loft"]);
    night(map, 11, ["king"]);
    night(map, 12, ["king", "queen", "cozy", "twin", "loft"]);
    expect(getFullyBookedReach(map, rooms, 9)).toBe(12);
  });

  it("leaves full nights already inside the window to the window", () => {
    const map = new Map<string, dayType>();
    night(map, 5, ["king", "queen", "cozy", "twin", "loft"]);
    expect(getFullyBookedReach(map, rooms, 9)).toBeNull();
  });

  it("stops at the cap", () => {
    const map = new Map<string, dayType>();
    night(map, PLAN_DAYS_MAX + 1, ["king", "queen", "cozy", "twin", "loft"]);
    expect(getFullyBookedReach(map, rooms, 9)).toBeNull();
    expect(getFullyBookedReach(map, rooms, 9, PLAN_DAYS_MAX + 1)).toBe(PLAN_DAYS_MAX + 1);
  });

  it("is nothing before the rooms have loaded", () => {
    const map = new Map<string, dayType>();
    night(map, 9, ["king", "queen", "cozy", "twin", "loft"]);
    expect(getFullyBookedReach(map, [], 9)).toBeNull();
  });
});
