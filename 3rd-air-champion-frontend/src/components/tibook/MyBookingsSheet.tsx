import { addDays, format } from "date-fns";
import { roomType } from "../../util/types/roomType";
import { useTiBookTheme } from "../../contexts/TiBookThemeContext";

export interface GuestBooking {
  id: string;
  guestName: string;
  date: string;
  room: string;
  duration: number;
  numberOfGuests: number;
  status: string;
  createdAt: string;
}

interface MyBookingsSheetProps {
  bookings: GuestBooking[];
  rooms: roomType[];
  onClose: () => void;
}

const statusLabel: Record<string, { label: string; color: string }> = {
  pending:   { label: "Pending",   color: "text-amber-600 bg-amber-50 border-amber-200" },
  confirmed: { label: "Confirmed", color: "text-green-700 bg-green-50 border-green-200" },
};

const MyBookingsSheet = ({ bookings, rooms, onClose }: MyBookingsSheetProps) => {
  const { theme } = useTiBookTheme();
  const roomMap = new Map(rooms.map((r) => [r.id, r]));

  const upcoming = bookings.filter((b) => {
    const checkOut = addDays(new Date(b.date), b.duration);
    return checkOut >= new Date();
  });
  const past = bookings.filter((b) => {
    const checkOut = addDays(new Date(b.date), b.duration);
    return checkOut < new Date();
  });

  const renderRow = (b: GuestBooking) => {
    const checkIn = new Date(b.date);
    const checkOut = addDays(checkIn, b.duration);
    const room = roomMap.get(b.room);
    const st = statusLabel[b.status] ?? { label: b.status, color: "text-gray-500 bg-gray-50 border-gray-200" };
    return (
      <div key={b.id} className="flex items-start justify-between gap-3 py-3 border-b border-gray-100 last:border-0">
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-semibold text-gray-800">
            {room?.name ?? "Room"}
          </span>
          <span className="text-xs text-gray-500">
            {format(checkIn, "MMM d")} – {format(checkOut, "MMM d, yyyy")}
            <span className="ml-1 text-gray-400">· {b.duration} night{b.duration !== 1 ? "s" : ""}</span>
          </span>
        </div>
        <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${st.color} shrink-0`}>
          {st.label}
        </span>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white rounded-t-2xl shadow-xl max-h-[70vh] flex flex-col">
        <div className={`flex items-center justify-between px-4 py-3 border-b border-gray-100`}>
          <span className={`text-sm font-bold ${theme.textPrimary}`}>Your Bookings</span>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>
        <div className="overflow-y-auto px-4 py-2 flex-1">
          {bookings.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">No bookings found for this phone number.</p>
          ) : (
            <>
              {upcoming.length > 0 && (
                <>
                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide pt-2 pb-1">Upcoming</p>
                  {upcoming.map(renderRow)}
                </>
              )}
              {past.length > 0 && (
                <>
                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide pt-3 pb-1">Past</p>
                  {past.map(renderRow)}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default MyBookingsSheet;