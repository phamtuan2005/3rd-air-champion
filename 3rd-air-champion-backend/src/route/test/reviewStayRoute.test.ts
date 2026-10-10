import express from "express";
import request from "supertest";
import ttHostRoute from "../ttHostRoute";
import Host from "../../model/hostSchema";
import Calendar from "../../model/calendarSchema";
import Room from "../../model/roomSchema";
import Guest from "../../model/guestSchema";
import Day from "../../model/daySchema";
import { createMockHost } from "../../model/test/util/mockHost";

// The review form's stay lookup against real bookings (host, 2026-10-10): a
// pasted review names the guest, and the stay date fills itself in. These pin
// the trip to the database — the matching rules are in util/test/reviewStay.

const appFor = (hostId: string) => {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).user = { hostId, role: "Host" };
    next();
  });
  app.use("/tt-host", ttHostRoute);
  return app;
};

// A stay written onto every night it covers, as the calendar writes it.
const book = async (calendar: any, b: { room: any; guest: any; alias?: string; first: string; last: string }) => {
  const nights: string[] = [];
  for (let d = new Date(`${b.first}T00:00:00Z`); d <= new Date(`${b.last}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 1)) {
    nights.push(d.toISOString().slice(0, 10));
  }
  for (const n of nights) {
    await Day.create({
      calendar,
      date: new Date(`${n}T00:00:00Z`),
      bookings: [
        {
          room: b.room,
          guest: b.guest,
          alias: b.alias ?? "",
          startDate: new Date(`${b.first}T00:00:00Z`),
          endDate: new Date(`${b.last}T00:00:00Z`),
        },
      ],
    });
  }
};

const setup = async (email: string) => {
  const host: any = await createMockHost(email);
  const calendar = await Calendar.create({ host: host._id });
  await Host.updateOne({ _id: host._id }, { $set: { calendar: calendar._id } });
  const king = await Room.create({ host: host._id, name: "King", price: 60 });
  const queen = await Room.create({ host: host._id, name: "Queen", price: 60 });
  const airbnb = await Guest.create({ host: host._id, name: "AirBnB", phone: "0000000000" });
  return { hostId: String(host._id), calendar: calendar._id, king, queen, airbnb };
};

const lookup = (hostId: string, q: Record<string, string>) =>
  request(appFor(hostId)).get("/tt-host/reviews/stay").query(q);

describe("GET /tt-host/reviews/stay", () => {
  it("finds an AirBnB guest's stay in the room by the name on the review", async () => {
    const s = await setup("stay-airbnb@example.com");
    // Nights Sep 28, 29, 30 — checkout Oct 1.
    await book(s.calendar, { room: s.king._id, guest: s.airbnb._id, alias: "Han", first: "2026-09-28", last: "2026-09-30" });
    const res = await lookup(s.hostId, { roomId: String(s.king._id), name: "Han", month: "2026-10" });
    expect(res.body).toEqual({ stayDate: "2026-09-28", checkout: "2026-10-01", nights: 3, others: 0 });
  });

  it("finds one of the house's own guests by first name, and names them", async () => {
    const s = await setup("stay-own@example.com");
    const mai = await Guest.create({ host: s.hostId, name: "Mai Nguyen", phone: "4085550199" });
    await book(s.calendar, { room: s.king._id, guest: mai._id, first: "2026-10-03", last: "2026-10-04" });
    const res = await lookup(s.hostId, { roomId: String(s.king._id), name: "Mai", month: "2026-10" });
    expect(res.body).toMatchObject({ stayDate: "2026-10-03", nights: 2, guestId: String(mai._id) });
  });

  it("does not take the same name's stay in another room", async () => {
    const s = await setup("stay-room@example.com");
    await book(s.calendar, { room: s.queen._id, guest: s.airbnb._id, alias: "Han", first: "2026-09-28", last: "2026-09-30" });
    const res = await lookup(s.hostId, { roomId: String(s.king._id), name: "Han", month: "2026-10" });
    expect(res.body).toBeNull();
  });

  it("says nothing for a request it cannot answer", async () => {
    const s = await setup("stay-bad@example.com");
    expect((await lookup(s.hostId, { roomId: "nope", name: "Han", month: "2026-10" })).body).toBeNull();
    expect((await lookup(s.hostId, { roomId: String(s.king._id), name: "Han", month: "" })).body).toBeNull();
  });

  it("never reads another host's bookings", async () => {
    const mine = await setup("stay-mine@example.com");
    const theirs = await setup("stay-theirs@example.com");
    await book(theirs.calendar, { room: mine.king._id, guest: theirs.airbnb._id, alias: "Han", first: "2026-09-28", last: "2026-09-30" });
    const res = await lookup(mine.hostId, { roomId: String(mine.king._id), name: "Han", month: "2026-10" });
    expect(res.body).toBeNull();
  });
});

// Editing a review now happens in the add form, which shows the stay date —
// so the update must save it, and keep it when an older client leaves it out.
describe("PATCH /tt-host/reviews/entry/:id with a stay date", () => {
  it("saves the stay date sent, keeps it when none is sent, and refuses one that is not a date", async () => {
    const s = await setup("stay-edit@example.com");
    const TTReviewEntry = (await import("../../model/ttReviewEntrySchema")).default;
    const e = await TTReviewEntry.create({ host: s.hostId, room: s.king._id, text: "Quiet.", hash: "edit1", guestName: "Han" });
    const patch = (body: Record<string, unknown>) => request(appFor(s.hostId)).patch(`/tt-host/reviews/entry/${e._id}`).send(body);
    const base = { guestName: "Han", stars: 5, reviewMonth: "2026-10", text: "Quiet." };

    expect((await patch({ ...base, stayDate: "2026-09-28" })).body.stayDate).toBe("2026-09-28");
    expect((await patch(base)).body.stayDate).toBe("2026-09-28");
    expect((await patch({ ...base, stayDate: "Sept 28" })).status).toBe(400);
    expect((await patch({ ...base, stayDate: "" })).body.stayDate).toBe("");
  });
});

// Searching the reviews on record (host, 2026-10-10).
describe("GET /tt-host/reviews/entries?q=", () => {
  it("finds a review by name or by any words in it, every word required, and previews near the match", async () => {
    const s = await setup("search@example.com");
    const TTReviewEntry = (await import("../../model/ttReviewEntrySchema")).default;
    const long = `${"Lovely stay. ".repeat(10)}The mattress was a bit soft for me.`;
    await TTReviewEntry.create({ host: s.hostId, room: s.king._id, text: long, hash: "s1", guestName: "Han", stayDate: "2026-09-28" });
    await TTReviewEntry.create({ host: s.hostId, room: s.king._id, text: "Very quiet.", hash: "s2", guestName: "Gail" });
    const find = async (q: string) =>
      (await request(appFor(s.hostId)).get("/tt-host/reviews/entries").query({ q })).body.entries;

    expect((await find("gail")).map((e: any) => e.guestName)).toEqual(["Gail"]);
    expect((await find("MATTRESS soft")).map((e: any) => e.guestName)).toEqual(["Han"]);
    expect(await find("mattress quiet")).toEqual([]);
    expect((await find("2026-09")).map((e: any) => e.guestName)).toEqual(["Han"]);
    expect((await find("mattress"))[0].snippet).toContain("The mattress was a bit soft");
    expect(await find("")).toHaveLength(2);
  });
});

// Under each review in the list: who cleaned the room for that stay (host,
// 2026-10-10), the same lead TT gives.
describe("GET /tt-host/reviews/entries — the cleaner lead", () => {
  it("names who cleaned the room for the stay, and says when a stay predates the rota", async () => {
    const s = await setup("leads@example.com");
    const TTReviewEntry = (await import("../../model/ttReviewEntrySchema")).default;
    const Cleaner = (await import("../../model/cleanerSchema")).default;
    const CleaningAssignment = (await import("../../model/cleaningAssignmentSchema")).default;
    const henry = await Cleaner.create({ host: s.hostId, name: "Henry" });
    await CleaningAssignment.create({ host: s.hostId, date: "2026-09-28", room: s.king._id, cleaner: henry._id, hours: 2 });
    await TTReviewEntry.create({ host: s.hostId, room: s.king._id, text: "Spotless.", hash: "l1", guestName: "Han", stayDate: "2026-09-28" });
    await TTReviewEntry.create({ host: s.hostId, room: s.king._id, text: "Old one.", hash: "l2", guestName: "Ann", reviewMonth: "2025-03" });
    await TTReviewEntry.create({ host: s.hostId, room: s.king._id, text: "No date.", hash: "l3", guestName: "Bo" });

    const rows = (await request(appFor(s.hostId)).get("/tt-host/reviews/entries")).body.entries;
    const by = (n: string) => rows.find((r: any) => r.guestName === n);
    expect(by("Han")).toMatchObject({ cleaners: ["Henry"], basis: "night" });
    expect(by("Ann")).toMatchObject({ cleaners: [], basis: "before" });
    expect(by("Bo")).toMatchObject({ cleaners: [], basis: "none" });
  });
});
