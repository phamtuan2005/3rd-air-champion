import { describe, expect, it } from "vitest";
import { addDays, format, startOfToday } from "date-fns";
import { getCleaningEntriesFor } from "./cleaningTasks";
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
