import type { HostWorkEntry, StaffType } from "./staffOperations";
import type { CleanerSummaryType } from "./cleanerOperations";

// Payroll, month by month: every paycheck the house wrote, who it went to,
// and what that person earned in the same month.
//
// Anh-Tuan asked for it on 2026-09-30: the Team tab records a payout and
// shows a "paid to date", and Clean does the same for cleaners, but neither
// answers "what did I pay out in August, and to whom". The records were
// already there — a staff member's dated payments, a cleaner's itemised
// payouts, and the approved hours — only never laid side by side by month.
//
// Nothing here is written back. Paychecks are still recorded where they
// were (Team tab for staff, Clean for cleaners); this is the ledger view.
//
// Pure, because the figures are money out of the business.

export interface Paycheck {
  paidOn: string; // yyyy-MM-dd
  amount: number;
  note: string;
  // A tip is money on top of wages and settles nothing — kept apart so the
  // month's wages read true (see the backend's cleanerPay).
  tip: boolean;
}

export interface PersonMonth {
  id: string;
  name: string;
  kind: "staff" | "cleaner";
  // Wages paid this month (tips excluded) and tips on top.
  paid: number;
  tips: number;
  // Approved hours × the rate each was approved at, this month. null for a
  // salaried person: their pay is the salary, not a sum of hours.
  earned: number | null;
  paychecks: Paycheck[]; // newest first
}

export interface PayrollMonth {
  key: string; // yyyy-MM
  paid: number;
  tips: number;
  people: PersonMonth[]; // name order
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export const payrollByMonth = (
  staff: StaffType[],
  cleaners: CleanerSummaryType[],
  entries: HostWorkEntry[],
  todayKey: string,
): PayrollMonth[] => {
  const months = new Map<string, Map<string, PersonMonth>>();
  const personIn = (monthKey: string, id: string, name: string, kind: "staff" | "cleaner", salaried: boolean) => {
    let people = months.get(monthKey);
    if (!people) {
      people = new Map();
      months.set(monthKey, people);
    }
    let p = people.get(id);
    if (!p) {
      p = { id, name, kind, paid: 0, tips: 0, earned: salaried ? null : 0, paychecks: [] };
      people.set(id, p);
    }
    return p;
  };

  for (const s of staff) {
    for (const pay of s.payments ?? []) {
      const p = personIn(pay.paidOn.slice(0, 7), s.id, s.name, "staff", s.payType === "biweekly");
      p.paid = round2(p.paid + pay.amount);
      p.paychecks.push({ paidOn: pay.paidOn, amount: pay.amount, note: pay.note ?? "", tip: false });
    }
  }
  for (const c of cleaners) {
    for (const pay of c.payments ?? []) {
      const p = personIn(pay.paidOn.slice(0, 7), c.id, c.name, "cleaner", false);
      if (pay.tip) p.tips = round2(p.tips + pay.amount);
      else p.paid = round2(p.paid + pay.amount);
      p.paychecks.push({ paidOn: pay.paidOn, amount: pay.amount, note: pay.note ?? "", tip: !!pay.tip });
    }
  }
  const salaried = new Set(staff.filter((s) => s.payType === "biweekly").map((s) => s.id));
  for (const w of entries) {
    if (w.status !== "approved") continue;
    const p = personIn(w.date.slice(0, 7), w.staffId, w.staffName, w.kind, salaried.has(w.staffId));
    if (p.earned !== null) p.earned = round2(p.earned + w.hours * (w.approvedRate || 0));
  }
  // The current month is always there, so an empty one says "nothing paid
  // yet" rather than looking like the tab has nothing to say.
  if (!months.has(todayKey.slice(0, 7))) months.set(todayKey.slice(0, 7), new Map());

  return [...months.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([key, people]) => {
      const list = [...people.values()]
        .map((p) => ({ ...p, paychecks: [...p.paychecks].sort((a, b) => b.paidOn.localeCompare(a.paidOn)) }))
        .sort((a, b) => a.name.localeCompare(b.name));
      return {
        key,
        paid: round2(list.reduce((s, p) => s + p.paid, 0)),
        tips: round2(list.reduce((s, p) => s + p.tips, 0)),
        people: list,
      };
    });
};

/** The month `delta` months from a yyyy-MM key — string arithmetic, so no timezone can move it. */
export const shiftMonth = (key: string, delta: number): string => {
  const [y, m] = key.split("-").map(Number);
  const n = y * 12 + (m - 1) + delta;
  return `${Math.floor(n / 12)}-${String((n % 12) + 1).padStart(2, "0")}`;
};
