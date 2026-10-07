import { monthlyPayHistory } from "../monthlyPay";

// The bars a cleaner reads as their own money and time. Paid = what reached
// their hand that month, tips included; hours = what they worked that month.

const today = new Date("2026-10-07T12:00:00Z");

describe("monthlyPayHistory", () => {
  it("gives the last six months, oldest first, with empty months as zero", () => {
    const out = monthlyPayHistory([], [], 6, today);
    expect(out.map((r) => r.month)).toEqual(["2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"]);
    expect(out.every((r) => r.paid === 0 && r.hours === 0)).toBe(true);
  });

  it("counts a payday's earning and tip together, in the month it was paid", () => {
    const out = monthlyPayHistory(
      [
        { amount: 112, paidOn: "2026-10-07" },
        { amount: 10, paidOn: "2026-10-07" }, // the tip, its own record
        { amount: 239.25, paidOn: "2026-09-30" },
      ],
      [],
      6,
      today,
    );
    expect(out.find((r) => r.month === "2026-10")!.paid).toBe(122);
    expect(out.find((r) => r.month === "2026-09")!.paid).toBe(239.25);
  });

  it("puts hours in the month they were worked, even when paid the next month", () => {
    const out = monthlyPayHistory(
      [{ amount: 60, paidOn: "2026-10-02" }],
      [
        { date: "2026-09-29", hours: 2.5 },
        { date: "2026-09-30", hours: 0.75 },
        { date: "2026-10-01", hours: 1 },
      ],
      6,
      today,
    );
    expect(out.find((r) => r.month === "2026-09")).toMatchObject({ hours: 3.25, paid: 0 });
    expect(out.find((r) => r.month === "2026-10")).toMatchObject({ hours: 1, paid: 60 });
  });

  it("leaves out anything older than the window, and crosses a year end", () => {
    const out = monthlyPayHistory(
      [{ amount: 50, paidOn: "2025-08-01" }, { amount: 20, paidOn: "2025-12-15" }],
      [{ date: "2026-01-03", hours: 2 }],
      3,
      new Date("2026-01-20T12:00:00Z"),
    );
    expect(out).toEqual([
      { month: "2025-11", paid: 0, hours: 0 },
      { month: "2025-12", paid: 20, hours: 0 },
      { month: "2026-01", paid: 0, hours: 2 },
    ]);
  });

  it("nets a correction (a negative payment) into its month, to the cent", () => {
    const out = monthlyPayHistory([{ amount: 0.1, paidOn: "2026-10-01" }, { amount: 0.2, paidOn: "2026-10-01" }, { amount: -0.1, paidOn: "2026-10-02" }], [], 1, today);
    expect(out[0].paid).toBe(0.2);
  });
});
