import express from "express";
import request from "supertest";
import guestRoute from "../guestRoute";
import bookingRequestRoute from "../bookingRequestRoute";
import Host from "../../model/hostSchema";
import Calendar from "../../model/calendarSchema";
import Room from "../../model/roomSchema";
import Guest from "../../model/guestSchema";
import Day from "../../model/daySchema";
import { createMockHost } from "../../model/test/util/mockHost";
import { aliasNamesGuest, matchAirbnbStays } from "../../util/airbnbHistory";

// A TiBook requester who stayed before through AirBnB (host, 2026-11-22:
// Irina V booked on TiBook and TiMag marked her NEW). AirBnB leaves a first
// name and the phone's last four; both have to agree.

const feed = (code: string, last4: string) =>
  `Reservation URL: https://www.airbnb.com/hosting/reservations/details/${code}\nPhone Number (Last 4 Digits): ${last4}`;

describe("matching an AirBnB alias to a TiBook guest", () => {
  it("matches the first name, accents and case aside, and an initial against the surname", () => {
    expect(aliasNamesGuest("Irina", "Irina Vaysertreyger")).toBe(true);
    expect(aliasNamesGuest("Irina V", "irina vaysertreyger")).toBe(true);
    expect(aliasNamesGuest("Irína", "Irina")).toBe(true);
    expect(aliasNamesGuest("Irina K", "Irina Vaysertreyger")).toBe(false);
    expect(aliasNamesGuest("Irene", "Irina Vaysertreyger")).toBe(false);
  });

  it("drops a same-name stay with a different phone, and keeps a hand-entered one as a name match", () => {
    const rows = [
      { start: "2026-03-03", end: "2026-03-08", roomId: "k", alias: "Irina", description: feed("HM1", "4321") },
      { start: "2026-05-01", end: "2026-05-03", roomId: "q", alias: "Irina", description: feed("HM2", "9999") },
      { start: "2026-07-10", end: "2026-07-12", roomId: "c", alias: "Irina", description: "" },
    ];
    expect(matchAirbnbStays(rows, "Irina Vaysertreyger", "(408) 555-4321")).toEqual([
      { start: "2026-07-10", end: "2026-07-12", nights: 2, roomId: "c", alias: "Irina", matchedBy: "name" },
      { start: "2026-03-03", end: "2026-03-08", nights: 5, roomId: "k", alias: "Irina", matchedBy: "phone" },
    ]);
  });
});

describe("GET /guest/airbnb-history", () => {
  const appFor = (hostId: string) => {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      (req as any).user = { hostId, role: "Host" };
      next();
    });
    app.use("/guest", guestRoute);
    return app;
  };

  it("finds Irina's AirBnB stay once, from its start night", async () => {
    const host: any = await createMockHost("airbnb-history@example.com");
    const calendar = await Calendar.create({ host: host._id });
    await Host.updateOne({ _id: host._id }, { $set: { calendar: calendar._id } });
    const king = await Room.create({ host: host._id, name: "King", price: 60 });
    const airbnb = await Guest.create({ host: host._id, name: "AirBnB", phone: "0000000000" });
    // Three nights, each carrying the stay, as the calendar writes it.
    for (const night of ["2026-03-03", "2026-03-04", "2026-03-05"]) {
      await Day.create({
        calendar: calendar._id,
        date: new Date(`${night}T00:00:00Z`),
        bookings: [
          {
            room: king._id,
            guest: airbnb._id,
            alias: "Irina",
            description: feed("HMIRINA", "4321"),
            startDate: new Date("2026-03-03T00:00:00Z"),
            endDate: new Date("2026-03-05T00:00:00Z"),
          },
        ],
      });
    }

    const res = await request(appFor(String(host._id)))
      .get("/guest/airbnb-history")
      .query({ name: "Irina Vaysertreyger", phone: "408-555-4321" });
    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      { start: "2026-03-03", end: "2026-03-06", nights: 3, roomId: String(king._id), alias: "Irina", matchedBy: "phone" },
    ]);

    const stranger = await request(appFor(String(host._id)))
      .get("/guest/airbnb-history")
      .query({ name: "Irina Vaysertreyger", phone: "408-555-0000" });
    expect(stranger.body).toEqual([]);

    // TiBook's welcome: public, so it says how many stays and which rooms —
    // never the dates.
    const tibook = express();
    tibook.use(express.json());
    tibook.use("/booking-request", bookingRequestRoute);
    const welcome = await request(tibook)
      .post("/booking-request/airbnb-welcome")
      .send({ host: String(host._id), name: "Irina Vaysertreyger", phone: "408-555-4321" });
    expect(welcome.body).toEqual({ stays: 1, rooms: ["King"] });
    const nobody = await request(tibook)
      .post("/booking-request/airbnb-welcome")
      .send({ host: String(host._id), name: "Irina Vaysertreyger", phone: "408-555-0000" });
    expect(nobody.body).toEqual({ stays: 0, rooms: [] });
  });
});
