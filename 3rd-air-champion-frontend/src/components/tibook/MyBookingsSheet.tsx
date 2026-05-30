import { useEffect, useRef, useState } from "react";
import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns";
import { roomType } from "../../util/types/roomType";
import { useTiBookTheme } from "../../contexts/TiBookThemeContext";
import { fetchBookingRequestsByGuest, fetchCalendarBookingsByGuest } from "../../util/bookingRequestOperations";
import { formatCancellationPolicy } from "../../util/cancellationPolicy";
import { fetchGuestByPhone } from "../../util/guestOperations";
import { toggleWishListDate } from "../../util/wishListOperations";
import RoomBadge from "../shared/RoomBadge";
import GuestLoyaltyBanner from "./GuestLoyaltyBanner";

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
  doorCode?: string;
  initialPhone: string;
  initialName?: string;
  rooms: roomType[];
  wishListDates?: Set<string>;
  onToggleWishDate?: (date: string) => void;
  cancellationFullRefundDays?: number;
  cancellationHalfRefundDays?: number;
  onClose: () => void;
  onPhoneConfirmed: (phone: string) => void;
  onClear?: () => void;
}

const resolveInstructions = (
  template: string,
  vars: { guestName: string; roomName: string; roomCode: string; doorCode: string; checkInDate: string; checkOutDate: string; duration: string }
) =>
  template
    .replace(/\{\{guestName\}\}/g, vars.guestName)
    .replace(/\{\{roomName\}\}/g, vars.roomName)
    .replace(/\{\{roomCode\}\}/g, vars.roomCode)
    .replace(/\{\{doorCode\}\}/g, vars.doorCode)
    .replace(/\{\{checkInDate\}\}/g, vars.checkInDate)
    .replace(/\{\{checkOutDate\}\}/g, vars.checkOutDate)
    .replace(/\{\{duration\}\}/g, vars.duration);

const CheckInInstructionsPanel = ({ instructions, theme }: { instructions: string; theme: any }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className={`rounded-xl border ${theme.tagBorder} overflow-hidden`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`w-full flex items-center justify-between px-3 py-2.5 ${theme.tagBg} text-left`}
      >
        <div className="flex items-center gap-2">
          <svg className={`w-4 h-4 shrink-0 ${theme.textPrimary}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <span className={`text-[11px] font-bold uppercase tracking-wide ${theme.textPrimary}`}>Check-in instructions</span>
        </div>
        <svg className={`w-3.5 h-3.5 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="px-3 py-3 bg-white">
          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{instructions}</p>
        </div>
      )}
    </div>
  );
};

const mergeConsecutiveBookings = (bookings: GuestBooking[]): GuestBooking[] => {
  if (bookings.length <= 1) return bookings;
  const dk = (b: GuestBooking) => String(b.date).slice(0, 10);
  const merged: GuestBooking[] = [];
  let cur = { ...bookings[0] };
  for (let i = 1; i < bookings.length; i++) {
    const nxt = bookings[i];
    const curCheckOut = format(addDays(parseISO(dk(cur)), Number(cur.duration) || 1), "yyyy-MM-dd");
    if (cur.room === nxt.room && curCheckOut === dk(nxt)) {
      cur = { ...cur, duration: (Number(cur.duration) || 1) + (Number(nxt.duration) || 1) };
    } else {
      merged.push(cur);
      cur = { ...nxt };
    }
  }
  merged.push(cur);
  return merged;
};

const statusLabel: Record<string, { label: string; color: string }> = {
  pending:   { label: "Pending",   color: "text-amber-600 bg-amber-50 border-amber-200" },
  confirmed: { label: "Confirmed", color: "text-green-700 bg-green-50 border-green-200" },
  reserved:  { label: "Reserved",  color: "text-amber-700 bg-amber-100 border-amber-300" },
};

