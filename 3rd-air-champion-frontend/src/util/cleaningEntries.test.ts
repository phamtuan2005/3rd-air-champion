import { describe, expect, it } from "vitest";
import { addDays, format, startOfToday } from "date-fns";
import { getCleaningEntriesFor, isStaleCleaning } from "./cleaningTasks";
import { dayType } from "./types/dayType";

// One room, one clean, one morning.
//
// Written after the Plan tab showed "6 rooms" for a five-room house on
// 2026-09-14, with Cozy listed twice under the same cleaner. Two bookings ended
// the same night in that room, and the checkout loop pushed an entry for each.
//
// The forecast half of the function had always guarded against this; the
// confirmed half had not, so only real data could expose it.

const key = (d: Date) => format(d, "yyyy-MM-dd");
const room = (id: string, name: string) => ({ id, name, color: "" });

const booking = (
  roomId: string,
  name: string,
  start: string,
  end: string,
  extra: { id?: string; bookedOn?: string; numberOfGuests?: number } = {},
) =>
  ({
    id: extra.id ?? `${roomId}-${start}`,
    room: room(roomId, name),
    startDate: `${start}T00:00:00.000Z`,
    endDate: `${end}T00:00:00.000Z`,
    reserved: false,
    numberOfGuests: extra.numberOfGuests ?? 1,
    bookedOn: extra.bookedOn ?? "",
  }) as never;

describe("what needs cleaning on a morning", () => {
  it("lists a room once even when two stays end the same night in it", () => {
    const morning = key(addDays(startOfToday(), 2));
    const lastNight = key(addDays(startOfToday(), 1));

    const map = new Map<string, dayType>();
    map.set(lastNight, {
      date: lastNight,
      bookings: [
        booking("cozy", "Cozy", lastNight, lastNight),
        // The same room, the same night, a second time. Impossible in a house
        // and entirely possible in the data.
        booking("cozy", "Cozy", lastNight, lastNight),
      ],
      blockedRooms: [],
    } as unknown as dayType);

    const entries = getCleaningEntriesFor(map, morning);
    expect(entries.filter((e) => e.checkoutBooking.room.id === "cozy")).toHaveLength(1);
  });

  it("still lists two DIFFERENT rooms turning over on the same morning", () => {
    const morning = key(addDays(startOfToday(), 2));
    const lastNight = key(addDays(startOfToday(), 1));

    const map = new Map<string, dayType>();
    map.set(lastNight, {
      date: lastNight,
      bookings: [
        booking("cozy", "Cozy", lastNight, lastNight),
        booking("king", "King", lastNight, lastNight),
      ],
      blockedRooms: [],
    } as unknown as dayType);

    expect(getCleaningEntriesFor(map, morning)).toHaveLength(2);
  });
});

describe("which of two stays on one night is the live one", () => {
  // The real case: an AirBnB guest cancels, another books the same night, and
  // the cancelled stay is KEPT in the day's record on purpose. The house is
  // serving the newer guest, so that is the booking the clean is for.
  it("keeps the most recently booked stay", () => {
    const morning = key(addDays(startOfToday(), 2));
    const lastNight = key(addDays(startOfToday(), 1));

    const map = new Map<string, dayType>();
    map.set(lastNight, {
      date: lastNight,
      bookings: [
        booking("cozy", "Cozy", lastNight, lastNight, {
          id: "cancelled",
          bookedOn: "2026-08-01",
          numberOfGuests: 3,
        }),
        booking("cozy", "Cozy", lastNight, lastNight, {
          id: "live",
          bookedOn: "2026-09-10",
          numberOfGuests: 1,
        }),
      ],
      blockedRooms: [],
    } as unknown as dayType);

    const entries = getCleaningEntriesFor(map, morning);
    expect(entries).toHaveLength(1);
    expect(entries[0].checkoutBooking.id).toBe("live");
    // And the headcount comes with it -- 1, not the cancelled party of 3.
    expect(entries[0].checkoutBooking.numberOfGuests).toBe(1);
  });

  it("keeps the later entry when both were booked the same day", () => {
    // Cancel and rebook on the same day is the common shape, and bookedOn
    // cannot separate them. A booking is pushed onto the night when it is made,
    // so the later position is the newer stay.
    const morning = key(addDays(startOfToday(), 2));
    const lastNight = key(addDays(startOfToday(), 1));

    const map = new Map<string, dayType>();
    map.set(lastNight, {
      date: lastNight,
      bookings: [
        booking("cozy", "Cozy", lastNight, lastNight, { id: "first", bookedOn: "2026-09-12" }),
        booking("cozy", "Cozy", lastNight, lastNight, { id: "second", bookedOn: "2026-09-12" }),
      ],
      blockedRooms: [],
    } as unknown as dayType);

    expect(getCleaningEntriesFor(map, morning)[0].checkoutBooking.id).toBe("second");
  });

  it("falls back to the later entry when neither carries a booking date", () => {
    // Stays that predate the bookedOn field. Both read "", so position decides.
    const morning = key(addDays(startOfToday(), 2));
    const lastNight = key(addDays(startOfToday(), 1));

    const map = new Map<string, dayType>();
    map.set(lastNight, {
      date: lastNight,
      bookings: [
        booking("cozy", "Cozy", lastNight, lastNight, { id: "older" }),
        booking("cozy", "Cozy", lastNight, lastNight, { id: "newer" }),
      ],
      blockedRooms: [],
    } as unknown as dayType);

    expect(getCleaningEntriesFor(map, morning)[0].checkoutBooking.id).toBe("newer");
  });
});

