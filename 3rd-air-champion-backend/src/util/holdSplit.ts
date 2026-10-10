// Holding SOME nights of a stay: the stay is cut into parts at the nights
// picked, each part a stay of its own (host, 2026-10-10: "sometimes I need a
// soft hold for a few nights within a many-night stay"; asked, they chose a
// split over one stay with some nights held, because every part then behaves
// like any stay — the hold message, To Do, TiBook).
//
// King Oct 19–31 with the 19th, 20th, 26th and 27th picked:
//   19–20 held · 21–25 as it was · 26–27 held · 28–31 as it was
//
// Fees and discounts are per STAY and written on every night (counted once,
// from the start night). Each part is now a stay, so each would count them:
// they stay on ONE part only — the first part not being held, the booking
// that carries on as it was — and the others carry none.

export interface StayPart {
  nights: string[]; // yyyy-MM-dd, in order
  held: boolean;
  keepsFees: boolean;
}

export const splitStay = (stayNights: string[], picked: Set<string>): StayPart[] => {
  const parts: StayPart[] = [];
  for (const night of stayNights) {
    const held = picked.has(night);
    const last = parts[parts.length - 1];
    if (last && last.held === held) last.nights.push(night);
    else parts.push({ nights: [night], held, keepsFees: false });
  }
  const feeHome = parts.findIndex((p) => !p.held);
  // Every night picked: one part, held, keeping its own fees.
  parts[feeHome >= 0 ? feeHome : 0].keepsFees = true;
  return parts;
};
