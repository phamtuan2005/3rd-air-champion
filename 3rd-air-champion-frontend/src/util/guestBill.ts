import { bookingType, feesTotal } from "./types/bookingType";
import { dayType } from "./types/dayType";

/**
 * A house guest's bill for one month, as TiMag shows it beside the month when
 * the calendar is filtered to that guest: every NIGHT of theirs that falls in
 * the month, at the price saved on that night, plus each stay's fees once.
 *
 * It used to count each stay whole, in the month it STARTED — so Shuhui's
 * Nov 30 – Dec 3 stay put Dec 1–3 into November, and December read $584 where
 * her eleven December nights at $73 are $803 (host, 2026-10-07: "It should be
 * 803"). A stay is written onto every night it covers, so each night here is a
 * row of its own.
 *
 * Fees are per STAY but stored on every night: they are counted once, on the
 * night the stay starts, in that night's month.
 *
 * Two bookings on the same room and night are a real, kept state (a cancelled
 * stay and the one that replaced it). Only the live one counts — the most
 * recently booked, the later in the array on a tie — the same rule as the
 * cleaning code (cleaningTasks mostRecentPerRoom), so a night is never billed
 * twice.
 *
 * Months are compared on the yyyy-MM-dd strings, never through a timezone.
 */
export const guestBillForMonth = (monthMap: Map<string, dayType>, guestName: string, monthKey: string): number => {
  let total = 0;
  for (const [dateKey, day] of monthMap) {
    if (dateKey.slice(0, 7) !== monthKey) continue;
    const live = new Map<string, bookingType>();
    for (const b of day.bookings ?? []) {
      if (!b.room) continue;
      const held = live.get(b.room.id);
      if (!held || (b.bookedOn ?? "") >= (held.bookedOn ?? "")) live.set(b.room.id, b);
    }
    for (const b of live.values()) {
      if (b.guest?.name !== guestName) continue;
      total += b.price ?? 0;
      if (b.startDate === dateKey) total += feesTotal(b.fees);
    }
  }
  return Math.round(total * 100) / 100;
};
