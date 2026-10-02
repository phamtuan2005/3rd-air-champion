import { describe, expect, it } from "vitest";
import { airbnbGuestList } from "./airbnbGuestList";
import type { dayType } from "./types/dayType";

// The AirBnB names the calendar's Filter offers. Half the house's guests come
// through AirBnB, and each case here is a way the list could name the wrong
// person, or the same person several times.

const TODAY = "2026-10-02";
const king = { id: "king", name: "King" };
const cozy = { id: "cozy", name: "Cozy" };
const airbnb = { id: "ab", name: "AirBnB" };

const b = (alias: string, room: { id: string; name: string }, startDate: string, endDate: string, extra: Record<string, unknown> = {}) =>
  ({ id: `${alias}-${startDate}-${room.id}`, alias, room, guest: airbnb, startDate, endDate, airbnbBlocked: false, bookedOn: "2026-09-01", ...extra });

// A stay is written onto every night it covers, as the backend writes it.
const calendar = (bookings: ReturnType<typeof b>[]) => {
  const map = new Map<string, dayType>();
  for (const bk of bookings) {
    const start = new Date(`${bk.startDate}T00:00:00Z`);
    const end = new Date(`${bk.endDate}T00:00:00Z`);
    for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
      const key = d.toISOString().slice(0, 10);
      const day = map.get(key) ?? ({ id: key, date: key, bookings: [], isBlocked: false, blockedRooms: [] } as unknown as dayType);
      (day.bookings as unknown[]).push(bk);
      map.set(key, day);
    }
  }
  return map;
};

describe("the AirBnB guests the Filter offers", () => {
  it("lists a three-night stay once, not once a night", () => {
    const rows = airbnbGuestList(calendar([b("Kyle", king, "2026-10-02", "2026-10-04")]), TODAY);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ alias: "Kyle", next: "2026-10-02", room: "King", stays: 1, inHouse: true });
  });

  it("puts who is here tonight first, then arrivals soonest first, then the most recently gone", () => {
    const rows = airbnbGuestList(calendar([
      b("Gone", king, "2026-09-20", "2026-09-21"),
      b("LongGone", cozy, "2026-08-01", "2026-08-02"),
      b("NextWeek", king, "2026-10-09", "2026-10-10"),
      b("Tomorrow", cozy, "2026-10-03", "2026-10-03"),
      b("Here", king, "2026-10-01", "2026-10-03"),
    ]), TODAY);
    expect(rows.map((r) => r.alias)).toEqual(["Here", "Tomorrow", "NextWeek", "Gone", "LongGone"]);
  });

  // endDate is the last night slept: someone whose last night was yesterday
  // checked out this morning and is not "next".
  it("treats a stay whose last night was yesterday as past", () => {
    const rows = airbnbGuestList(calendar([b("Lim", cozy, "2026-09-29", "2026-10-01")]), TODAY);
    expect(rows[0]).toMatchObject({ alias: "Lim", inHouse: false, last: "2026-09-29" });
    expect(rows[0].next).toBeUndefined();
  });

  // A cancelled AirBnB stay is kept in the day's record when another guest
  // books the same room and night. The list must name the one who is coming.
  it("names the most recently booked guest when a cancelled stay shares the room and night", () => {
    const rows = airbnbGuestList(calendar([
      b("Cancelled", king, "2026-10-06", "2026-10-06", { bookedOn: "2026-09-10" }),
      b("Vanessa", king, "2026-10-06", "2026-10-06", { bookedOn: "2026-09-25" }),
    ]), TODAY);
    expect(rows.map((r) => r.alias)).toEqual(["Vanessa"]);
  });

  it("lets the later entry win when both were booked the same day", () => {
    const rows = airbnbGuestList(calendar([
      b("First", king, "2026-10-06", "2026-10-06", { bookedOn: "2026-09-25" }),
      b("Second", king, "2026-10-06", "2026-10-06", { bookedOn: "2026-09-25" }),
    ]), TODAY);
    expect(rows.map((r) => r.alias)).toEqual(["Second"]);
  });

  it("counts every stay under one name, and leads with the one to come", () => {
    const rows = airbnbGuestList(calendar([
      b("Danny", king, "2026-07-04", "2026-07-05"),
      b("Danny", cozy, "2026-10-03", "2026-10-03"),
    ]), TODAY);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ alias: "Danny", stays: 2, next: "2026-10-03", room: "Cozy" });
  });

  it("leaves out a blocked placeholder, a stay with no name, and the house's own guests", () => {
    const rows = airbnbGuestList(calendar([
      b("Blocked", king, "2026-10-05", "2026-10-05", { airbnbBlocked: true }),
      b("", cozy, "2026-10-05", "2026-10-05"),
      b("Susan", king, "2026-10-19", "2026-10-20", { guest: { id: "g1", name: "Susan" } }),
    ]), TODAY);
    expect(rows).toEqual([]);
  });
});
