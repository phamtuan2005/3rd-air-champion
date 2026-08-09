import { dayType } from "./types/dayType";
import { bookingType, feesTotal } from "./types/bookingType";
import { MiscExpenseType } from "./miscOperations";

// What ONE booking earned on ONE night.
//
// THE per-night money formula. Three surfaces had their own copy — the calendar
// profit stat, the Stats month/trend totals, and the per-room estimator — and
// they drifted before over exactly one term: whole-stay fees. Those count ONCE,
// on the stay's start night, so a surface that forgets them reads low against
// every other surface. Exported so there is one place to be right.
//
// Direct bookings use `price`, the rate stamped when the booking was made —
// never the guest's current rate, which would re-report closed months at the
// new rate every time a rate changes. AirBnB payouts are whole-stay, so the
// night's share is airbnbPrice / duration.
export const bookingNightAmount = (booking: bookingType, dateKey: string): number => {
  if (!booking.room) return 0;
  const fee = booking.startDate.split("T")[0] === dateKey ? feesTotal(booking.fees) : 0;
  if (booking.guest.name !== "AirBnB") return (booking.price ?? 0) + fee;
  const nightly =
    booking.airbnbPrice && booking.duration ? booking.airbnbPrice / booking.duration : 0;
  return nightly + fee;
};

export interface DayGross {
  total: number;
  direct: number; // booked with you directly
  airbnb: number;
  fees: number; // whole-stay fees landing on this date (already inside total)
  nights: number; // occupied room-nights earning on this date
}

// Everything earned on one date, split the way the money actually arrives.
export const getDayGross = (day: dayType | undefined, dateKey: string): DayGross => {
  const out: DayGross = { total: 0, direct: 0, airbnb: 0, fees: 0, nights: 0 };
  if (!day) return out;
  for (const b of day.bookings) {
    if (!b.room) continue;
    const amount = bookingNightAmount(b, dateKey);
    const fee = b.startDate.split("T")[0] === dateKey ? feesTotal(b.fees) : 0;
    out.total += amount;
    out.fees += fee;
    out.nights += 1;
    if (b.guest.name !== "AirBnB") out.direct += amount;
    else out.airbnb += amount;
  }
  return out;
};

// ── Misc expenses landing on a single date ──────────────────────────────────
// A one-off lands on its own date. A recurring bill repeats monthly and stores
// only its FIRST occurrence, so it lands on the same day-of-month in every
// month it covers — the day the bill actually falls due. Anchoring it that way
// (rather than smearing 1/N across the month) keeps each day's figure a real
// day's money while still letting the month's days sum to the month total.
//
// Short months: an anchor past the month's length (the 31st in February) falls
// on the last day, so the bill lands exactly once and is never dropped.
export const miscExpensesOn = (
  expenses: MiscExpenseType[],
  dateKey: string,
): MiscExpenseType[] => {
  const monthKey = dateKey.slice(0, 7);
  const dayOfMonth = Number(dateKey.slice(8, 10));
  const daysInMonth = new Date(
    Number(dateKey.slice(0, 4)),
    Number(dateKey.slice(5, 7)),
    0,
  ).getDate();

  return expenses.filter((e) => {
    const startMonth = e.date.slice(0, 7);
    if (!e.recurring) return e.date.slice(0, 10) === dateKey;
    if (monthKey < startMonth) return false;
    if (e.endMonth && monthKey > e.endMonth) return false;
    const anchor = Number(e.date.slice(8, 10));
    return dayOfMonth === Math.min(anchor, daysInMonth);
  });
};

export const sumAmounts = (items: { amount: number }[]): number =>
  items.reduce((s, e) => s + (Number(e.amount) || 0), 0);