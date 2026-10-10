// Which stay a guest's review is about — found from the bookings, so the host
// does not have to look it up and type the date (host, 2026-10-10: "when the
// guest name is detected, combine it with the room name and look into the
// database").
//
// The stay date is what ties a review to the cleaner who prepared the room
// (the rota has date + room + cleaner). A review itself says only a month; the
// bookings know the night.
//
// The rules:
//  - Same ROOM: the review is on that room's listing.
//  - Same FIRST NAME: AirBnB shows a reviewer by first name. An AirBnB stay
//    carries that name in its alias; one of the house's own guests is matched
//    by the first word of their name on the guest list.
//  - CHECKED OUT in the review's month or the month before: AirBnB takes
//    reviews only in the 14 days after checkout, so a stay that ended in
//    September can be reviewed in early October, never the other way round.
//  - A stay is written onto every night it covers; it is read from its START
//    night only, or one stay is three.
//  - Several left: the most recent checkout — the latest stay is the one a
//    review written now is about. Sorted, index 0.

export interface StayRow {
  start: string; // yyyy-MM-dd, the first night
  end: string; // yyyy-MM-dd, checkout morning
  name: string; // the AirBnB alias, or the guest's name on the list
  guestId?: string; // one of the house's own guests; absent for AirBnB
}

export interface FoundStay {
  stayDate: string;
  checkout: string;
  nights: number;
  guestId?: string;
  // More than one stay fitted: the host should check the date.
  others: number;
}

const first = (s: string) => s.trim().split(/\s+/)[0]?.toLowerCase() ?? "";

const monthStart = (ym: string, back: number) => {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 - back, 1));
  return d.toISOString().slice(0, 10);
};

const monthEnd = (ym: string) => {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
};

const nightsBetween = (start: string, end: string) =>
  Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000);

/** The window of checkouts a review dated `reviewMonth` (yyyy-MM) can be about. */
export const checkoutWindow = (reviewMonth: string) => ({ from: monthStart(reviewMonth, 1), to: monthEnd(reviewMonth) });

export const findReviewedStay = (stays: StayRow[], guestName: string, reviewMonth: string): FoundStay | null => {
  const who = first(guestName);
  if (!who || !/^\d{4}-(0[1-9]|1[0-2])$/.test(reviewMonth)) return null;
  const { from, to } = checkoutWindow(reviewMonth);
  const fits = stays
    .filter((s) => first(s.name) === who && s.end >= from && s.end <= to)
    .sort((a, b) => b.end.localeCompare(a.end));
  if (fits.length === 0) return null;
  const s = fits[0];
  return { stayDate: s.start, checkout: s.end, nights: nightsBetween(s.start, s.end), guestId: s.guestId, others: fits.length - 1 };
};
