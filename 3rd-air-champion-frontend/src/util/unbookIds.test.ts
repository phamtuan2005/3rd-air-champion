import { describe, expect, it } from "vitest";
import { airbnbCodeOf, unbookIdsFor } from "./unbookIds";
import { bookingType } from "./types/bookingType";
import { dayType } from "./types/dayType";

const row = (id: string, guestId: string, guestName: string, description = "", duration = 1) =>
  ({
    id,
    description,
    duration,
    startDate: "2027-06-03T12:00:00.000Z",
    guest: { id: guestId, name: guestName },
    room: { id: "king", name: "King" },
  }) as unknown as bookingType;

const FAILED = "Reservation URL: https://www.airbnb.com/hosting/reservations/details/HMFAILED1\nPhone Number (Last 4 Digits): 2275";
const REAL = "Reservation URL: https://www.airbnb.com/hosting/reservations/details/HMREAL222";

const on = (entries: [string, bookingType[]][]) =>
  new Map(entries.map(([date, bookings]) => [date, { bookings } as unknown as dayType]));

describe("unbookIdsFor", () => {
  it("sends only the chosen AirBnB reservation when another shares the night", () => {
    const failed = row("failed", "airbnb", "AirBnB", FAILED);
    const real = row("real", "airbnb", "AirBnB", REAL);
    expect(unbookIdsFor([failed], on([["2027-06-03", [failed, real]]]))).toEqual(["failed"]);
  });

  it("sends every night of a direct guest's stay", () => {
    const first = row("n1", "mai", "Mai", "", 2);
    const second = row("n2", "mai", "Mai", "", 2);
    const other = row("n3", "other", "Other", "", 2);
    const map = on([["2027-06-03", [first, other]], ["2027-06-04", [second]]]);
    expect(unbookIdsFor([first], map)).toEqual(["n1", "n2"]);
  });
});

describe("airbnbCodeOf", () => {
  it("reads the code from a feed stay, and nothing from a hand-entered one", () => {
    expect(airbnbCodeOf(row("a", "airbnb", "AirBnB", FAILED))).toBe("HMFAILED1");
    expect(airbnbCodeOf(row("b", "airbnb", "AirBnB", ""))).toBeNull();
  });
});
