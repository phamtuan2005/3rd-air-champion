import { computeCleanerPay, rateOn } from "../cleanerPay";

// What a cleaner is owed. Money, so pinned.
//
// The case that started these: Cindy tipped a cleaner $11. Recorded as an
// ordinary payment it paid DOWN the balance — so the tip quietly came out of
// the next wage packet — and because paid then exceeded earned, the Pay tab
// reported "hours missing" for hours nobody had worked.

const cleaner = (over: Record<string, unknown> = {}) => ({
  payRate: 25,
  rateHistory: [],
  paidAmount: 0,
  payments: [],
  ...over,
});

const day = (date: string, hours: number) => ({ date, hours });

describe("the rate in force on a date", () => {
  it("uses the base rate before any change", () => {
    expect(rateOn(cleaner(), "2026-01-01")).toBe(25);
  });

  it("never re-prices past work when a raise lands", () => {
    const c = cleaner({
      payRate: 25,
      rateHistory: [{ rate: 30, effectiveFrom: "2026-06-01" }],
    });
    expect(rateOn(c, "2026-05-31")).toBe(25);
    expect(rateOn(c, "2026-06-01")).toBe(30);
  });
});

describe("what is earned and what is owed", () => {
  it("prices each day at its own rate", () => {
    const pay = computeCleanerPay(cleaner(), [day("2026-08-01", 2), day("2026-08-02", 3)]);
    expect(pay.hours).toBe(5);
    expect(pay.earned).toBe(125);
    expect(pay.balance).toBe(125);
  });

  it("sums a cleaner-day recorded across several rooms", () => {
    // A day is stored as the whole total on the first room and 0 on the rest.
    // Treated as separate days, the payment walk consumes the empty rows.
    const pay = computeCleanerPay(cleaner(), [
      day("2026-08-01", 3),
      day("2026-08-01", 0),
      day("2026-08-01", 0),
    ]);
    expect(pay.hours).toBe(3);
    expect(pay.earned).toBe(75);
  });

  it("counts wages paid against the oldest work first", () => {
    const c = cleaner({ paidAmount: 50 });
    const pay = computeCleanerPay(c, [day("2026-08-01", 2), day("2026-08-02", 2)]);
    expect(pay.balance).toBe(50);
    expect(pay.unpaidHours).toBeCloseTo(2);
    expect(pay.unpaidSince).toBe("2026-08-02");
  });
});

describe("a tip is not a wage", () => {
  const worked = [day("2026-08-01", 2)]; // earns $50

  it("does not reduce what is still owed", () => {
    const c = cleaner({
      paidAmount: 11,
      payments: [{ _id: "p1", amount: 11, paidOn: "2026-08-02", tip: true }],
    });
    const pay = computeCleanerPay(c, worked);
    expect(pay.tips).toBe(11);
    expect(pay.wagesPaid).toBe(0);
    // The whole $50 is still owed. Before this, it read $39.
    expect(pay.balance).toBe(50);
    expect(pay.unpaidHours).toBeCloseTo(2);
  });

  it("does not make paid exceed earned, which reported hours that were never worked", () => {
    const c = cleaner({
      paidAmount: 61, // $50 wages + $11 tip
      payments: [
        { _id: "p1", amount: 50, paidOn: "2026-08-02", tip: false },
        { _id: "p2", amount: 11, paidOn: "2026-08-02", tip: true },
      ],
    });
    const pay = computeCleanerPay(c, worked);
    expect(pay.balance).toBe(0); // all paid up — not "$11 beyond the hours on record"
    expect(pay.tips).toBe(11);
  });

  it("a payout still settles the balance", () => {
    const c = cleaner({
      paidAmount: 50,
      payments: [{ _id: "p1", amount: 50, paidOn: "2026-08-02", tip: false }],
    });
    expect(computeCleanerPay(c, worked).balance).toBe(0);
  });

  it("treats money paid before the tip flag existed as wages", () => {
    // Unmarked history is wages. Reading it as tips would inflate the balance
    // and claim the house owes money it already handed over.
    const c = cleaner({ paidAmount: 50, payments: [] });
    const pay = computeCleanerPay(c, worked);
    expect(pay.tips).toBe(0);
    expect(pay.balance).toBe(0);
  });

  it("reports each payment's kind so the list can say which is which", () => {
    const c = cleaner({
      paidAmount: 61,
      payments: [
        { _id: "p1", amount: 50, paidOn: "2026-08-02", tip: false },
        { _id: "p2", amount: 11, paidOn: "2026-08-03", tip: true },
      ],
    });
    const pay = computeCleanerPay(c, worked);
    expect(pay.payments.find((p: any) => p.id === "p2")?.tip).toBe(true);
    expect(pay.payments.find((p: any) => p.id === "p1")?.tip).toBe(false);
  });
});
