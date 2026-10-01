import { describe, expect, it } from "vitest";
import { payrollByMonth } from "./payrollByMonth";
import type { HostWorkEntry, StaffType } from "./staffOperations";
import type { CleanerSummaryType } from "./cleanerOperations";

// The payroll ledger: what went out each month, to whom, beside what they
// earned. Money out of the business, so the sums are pinned here.

const staffer = (over: Partial<StaffType>): StaffType => ({
  id: "s1", name: "Minh", title: "Office", phone: "", email: "", character: "", hiredOn: "2026-01-01", endedOn: "",
  payType: "biweekly", accessCode: "", payRate: 1000, rateHistory: [], reviews: [], paidAmount: 0, payments: [], note: "", ...over,
});
const cleaner = (over: Partial<CleanerSummaryType>): CleanerSummaryType => ({
  id: "c1", name: "Ana", hours: 0, earned: 0, paid: 0, balance: 0, payments: [], ...over,
});
const entry = (staffId: string, name: string, kind: HostWorkEntry["kind"], date: string, hours: number, rate: number): HostWorkEntry => ({
  id: `${staffId}-${date}`, kind, roomName: "", staffId, staffName: name, staffTitle: "", date, hours, report: "",
  status: "approved", approvedRate: rate, approvedOn: date, hostNote: "",
});

const staff = [staffer({ payments: [
  { id: "p1", amount: 1000, paidOn: "2026-09-15", note: "" },
  { id: "p2", amount: 1000, paidOn: "2026-09-29", note: "" },
  { id: "p3", amount: 1000, paidOn: "2026-08-18", note: "" },
] })];
const cleaners = [cleaner({ payments: [
  { id: "q1", amount: 120, paidOn: "2026-09-20", note: "" },
  { id: "q2", amount: 20, paidOn: "2026-09-20", note: "thanks", tip: true },
] })];
const entries = [
  entry("c1", "Ana", "cleaner", "2026-09-05", 3, 20),
  entry("c1", "Ana", "cleaner", "2026-09-19", 4, 20),
  entry("c1", "Ana", "cleaner", "2026-08-30", 2, 20),
];

describe("payroll by month", () => {
  it("lists months newest first and always includes this month", () => {
    const months = payrollByMonth(staff, cleaners, entries, "2026-10-01");
    expect(months.map((m) => m.key)).toEqual(["2026-10", "2026-09", "2026-08"]);
    expect(months[0].people).toEqual([]);
  });

  it("sums a month's wages across everyone, with tips kept apart", () => {
    const sep = payrollByMonth(staff, cleaners, entries, "2026-09-30")[0];
    expect(sep.paid).toBe(2120);
    expect(sep.tips).toBe(20);
  });

  it("puts each person's paychecks under the month they were paid in, newest first", () => {
    const sep = payrollByMonth(staff, cleaners, entries, "2026-09-30")[0];
    const minh = sep.people.find((p) => p.name === "Minh")!;
    expect(minh.paid).toBe(2000);
    expect(minh.paychecks.map((p) => p.paidOn)).toEqual(["2026-09-29", "2026-09-15"]);
    expect(minh.earned).toBeNull(); // salaried: no hours to add up
  });

  it("sets what an hourly person earned that month beside what they were paid", () => {
    const sep = payrollByMonth(staff, cleaners, entries, "2026-09-30")[0];
    const ana = sep.people.find((p) => p.name === "Ana")!;
    expect(ana.earned).toBe(140);
    expect(ana.paid).toBe(120);
    expect(ana.tips).toBe(20);
  });

  it("shows a person who earned but was not paid that month", () => {
    const aug = payrollByMonth(staff, cleaners, entries, "2026-09-30").find((m) => m.key === "2026-08")!;
    const ana = aug.people.find((p) => p.name === "Ana")!;
    expect(ana.earned).toBe(40);
    expect(ana.paid).toBe(0);
    expect(ana.paychecks).toEqual([]);
  });
});
