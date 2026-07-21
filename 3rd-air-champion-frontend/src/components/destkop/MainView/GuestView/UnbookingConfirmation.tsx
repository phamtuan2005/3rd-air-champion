import { toZonedTime } from "date-fns-tz";
import { formatDate } from "../../../../util/formatDate";
import { bookingType } from "../../../../util/types/bookingType";
import { dayType } from "../../../../util/types/dayType";
import { addDays, differenceInCalendarDays, parseISO } from "date-fns";

interface UnbookingConfirmationProps {
  bookings: bookingType[]; // one or many stays to unbook in a single firm step
  monthMap: Map<string, dayType>;
  cancellationFullRefundDays?: number;
  cancellationHalfRefundDays?: number;
  onClose: () => void;
  onUnbook: (ids: string[]) => void;
}

// Refund % for one stay, given the host's cancellation policy and how far out
// the check-in is. Returns null when no policy is configured.
const refundFor = (
  booking: bookingType,
  fullDays?: number,
  halfDays?: number,
): { pct: number; amount: number } | null => {
  if (fullDays === undefined || halfDays === undefined) return null;
  const rate =
    booking.guest.pricing?.find((p) => p.room === booking.room.id)?.price ?? booking.price;
  const total = rate * booking.duration;
  const daysOut = differenceInCalendarDays(parseISO(booking.startDate.split("T")[0]), new Date());
  const pct = daysOut >= fullDays ? 100 : daysOut >= halfDays ? 50 : 0;
  return { pct, amount: Math.round((total * pct) / 100) };
};

const UnbookingConfirmation = ({
  bookings,
  monthMap,
  cancellationFullRefundDays,
  cancellationHalfRefundDays,
  onClose,
  onUnbook,
}: UnbookingConfirmationProps) => {
  const many = bookings.length > 1;

  const handleConfirm = () => {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    // Each stay is stored as one booking record per night; collect every
    // night's id across every selected stay, then delete them all in one batch.
    const bookingIds: string[] = [];
    bookings.forEach((booking) => {
      const startDate = toZonedTime(booking.startDate, timeZone);
      for (let i = 0; i < booking.duration; i++) {
        const currentDay = monthMap.get(addDays(startDate, i).toISOString().split("T")[0]);
        currentDay?.bookings.forEach((b) => {
          if (b.guest.id === booking.guest.id && b.room.id === booking.room.id) {
            bookingIds.push(b.id);
          }
        });
      }
    });
    onUnbook(bookingIds);
  };

  return (
    <div className="fixed bottom-0 left-0 w-full h-full bg-black bg-opacity-50 flex justify-center items-center z-[70]">
      <div className="bg-white rounded-xl p-4 max-w-lg w-full shadow-lg max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-lg font-bold text-gray-800">
            Unbook {bookings.length} {many ? "bookings" : "booking"}?
          </h1>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl leading-none px-1">
            &times;
          </button>
        </div>

        {/* One row per stay, with the refund it qualifies for */}
        <div className="min-h-0 flex-1 overflow-y-auto space-y-1.5">
          {bookings.map((booking) => {
            const refund = refundFor(booking, cancellationFullRefundDays, cancellationHalfRefundDays);
            return (
              <div
                key={`${booking.room.id}|${booking.startDate}`}
                className="flex items-center justify-between gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-gray-900">
                    {booking.alias || booking.guest.name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {booking.room.name} · {formatDate(booking.startDate)} – {formatDate(booking.endDate)}
                  </p>
                </div>
                {refund && (
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${
                      refund.pct === 100
                        ? "bg-green-100 text-green-700"
                        : refund.pct === 50
                          ? "bg-amber-100 text-amber-700"
                          : "bg-red-100 text-red-700"
                    }`}
                  >
                    Refund ${refund.amount} ({refund.pct}%)
                  </span>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex justify-end gap-2 mt-3 pt-3 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md text-sm font-semibold">
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md text-sm font-bold"
          >
            Unbook {bookings.length} {many ? "bookings" : "booking"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default UnbookingConfirmation;
