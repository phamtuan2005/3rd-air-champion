import Host from "../model/hostSchema";
import Day from "../model/daySchema";
import { dayKey, shiftKey } from "./arrivingGuests";
import { checkoutWindow, findReviewedStay, FoundStay, StayRow } from "./reviewStay";

// The trip to the database for util/reviewStay: one room's stays around a
// review's month, read from their START nights, scoped to the host's calendar.
// Shared by the review form's lookup (GET /tt-host/reviews/stay) and the
// one-off backfill (scripts/backfill-review-stays.js), so the date filled in
// for an old review is the date the form would have filled in for it.
export const lookupReviewStay = async (
  hostId: string,
  roomId: string,
  name: string,
  month: string,
): Promise<FoundStay | null> => {
  const host: any = await Host.findById(hostId).select("calendar").lean();
  if (!host?.calendar) return null;
  const { from, to } = checkoutWindow(month);
  // Start nights from two months before the window: a long stay that checks
  // out inside it began well before it.
  const days: any[] = await Day.find({
    calendar: host.calendar,
    date: { $gte: new Date(`${shiftKey(from, -62)}T00:00:00.000Z`), $lte: new Date(`${to}T23:59:59.999Z`) },
    "bookings.room": roomId,
  })
    .select("date bookings.room bookings.startDate bookings.endDate bookings.alias bookings.guest bookings.airbnbBlocked")
    .populate("bookings.guest", "name")
    .lean();
  const stays: StayRow[] = [];
  for (const day of days) {
    const key = dayKey(day.date);
    for (const b of day.bookings ?? []) {
      if (String(b.room) !== roomId || !b.startDate || !b.endDate || b.airbnbBlocked) continue;
      // Its START night only: a stay is written onto every night it covers.
      if (dayKey(b.startDate) !== key) continue;
      const airbnb = b.guest?.name === "AirBnB";
      stays.push({
        start: key,
        // endDate is the LAST NIGHT; the guest leaves the morning after.
        end: shiftKey(dayKey(b.endDate), 1),
        name: airbnb ? String(b.alias ?? "") : String(b.guest?.name ?? ""),
        ...(airbnb || !b.guest?._id ? {} : { guestId: String(b.guest._id) }),
      });
    }
  }
  return findReviewedStay(stays, name, month);
};
