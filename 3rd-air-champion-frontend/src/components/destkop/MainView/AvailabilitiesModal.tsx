import { isAfter, startOfToday, format, startOfMonth, endOfMonth, eachDayOfInterval } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { dayType } from "../../../util/types/dayType";
import { roomType } from "../../../util/types/roomType";
import { getRoomColor } from "../../../util/getRoomColor";

interface AvailabilitiesModalProps {
  monthMap: Map<string, dayType>;
  rooms: roomType[];
  currentMonth: Date;
}

const AvailabilitiesModal = ({ monthMap, rooms, currentMonth }: AvailabilitiesModalProps) => {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const today = startOfToday();

  // All date keys in the current month (includes days with no bookings)
  const allMonthDateKeys = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth),
  }).map((date) => format(date, "yyyy-MM-dd"));

  // Collect date keys that are in the current month and >= today, sorted chronologically
  const eligibleDateKeys = allMonthDateKeys
    .filter((dateKey) => {
      const date = toZonedTime(dateKey, timeZone);
      return isAfter(date, today) || date.toDateString() === today.toDateString();
    })
    .sort();

  const stats = rooms
    .filter((r) => r.active)
    .map((room) => {
      const unbookedDates: string[] = [];
      for (const dateKey of eligibleDateKeys) {
        const day = monthMap.get(dateKey);
        const isBooked = day
          ? day.bookings.some((b) => b.room.id === room.id)
          : false;
        if (!isBooked) unbookedDates.push(dateKey);
      }
      return {
        room,
        unbookedDates,
        unbookedNights: unbookedDates.length,
        potentialProfit: unbookedDates.length * room.price,
      };
    });

  stats.sort((a, b) => a.unbookedNights - b.unbookedNights);

  // Width enough to cover the longest room name (6.5px per char at text-[10px] + 16px padding)
  const maxNameLen = Math.max(...stats.map((s) => s.room.name.length), 0);
  const roomBoxWidth = `${maxNameLen * 6.5 + 16}px`;

  const totalNights = stats.reduce((sum, s) => sum + s.unbookedNights, 0);
  const totalProfit = stats.reduce((sum, s) => sum + s.potentialProfit, 0);

  // Actual profit: same logic as the main page profit indicator (per-day accumulation)
  const actualProfit = allMonthDateKeys.reduce((total, dateKey) => {
    const day = monthMap.get(dateKey);
    if (!day) return total;
    return (
      total +
      day.bookings.reduce((sum, booking) => {
        if (booking.guest.name !== "AirBnB") {
          const guestPricing = booking.guest.pricing.find(
            (p) => p.room === booking.room.id,
          );
          return sum + (guestPricing ? guestPricing.price : 0);
        } else {
          if (booking.airbnbPrice && booking.duration) {
            return sum + booking.airbnbPrice / booking.duration;
          }
          return sum;
        }
      }, 0)
    );
  }, 0);

  const totalMonthProfit = actualProfit + totalProfit;

  const monthLabel = currentMonth.toLocaleString("default", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="p-3 flex flex-col gap-3 h-full overflow-y-auto">
      <div className="flex flex-col gap-0.5">
        <h2 className="text-sm font-bold text-gray-700">
          Availabilities — {monthLabel}
        </h2>
        <span className="text-xs text-gray-500">
          Today: <span className="font-semibold text-gray-700">{format(today, "MMM d, yyyy")}</span>
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
            {stats.map(({ room, unbookedNights, unbookedDates, potentialProfit }) => {
              const days = unbookedDates.map((dateKey) =>
                format(toZonedTime(dateKey, timeZone), "d"),
              );
              const monthName =
                unbookedDates.length > 0
                  ? format(toZonedTime(unbookedDates[0], timeZone), "MMMM")
                  : "";
              const dateList =
                unbookedDates.length > 0
                  ? `${monthName} ${days.join(", ")}`
                  : "";
              return (
                <tr key={room.id} className="border-b border-gray-100">
                  <td className="py-1.5">
                    <span
                      className={`${getRoomColor(room.name, room.color)} text-white text-[10px] font-medium py-0.5 rounded inline-block text-center whitespace-nowrap`}
                      style={{ width: roomBoxWidth }}
                    >
                      {room.name}
                    </span>
                  </td>
                  <td className="py-1.5 text-gray-600">
                    {unbookedNights > 0 ? (
                      `${unbookedNights} (${dateList})`
                    ) : (
                      <span className="text-emerald-600 font-medium">Sold out</span>
                    )}
                  </td>
                  <td className="py-1.5 text-right font-medium text-emerald-600">
                    ${potentialProfit.toFixed(2)}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="font-bold text-gray-800">
              <td className="pt-2">Total</td>
              <td className="pt-2">{totalNights}</td>
              <td className="pt-2 text-right text-emerald-700">
                ${totalProfit.toFixed(2)}
              </td>
            </tr>
          </tfoot>
        </table>
      )}

      {stats.length > 0 && (
        <div className="mt-auto flex flex-col gap-1 rounded-md bg-emerald-50 border border-emerald-200 px-3 py-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-700">Estimated total month profit</span>
            <span className="text-sm font-bold text-emerald-700">${totalMonthProfit.toFixed(2)}</span>
          </div>
        </div>
      )}

      <p className="text-[10px] text-gray-400">
        Based on room default nightly rate · from today to end of month
      </p>
    </div>
  );
};

export default AvailabilitiesModal;