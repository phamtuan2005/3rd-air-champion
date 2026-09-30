import { addDays, format, parseISO } from "date-fns";
import { dayType } from "./types/dayType";
import { feeType, feesTotal } from "./types/bookingType";

/*
 * What a guest paid for one of their stays, worked out from the nights TiBook
 * has already loaded: each night at the price it was booked at, and the
 * stay's fees ONCE (they are stored on every night but are one charge).
 *
 * A STOPGAP. The backend now works this out itself and sends it as the stay's
 * `total` (calendarBookingsByGuest); TiBook uses that whenever it is present,
 * and this only fills in while the live backend predates it. It leans on the
 * day records TiBook loads — which carry every guest's bookings and prices,
 * and should not reach a guest's browser at all. When that is fixed, or once
 * the backend's total is deployed, delete this and its call in TiBook.tsx.
 *
 * Same rule as the backend, so the two agree. Returns undefined — shown as
 * nothing — rather than a partial or guessed amount when any night cannot be
 * matched to exactly one of this guest's bookings: a cancelled stay can stay
 * in a night's record beside the live one, and a wrong "Paid" is worse than
 * none.
 */
export const stayPaidFromNights = (
  startKey: string,
  nights: number,
  roomId: string,
  guestId: string | undefined,
  monthMap: Map<string, dayType>,
  fees?: feeType[] | null,
): number | undefined => {
  if (!guestId || !nights || nights < 1) return undefined;
  const start = parseISO(startKey);
  let total = 0;
  for (let i = 0; i < nights; i++) {
    const day = monthMap.get(format(addDays(start, i), "yyyy-MM-dd"));
    const mine = (day?.bookings ?? []).filter(
      (b) => b.guest?.id === guestId && b.room?.id === roomId,
    );
    if (mine.length !== 1) return undefined;
    total += Number(mine[0].price) || 0;
  }
  return total + feesTotal(fees);
};
