import { describe, expect, it } from "vitest";
import { entriesFor, monthLabel, peopleFromEntries, startsMonth, totalsByMonth } from "./hoursByPerson";
import type { HostWorkEntry } from "./staffOperations";

// The Hours tab narrowed to one worker. The figures are what that person is
// paid, so they are pinned here rather than trusted to the modal.

const entry = (staffId: string, date: string, hours: number, status: HostWorkEntry["status"], approvedRate = 0): HostWorkEntry => ({
  id: `${staffId}-${date}`, kind: "cleaner", roomName: "", staffId, staffName: staffId === "a" ? "Ana" : "Zed", staffTitle: "Cleaner",
  date, hours, report: "", status, approvedRate, approvedOn: "", hostNote: "",
});

const all = [
  entry("z", "2026-09-30", 2, "submitted"),
  entry("a", "2026-09-29", 3, "approved", 20),
  entry("z", "2026-09-28", 1.5, "approved", 22),
  entry("a", "2026-08-31", 2, "rejected"),
  entry("a", "2026-08-30", 4, "approved", 18),
];

describe("hours by person", () => {
  it("lists everyone with an entry, in name order", () => {
    expect(peopleFromEntries(all).map((p) => p.name)).toEqual(["Ana", "Zed"]);
  });

  it("sums approved hours at the rate each claim was approved at", () => {
    const ana = peopleFromEntries(all)[0];
    expect(ana.approvedHours).toBe(7);
    expect(ana.approvedPay).toBe(3 * 20 + 4 * 18);
    expect(ana.visits).toBe(3);
    expect(ana.pending).toBe(0);
  });

  it("keeps what is waiting apart from what is approved", () => {
    const zed = peopleFromEntries(all)[1];
    expect(zed.pending).toBe(1);
    expect(zed.waitingHours).toBe(2);
    expect(zed.approvedHours).toBe(1.5);
    expect(zed.approvedPay).toBe(33);
  });

  it("shows one person's visits only, newest first", () => {
    expect(entriesFor(all, "a").map((w) => w.date)).toEqual(["2026-09-29", "2026-08-31", "2026-08-30"]);
  });

  it("shows everyone when nobody is picked", () => {
    expect(entriesFor(all, null)).toHaveLength(5);
    expect(entriesFor(all, null)[0].date).toBe("2026-09-30");
  });

  it("puts a month heading where the month turns", () => {
    const shown = entriesFor(all, "a");
    expect(shown.map((_, i) => startsMonth(shown, i))).toEqual([true, true, false]);
  });

  it("names a month from the key alone", () => {
    expect(monthLabel("2026-09-29")).toBe("September 2026");
    expect(monthLabel("2027-01-05")).toBe("January 2027");
  });
});

describe("a person's months", () => {
  it("totals each month on its own, never across months", () => {
    const months = totalsByMonth(entriesFor(all, "a"));
    expect([...months.keys()]).toEqual(["2026-09", "2026-08"]);
    expect(months.get("2026-09")).toEqual({ visits: 1, approvedHours: 3, approvedPay: 60, waitingHours: 0 });
    // August: one approved visit at $18, one declined that counts for nothing.
    expect(months.get("2026-08")).toEqual({ visits: 2, approvedHours: 4, approvedPay: 72, waitingHours: 0 });
  });

  it("keeps a month's waiting hours apart from its approved ones", () => {
    const months = totalsByMonth(entriesFor(all, "z"));
    expect(months.get("2026-09")).toEqual({ visits: 2, approvedHours: 1.5, approvedPay: 33, waitingHours: 2 });
  });
});
