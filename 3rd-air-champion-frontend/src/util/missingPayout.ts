import { dayType } from "./types/dayType";

// The AirBnB stays TiMag still needs a payout for — the list behind the
// "AirBnB bookings missing profit" pop-up.
//
// The pop-up used to list only stays that START in the month on screen. A new
// reservation for Dec 30 arrived in mid-November and nothing appeared: the host
// would only have been told on the day he happened to page to December (host,
// 2026-11-18: "I want to have a popup on any day of the month"). A new booking
// is news on the day it arrives, whichever month the calendar is showing.
//
// So a stay is listed when EITHER:
//   - it has a night today or later, in any month — the new reservations, and
//     the ones in the house now; or
//   - it starts in the month on screen — what the pop-up always did, so paging
//     back to an old month still asks about that month's gaps.
// A stay that is over is NOT pulled in from a month nobody is looking at: old
// gaps would then sit in the pop-up for good and bury the new booking.

export interface MissingPayoutStay {
  id: string;
  alias: string;
  roomName: string;
  roomColor?: string;
  startDate: string;
  duration: number;
  description: string;
  numberOfGuests: number;
}

export const missingPayoutStays = (
  monthMap: Map<string, dayType>,
  viewedMonth: string, // yyyy-MM
  todayKey: string, // yyyy-MM-dd
): MissingPayoutStay[] => {
  const found = new Map<string, MissingPayoutStay>();
  for (const [dateKey, day] of monthMap) {
    for (const booking of day.bookings) {
      if (booking.guest?.name !== "AirBnB" || booking.airbnbPrice || booking.airbnbBlocked || !booking.startDate) {
        continue;
      }
      // Compare the date STRING, never new Date(startDate).getMonth().
      //
      // startDate arrives as UTC midnight ("2026-09-01T00:00:00.000Z"), which
      // west of Greenwich is the previous evening in local time. A Sept 1
      // check-in therefore reported getMonth() === August, so the modal
      // ambushed the host on the wrong month naming a booking they could not
      // find there. The yyyy-MM-dd prefix is what the rest of the app already
      // treats as the date (see bookingNightAmount).
      const startsInView = booking.startDate.slice(0, 7) === viewedMonth;
      // A stay is written onto every night it covers, so "has a night today or
      // later" is simply: this row's own day is today or later.
      if (!startsInView && dateKey < todayKey) continue;

      // One line per STAY, not per night.
      const key = `${booking.startDate}_${booking.room?.id}`;
      if (found.has(key)) continue;
      found.set(key, {
        id: booking.id,
        alias: booking.alias,
        roomName: booking.room?.name ?? "",
        roomColor: booking.room?.color,
        startDate: booking.startDate,
        duration: booking.duration,
        description: booking.description ?? "",
        numberOfGuests: booking.numberOfGuests ?? 1,
      });
    }
  }
  return [...found.values()].sort((a, b) => a.startDate.localeCompare(b.startDate));
};
