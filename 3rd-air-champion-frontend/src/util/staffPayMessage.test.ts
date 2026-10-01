import { describe, expect, it } from "vitest";
import { staffPayMessage } from "./staffPayMessage";
import type { HostWorkEntry } from "./staffOperations";

// The pay text a staff member receives. It goes to their phone, so the
// numbers in it are pinned here.

const entry = (date: string, hours: number, rate: number, status: HostWorkEntry["status"] = "approved"): HostWorkEntry => ({
  id: date, kind: "staff", roomName: "", staffId: "s1", staffName: "SyTien", staffTitle: "Intern",
  date, hours, report: "", status, approvedRate: rate, approvedOn: date, hostNote: "",
});

const entries = [
  entry("2026-09-14", 3.5, 22),
  entry("2026-09-02", 2, 22),
  entry("2026-09-20", 1, 22, "submitted"), // a claim, not yet money
  entry("2026-08-30", 4, 22), // last month
];

describe("a staff member's pay text", () => {
  it("lists the month's approved days in date order and adds them up", () => {
    const text = staffPayMessage({ name: "SyTien", staffId: "s1", entries, monthKey: "2026-09", monthName: "September", paid: 121, tip: 0, sender: "Anh-Tuan" });
    expect(text).toContain("Your work in September — 5h 30m = $121.00 gross:");
    expect(text.indexOf("Wed 9/2")).toBeLessThan(text.indexOf("Mon 9/14"));
    expect(text).toContain("* Mon 9/14: 3h 30m = $77.00");
    expect(text).not.toContain("9/20");
    expect(text).not.toContain("8/30");
  });

  it("folds a tip into one paid number and names it", () => {
    const text = staffPayMessage({ name: "SyTien", staffId: "s1", entries, monthKey: "2026-09", monthName: "September", paid: 121, tip: 20, sender: "Cindy" });
    expect(text).toContain("Paid today: $141.00 (includes a $20.00 tip 🎁)");
    expect(text).toContain("— Cindy");
  });

  it("still reads whole with no approved days in the month", () => {
    const text = staffPayMessage({ name: "SyTien", staffId: "s1", entries, monthKey: "2026-07", monthName: "July", paid: 100, tip: 0 });
    expect(text).not.toContain("gross");
    expect(text).toContain("Paid today: $100.00");
  });
});