// Every AirBnB stay hangs off one shared "AirBnB" guest. Two DIFFERENT AirBnB
// guests back to back are a turnover, not a guest staying on (2026-10-11:
// Cute and King lost their clean from the Week tab).
describe("back-to-back AirBnB guests", () => {
  it("are still a turnover, though they share the AirBnB guest record", () => {
    const n1 = key(addDays(startOfToday(), 1));
    const n2 = key(addDays(startOfToday(), 2));
    const airbnb = (b: never) => ({ ...(b as object), guest: { id: "airbnb", name: "AirBnB" } }) as never;
    const map = new Map<string, dayType>();
    map.set(n1, { date: n1, bookings: [airbnb(booking("cute", "Cute", n1, n1))], blockedRooms: [] } as unknown as dayType);
    map.set(n2, { date: n2, bookings: [airbnb(booking("cute", "Cute", n2, n2))], blockedRooms: [] } as unknown as dayType);
    expect(getCleaningEntriesFor(map, n2).filter((e) => e.checkoutBooking.room.id === "cute")).toHaveLength(1);
  });
});

// A soft hold is an established booking to the cleaning schedule (host,
// 2026-10-11). The empty nights before a HELD arrival used to get no planned
// clean, because only confirmed arrivals bounded the gap.
describe("a soft-held arrival", () => {
  it("bounds a gap like any booking, so the empty night before it gets a clean", () => {
    const before = key(addDays(startOfToday(), 1));
    const morning = key(addDays(startOfToday(), 4));
    const arrival = key(addDays(startOfToday(), 5));
    const held = { ...(booking("queen", "Queen", arrival, arrival) as object), reserved: true } as never;
    const map = new Map<string, dayType>();
    map.set(before, { date: before, bookings: [booking("queen", "Queen", before, before)], blockedRooms: [] } as unknown as dayType);
    map.set(arrival, { date: arrival, bookings: [held], blockedRooms: [] } as unknown as dayType);
    const queen = getCleaningEntriesFor(map, morning).filter((e) => e.checkoutBooking.room.id === "queen");
    expect(queen).toHaveLength(1);
  });
});

// The reaper in Clean deletes an unworked assignment when isStaleCleaning says
// no turnover was due. It looked at the FIRST stay in the room that night; a
// cancelled AirBnB copy kept beside the live one ran on past it, so today's
// real Cute and King cleans were deleted on every open (2026-10-11).
describe("a stale cleaning", () => {
  const dayOf = (k: string, bookings: never[]) => ({ date: k, bookings, blockedRooms: [] }) as unknown as dayType;
  it("is not stale when ANY stay in the room ended the night before, whatever is listed first", () => {
    const last = key(addDays(startOfToday(), -1));
    const morning = key(startOfToday());
    const later = key(addDays(startOfToday(), 3));
    const map = new Map<string, dayType>();
    map.set(last, dayOf(last, [booking("cute", "Cute", last, later, { id: "cancelled" }), booking("cute", "Cute", last, last, { id: "live" })]));
    expect(isStaleCleaning(map, "cute", morning)).toBe(false);
  });
  it("is stale when the guest stays on and nobody left", () => {
    const last = key(addDays(startOfToday(), -1));
    const morning = key(startOfToday());
    const later = key(addDays(startOfToday(), 3));
    const map = new Map<string, dayType>();
    map.set(last, dayOf(last, [booking("cute", "Cute", last, later)]));
    expect(isStaleCleaning(map, "cute", morning)).toBe(true);
  });
});
