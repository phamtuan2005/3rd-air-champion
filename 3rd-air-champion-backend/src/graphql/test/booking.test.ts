import request from "supertest";
import { createApp } from "../../test/util/testServer";
import { createMockHost } from "../../model/test/util/mockHost";
import Calendar from "../../model/calendarSchema";
import Room from "../../model/roomSchema";
import Guest from "../../model/guestSchema";
import Day from "../../model/daySchema";

const BOOK_DAYS = `
  mutation BookDays(
    $calendar: String!
    $date: String!
    $guest: String!
    $room: String!
    $duration: Int!
    $numberOfGuests: Int!
    $isAirBnB: Boolean!
  ) {
    bookDays(
      calendar: $calendar
      date: $date
      guest: $guest
      room: $room
      duration: $duration
      numberOfGuests: $numberOfGuests
      isAirBnB: $isAirBnB
    ) {
      date
    }
  }
`;

describe("bookDays resolver", () => {
  let app: any;
  let calendarId: string;
  let roomId: string;
  let guestId: string;

  beforeAll(async () => {
    app = await createApp();
  });

  beforeEach(async () => {
    const host = await createMockHost("booking-test@example.com");
    const calendar = await new Calendar({ host: host._id }).save();
    calendarId = calendar._id.toString();

    const room = await new Room({ host: host._id, name: "Suite", price: 200, roomCode: "S1" }).save();
    roomId = room._id.toString();

    const guest = await new Guest({ name: "Alice", email: "alice@example.com", phone: "4081234567", host: host._id }).save();
    guestId = guest._id.toString();
  });

  const book = (variables: object) =>
    request(app)
      .post("/graphql")
      .send({ query: BOOK_DAYS, variables });

  it("books a room successfully", async () => {
    const res = await book({
      calendar: calendarId,
      date: "2027-06-01",
      guest: guestId,
      room: roomId,
      duration: 2,
      numberOfGuests: 1,
      isAirBnB: false,
    });

    expect(res.body.errors).toBeUndefined();
    expect(res.body.data.bookDays).toHaveLength(2);
  });

  it("rejects a double-booking on the same room and date", async () => {
    const vars = {
      calendar: calendarId,
      date: "2027-07-01",
      guest: guestId,
      room: roomId,
      duration: 3,
      numberOfGuests: 1,
      isAirBnB: false,
    };

    await book(vars); // first booking succeeds

    const res = await book(vars); // same room + dates — must conflict
    expect(res.body.errors).toBeDefined();
    expect(res.body.errors[0].message).toMatch(/unavailable/i);
  });

  it("rejects booking on a blocked day", async () => {
    // Block the day first via blockDay mutation
    const blockRes = await request(app)
      .post("/graphql")
      .send({
        query: `mutation { blockDay(calendar: "${calendarId}", date: "2027-08-01") { date } }`,
      });
    expect(blockRes.body.errors).toBeUndefined();

    const res = await book({
      calendar: calendarId,
      date: "2027-08-01",
      guest: guestId,
      room: roomId,
      duration: 1,
      numberOfGuests: 1,
      isAirBnB: false,
    });

    expect(res.body.errors).toBeDefined();
    expect(res.body.errors[0].message).toMatch(/unavailable/i);
  });

  it("allows booking a different room on the same date", async () => {
    const host = await createMockHost("booking-test2@example.com");
    const room2 = await new Room({ host: host._id, name: "Cozy", price: 100, roomCode: "C1" }).save();

    await book({
      calendar: calendarId,
      date: "2027-09-01",
      guest: guestId,
      room: roomId,
      duration: 1,
      numberOfGuests: 1,
      isAirBnB: false,
    });

    const res = await book({
      calendar: calendarId,
      date: "2027-09-01",
      guest: guestId,
      room: room2._id.toString(),
      duration: 1,
      numberOfGuests: 1,
      isAirBnB: false,
    });

    expect(res.body.errors).toBeUndefined();
  });
});

const BOOK_AIRBNB = `
  mutation BookAirBnB(
    $calendar: String!
    $date: String!
    $guest: String!
    $description: String!
    $room: String!
    $duration: Int!
  ) {
    bookAirBnB(
      calendar: $calendar
      date: $date
      guest: $guest
      description: $description
      room: $room
      duration: $duration
    ) {
      date
    }
  }
`;

