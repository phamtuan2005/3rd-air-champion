import { useState } from "react";
import { addDays, format, parseISO } from "date-fns";
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
  wishListDates?: Set<string>;
  onToggleWishDate?: (date: string) => void;
  onClose: () => void;
}

const statusLabel: Record<string, { label: string; color: string }> = {
  pending:   { label: "Pending",   color: "text-amber-600 bg-amber-50 border-amber-200" },
  confirmed: { label: "Confirmed", color: "text-green-700 bg-green-50 border-green-200" },
};

const MyBookingsSheet = ({ bookings, rooms, wishListDates, onToggleWishDate, onClose }: MyBookingsSheetProps) => {
  const { theme } = useTiBookTheme();
  const roomMap = new Map(rooms.map((r) => [r.id, r]));
  const [wishListOpen, setWishListOpen] = useState(false);
  const sortedWishDates = wishListDates ? [...wishListDates].sort() : [];

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
      <div className="relative bg-white rounded-t-2xl shadow-xl max-h-[70vh] flex flex-col" onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
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

          {sortedWishDates.length > 0 && (
            <div className="mt-3 border-t border-gray-100 pt-2">
              <button
                type="button"
                onClick={() => setWishListOpen((o) => !o)}
                className="w-full flex items-center justify-between py-1 text-left"
              >
                <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
                  Wish list dates
                  <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${theme.tagBg} ${theme.textPrimary}`}>
                    {sortedWishDates.length}
                  </span>
                </span>
                <svg
                  className={`w-3.5 h-3.5 text-gray-400 transition-transform ${wishListOpen ? "rotate-180" : ""}`}
                  fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {wishListOpen && (
                <div className="flex flex-col gap-1.5 pb-2 pt-1">
                  {sortedWishDates.map((d) => (
                    <div key={d} className={`flex items-center justify-between px-3 py-2 rounded-xl border ${theme.tagBg} ${theme.tagBorder}`}>
                      <span className={`text-sm font-semibold ${theme.textPrimaryDark}`}>
                        {format(parseISO(d), "EEE, MMM d yyyy")}
                      </span>
                      {onToggleWishDate && (
                        <button
                          type="button"
                          onClick={() => onToggleWishDate(d)}
                          className="text-xs text-gray-400 hover:text-red-500 transition-colors ml-2"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MyBookingsSheet;