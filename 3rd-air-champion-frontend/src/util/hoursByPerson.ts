import type { HostWorkEntry } from "./staffOperations";

// The Hours tab, one person at a time.
//
// Every claim from every worker arrives in one list, newest first. Anh-Tuan
// reads it to follow what ONE person has done over the weeks, and the other
// workers' days are interleaved all through it (2026-09-30). So the tab can be
// narrowed to a person: their visits only, with the whole of what they are
// owed and what is still waiting at the top, and a month heading wherever the
// month turns so "over time" reads as time.
//
// Pure, so it can be tested without the modal: the figures here are money
// somebody is paid, and a wrong sum here is a wrong pay packet.

export interface PersonHours {
  staffId: string;
  name: string;
  title: string;
  // Each entry is one visit (TiWork logs hours per visit, not per room).
  visits: number;
  pending: number;
  approvedHours: number;
  // Approved hours at the rate each was approved at — the rate can change
  // between one claim and the next, so this is summed claim by claim.
  approvedPay: number;
  waitingHours: number;
}

/** Everyone with at least one entry, in name order, with their totals. */
export const peopleFromEntries = (entries: HostWorkEntry[]): PersonHours[] => {
  const byId = new Map<string, PersonHours>();
  for (const w of entries) {
    let p = byId.get(w.staffId);
    if (!p) {
      p = { staffId: w.staffId, name: w.staffName, title: w.staffTitle, visits: 0, pending: 0, approvedHours: 0, approvedPay: 0, waitingHours: 0 };
      byId.set(w.staffId, p);
    }
    p.visits += 1;
    if (w.status === "approved") {
      p.approvedHours += w.hours;
      p.approvedPay += Math.round(w.hours * (w.approvedRate || 0) * 100) / 100;
    } else if (w.status === "submitted") {
      p.pending += 1;
      p.waitingHours += w.hours;
    }
  }
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
};

/** The entries to show: one person's, or everyone's — newest first either way. */
export const entriesFor = (entries: HostWorkEntry[], staffId: string | null): HostWorkEntry[] =>
  entries
    .filter((w) => staffId === null || w.staffId === staffId)
    .sort((a, b) => b.date.localeCompare(a.date) || a.staffName.localeCompare(b.staffName));

/** True where a month heading belongs: the first row, and each row whose month differs from the one above. */
export const startsMonth = (shown: HostWorkEntry[], i: number): boolean =>
  i === 0 || shown[i - 1].date.slice(0, 7) !== shown[i].date.slice(0, 7);

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** "September 2026" from a yyyy-MM-dd key — string parts, never a Date, so no timezone can move it. */
export const monthLabel = (dateKey: string): string => {
  const [y, m] = dateKey.split("-");
  return `${MONTHS[Number(m) - 1] ?? m} ${y}`;
};

// One month of one person's claims — the figures a month heading carries.
//
// The first version put a single all-time total above the person's visits.
// Anh-Tuan: "a lump sum of all time is useless" (2026-09-30) — pay is settled
// month by month, so the month is the unit the money has to be said in.
export interface MonthTotals {
  visits: number;
  approvedHours: number;
  approvedPay: number;
  waitingHours: number;
}

/** Totals keyed by yyyy-MM, for the entries given (one person's, or everyone's). */
export const totalsByMonth = (entries: HostWorkEntry[]): Map<string, MonthTotals> => {
  const out = new Map<string, MonthTotals>();
  for (const w of entries) {
    const key = w.date.slice(0, 7);
    let t = out.get(key);
    if (!t) {
      t = { visits: 0, approvedHours: 0, approvedPay: 0, waitingHours: 0 };
      out.set(key, t);
    }
    t.visits += 1;
    if (w.status === "approved") {
      t.approvedHours += w.hours;
      t.approvedPay += Math.round(w.hours * (w.approvedRate || 0) * 100) / 100;
    } else if (w.status === "submitted") {
      t.waitingHours += w.hours;
    }
  }
  return out;
};
