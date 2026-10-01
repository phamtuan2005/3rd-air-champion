import { dayResolvers } from "../resolvers/day";
import { createMockHost } from "../../model/test/util/mockHost";
import Calendar from "../../model/calendarSchema";
import Room from "../../model/roomSchema";
import Guest from "../../model/guestSchema";
import Day from "../../model/daySchema";

// What a guest paid for a stay, as TiBook shows it on the stay in the
// calendar list. Each case is a way the number can be wrong while looking
// perfectly plausible to the guest reading it.

const stays = (calendarId: string, phone: string) =>
  (dayResolvers.Query.calendarBookingsByGuest as any)(null, { calendarId, phone });

let seq = 0;
const setup = async () => {
  seq += 1;
  const host: any = await createMockHost(`stay-total-${seq}@example.com`);
  const calendar: any = await new Calendar({ host: host._id }).save();
  const room: any = await new Room({ host: host._id, name: "King", price: 90, roomCode: "K" }).save();
  const guest: any = await new Guest({ name: "Mai", phone: "408-555-1234", host: host._id, numberOfGuests: 1 }).save();
  return { calendarId: String(calendar._id), calendar, room, guest };
};

// A stay is written onto every night it covers — price, fees and all.
const bookNights = async (
  s: Awaited<ReturnType<typeof setup>>,
  dates: string[],
  prices: number[],
  fees: { label: string; amount: number }[] = [],
  reserved = false,
) => {
  for (let i = 0; i < dates.length; i++) {
    await new Day({
      calendar: s.calendar._id,
      date: new Date(`${dates[i]}T00:00:00.000Z`),
      bookings: [{ room: s.room._id, guest: s.guest._id, price: prices[i], fees, reserved, duration: dates.length }],
    }).save();
  }
};

describe("the total a guest paid for a stay", () => {
  it("adds every night at its price", async () => {
    const s = await setup();
    await bookNights(s, ["2027-03-01", "2027-03-02", "2027-03-03"], [80, 80, 80]);
    const [stay] = await stays(s.calendarId, "4085551234");
    expect(stay.total).toBe(240);
  });

  // Fees are stored on every night; counted per night, a 3-night stay's
  // cleaning fee would be charged three times.
  it("counts the fees once, not once a night", async () => {
    const s = await setup();
    await bookNights(s, ["2027-03-01", "2027-03-02", "2027-03-03"], [80, 80, 80], [{ label: "Cleaning", amount: 25 }]);
    const [stay] = await stays(s.calendarId, "4085551234");
    expect(stay.total).toBe(265);
  });

  it("takes a discount off", async () => {
    const s = await setup();
    await bookNights(s, ["2027-03-01", "2027-03-02"], [80, 80], [{ label: "Returning guest", amount: -10 }]);
    const [stay] = await stays(s.calendarId, "4085551234");
    expect(stay.total).toBe(150);
  });

  // The night's own price, not the guest's current rate: a rate changed
  // partway through is added up as it was booked.
  it("uses each night's own price", async () => {
    const s = await setup();
    await bookNights(s, ["2027-03-01", "2027-03-02"], [80, 95]);
    const [stay] = await stays(s.calendarId, "4085551234");
    expect(stay.total).toBe(175);
  });

  // Family stays at $0 on purpose. That is a real total, not a missing one.
  it("is 0 for a family stay, not missing", async () => {
    const s = await setup();
    await bookNights(s, ["2027-03-01", "2027-03-02"], [0, 0]);
    const [stay] = await stays(s.calendarId, "4085551234");
    expect(stay.total).toBe(0);
  });

  it("belongs to each stay separately", async () => {
    const s = await setup();
    await bookNights(s, ["2027-03-01", "2027-03-02"], [80, 80]);
    await bookNights(s, ["2027-04-10"], [70]);
    const result = await stays(s.calendarId, "4085551234");
    const byDate = Object.fromEntries(result.map((r: any) => [r.date.slice(0, 10), r.total]));
    expect(byDate["2027-03-01"]).toBe(160);
    expect(byDate["2027-04-10"]).toBe(70);
  });
});