const MyBookingsSheet = ({ hostId, calendarId, doorCode, initialPhone, initialName, rooms, wishListDates, onToggleWishDate, cancellationFullRefundDays, cancellationHalfRefundDays, onClose, onPhoneConfirmed, onClear }: MyBookingsSheetProps) => {
  const { theme } = useTiBookTheme();
  const activeRooms = rooms.filter((r) => r.active);
  const roomMap = new Map(rooms.map((r) => [r.id, r]));

  const [phone, setPhone] = useState(initialPhone);
  const [loading, setLoading] = useState(false);
  const [bookings, setBookings] = useState<GuestBooking[] | null>(null);
  const [guestPricing, setGuestPricing] = useState<Map<string, number>>(new Map());
  const [error, setError] = useState("");
  const [wishListOpen, setWishListOpen] = useState(false);
  const [pendingRemove, setPendingRemove] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState("");
  const [resolvedName, setResolvedName] = useState(initialName ?? "");
  const sortedWishDates = wishListDates ? [...wishListDates].sort() : [];

  useEffect(() => {
    if (resolvedName || !phone || !hostId) return;
    fetchGuestByPhone(phone.trim(), hostId).then((guest) => {
      if (guest?.name) setResolvedName(guest.name);
    }).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const guestNameForToggle =
    (bookings && bookings.length > 0 ? bookings[0].guestName : null) ?? resolvedName;

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

  const _now = new Date();
  const today = `${_now.getFullYear()}-${String(_now.getMonth() + 1).padStart(2, "0")}-${String(_now.getDate()).padStart(2, "0")}`;
  const dateKey = (b: GuestBooking) => String(b.date).slice(0, 10);
  const upcoming = (bookings ?? []).filter((b) => {
    const checkOut = addDays(parseISO(dateKey(b)), Number(b.duration) || 1);
    const checkOutKey = `${checkOut.getFullYear()}-${String(checkOut.getMonth() + 1).padStart(2, "0")}-${String(checkOut.getDate()).padStart(2, "0")}`;
    return checkOutKey > today && b.status === "confirmed";
  }).sort((a, b) => dateKey(a).localeCompare(dateKey(b)));

  const guestFirstName = bookings && bookings.length > 0
    ? bookings[0].guestName.split(" ")[0]
    : null;

  const allNonAirbnbBookings = (bookings ?? []);
  const totalStays = allNonAirbnbBookings.length;
  const totalNights = allNonAirbnbBookings.reduce((sum, b) => sum + (Number(b.duration) || 1), 0);
  const memberSince = allNonAirbnbBookings.length > 0
    ? format(parseISO(allNonAirbnbBookings.reduce((min, b) => dateKey(b) < min ? dateKey(b) : min, dateKey(allNonAirbnbBookings[0]))), "MMM yyyy")
    : null;


  const renderRow = (b: GuestBooking, isNext = false) => {
    const checkIn  = parseISO(dateKey(b));
    const checkOut = addDays(checkIn, Number(b.duration) || 1);
    const room     = roomMap.get(b.room);
    const st        = statusLabel[b.status] ?? { label: b.status, color: "text-gray-500 bg-gray-50 border-gray-200" };
    const nightRate = guestPricing.get(b.room);
    const total     = nightRate !== undefined ? nightRate * (Number(b.duration) || 1) : undefined;
    const daysLeft     = differenceInCalendarDays(checkIn, parseISO(today));
    const isStayingNow = daysLeft < 0;
    const isToday      = daysLeft === 0;
    return (
      <div key={b.id} className={`flex flex-col gap-2 py-3 border-b border-gray-100 last:border-0 ${isNext ? "pb-4" : ""} ${(isToday || isStayingNow) ? `-mx-4 px-4 rounded-2xl bg-amber-50 border border-amber-200 shadow-sm` : ""}`}>
        {isStayingNow && (
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-[11px] font-bold text-amber-600 uppercase tracking-wide">Staying now</span>
          </div>
        )}
        {isToday && (
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-[11px] font-bold text-amber-600 uppercase tracking-wide">Check-in today</span>
          </div>
        )}
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <RoomBadge room={room ?? { name: "Room" }} rooms={activeRooms} override={room ? undefined : "bg-gray-400"} />
            <span className="text-xs text-gray-500">
              {format(checkIn, "MMM d")} – {format(checkOut, "MMM d, yyyy")}
              <span className="ml-1 text-gray-400">· {b.duration} night{b.duration !== 1 ? "s" : ""}</span>
            </span>
            {!isToday && !isStayingNow && (
              <span className="text-[11px] font-semibold text-indigo-500 mt-0.5">
                {daysLeft === 1 ? "Tomorrow!" : `in ${daysLeft} days`}
              </span>
            )}
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
        {isNext && room?.checkInInstructions && (
          <CheckInInstructionsPanel
            instructions={resolveInstructions(room.checkInInstructions, {
              guestName:    b.guestName.split(" ")[0],
              roomName:     room.name,
              roomCode:     room.roomCode ?? "",
              doorCode:     doorCode ?? "",
              checkInDate:  format(checkIn, "MMM d, yyyy"),
              checkOutDate: format(checkOut, "MMM d, yyyy"),
              duration:     String(b.duration),
            })}
            theme={theme}
          />
        )}
        {isNext && room?.roomCode && (
          <div className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border ${theme.tagBg} ${theme.tagBorder}`}>
            <svg className={`w-4 h-4 shrink-0 ${theme.textPrimary}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
            <div className="flex flex-col">
              <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wide leading-none mb-0.5">Room code</span>
              <span className={`text-lg font-bold tracking-widest ${theme.textPrimaryDark} leading-none`}>{room.roomCode}</span>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={`fixed inset-0 z-50 ${isDragging ? "select-none" : ""}`}>
      <div className="absolute inset-0 bg-black/30" onPointerDown={onClose} />
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
              onChange={(e) => { setPhone(e.target.value); setBookings(null); setGuestPricing(new Map()); }}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-gray-400"
            />
            {bookings !== null ? (
              <button
                type="button"
                onClick={() => { setPhone(""); setBookings(null); setGuestPricing(new Map()); setError(""); localStorage.removeItem("tiBookGuestPhone"); onClear?.(); }}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-500 border border-gray-200 hover:border-gray-400 whitespace-nowrap"
              >
                Clear
              </button>
            ) : (
              <button
                type="button"
                disabled={loading || !phone.trim()}
                onClick={handleSearch}
                className={`px-4 py-2.5 rounded-xl text-white text-sm font-semibold ${theme.btn} disabled:opacity-50 whitespace-nowrap`}
              >
                {loading ? "…" : "Search"}
              </button>
            )}
          </div>
          {error && <p className="px-4 pb-2 text-xs text-red-500">{error}</p>}
        </div>

        {/* Results — grid row "1fr" fills remaining height */}
        <div className="overflow-y-auto px-4 pb-4">

          {/* Welcome banner */}
          {guestFirstName && (
            <div className="mt-3 mb-2">
              <GuestLoyaltyBanner
                firstName={guestFirstName}
                totalStays={totalStays}
                totalNights={totalNights}
                memberSince={memberSince}
              />
            </div>
          )}

          {bookings === null ? null : bookings.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">
              We couldn't find any bookings for this number. Please double-check the number you used when booking.
            </p>
          ) : (
            <>
              {upcoming.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">
                  No upcoming bookings. We look forward to having you again!
                </p>
              ) : (() => {
                const merged         = mergeConsecutiveBookings(upcoming);
                const stayingNow     = merged.filter((b) => dateKey(b) < today);
                const checkInToday   = merged.filter((b) => dateKey(b) === today);
                const futureBookings = merged.filter((b) => dateKey(b) > today);
                // The single most-imminent booking across all buckets (merged is sorted by date)
                const nextId = merged[0]?.id;
                return (
                  <>
                    {stayingNow.map((b) => <div key={b.id} className="pt-2">{renderRow(b, b.id === nextId)}</div>)}
                    {checkInToday.map((b) => <div key={b.id} className="pt-2">{renderRow(b, b.id === nextId)}</div>)}
                    {futureBookings.length > 0 && (
                      <>
                        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide pt-3 pb-1">Upcoming</p>
                        {futureBookings.map((b) => renderRow(b, b.id === nextId))}
                      </>
                    )}
                  </>
                );
              })()}
            </>
          )}

          {bookings !== null && cancellationFullRefundDays != null && cancellationHalfRefundDays != null && (
            <div className={`flex items-start gap-2 px-3 py-2.5 rounded-xl border mt-3 ${theme.tagBg} ${theme.tagBorder}`}>
              <svg className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${theme.textPrimary}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20A10 10 0 0012 2z" />
              </svg>
              <p className="text-[11px] text-gray-500 leading-relaxed">
                {formatCancellationPolicy(cancellationFullRefundDays, cancellationHalfRefundDays)}
              </p>
            </div>
          )}

          {bookings !== null && sortedWishDates.length > 0 && (
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
                  {sortedWishDates.map((d) => {
                    const isPending = pendingRemove === d;
                    return isPending ? (
                      <div key={d} className="flex flex-col gap-1 px-3 py-2 rounded-xl border bg-red-50 border-red-200">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-red-600 font-medium">
                            Remove {format(parseISO(d), "MMM d")}?
                          </span>
                          <div className="flex items-center gap-2 ml-2">
                            <button
                              type="button"
                              disabled={removing}
                              onClick={async () => {
                                if (!guestNameForToggle) {
                                  setRemoveError("Please search your bookings first so we can verify your identity.");
                                  return;
                                }
                                setRemoveError("");
                                setRemoving(true);
                                try {
                                  await toggleWishListDate({ host: hostId, guestPhone: phone.trim(), guestName: guestNameForToggle, date: d });
                                  onToggleWishDate?.(d);
                                  setPendingRemove(null);
                                } catch {
                                  setRemoveError("Something went wrong. Please try again.");
                                } finally {
                                  setRemoving(false);
                                }
                              }}
                              className="text-xs font-semibold text-red-600 hover:text-red-800 disabled:opacity-50"
                            >
                              {removing ? "…" : "Yes, remove"}
                            </button>
                            <button
                              type="button"
                              onClick={() => { setPendingRemove(null); setRemoveError(""); }}
                              className="text-xs text-gray-400 hover:text-gray-600"
                            >
                              Keep
                            </button>
                          </div>
                        </div>
                        {removeError && <p className="text-[11px] text-red-500">{removeError}</p>}
                      </div>
                    ) : (
                      <div key={d} className={`flex items-center justify-between px-3 py-2 rounded-xl border ${theme.tagBg} ${theme.tagBorder}`}>
                        <span className={`text-sm font-semibold ${theme.textPrimaryDark}`}>
                          {format(parseISO(d), "EEE, MMM d yyyy")}
                        </span>
                        {onToggleWishDate && (
                          <button
                            type="button"
                            onClick={() => setPendingRemove(d)}
                            className="text-xs text-gray-400 hover:text-red-500 transition-colors ml-2"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    );
                  })}
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