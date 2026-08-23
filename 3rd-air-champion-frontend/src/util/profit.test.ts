import { describe, expect, it } from "vitest";
import { bookingNightAmount, getDayGross, miscExpensesOn } from "./profit";
import { bookingType } from "./types/bookingType";
import { dayType } from "./types/dayType";
import { MiscExpenseType } from "./miscOperations";

// The money rules, pinned.
//
// These are not here because the code looks fragile. They are here because
// three surfaces once kept their own copy of the per-night formula and drifted
// over exactly one term — whole-stay fees — and nothing failed. The totals were
// simply wrong, on a screen the host trusts, for as long as nobody added them
// up by hand.
//
// A test that fails here means the MEANING of a figure changed. Work out which
// rule before touching it.

const room = { id: "r1", name: "King", price: 75, active: true } as never;

const booking = (over: Partial<bookingType> = {}): bookingType =>
  ({
    id: "b1",
    alias: "",
    price: 75,
    airbnbPrice: 0,
    fees: [],
    notes: "",
    earlyCheckin: false,
    lateCheckout: false,
    guest: { name: "Sean Yoo" },
    room,
    description: "",
    duration: 3,
    numberOfGuests: 2,
    startDate: "2026-08-24T00:00:00.000Z",
    endDate: "2026-08-26T00:00:00.000Z",
    airbnbBlocked: false,
    ...over,
  }) as bookingType;

describe("what one booking earns on one night", () => {
  it("a direct booking earns its stamped nightly price", () => {
    expect(bookingNightAmount(booking(), "2026-08-25")).toBe(75);
  });

  it("an AirBnB stay earns its payout divided over the nights", () => {
    const b = booking({ guest: { name: "AirBnB" } as never, airbnbPrice: 300, duration: 4 });
    expect(bookingNightAmount(b, "2026-08-25")).toBe(75);
  });

  it("whole-stay fees land ONCE, on the first night", () => {
    const b = booking({ fees: [{ label: "Cleaning", amount: 40 }] });
    expect(bookingNightAmount(b, "2026-08-24")).toBe(115); // 75 + 40
    expect(bookingNightAmount(b, "2026-08-25")).toBe(75); // and never again
  });

  it("a negative fee is a discount, not an error", () => {
    const b = booking({ fees: [{ label: "Discount", amount: -20 }] });
    expect(bookingNightAmount(b, "2026-08-24")).toBe(55);
  });

  it("earns nothing without a room — an unassigned row is not income", () => {
    expect(bookingNightAmount(booking({ room: undefined as never }), "2026-08-25")).toBe(0);
  });

  it("a comped guest earns zero rather than falling back to the room rate", () => {
    // Family stays on deliberate $0 rates. Substituting the room's price here
    // would invent revenue that was never charged.
    expect(bookingNightAmount(booking({ price: 0 }), "2026-08-25")).toBe(0);
  });
});

describe("what a whole day earns", () => {
  const day = (bookings: bookingType[]): dayType =>
    ({ id: "d1", blockedRooms: [], bookings, isBlocked: false, isAirBnB: false, date: new Date(), numberOfGuests: 0 }) as dayType;

  it("splits direct from AirBnB, and both add up to the total", () => {
    const g = getDayGross(
      day([
        booking({ price: 75 }),
        booking({ id: "b2", guest: { name: "AirBnB" } as never, airbnbPrice: 200, duration: 2 }),
      ]),
      "2026-08-25",
    );
    expect(g.direct).toBe(75);
    expect(g.airbnb).toBe(100);
    expect(g.total).toBe(175);
    expect(g.direct + g.airbnb).toBe(g.total);
  });

  it("reports fees inside the total, not beside it", () => {
    const g = getDayGross(day([booking({ fees: [{ label: "Parking", amount: 30 }] })]), "2026-08-24");
    expect(g.fees).toBe(30);
    expect(g.total).toBe(105); // 75 + 30, fees already counted in
  });

  it("counts occupied room-nights, including comped ones", () => {
    // A $0 family stay occupies the room. Counting nights by revenue would
    // report the room as empty and the house as more available than it is.
    const g = getDayGross(day([booking({ price: 0 }), booking({ id: "b2" })]), "2026-08-25");
    expect(g.nights).toBe(2);
    expect(g.total).toBe(75);
  });

  it("is all zeroes for a day with nothing on it", () => {
    expect(getDayGross(undefined, "2026-08-25")).toEqual({
      total: 0,
      direct: 0,
      airbnb: 0,
      fees: 0,
      nights: 0,
    });
  });
});

describe("misc expenses landing on a date", () => {
  const expense = (over: Partial<MiscExpenseType> = {}): MiscExpenseType =>
    ({ id: "e1", label: "Supplies", amount: 50, date: "2026-08-24", category: "supplies", recurring: false, ...over }) as MiscExpenseType;

  it("a one-off lands on its own date and no other", () => {
    expect(miscExpensesOn([expense()], "2026-08-24")).toHaveLength(1);
    expect(miscExpensesOn([expense()], "2026-08-25")).toHaveLength(0);
  });

  it("a recurring bill repeats on the same day of later months", () => {
    const rent = expense({ label: "Internet", date: "2026-08-15", recurring: true });
    expect(miscExpensesOn([rent], "2026-09-15")).toHaveLength(1);
    expect(miscExpensesOn([rent], "2026-12-15")).toHaveLength(1);
  });

  it("a recurring bill does not land before it started", () => {
    const rent = expense({ date: "2026-08-15", recurring: true });
    expect(miscExpensesOn([rent], "2026-07-15")).toHaveLength(0);
  });

  it("a 31st anchor falls on the last day of a short month — once, never dropped", () => {
    const bill = expense({ date: "2026-01-31", recurring: true });
    expect(miscExpensesOn([bill], "2026-02-28")).toHaveLength(1);
    expect(miscExpensesOn([bill], "2026-02-27")).toHaveLength(0);
  });
});
