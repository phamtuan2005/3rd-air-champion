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

const booking = (roomId: string, name: string, start: string, end: string) =>
  ({
    id: `${roomId}-${start}`,
    room: room(roomId, name),
    startDate: `${start}T00:00:00.000Z`,
    endDate: `${end}T00:00:00.000Z`,
    reserved: false,
    numberOfGuests: 1,
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
