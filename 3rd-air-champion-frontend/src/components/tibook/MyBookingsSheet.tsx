import { useRef, useState } from "react";
import { addDays, format, parseISO } from "date-fns";
import { roomType } from "../../util/types/roomType";
import { useTiBookTheme } from "../../contexts/TiBookThemeContext";
import { fetchBookingRequestsByGuest, fetchCalendarBookingsByGuest } from "../../util/bookingRequestOperations";
import { fetchGuestByPhone } from "../../util/guestOperations";
import RoomBadge from "../shared/RoomBadge";

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
  hostId: string;
  calendarId: string;
  initialPhone: string;
  rooms: roomType[];
  wishListDates?: Set<string>;
  onToggleWishDate?: (date: string) => void;
  onClose: () => void;
  onPhoneConfirmed: (phone: string) => void;
}

const statusLabel: Record<string, { label: string; color: string }> = {
  pending:   { label: "Pending",   color: "text-amber-600 bg-amber-50 border-amber-200" },
  confirmed: { label: "Confirmed", color: "text-green-700 bg-green-50 border-green-200" },
};

const MyBookingsSheet = ({ hostId, calendarId, initialPhone, rooms, wishListDates, onToggleWishDate, onClose, onPhoneConfirmed }: MyBookingsSheetProps) => {
  const { theme } = useTiBookTheme();
  const activeRooms = rooms.filter((r) => r.active);
  const roomMap = new Map(rooms.map((r) => [r.id, r]));

  const [phone, setPhone] = useState(initialPhone);
  const [loading, setLoading] = useState(false);
  const [bookings, setBookings] = useState<GuestBooking[] | null>(null);
  const [guestPricing, setGuestPricing] = useState<Map<string, number>>(new Map());
  const [error, setError] = useState("");
  const [wishListOpen, setWishListOpen] = useState(false);
  const sortedWishDates = wishListDates ? [...wishListDates].sort() : [];

  const [sheetHeight, setSheetHeight] = useState(() => Math.round(window.innerHeight * 0.62));
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{ startY: number; startH: number } | null>(null);
  const heightRef = useRef(sheetHeight);

  const onDragStart = (e: React.PointerEvent) => {
    e.preventDefault();
    dragRef.current = { startY: e.clientY, startH: heightRef.current };
    setIsDragging(true);
    const maxH = Math.round(window.innerHeight * 0.88);
    const onMove = (ev: PointerEvent) => {
      if (!dragRef.current) return;
      const next = Math.max(40, Math.min(dragRef.current.startH - (ev.clientY - dragRef.current.startY), maxH));
      heightRef.current = next;
      setSheetHeight(next);
    };
    const onUp = () => {
      setIsDragging(false);
      dragRef.current = null;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      if (heightRef.current < 120) onClose();
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const handleSearch = async () => {
    const p = phone.trim();
    if (!p) return;
    setLoading(true);
    setError("");
    try {
      const [calendarBookings, tiBookRequests, guest] = await Promise.all([
        fetchCalendarBookingsByGuest(calendarId, p),
        fetchBookingRequestsByGuest(hostId, p),
        fetchGuestByPhone(p, hostId),
      ]);
      // Calendar bookings are source of truth; add TiBook requests only if not already on calendar
      const calendarKeys = new Set((calendarBookings ?? []).map((b: GuestBooking) => `${b.room}:${String(b.date).slice(0, 10)}`));
      const extraRequests = (tiBookRequests ?? []).filter((b: GuestBooking) => !calendarKeys.has(`${b.room}:${String(b.date).slice(0, 10)}`));
      setBookings([...(calendarBookings ?? []), ...extraRequests]);
      setGuestPricing(new Map((guest?.pricing ?? []).map((pr: { room: string; price: number }) => [pr.room, pr.price])));
      localStorage.setItem("tiBookGuestPhone", p);
      onPhoneConfirmed(p);
    } catch {
      setError("Could not load bookings. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const today = new Date().toISOString().slice(0, 10);
  const dateKey = (b: GuestBooking) => String(b.date).slice(0, 10);
  const upcoming = (bookings ?? []).filter((b) => dateKey(b) >= today).sort((a, b) => dateKey(a).localeCompare(dateKey(b)));

  const guestFirstName = bookings && bookings.length > 0
    ? bookings[0].guestName.split(" ")[0]
    : null;

  const pastBookings = (bookings ?? []).filter((b) => dateKey(b) < today);
  const totalStays = pastBookings.length;
  const totalNights = pastBookings.reduce((sum, b) => sum + (Number(b.duration) || 1), 0);
  const memberSince = pastBookings.length > 0
    ? format(parseISO(pastBookings.reduce((min, b) => dateKey(b) < min ? dateKey(b) : min, dateKey(pastBookings[0]))), "MMM yyyy")
    : null;

  const loyaltyTier =
    totalStays >= 50 ? { label: "Cherished Guest", color: "text-amber-700 bg-amber-50 border-amber-200", message: "You are one of our most loyal and treasured guests. Every stay you've had with us is something we hold close — your trust in TT House means everything to us." } :
    totalStays >= 20 ? { label: "Valued Guest",    color: "text-purple-700 bg-purple-50 border-purple-200", message: "Your loyalty over the years has meant so much to us. We are genuinely grateful you keep choosing TT House as your home away from home." } :
    totalStays >= 5  ? { label: "Loyal Guest",     color: "text-blue-700 bg-blue-50 border-blue-200", message: "We love having you back! Your continued trust in TT House warms our hearts every time." } :
    totalStays >= 1  ? { label: "Returning Guest", color: "text-green-700 bg-green-50 border-green-200", message: "It's wonderful to see you again! We hope every stay with us feels like coming home." } :
    null;

  const renderRow = (b: GuestBooking) => {
    const checkIn  = parseISO(dateKey(b));
    const checkOut = addDays(checkIn, Number(b.duration) || 1);
    const room     = roomMap.get(b.room);
    const st        = statusLabel[b.status] ?? { label: b.status, color: "text-gray-500 bg-gray-50 border-gray-200" };
    const nightRate = guestPricing.get(b.room);
    const total     = nightRate !== undefined ? nightRate * (Number(b.duration) || 1) : undefined;
    return (
      <div key={b.id} className="flex items-start justify-between gap-3 py-3 border-b border-gray-100 last:border-0">
        <div className="flex flex-col gap-0.5">
          <RoomBadge room={room ?? { name: "Room" }} rooms={activeRooms} override={room ? undefined : "bg-gray-400"} />
          <span className="text-xs text-gray-500">
            {format(checkIn, "MMM d")} – {format(checkOut, "MMM d, yyyy")}
            <span className="ml-1 text-gray-400">· {b.duration} night{b.duration !== 1 ? "s" : ""}</span>
          </span>
          {total !== undefined && (
            <span className={`text-xs font-semibold ${theme.textPrimary}`}>
              ${total} <span className="font-normal text-gray-400">(${nightRate}/night)</span>
            </span>
          )}
        </div>
        <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${st.color} shrink-0`}>
          {st.label}
        </span>
      </div>
    );
  };

  return (
    <div className={`fixed inset-0 z-50 ${isDragging ? "select-none" : ""}`}>
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div
        className="absolute inset-x-0 bottom-0 bg-white rounded-t-2xl shadow-xl overflow-hidden"
        style={{
          height: sheetHeight,
          transition: isDragging ? "none" : "height 0.2s ease",
          display: "grid",
          gridTemplateRows: "auto auto auto 1fr",
        }}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div
          className="flex justify-center pt-2.5 pb-1 cursor-row-resize touch-none"
          onPointerDown={onDragStart}
        >
          <div className="w-10 h-1 rounded-full bg-gray-300" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <span className={`text-sm font-bold ${theme.textPrimary}`}>Your Bookings</span>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        {/* Phone search — wrapped with error so grid always has exactly 4 rows */}
        <div>
          <div className="flex gap-2 px-4 pt-3 pb-2">
            <input
              type="tel"
              placeholder="Your phone number"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-gray-400"
            />
            <button
              type="button"
              disabled={loading || !phone.trim()}
              onClick={handleSearch}
              className={`px-4 py-2.5 rounded-xl text-white text-sm font-semibold ${theme.btn} disabled:opacity-50 whitespace-nowrap`}
            >
              {loading ? "…" : "Search"}
            </button>
          </div>
          {error && <p className="px-4 pb-2 text-xs text-red-500">{error}</p>}
        </div>

        {/* Results — grid row "1fr" fills remaining height */}
        <div className="overflow-y-auto px-4 pb-4">

          {/* Welcome banner */}
          {guestFirstName && (
            <div className={`mt-3 mb-2 px-4 py-3 rounded-2xl ${theme.tagBg} border ${theme.tagBorder}`}>
              <div className="flex items-start justify-between gap-2">
                <p className={`text-sm font-bold ${theme.textPrimaryDark}`}>
                  Hi {guestFirstName}! Welcome back
                </p>
                {loyaltyTier && (
                  <span className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${loyaltyTier.color}`}>
                    {loyaltyTier.label}
                  </span>
                )}
              </div>

              {totalStays > 0 && memberSince && (
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <span className={`text-[11px] font-bold ${theme.textPrimary}`}>
                    {totalStays} {totalStays === 1 ? "stay" : "stays"}
                  </span>
                  <span className="text-gray-300 text-[10px]">·</span>
                  <span className={`text-[11px] font-bold ${theme.textPrimary}`}>
                    {totalNights} {totalNights === 1 ? "night" : "nights"}
                  </span>
                  <span className="text-gray-300 text-[10px]">·</span>
                  <span className="text-[11px] text-gray-400">
                    with us since {memberSince}
                  </span>
                </div>
              )}

              <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">
                {loyaltyTier
                  ? loyaltyTier.message
                  : "Thank you for choosing TT House. We're always happy to have you with us."}
              </p>
            </div>
          )}

          {bookings === null ? null : upcoming.length === 0 && bookings.length > 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">
              No upcoming bookings. We look forward to having you again!
            </p>
          ) : bookings.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">
              We couldn't find any bookings for this number. Please double-check the number you used when booking.
            </p>
          ) : (
            <>
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide pt-2 pb-1">Upcoming</p>
              {upcoming.map(renderRow)}
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