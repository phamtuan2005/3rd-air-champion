import mongoose from "mongoose";
import Host from "../../model/hostSchema";
import Calendar from "../../model/calendarSchema";
import Day from "../../model/daySchema";
import { createMockHost } from "../../model/test/util/mockHost";
import { loadCleaningDays, shouldListRoom } from "../cleaningDays";

// What TiWork hands TiMag's cleaning rule, and when it is allowed to act on the
// answer.
//
// TiWork used to list every assignment it found and showed Henry 4 rooms for a
// morning TiMag showed 3. It now runs TiMag's own rule (shared/generated), so
// the only new code is the translation below and the two exceptions in
// shouldListRoom — which is exactly what these pin.

const utcDay = (offsetDays: number): string => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
};

describe("deciding whether a room stays on a cleaner's list", () => {
  const roomId = "room-1";
  const turnsOver = new Set([roomId]);

  it("lists a room that turns over that morning", () => {
    expect(
      shouldListRoom({ hoursRecorded: false, calendarKnown: true, turnsOverRoomIds: turnsOver, roomId }),
    ).toBe(true);
  });

  it("drops a room nothing turns over in — the bug this fixes", () => {
    expect(
      shouldListRoom({
        hoursRecorded: false,
        calendarKnown: true,
        turnsOverRoomIds: new Set(["another-room"]),
        roomId,
      }),
    ).toBe(false);
  });

  // The plan is not always what happened. A morning somebody is paid for must
  // not vanish because the booking behind it was cancelled afterwards.
  it("keeps a morning whose hours are already recorded", () => {
    expect(
      shouldListRoom({
        hoursRecorded: true,
        calendarKnown: true,
        turnsOverRoomIds: new Set(["another-room"]),
        roomId,
      }),
    ).toBe(true);
  });

  // Hiding a cleaner's morning on the strength of an empty query is the worse
  // mistake: they turn up to nothing, or do not turn up at all.
  it("keeps everything when the calendar could not be read", () => {
    expect(
      shouldListRoom({ hoursRecorded: false, calendarKnown: false, turnsOverRoomIds: undefined, roomId }),
    ).toBe(true);
  });

  it("keeps a morning no entries were worked out for", () => {
    expect(
      shouldListRoom({ hoursRecorded: false, calendarKnown: true, turnsOverRoomIds: undefined, roomId }),
    ).toBe(true);
  });
});

describe("handing the calendar to TiMag's rule", () => {
  it("translates a stored day into the shape the rule reads", async () => {
    const host: any = await createMockHost("cleaning-days@example.com");
    await Calendar.create({ host: host._id });
    const withCalendar: any = await Host.findById(host._id);

    const room = new mongoose.Types.ObjectId();
    const blocked = new mongoose.Types.ObjectId();
    const key = utcDay(1);

    await Day.create({
      calendar: withCalendar.calendar,
      date: new Date(`${key}T00:00:00.000Z`),
      blockedRooms: [blocked],
      bookings: [
        {
          room,
          startDate: new Date(`${utcDay(0)}T00:00:00.000Z`),
          endDate: new Date(`${key}T00:00:00.000Z`),
          reserved: true,
        },
      ],
    });

    const map = await loadCleaningDays(host._id, key, key);
    const day = map.get(key)!;

    expect(day).toBeDefined();
    // Room comes out of Mongo as an ObjectId; the rule compares `b.room.id`.
    expect(day.bookings[0].room.id).toBe(String(room));
    // And the dates as Dates; the rule splits them on "T".
    expect(day.bookings[0].endDate.split("T")[0]).toBe(key);
    expect(day.bookings[0].startDate.split("T")[0]).toBe(utcDay(0));
    // A held stay occupies the room, so the rule has to see it.
    expect(day.bookings[0].reserved).toBe(true);
    expect(day.blockedRooms[0].id).toBe(String(blocked));
  });

  // The premise of shouldListRoom's "calendar could not be read" exception.
  it("comes back empty for a host with no calendar", async () => {
    const host: any = await createMockHost("no-calendar@example.com");
    expect((await loadCleaningDays(host._id, utcDay(1), utcDay(1))).size).toBe(0);
  });
});