// Reservation code lives in the description; it's the unique key for a stay.
const DESC =
  "Reservation URL: https://www.airbnb.com/hosting/reservations/details/HMTEST123";

describe("bookAirBnB reconciliation", () => {
  let app: any;
  let calendarId: string;
  let roomId: string;
  let airbnbGuestId: string;

  beforeAll(async () => {
    app = await createApp();
  });

  beforeEach(async () => {
    const host = await createMockHost("airbnb-recon@example.com");
    const calendar = await new Calendar({ host: host._id }).save();
    calendarId = calendar._id.toString();

    const room = await new Room({ host: host._id, name: "Cute", price: 150, roomCode: "CU1" }).save();
    roomId = room._id.toString();

    const guest = await new Guest({ name: "AirBnB", email: "airbnb@example.com", phone: "4080000000", host: host._id }).save();
    airbnbGuestId = guest._id.toString();
  });

  const bookAirBnB = (duration: number) =>
    request(app)
      .post("/graphql")
      .send({
        query: BOOK_AIRBNB,
        variables: { calendar: calendarId, date: "2027-06-03", guest: airbnbGuestId, description: DESC, room: roomId, duration },
      });

  // All night-docs of this reservation, sorted by date.
  const reservationNights = async () => {
    const days = await Day.find({ calendar: calendarId, "bookings.room": roomId }).sort({ date: 1 });
    const rows: { date: Date; b: any }[] = [];
    for (const d of days) for (const b of d.bookings as any[]) {
      if (b.description === DESC) rows.push({ date: d.date, b });
    }
    return rows;
  };

  it("extending a stay reconciles every night to one consistent span (no split)", async () => {
    await bookAirBnB(2); // Jun 3 -> Jun 5 (2 nights)
    expect(await reservationNights()).toHaveLength(2);

    await bookAirBnB(3); // extend to Jun 3 -> Jun 6 (3 nights)
    const nights = await reservationNights();

    expect(nights).toHaveLength(3);
    // Every night must share ONE check-in, ONE last-night, and the same duration.
    expect(new Set(nights.map((n) => n.b.startDate.toISOString())).size).toBe(1);
    expect(new Set(nights.map((n) => n.b.endDate.toISOString())).size).toBe(1);
    expect(new Set(nights.map((n) => n.b.duration))).toEqual(new Set([3]));
    // The stored span must equal the actual night dates (no stale/short end).
    const nightTimes = nights.map((n) => n.date.getTime());
    expect(nights[0].b.startDate.getTime()).toBe(Math.min(...nightTimes));
    expect(nights[0].b.endDate.getTime()).toBe(Math.max(...nightTimes));
  });

  it("preserves a host-set alias when the stay is extended", async () => {
    await bookAirBnB(2);
    // Host names the AirBnB guest on the existing nights.
    await Day.updateMany(
      { calendar: calendarId, "bookings.description": DESC },
      { $set: { "bookings.$[b].alias": "Conrad" } },
      { arrayFilters: [{ "b.description": DESC }] }
    );

    await bookAirBnB(3);
    const nights = await reservationNights();
    expect(nights).toHaveLength(3);
    expect(nights.every((n) => n.b.alias === "Conrad")).toBe(true);
  });

  // Dejah, King, Oct 9 2026: her phone number changed on the reservation, the
  // feed's description changed with it, and the sync wrote the same stay onto
  // the night a second time — two cards, counted twice.
  it("a changed phone line on the same reservation updates the stay, never adds a second", async () => {
    const withPhone = (last4: string) => `${DESC}\nPhone Number (Last 4 Digits): ${last4}`;
    const book = (description: string) =>
      request(app)
        .post("/graphql")
        .send({
          query: BOOK_AIRBNB,
          variables: { calendar: calendarId, date: "2027-06-03", guest: airbnbGuestId, description, room: roomId, duration: 2 },
        });

    await book(withPhone("2275"));
    await Day.updateMany(
      { calendar: calendarId },
      { $set: { "bookings.$[].notes": "Need to prepare BDay gift", "bookings.$[].airbnbPrice": 82.81 } },
    );
    await book(withPhone("3444"));

    const days = await Day.find({ calendar: calendarId }).sort({ date: 1 });
    expect(days).toHaveLength(2);
    for (const d of days) {
      expect(d.bookings).toHaveLength(1);
      const b: any = d.bookings[0];
      expect(b.description).toBe(withPhone("3444"));
      expect(b.notes).toBe("Need to prepare BDay gift");
      expect(b.airbnbPrice).toBe(82.81);
    }
  });

  it("a different reservation code on the same night is still a second booking", async () => {
    await bookAirBnB(2);
    await request(app)
      .post("/graphql")
      .send({
        query: BOOK_AIRBNB,
        variables: {
          calendar: calendarId, date: "2027-06-03", guest: airbnbGuestId, room: roomId, duration: 2,
          description: "Reservation URL: https://www.airbnb.com/hosting/reservations/details/HMTEST1234",
        },
      });
    const days = await Day.find({ calendar: calendarId });
    expect(days.every((d) => d.bookings.length === 2)).toBe(true);
  });

  // ── A stay that has already begun ──────────────────────────────────────────
  //
  // Kyle, King, Oct 2–6 2026, added a night from inside the house. The feed
  // said Oct 2–7 within the hour; the sync could not write it for as long as
  // he was staying, because a span was refused on its FIRST night being past.
  const { addDays, format, startOfToday } = require("date-fns");
  const { toZonedTime } = require("date-fns-tz");
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const key = (offset: number) => format(addDays(startOfToday(), offset), "yyyy-MM-dd");
  const bookFrom = (date: string, duration: number) =>
    request(app)
      .post("/graphql")
      .send({
        query: BOOK_AIRBNB,
        variables: { calendar: calendarId, date, guest: airbnbGuestId, description: DESC, room: roomId, duration },
      });
  // Nights the stay already has, written the way the sync's earlier runs
  // wrote them — with everything the host typed in since.
  const seedNights = async (offsets: number[], span: { start: number; nights: number }) => {
    for (const n of offsets)
      await Day.create({
        calendar: calendarId,
        date: toZonedTime(key(n), tz),
        isAirBnB: true,
        bookings: [
          {
            guest: airbnbGuestId,
            room: roomId,
            description: DESC,
            alias: "Kyle",
            numberOfGuests: 2,
            airbnbPrice: 460.02,
            notes: "door code 1348",
            price: 75,
            bookedOn: "2026-09-28",
            duration: span.nights,
            startDate: toZonedTime(key(span.start), tz),
            endDate: toZonedTime(key(span.start + span.nights - 1), tz),
          },
        ],
      });
  };

  it("extends a stay that began before today, and the new night is a night of that stay", async () => {
    await seedNights([-2, -1, 0], { start: -2, nights: 3 }); // last night tonight
    const res = await bookFrom(key(-2), 4); // the feed now says one more night
    expect(res.body.errors).toBeUndefined();

    const nights = await reservationNights();
    expect(nights.map((n) => format(n.date, "yyyy-MM-dd"))).toEqual([key(-2), key(-1), key(0), key(1)]);
    expect(new Set(nights.map((n) => n.b.duration))).toEqual(new Set([4]));
    expect(new Set(nights.map((n) => n.b.endDate.toISOString())).size).toBe(1);
    // The added night carries the stay's payout, headcount, name and notes.
    // Without them it read as a night that earned nothing, and the stay's
    // total shrank for having grown.
    const added = nights[3].b;
    expect(added.airbnbPrice).toBe(460.02);
    expect(added.numberOfGuests).toBe(2);
    expect(added.alias).toBe("Kyle");
    expect(added.notes).toBe("door code 1348");
    expect(added.price).toBe(75);
  });

  it("never invents a night that has already passed", async () => {
    await seedNights([0], { start: 0, nights: 1 });
    // The feed claims the stay began two days ago — nights the calendar
    // never held. They are history now, not something to write.
    const res = await bookFrom(key(-2), 4);
    expect(res.body.errors).toBeUndefined();
    const nights = await reservationNights();
    expect(nights.map((n) => format(n.date, "yyyy-MM-dd"))).toEqual([key(0), key(1)]);
    // But the nights it does hold are brought onto the one span.
    expect(nights.every((n) => n.b.duration === 4)).toBe(true);
  });

  it("still refuses a span that is wholly in the past", async () => {
    const res = await bookFrom(key(-5), 2);
    expect(res.body.errors?.[0]?.message).toMatch(/past/);
    expect(await reservationNights()).toHaveLength(0);
  });
});