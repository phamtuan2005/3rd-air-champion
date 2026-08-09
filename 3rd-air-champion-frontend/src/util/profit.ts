import { addDays, startOfToday } from "date-fns";
import { dayType } from "./types/dayType";
import { roomType } from "./types/roomType";
import { bookingType, feesTotal } from "./types/bookingType";
import { MiscExpenseType } from "./miscOperations";

// Local date key — never toISOString on a local midnight, which lands a day
// east of the host's timezone.
const dk = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

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

// ── Projecting a still-open night ───────────────────────────────────────────

// Nightly rate for a room, blending its own booked-night average toward the
// room's default price. With few booked nights the sample average is noise, so
// weight = n/(n+k) leans on the default; as bookings accumulate it takes over.
// Shared with the Stats per-room estimator so both use one k and one formula.
export const RATE_PRIOR_K = 5;

export const blendedNightlyRate = (
  bookedProfit: number,
  bookedNights: number,
  fallbackPrice: number,
  k = RATE_PRIOR_K,
): number => {
  const weight = bookedNights / (bookedNights + k);
  return (
    weight * (bookedNights > 0 ? bookedProfit / bookedNights : 0) + (1 - weight) * fallbackPrice
  );
};

export const ODDS_WINDOW_DAYS = 60;
// Prior strength for the per-weekday split. A 60-day window leaves only ~8
// samples per weekday, so a raw weekday rate swings wildly; each is shrunk
// toward the room's own overall rate until it has earned its independence.
export const WEEKDAY_ODDS_K = 4;

// Odds a sellable night ends up booked, per room, PER WEEKDAY (index 0=Sun…6=Sat).
//
// Separate from getRoomOccupancyOdds in cleaningTasks, which stays flat and
// drives the cleaning forecast — changing that would move cleaning schedules.
// This one exists for money projection, where the weekend/weekday gap is the
// single biggest source of error in a flat rate.
//
// Blocked nights are excluded from the denominator; a missing Day doc means the
// night sat empty. Reserved (amber) stays count as occupied.
export const getRoomWeekdayOdds = (
  monthMap: Map<string, dayType>,
  windowDays = ODDS_WINDOW_DAYS,
  k = WEEKDAY_ODDS_K,
): Map<string, number[]> => {
  const today = startOfToday();
  const roomIds = new Set<string>();
  for (let i = 1; i <= windowDays; i++) {
    const day = monthMap.get(dk(addDays(today, -i)));
    if (!day) continue;
    day.bookings.forEach((b) => b.room && roomIds.add(b.room.id));
    day.blockedRooms?.forEach((r) => roomIds.add(r.id));
  }

  const out = new Map<string, number[]>();
  roomIds.forEach((roomId) => {
    let booked = 0;
    let sellable = 0;
    const wBooked = new Array(7).fill(0);
    const wSellable = new Array(7).fill(0);
    for (let i = 1; i <= windowDays; i++) {
      const d = addDays(today, -i);
      const day = monthMap.get(dk(d));
      if (day?.isBlocked || day?.blockedRooms?.some((r) => r.id === roomId)) continue;
      const wd = d.getDay();
      sellable++;
      wSellable[wd]++;
      if (day?.bookings.some((b) => b.room?.id === roomId)) {
        booked++;
        wBooked[wd]++;
      }
    }
    const overall = sellable > 0 ? booked / sellable : 0;
    out.set(
      roomId,
      Array.from({ length: 7 }, (_, wd) => {
        const n = wSellable[wd];
        const weight = n / (n + k);
        return weight * (n > 0 ? wBooked[wd] / n : 0) + (1 - weight) * overall;
      }),
    );
  });
  return out;
};

// Every date key in a yyyy-MM month, built from the string so no timezone can
// shift a day off either end.
export const monthDateKeys = (monthKey: string): string[] => {
  const [y, m] = monthKey.split("-").map(Number);
  const n = new Date(y, m, 0).getDate();
  return Array.from({ length: n }, (_, i) => `${monthKey}-${String(i + 1).padStart(2, "0")}`);
};

