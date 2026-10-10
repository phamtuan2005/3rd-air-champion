import { dayResolvers } from "../resolvers/day";
import { createMockHost } from "../../model/test/util/mockHost";
import Calendar from "../../model/calendarSchema";
import Room from "../../model/roomSchema";
import Guest from "../../model/guestSchema";
import Day from "../../model/daySchema";

// Soft-holding SOME nights of a stay (host, 2026-10-10: "sometimes I need a
// soft hold for a few nights within a many-night stay"). Holding the 19th
// and 20th of King Oct 19–24 used to hold all six nights.

const holdNights = (_id: string, nights: string[]) => (dayResolvers.Mutation as any).holdNights(null, { _id, nights });

let seq = 0;
const setup = async (guestName = "Sean") => {
  seq += 1;
  const host: any = await createMockHost(`hold-nights-${seq}@example.com`);
  const calendar: any = await new Calendar({ host: host._id }).save();
  const room: any = await new Room({ host: host._id, name: "King", price: 90, roomCode: "K" }).save();
  const guest: any = await new Guest({ name: guestName, phone: `408-555-${String(1000 + seq)}`, host: host._id, numberOfGuests: 1 }).save();
  return { calendar, room, guest };
};

const d = (n: number) => `2026-10-${String(n).padStart(2, "0")}`;

// A stay written onto every night it covers, as the calendar writes it.
const book = async (s: Awaited<ReturnType<typeof setup>>, from: number, to: number, extra: Record<string, unknown> = {}) => {
  const start = new Date(`${d(from)}T00:00:00.000Z`);
  const end = new Date(`${d(to)}T00:00:00.000Z`);
  for (let n = from; n <= to; n++) {
    await new Day({
      calendar: s.calendar._id,
      date: new Date(`${d(n)}T00:00:00.000Z`),
      bookings: [
        {
          room: s.room._id,
          guest: s.guest._id,
          price: 90,
          startDate: start,
          endDate: end,
          duration: to - from + 1,
          fees: [{ label: "Cleaning", amount: 25 }],
          ...extra,
        },
      ],
    }).save();
  }
  const first: any = await Day.findOne({ calendar: s.calendar._id, date: start });
  return String(first.bookings[0]._id);
};

const night = async (s: Awaited<ReturnType<typeof setup>>, n: number) =>
  ((await Day.findOne({ calendar: s.calendar._id, date: new Date(`${d(n)}T00:00:00.000Z`) }).lean()) as any).bookings[0];
const key = (x: Date) => new Date(x).toISOString().slice(0, 10);

describe("holding some nights of a stay", () => {
  it("splits the stay: the nights picked held, the rest as they were", async () => {
    const s = await setup();
    const id = await book(s, 19, 24);
    await holdNights(id, [d(19), d(20)]);

    const held = await night(s, 20);
    expect([key(held.startDate), key(held.endDate), held.duration, held.reserved]).toEqual([d(19), d(20), 2, true]);
    const rest = await night(s, 23);
    expect([key(rest.startDate), key(rest.endDate), rest.duration, rest.reserved]).toEqual([d(21), d(24), 4, false]);
  });

  it("keeps the stay's fees on one part only, so they are counted once", async () => {
    const s = await setup();
    const id = await book(s, 19, 24);
    await holdNights(id, [d(19), d(20)]);
    expect((await night(s, 19)).fees).toEqual([]);
    expect((await night(s, 21)).fees.map((f: any) => [f.label, f.amount])).toEqual([["Cleaning", 25]]);
  });

  it("holds nights in the middle as their own part", async () => {
    const s = await setup();
    const id = await book(s, 19, 24);
    await holdNights(id, [d(21), d(22)]);
    const parts = await Promise.all([19, 21, 23].map((n) => night(s, n)));
    expect(parts.map((p) => [key(p.startDate), key(p.endDate), p.reserved])).toEqual([
      [d(19), d(20), false],
      [d(21), d(22), true],
      [d(23), d(24), false],
    ]);
  });

  it("refuses an AirBnB stay — its payout is counted once per stay", async () => {
    const s = await setup("AirBnB");
    const id = await book(s, 19, 22, { airbnbPrice: 400 });
    await expect(holdNights(id, [d(19)])).rejects.toThrow(/AirBnB/);
    expect((await night(s, 22)).reserved).toBe(false);
  });
});
