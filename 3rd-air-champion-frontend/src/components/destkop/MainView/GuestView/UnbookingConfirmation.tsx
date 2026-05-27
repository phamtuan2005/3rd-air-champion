import { toZonedTime } from "date-fns-tz";
import { formatDate } from "../../../../util/formatDate";
import { bookingType } from "../../../../util/types/bookingType";
import { dayType } from "../../../../util/types/dayType";
import { addDays, differenceInCalendarDays, parseISO } from "date-fns";

interface UnbookingConfirmationProps {
  booking: bookingType;
  monthMap: Map<string, dayType>;
  cancellationFullRefundDays?: number;
  cancellationHalfRefundDays?: number;
  onClose: () => void;
  onUnbook: (ids: string[]) => void;
}

const UnbookingConfirmation = ({
  booking,
  monthMap,
  cancellationFullRefundDays,
  cancellationHalfRefundDays,
  onClose,
  onUnbook,
}: UnbookingConfirmationProps) => {
  const total = booking.price * booking.duration;
  const daysUntilCheckin = differenceInCalendarDays(parseISO(booking.startDate.split("T")[0]), new Date());
  const refundPct =
    cancellationFullRefundDays !== undefined && cancellationHalfRefundDays !== undefined
      ? daysUntilCheckin >= cancellationFullRefundDays
        ? 100
        : daysUntilCheckin >= cancellationHalfRefundDays
        ? 50
        : 0
      : null;
  const refundAmount = refundPct !== null ? Math.round((total * refundPct) / 100) : null;

  return (
    <div className="fixed bottom-0 left-0 w-full h-full bg-black bg-opacity-50 flex justify-center items-center z-50">
      <div className="bg-white rounded-lg p-4 max-w-lg w-full shadow-lg">
        <button
          onClick={onClose}
          className="text-gray-700 font-bold text-[1.5rem]"
        >
          &times;
        </button>

        {/* Content */}
        {/* Warning label*/}
        <h1>
          Are you sure you want to unbook:{" "}
          <span className="font-semibold">
            {booking.alias || booking.guest.name}
          </span>{" "}
          on{" "}
          <span className="font-semibold">{formatDate(booking.startDate)}</span>{" "}
          to{" "}
          <span className="font-semibold">{formatDate(booking.endDate)}</span>
        </h1>

        {/* Refund summary */}
        {refundAmount !== null && (
          <div className={`mt-3 px-3 py-2 rounded-lg text-sm font-medium border ${
            refundPct === 100 ? "bg-green-50 border-green-200 text-green-700" :
            refundPct === 50  ? "bg-amber-50 border-amber-200 text-amber-700" :
                                "bg-red-50 border-red-200 text-red-700"
          }`}>
            Refund: <span className="font-bold">${refundAmount}</span>
            {" "}({refundPct}% of ${total}) — {daysUntilCheckin} day{daysUntilCheckin !== 1 ? "s" : ""} before check-in
          </div>
        )}

        {/* Action buttons */}
        <div className="flex justify-end space-x-4 mt-4">
          <button
            onClick={() => {
              const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

              const bookingIds: string[] = [];
              const startDate = toZonedTime(booking.startDate, timeZone);

              for (let i = 0; i < booking.duration; i++) {
                const currentDay = monthMap.get(
                  addDays(startDate, i).toISOString().split("T")[0]
                );

                if (currentDay) {
                  // Find matching bookings in the current day
                  currentDay.bookings.forEach((b) => {
                    if (
                      b.guest.id === booking.guest.id &&
                      b.room.id === booking.room.id
                    ) {
                      bookingIds.push(b.id); // Collect the booking ID
                    }
                  });
                }
              }

              onUnbook(bookingIds);
            }}
            className="px-4 py-2 bg-green-500 text-white rounded"
          >
            Confirm
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-500 text-white rounded"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default UnbookingConfirmation;