export interface RoomMonthEstimate {
  room: roomType;
  bookedNights: number;
  bookedProfit: number; // realized income this month
  avgNightlyRate: number; // shrinkage-blended rate an open night is worth
  unbookedDates: string[]; // still-sellable dates from `fromDateKey` onward
  unbookedNights: number;
  potentialProfit: number; // unbookedNights × avgNightlyRate (at full rate)
  estimatedProfit: number; // bookedProfit + potentialProfit
}

// Per-room booked AND projected income for one month.
//
// THE room estimator. The Stats "This Month" tab is built on it, and the day
// view's open-room projection derives from it rather than re-deriving a rate of
// its own — so a room is worth the same amount per open night on both screens,
// and a day's ceiling sums to the month's potentialProfit.
//
// `fromDateKey` bounds which nights still count as sellable: Stats passes today
// (the rest of the month is what's left to sell), the day view passes the date
// it is showing.
export const getRoomMonthEstimates = (
  monthMap: Map<string, dayType>,
  rooms: roomType[],
  monthKey: string,
  fromDateKey: string,
): RoomMonthEstimate[] => {
  const allKeys = monthDateKeys(monthKey);
  const eligibleKeys = allKeys.filter((k) => k >= fromDateKey);

  return rooms
    .filter((r) => r.active)
    .map((room) => {
      const unbookedDates = eligibleKeys.filter((dateKey) => {
        const day = monthMap.get(dateKey);
        if (!day) return true; // no Day doc → nobody booked it
        if (day.bookings.some((b) => b.room?.id === room.id)) return false;
        if (day.isBlocked || day.blockedRooms?.some((r) => r?.id === room.id)) return false;
        return true;
      });

      let bookedNights = 0;
      let bookedProfit = 0;
      for (const dateKey of allKeys) {
        const day = monthMap.get(dateKey);
        if (!day) continue;
        const roomBookings = day.bookings.filter((b) => b.room?.id === room.id);
        if (roomBookings.length > 0) bookedNights++;
        for (const b of roomBookings) bookedProfit += bookingNightAmount(b, dateKey);
      }

      const avgNightlyRate = blendedNightlyRate(bookedProfit, bookedNights, room.price);
      const potentialProfit = unbookedDates.length * avgNightlyRate;
      return {
        room,
        bookedNights,
        bookedProfit,
        avgNightlyRate,
        unbookedDates,
        unbookedNights: unbookedDates.length,
        potentialProfit,
        estimatedProfit: bookedProfit + potentialProfit,
      };
    });
};

export interface OpenRoomProjection {
  room: roomType;
  rate: number; // the room estimator's rate — same one Stats projects with
  odds: number; // chance this weekday sells, 0–1
  expected: number; // rate × odds
}

// Rooms still sellable on ONE date, with what each is worth in expectation.
//
// A thin derivation of getRoomMonthEstimates: same open-ness test, same rate.
// The only thing added is the weekday odds, which turn Stats' "if it sells"
// ceiling into "what it's worth given how often this weekday actually sells".
//
// FUTURE dates only at the call site — a past open night earned nothing, and
// that is a fact rather than a forecast.
export const getOpenRoomProjections = (
  monthMap: Map<string, dayType>,
  rooms: roomType[],
  dateKey: string,
  weekdayOdds: Map<string, number[]>,
): OpenRoomProjection[] => {
  const weekday = new Date(dateKey + "T00:00:00").getDay();
  return getRoomMonthEstimates(monthMap, rooms, dateKey.slice(0, 7), dateKey)
    .filter((e) => e.unbookedDates.includes(dateKey))
    .map((e) => {
      const odds = weekdayOdds.get(e.room.id)?.[weekday] ?? 0;
      return { room: e.room, rate: e.avgNightlyRate, odds, expected: e.avgNightlyRate * odds };
    })
    .sort((a, b) => b.expected - a.expected);
};