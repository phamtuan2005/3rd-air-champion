import { useEffect, useState } from "react";
import { isAfter, startOfToday, startOfMonth, endOfMonth, eachDayOfInterval } from "date-fns";
import { format } from "date-fns-tz";
import { dayType } from "../../../util/types/dayType";
import { roomType } from "../../../util/types/roomType";
import RoomBadge from "../../shared/RoomBadge";
import { fetchAssignments } from "../../../util/cleanerOperations";
import { fetchMiscExpenses, isExpenseInMonth } from "../../../util/miscOperations";

interface AvailabilitiesModalProps {
  monthMap: Map<string, dayType>;
  rooms: roomType[];
  currentMonth: Date;
  airbnbName?: string;
  hostId?: string;
  token?: string;
}

const AvailabilitiesModal = ({ monthMap, rooms, currentMonth, airbnbName, hostId, token }: AvailabilitiesModalProps) => {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const today = startOfToday();

  // This month's cleaning cost (recorded hours × rate) and misc-expense total.
  // Both are subtracted from the estimated gross to show a net figure.
  const [cleaningFee, setCleaningFee] = useState(0);
  const [miscFee, setMiscFee] = useState(0);

  useEffect(() => {
    if (!hostId || !token) return;
    const start = format(startOfMonth(currentMonth), "yyyy-MM-dd", { timeZone });
    const end = format(endOfMonth(currentMonth), "yyyy-MM-dd", { timeZone });
    const monthKey = format(startOfMonth(currentMonth), "yyyy-MM", { timeZone });

    fetchAssignments(hostId, start, end, token)
      .then((assignments) =>
        setCleaningFee(
          assignments.reduce(
            (sum, a) => sum + (a.hours != null && a.cleaner ? a.hours * a.cleaner.payRate : 0),
            0,
          ),
        ),
      )
      .catch(() => setCleaningFee(0));

    fetchMiscExpenses(hostId, token)
      .then((items) =>
        setMiscFee(
          items.filter((e) => isExpenseInMonth(e, monthKey)).reduce((s, e) => s + e.amount, 0),
        ),
      )
      .catch(() => setMiscFee(0));
  }, [hostId, token, currentMonth, timeZone]);

  // All date keys in the current month (includes days with no bookings)
  const allMonthDateKeys = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth),
  }).map((date) => format(date, "yyyy-MM-dd", { timeZone }));

  // Collect date keys that are in the current month and >= today, sorted chronologically
  const eligibleDateKeys = allMonthDateKeys
    .filter((dateKey) => {
      const date = new Date(`${dateKey}T12:00:00`);
      return isAfter(date, today) || date.toDateString() === today.toDateString();
    })
    .sort();

  const stats = rooms
    .filter((r) => r.active)
    .map((room) => {
      const unbookedDates: string[] = [];
      for (const dateKey of eligibleDateKeys) {
        const day = monthMap.get(dateKey);
        const isBooked = day ? day.bookings.some((b) => b.room?.id === room.id) : false;
        const isBlocked = day ? (day.isBlocked || day.blockedRooms.some((r) => r?.id === room.id)) : false;
        if (!isBooked && !isBlocked) unbookedDates.push(dateKey);
      }

      let bookedNights = 0;
      const bookedProfit = allMonthDateKeys.reduce((total, dateKey) => {
        const day = monthMap.get(dateKey);
        if (!day) return total;
        const roomBookings = day.bookings.filter((b) => b.room?.id === room.id);
        if (roomBookings.length > 0) bookedNights++;
        return total + roomBookings.reduce((sum, booking) => {
            if (booking.guest.name !== "AirBnB") {
              const guestPricing = booking.guest.pricing?.find((p) => p.room === booking.room?.id);
              return sum + (guestPricing ? guestPricing.price : 0);
            } else {
              if (booking.airbnbPrice && booking.duration) {
                return sum + booking.airbnbPrice / booking.duration;
              }
              return sum;
            }
          }, 0);
      }, 0);

      // Shrinkage estimator: blend sample avg toward room.price prior when sample is small
      const k = 5;
      const weight = bookedNights / (bookedNights + k);
      const avgNightlyRate = weight * (bookedNights > 0 ? bookedProfit / bookedNights : 0) + (1 - weight) * room.price;
      const potentialProfit = unbookedDates.length * avgNightlyRate;
      return {
        room,
        unbookedDates,
        unbookedNights: unbookedDates.length,
        potentialProfit,
        bookedProfit,
        estimatedProfit: bookedProfit + potentialProfit,
      };
    });

  stats.sort((a, b) => a.unbookedNights - b.unbookedNights);

  // Width enough to cover the longest room name (6.5px per char at text-[10px] + 16px padding)

  const totalNights = stats.reduce((sum, s) => sum + s.unbookedNights, 0);
  const totalMonthProfit = stats.reduce((sum, s) => sum + s.estimatedProfit, 0);
  const netProfit = totalMonthProfit - cleaningFee - miscFee;
  const dollars = (n: number) => `$${Math.round(n).toLocaleString()}`;

  const monthLabel = currentMonth.toLocaleString("default", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="p-3 flex flex-col gap-3 h-full overflow-y-auto">
      <div className="flex flex-col gap-0.5">
        <h2 className="text-sm font-bold text-gray-700">
          {airbnbName ? `${airbnbName}: Statistics` : "Statistics"} — {monthLabel}
        </h2>
        <span className="text-xs text-gray-500">
          Today: <span className="font-semibold text-gray-700">{format(today, "MMM d, yyyy", { timeZone })}</span>
        </span>
      </div>

      {stats.length === 0 ? (
        <p className="text-xs text-gray-500">No active rooms found.</p>
      ) : (
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="text-left text-gray-500 border-b">
              <th className="pb-1 font-semibold">Room</th>
              <th className="pb-1 font-semibold">Nights left</th>
              <th className="pb-1 font-semibold text-right">Estimated profit</th>
            </tr>
          </thead>
          <tbody>
            {stats.map(({ room, unbookedNights, unbookedDates, estimatedProfit }) => {
              const days = unbookedDates.map((dateKey) =>
                format(new Date(`${dateKey}T12:00:00`), "d", { timeZone }),
              );
              const monthName =
                unbookedDates.length > 0
                  ? format(new Date(`${unbookedDates[0]}T12:00:00`), "MMMM", { timeZone })
                  : "";
              const dateList =
                unbookedDates.length > 0
                  ? `${monthName} ${days.join(", ")}`
                  : "";
              return (
                <tr key={room.id} className="border-b border-gray-100">
                  <td className="py-1.5">
                    <RoomBadge room={room} rooms={rooms} />
                  </td>
                  <td className="py-1.5 text-gray-600">
                    {unbookedNights > 0 ? (
                      `${unbookedNights} (${dateList})`
                    ) : (
                      <span className="text-emerald-600 font-medium">Sold out</span>
                    )}
                  </td>
                  <td className="py-1.5 text-right font-medium text-emerald-600">
                    ${estimatedProfit.toFixed(2)}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="font-bold text-gray-800">
              <td className="pt-2">Total</td>
              <td className="pt-2">{totalNights}</td>
              <td className="pt-2 text-right">
                <span className="inline-block bg-emerald-600 text-white text-2xl font-bold px-3 py-1 rounded-lg">
                  ${Math.round(totalMonthProfit).toLocaleString()}
                </span>
              </td>
            </tr>
          </tfoot>
        </table>
      )}

      {/* Financial summary — gross Total (above) minus this month's costs → net */}
      {stats.length > 0 && (
        <div className="flex flex-col gap-1 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-gray-500">Cleaning fee</span>
            <span className="font-medium text-rose-500">−{dollars(cleaningFee)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-500">Misc fee</span>
            <span className="font-medium text-rose-500">−{dollars(miscFee)}</span>
          </div>
          <div className="mt-0.5 flex items-center justify-between border-t border-gray-200 pt-2">
            <span className="text-base font-bold text-gray-800">Net profit</span>
            <span
              className={`inline-block rounded-lg px-3 py-1 text-2xl font-bold text-white ${
                netProfit >= 0 ? "bg-emerald-600" : "bg-rose-600"
              }`}
            >
              {dollars(netProfit)}
            </span>
          </div>
        </div>
      )}

<p className="text-[10px] text-gray-400">
        Booked nights use actual pricing · unbooked nights use shrinkage-adjusted avg (blended toward default rate when sample is small)
      </p>
    </div>
  );
};

export default AvailabilitiesModal;