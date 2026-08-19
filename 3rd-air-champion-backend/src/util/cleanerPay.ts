// What a cleaner has earned, been paid, and is still owed.
//
// The one implementation. TiMag's Pay tab has computed this correctly for a long
// time; TiWork asking the same question separately is how the two ended up
// quoting different figures to the two people in the same conversation.

// The hourly rate in effect for a cleaner ON a given date. Newest applicable
// change wins; dates before any change use the base payRate. So a cleaning is
// always billed at its historical rate — a raise never re-prices past work.
export const rateOn = (c: any, dateStr: string): number => {
  let rate = c?.payRate ?? 0;
  const hist = [...(c?.rateHistory ?? [])].sort((a: any, b: any) =>
    a.effectiveFrom < b.effectiveFrom ? -1 : 1,
  );
  for (const h of hist as any[]) {
    if (h.effectiveFrom <= dateStr) rate = h.rate;
    else break;
  }
  return rate;
};

export interface WorkedDay {
  date: string;
  hours: number;
  earned: number;
}

export const computeCleanerPay = (
  cleaner: any,
  // `earned` may be supplied when the price is already fixed — office staff
  // entries carry the rate frozen at approval, and re-deriving it from today's
  // rateHistory would re-price work that was agreed months ago.
  worked: { date: string; hours: number; earned?: number }[],
) => {
  // Summed per DATE before anything else. A cleaner-day is recorded as the whole
  // total on that morning's first room and 0 on the rest, so one row per
  // assignment lists a real figure followed by a string of 0m / $0.00 lines for
  // the same day — and the payment walk below would consume those empty rows as
  // if they were separate days of work.
  const byDate = new Map<string, { hours: number; earned: number; priced: boolean }>();
  for (const w of worked) {
    const cur = byDate.get(w.date) ?? { hours: 0, earned: 0, priced: false };
    cur.hours += w.hours;
    if (w.earned != null) {
      cur.earned += w.earned;
      cur.priced = true;
    }
    byDate.set(w.date, cur);
  }

  const days: WorkedDay[] = [...byDate.entries()]
    .map(([date, v]) => ({
      date,
      hours: v.hours,
      earned: v.priced ? v.earned : v.hours * rateOn(cleaner, date),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  let hours = days.reduce((s, d) => s + d.hours, 0);
  let earned = days.reduce((s, d) => s + d.earned, 0);

  // Work done before assignment tracking began, priced at its own month's rate.
  const baseHrs = cleaner?.baselineHours ?? 0;
  const baseDate = cleaner?.baselineMonth
    ? `${cleaner.baselineMonth}-01`
    : new Date().toISOString().slice(0, 10);
  if (baseHrs > 0) {
    hours += baseHrs;
    earned += baseHrs * rateOn(cleaner, baseDate);
  }

  const paid = cleaner?.paidAmount ?? 0;

  // Which work the money has already covered. paidAmount is a running total with
  // no dates, so the boundary is recovered by consuming days oldest-first until
  // payments run out — everything after that is unpaid. A payment landing
  // mid-day pro-rates that day rather than dropping or double-counting it.
  const timeline: WorkedDay[] = [
    ...(baseHrs > 0
      ? [{ date: baseDate, hours: baseHrs, earned: baseHrs * rateOn(cleaner, baseDate) }]
      : []),
    ...days,
  ];
  let remainingPaid = paid;
  let unpaidHours = 0;
  let unpaidSince: string | null = null;
  for (const d of timeline) {
    if (remainingPaid >= d.earned - 1e-9) {
      remainingPaid -= d.earned;
      continue;
    }
    const uncovered = d.earned - Math.max(0, remainingPaid);
    const fraction = d.earned > 0 ? uncovered / d.earned : 1;
    unpaidHours += d.hours * fraction;
    if (!unpaidSince) unpaidSince = d.date;
    remainingPaid = 0;
  }

  // Itemised payouts, newest first. Anything paid before the log existed shows
  // as one opening figure rather than being invented as dated entries — which is
  // why a year-to-date total can look smaller than what was really paid.
  const payments = [...(cleaner?.payments ?? [])]
    .map((p: any) => ({
      id: String(p._id),
      amount: p.amount,
      paidOn: p.paidOn,
      note: p.note ?? "",
    }))
    .sort((x: any, y: any) => (x.paidOn < y.paidOn ? 1 : -1));
  const logged = payments.reduce((s: number, p: any) => s + p.amount, 0);

  return {
    hours,
    earned,
    paid,
    balance: earned - paid,
    unpaidHours,
    unpaidSince,
    payments,
    openingPaid: Math.round((paid - logged) * 100) / 100,
    days,
  };
};
