import request from "supertest";
import { createApp } from "../../test/util/testServer";
import { createMockHost } from "../../model/test/util/mockHost";
import Calendar from "../../model/calendarSchema";
import Room from "../../model/roomSchema";
import Guest from "../../model/guestSchema";

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