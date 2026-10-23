import mongoose from "mongoose";
import Room from "../../model/roomSchema";
import Day from "../../model/daySchema";
import Guest from "../../model/guestSchema";
import BookingRequest from "../../model/bookingRequestSchema";
import WishList from "../../model/wishListSchema";
import GuestMessage from "../../model/guestMessageSchema";
import { createMockHost } from "../../model/test/util/mockHost";
import { decideWishNews, notifyWishListsForHost } from "../wishListNotify";

// The house tells a wish-list guest when their night opens up, instead of the
// host noticing it in TiMag and texting by hand (host, 2026-10-23). What these
// pin: the guest hears once, only about a night really free for THEM, never
// off a calendar glitch, and never twice for news the host already texted.

describe("what one guest is told on a run", () => {
  const wish = (over: Partial<Parameters<typeof decideWishNews>[0]> = {}) => ({
    nights: ["2026-11-03", "2026-11-04"],
    status: "waiting",
    announcedNights: [] as string[] | undefined,
    freeLastRun: [] as string[],
    ...over,
  });

  it("waits for a second run before telling anyone — a sync glitch lasts one", () => {
    const first = decideWishNews(wish(), new Set(["2026-11-03"]));
    expect(first.announce).toEqual([]);
    const second = decideWishNews(wish({ freeLastRun: first.freeLastRun }), new Set(["2026-11-03"]));
    expect(second.announce).toEqual(["2026-11-03"]);
  });

  it("does not repeat a night already announced", () => {
    const news = decideWishNews(
      wish({ announcedNights: ["2026-11-03"], freeLastRun: ["2026-11-03"] }),
      new Set(["2026-11-03"]),
    );
    expect(news.announce).toEqual([]);
    expect(news.announcedNights).toEqual(["2026-11-03"]);
  });

  it("announces a night again when it was taken and then freed", () => {
    const taken = decideWishNews(
      wish({ announcedNights: ["2026-11-03"], freeLastRun: ["2026-11-03"] }),
      new Set(),
    );
    expect(taken.announcedNights).toEqual([]);
    const reopened = decideWishNews(wish({ ...taken, freeLastRun: ["2026-11-03"] }), new Set(["2026-11-03"]));
    expect(reopened.announce).toEqual(["2026-11-03"]);
  });

  it("adopts what the host already texted rather than sending it again", () => {
    const news = decideWishNews(
      wish({ status: "notified", announcedNights: undefined, freeLastRun: ["2026-11-03"] }),
      new Set(["2026-11-03"]),
    );
    expect(news.announce).toEqual([]);
    expect(news.announcedNights).toEqual(["2026-11-03"]);
  });
});

describe("the run against the calendar", () => {
  // 10:00 Pacific on Nov 1, 2026.
  const NOW = new Date("2026-11-01T17:00:00Z");
  const NIGHT = "2026-11-03";

  const setup = async () => {
    const host = await createMockHost(`host-${new mongoose.Types.ObjectId()}@example.com`);
    const calendar = new mongoose.Types.ObjectId();
    const king = await Room.create({ host: host._id, name: "King", price: 100 });
    const chill = await Room.create({ host: host._id, name: "Chill", price: 90 });
    const other = await Guest.create({ host: host._id, name: "Someone Else", phone: "4085550000" });
    const anna = await Guest.create({ host: host._id, name: "Anna Weber", phone: "4085551234" });
    await WishList.create({ host: host._id, guestPhone: "(408) 555-1234", guestName: "Anna Weber", dates: [new Date(`${NIGHT}T00:00:00Z`)] });
    return { host, calendar, king, chill, other, anna };
  };
  const run = (s: { host: any; calendar: any }, now = NOW) => notifyWishListsForHost(s.host._id, s.calendar, now);
  const thread = (s: { host: any }) => GuestMessage.find({ host: s.host._id, guestPhone: { $regex: "555-1234" } }).lean();

  it("tells the guest on the second run that their night is free, naming the room", async () => {
    const s = await setup();
    await Day.create({ calendar: s.calendar, date: new Date(`${NIGHT}T00:00:00Z`), bookings: [{ room: s.king._id, guest: s.other._id }] });

    await run(s);
    expect(await thread(s)).toHaveLength(0);
    await run(s);
    const msgs = await thread(s);
    expect(msgs).toHaveLength(1);
    expect(msgs[0].sender).toBe("host");
    expect(msgs[0].readByGuest).toBe(false);
    expect(msgs[0].body).toContain("Tue, Nov 3 — Chill");
    expect(msgs[0].body).not.toContain("King");
    expect((await WishList.findOne({ host: s.host._id }))!.status).toBe("notified");

    await run(s);
    expect(await thread(s)).toHaveLength(1);
  });

  it("counts a held (reserved) request and a per-room block as taken", async () => {
    const s = await setup();
    await Day.create({ calendar: s.calendar, date: new Date(`${NIGHT}T00:00:00Z`), blockedRooms: [s.king._id] });
    await BookingRequest.create({
      host: s.host._id, guestName: "Someone Else", guestPhone: "4085550000", date: new Date(`${NIGHT}T00:00:00Z`),
      room: s.chill._id, duration: 1, numberOfGuests: 1, status: "reserved",
    });
    await run(s);
    await run(s);
    expect(await thread(s)).toHaveLength(0);
  });

  it("says nothing about a night the guest already has or has already asked for", async () => {
    const s = await setup();
    await Day.create({ calendar: s.calendar, date: new Date(`${NIGHT}T00:00:00Z`), bookings: [{ room: s.king._id, guest: s.anna._id }] });
    await run(s);
    await run(s);
    expect(await thread(s)).toHaveLength(0);

    await Day.deleteMany({});
    await BookingRequest.create({
      host: s.host._id, guestName: "Anna Weber", guestPhone: "+1 408 555 1234", date: new Date(`${NIGHT}T00:00:00Z`),
      room: s.chill._id, duration: 1, numberOfGuests: 1, status: "pending",
    });
    await run(s);
    await run(s);
    expect(await thread(s)).toHaveLength(0);
  });

  it("still offers tonight in the evening, when the server's UTC day has already turned", async () => {
    const s = await setup();
    // 6pm Pacific on Nov 3 is 02:00 UTC on Nov 4.
    const evening = new Date("2026-11-04T02:00:00Z");
    await run(s, evening);
    await run(s, evening);
    expect(await thread(s)).toHaveLength(1);
  });

  it("leaves an entry the host marked Booked alone", async () => {
    const s = await setup();
    await WishList.updateOne({ host: s.host._id }, { status: "booked" });
    await run(s);
    await run(s);
    expect(await thread(s)).toHaveLength(0);
  });
});
