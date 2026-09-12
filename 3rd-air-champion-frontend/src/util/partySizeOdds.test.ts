import { describe, expect, it } from "vitest";
import { addDays, format, startOfToday } from "date-fns";
import { getRoomPartySizeOdds } from "./cleaningTasks";
import { dayType } from "./types/dayType";

// How many guests an UNBOOKED room will probably need setting up for, measured
// off that room's own recent stays.
//
// The rule these pin is the one this codebase gets wrong most often: a stay is
// written onto EVERY night it covers, so anything counting rows counts a long
// stay many times. Here that would make the estimate describe length of stay
// rather than party size, and it would do it silently — a plausible percentage
// on a screen, wrong.

const KING = "king-id";
const COZY = "cozy-id";
const back = (n: number) => format(addDays(startOfToday(), -n), "yyyy-MM-dd");

// A stay of `nights`, `guests` people, starting `startsAgo` days back — written
// onto every night it covers, the way the real data is.
const stay = (
  map: Map<string, dayType>,
  roomId: string,
  startsAgo: number,
  nights: number,
  guests: number,
) => {
  const startKey = back(startsAgo);
  for (let i = 0; i < nights; i++) {
    const key = back(startsAgo - i);
    const day = map.get(key) ?? ({ date: key, bookings: [], blockedRooms: [] } as unknown as dayType);
    (day.bookings as unknown[]).push({
      room: { id: roomId },
      startDate: `${startKey}T00:00:00.000Z`,
      numberOfGuests: guests,
    });
    map.set(key, day);
  }
};

describe("party size odds for an unbooked room", () => {
  it("counts one vote per stay, on the night it starts", () => {
    const map = new Map<string, dayType>();
    // Five nights of two people, then three separate single nights of three.
    // By rows that is 5 votes for 2 and 3 votes for 3, and the answer would be
    // "2". By stays it is 1 and 3, and the answer is 3.
    stay(map, KING, 30, 5, 2);
    stay(map, KING, 20, 1, 3);
    stay(map, KING, 15, 1, 3);
    stay(map, KING, 10, 1, 3);

    const odds = getRoomPartySizeOdds(map);
    expect(odds.get(KING)).toEqual({ guests: 3, p: 0.75, stays: 4 });
  });

  it("keeps each room to its own history", () => {
    const map = new Map<string, dayType>();
    stay(map, KING, 12, 2, 3);
    stay(map, KING, 8, 1, 3);
    stay(map, COZY, 9, 4, 1);

    const odds = getRoomPartySizeOdds(map);
    expect(odds.get(KING)?.guests).toBe(3);
    // Cozy takes one guest. Blending the house average would have said 3.
    expect(odds.get(COZY)?.guests).toBe(1);
    expect(odds.get(COZY)?.stays).toBe(1);
  });

  it("gives a room with no recent stays no answer at all", () => {
    const odds = getRoomPartySizeOdds(new Map<string, dayType>());
    expect(odds.get(KING)).toBeUndefined();
  });

  it("ignores stays older than the window", () => {
    const map = new Map<string, dayType>();
    stay(map, KING, 90, 1, 4); // outside the default 60 days
    stay(map, KING, 5, 1, 2);

    const odds = getRoomPartySizeOdds(map);
    expect(odds.get(KING)).toEqual({ guests: 2, p: 1, stays: 1 });
  });

  it("breaks a tie toward the larger party", () => {
    const map = new Map<string, dayType>();
    stay(map, KING, 20, 1, 2);
    stay(map, KING, 10, 1, 3);

    // A spare towel costs nothing; a missing bed is a guest standing up at 11pm.
    expect(getRoomPartySizeOdds(map).get(KING)?.guests).toBe(3);
  });

  it("treats a missing headcount as one guest, not as zero", () => {
    const map = new Map<string, dayType>();
    stay(map, KING, 7, 1, 0);

    expect(getRoomPartySizeOdds(map).get(KING)?.guests).toBe(1);
  });
});
