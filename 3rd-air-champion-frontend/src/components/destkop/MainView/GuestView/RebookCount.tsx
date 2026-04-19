import { useMemo } from "react";
import { bookingType } from "../../../../util/types/bookingType";

interface RebookCountProps {
  booking: bookingType;
  airBnBBookingCount: {
    Alias: string;
    Room: string;
    DistinctStartDateCount: number;
  }[];
}
const RebookCount = ({ booking, airBnBBookingCount }: RebookCountProps) => {
  const totalRebookings = useMemo(() => {
    if (airBnBBookingCount.length === 0) return undefined;
    return airBnBBookingCount
      .filter((guest) => guest.Alias === booking.alias)
      .reduce((acc, b) => acc + b.DistinctStartDateCount, 0);
  }, [airBnBBookingCount, booking]);

  if (totalRebookings === undefined) return null;

  if (totalRebookings === 0) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-400">
        First stay
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-600 border border-amber-200">
      ↩ {totalRebookings} {totalRebookings === 1 ? "stay" : "stays"}
    </span>
  );
};

export default RebookCount;
