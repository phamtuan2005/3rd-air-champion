import { describe, expect, it } from "vitest";
import { missingPayoutStays } from "./missingPayout";
import { dayType } from "./types/dayType";

// The pop-up that asks for a new AirBnB booking's payout. It listed only stays
// starting in the month on screen, so a reservation for Dec 30 that arrived in
// November never appeared (host, 2026-11-18).

const TODAY = "2026-11-18";

const night = (
  start: string,
  room: string,
  over: Record<string, unknown> = {},
) => ({
  id: `${start}-${room}`,
  alias: "",
  guest: { name: "AirBnB" },
  room: { id: room, name: room },
  startDate: `${start}T00:00:00.000Z`,
  duration: 1,
  description: "Reservation URL: https://www.airbnb.com/hosting/reservations/details/HM123",
  numberOfGuests: 1,
  airbnbPrice: 0,
  ...over,
});

const calendar = (rows: [string, unknown[]][]): Map<string, dayType> =>
  new Map(rows.map(([date, bookings]) => [date, { bookings } as unknown as dayType]));

describe("AirBnB stays missing a payout", () => {
  it("lists a new booking for next month while the calendar shows this month", () => {
    const map = calendar([["2026-12-30", [night("2026-12-30", "King")]]]);
    const stays = missingPayoutStays(map, "2026-11", TODAY);
    expect(stays.map((s) => s.startDate.slice(0, 10))).toEqual(["2026-12-30"]);
  });

  it("lists a booking that starts next year", () => {
    const map = calendar([["2027-01-04", [night("2027-01-04", "Queen")]]]);
    expect(missingPayoutStays(map, "2026-11", TODAY)).toHaveLength(1);
  });

  it("still lists the viewed month's gaps, past ones included", () => {
    const map = calendar([["2026-11-03", [night("2026-11-03", "Cute")]]]);
    expect(missingPayoutStays(map, "2026-11", TODAY)).toHaveLength(1);
  });

  // Otherwise every old gap would sit in the pop-up for good and bury the new
  // booking it exists to announce.
  it("does not pull in a finished stay from a month nobody is looking at", () => {
    const map = calendar([["2026-08-10", [night("2026-08-10", "King")]]]);
    expect(missingPayoutStays(map, "2026-11", TODAY)).toHaveLength(0);
    // Page back to August and it is asked about, as before.
    expect(missingPayoutStays(map, "2026-08", TODAY)).toHaveLength(1);
  });

  it("lists a stay in the house now that began last month", () => {
    const stay = { duration: 25 };
    const map = calendar([
      ["2026-10-28", [night("2026-10-28", "King", stay)]],
      ["2026-11-18", [night("2026-10-28", "King", stay)]],
      ["2026-11-19", [night("2026-10-28", "King", stay)]],
    ]);
    expect(missingPayoutStays(map, "2026-12", TODAY)).toHaveLength(1);
  });

  // A stay is written onto every night it covers.
  it("lists a stay once, however many nights it covers", () => {
    const stay = { duration: 3 };
    const map = calendar([
      ["2026-12-30", [night("2026-12-30", "King", stay)]],
      ["2026-12-31", [night("2026-12-30", "King", stay)]],
      ["2027-01-01", [night("2026-12-30", "King", stay)]],
    ]);
    expect(missingPayoutStays(map, "2026-11", TODAY)).toHaveLength(1);
  });

  it("leaves out stays with a payout, blocked nights and direct guests", () => {
    const map = calendar([
      [
        "2026-12-30",
        [
          night("2026-12-30", "King", { airbnbPrice: 212.4 }),
          night("2026-12-30", "Queen", { airbnbBlocked: true }),
          night("2026-12-30", "Cute", { guest: { name: "Kelly" } }),
        ],
      ],
    ]);
    expect(missingPayoutStays(map, "2026-11", TODAY)).toHaveLength(0);
  });

  it("puts the soonest stay first", () => {
    const map = calendar([
      ["2026-12-30", [night("2026-12-30", "King")]],
      ["2026-11-25", [night("2026-11-25", "Queen")]],
    ]);
    expect(missingPayoutStays(map, "2026-11", TODAY).map((s) => s.roomName)).toEqual(["Queen", "King"]);
  });
});
