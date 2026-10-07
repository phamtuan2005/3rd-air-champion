// A worker's last few months at a glance: what was PAID to them each month and
// the hours they WORKED each month — the two bars TiWork's pay screen draws.
//
// Paid, not earned (the host's choice, 2026-10-07): the lump sums that reached
// the worker's hand in that month, tips included — the same green Total they see
// on each payday. Earned-for-the-month can differ from it whenever a month's work
// is paid the next month, and a worker counts what they received.
//
// Months are calendar months by the yyyy-MM-dd strings themselves, never through
// a local timezone, like every date in this app.

export interface MonthRow {
  month: string; // yyyy-MM
  paid: number;
  hours: number;
}

const ym = (d: Date) => d.toISOString().slice(0, 7);

/** The last `n` calendar months ending with `today`'s, oldest first, each with its paid total and hours. */
export const monthlyPayHistory = (
  payments: { amount?: number; paidOn?: string }[],
  days: { date: string; hours: number }[],
  n = 6,
  today: Date = new Date(),
): MonthRow[] => {
  const months: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    months.push(ym(new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - i, 1))));
  }
  const rows = new Map(months.map((m) => [m, { month: m, paid: 0, hours: 0 }]));
  for (const p of payments) {
    const r = rows.get(String(p.paidOn ?? "").slice(0, 7));
    if (r) r.paid += Number(p.amount ?? 0);
  }
  for (const d of days) {
    const r = rows.get(String(d.date ?? "").slice(0, 7));
    if (r) r.hours += Number(d.hours ?? 0);
  }
  // To the cent and the hundredth of an hour: sums of many small amounts drift.
  return months.map((m) => {
    const r = rows.get(m)!;
    return { month: m, paid: Math.round(r.paid * 100) / 100, hours: Math.round(r.hours * 100) / 100 };
  });
};
