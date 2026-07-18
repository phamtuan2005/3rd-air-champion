import { useEffect, useRef, useState } from "react";
import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns";
import { roomType } from "../../util/types/roomType";
import { useTiBookTheme } from "../../contexts/TiBookThemeContext";
import { fetchCalendarBookingsByGuest } from "../../util/bookingRequestOperations";
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
  _source?: "calendar" | "tibook";
}

interface MyBookingsSheetProps {
  hostId: string;
  calendarId: string;
  doorCode?: string;
  airbnbAddress?: string;
  initialPhone: string;
  initialName?: string;
  rooms: roomType[];
  wishListDates?: Set<string>;
  onToggleWishDate?: (date: string) => void;
  cancellationFullRefundDays?: number;
  cancellationHalfRefundDays?: number;
  houseRules?: string;
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

// Airbnb re-sync race condition can leave multiple Day entries for the same stay with different startDates.
// Absorb any entry whose start date falls within an already-accepted entry's range; when durations differ, keep the longer one.
const dedupeCalendar = (bookings: GuestBooking[]): GuestBooking[] => {
  const dk = (b: GuestBooking) => String(b.date).slice(0, 10);
  const sorted = [...bookings].sort((a, b) => dk(a).localeCompare(dk(b)));
  const result: GuestBooking[] = [];
  for (const b of sorted) {
    const bDate = dk(b);
    const idx = result.findIndex((kept) => {
      const kStart = dk(kept);
      const kEnd = format(addDays(parseISO(kStart), Number(kept.duration) || 1), "yyyy-MM-dd");
      return b.room === kept.room && bDate >= kStart && bDate <= kEnd;
    });
    if (idx === -1) {
      result.push(b);
    } else {
      // Extend the kept entry if this absorbed entry reaches further
      const bEnd = format(addDays(parseISO(bDate), Number(b.duration) || 1), "yyyy-MM-dd");
      const kEnd = format(addDays(parseISO(dk(result[idx])), Number(result[idx].duration) || 1), "yyyy-MM-dd");
      if (bEnd > kEnd) {
        const newDuration = differenceInCalendarDays(parseISO(bEnd), parseISO(dk(result[idx])));
        result[idx] = { ...result[idx], duration: newDuration };
      }
    }
  }
  return result;
};

// Show only the last 4 digits in the recognized bar — a small privacy nicety on a screen a guest might show someone.
const maskPhone = (p: string) => {
  const last4 = p.replace(/\D/g, "").slice(-4);
  return last4 ? `•••• ${last4}` : p;
};

const statusLabel: Record<string, { label: string; color: string }> = {
  pending:   { label: "Pending",   color: "text-amber-600 bg-amber-50 border-amber-200" },
  confirmed: { label: "Confirmed", color: "text-green-700 bg-green-50 border-green-200" },
  reserved:  { label: "Reserved",  color: "text-amber-700 bg-amber-100 border-amber-300" },
};

const MyBookingsSheet = ({ hostId, calendarId, doorCode, airbnbAddress, initialPhone, initialName, rooms, wishListDates, onToggleWishDate, cancellationFullRefundDays, cancellationHalfRefundDays, houseRules, onClose, onPhoneConfirmed, onClear }: MyBookingsSheetProps) => {
  const { theme } = useTiBookTheme();
  const activeRooms = rooms.filter((r) => r.active);
  const roomMap = new Map(rooms.map((r) => [r.id, r]));

  const [phone, setPhone] = useState(initialPhone);
  const [loading, setLoading] = useState(false);
  const [bookings, setBookings] = useState<GuestBooking[] | null>(null);
  const [guestPricing, setGuestPricing] = useState<Map<string, number>>(new Map());
  const [error, setError] = useState("");
  const [wishListOpen, setWishListOpen] = useState(false);
  // House rules start collapsed so they never crowd out the bookings list.
  const [rulesOpen, setRulesOpen] = useState(false);
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

  const [sheetHeight, setSheetHeight] = useState(() => Math.round(window.innerHeight * 0.8));
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

  const handleClear = () => {
    setPhone("");
    setBookings(null);
    setGuestPricing(new Map());
    setError("");
    localStorage.removeItem("tiBookGuestPhone");
    onClear?.();
  };

  const handleSearch = async () => {
    const p = phone.trim();
    if (!p) return;
    setLoading(true);
    setError("");
    try {
      const [calendarBookings, guest] = await Promise.all([
        fetchCalendarBookingsByGuest(calendarId, p),
        fetchGuestByPhone(p, hostId),
      ]);
      setBookings(dedupeCalendar((calendarBookings ?? []) as GuestBooking[]));
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

  // Add all upcoming stays to the phone calendar — opens the .ics directly so the
  // Calendar app shows its "Add Event" screen (no share sheet). Same event format as TiMag.
  const handleAddToCalendar = () => {
    if (upcoming.length === 0) return;
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const fmt = (date: Date, hour: number) => format(date, `yyyyMMdd'T'${String(hour).padStart(2, "0")}0000`);
    const events = upcoming.map((b) => {
      const checkIn = parseISO(dateKey(b));
      const checkOut = addDays(checkIn, Number(b.duration) || 1);
      const roomName = roomMap.get(b.room)?.name ?? "Room";
      return [
        "BEGIN:VEVENT",
        `DTSTART;TZID=${tz}:${fmt(checkIn, 14)}`,
        `DTEND;TZID=${tz}:${fmt(checkOut, 11)}`,
        `SUMMARY:Stay at ${roomName}`,
        `DESCRIPTION:${b.duration} night${b.duration !== 1 ? "s" : ""} at ${roomName}`,
        ...(airbnbAddress ? [`LOCATION:${airbnbAddress.split("\n").join(", ")}`] : []),
        "END:VEVENT",
      ].join("\r\n");
    });
    const icsContent = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//3rd Air Champion//Bookings//EN",
      "CALSCALE:GREGORIAN",
      ...events,
      "END:VCALENDAR",
    ].join("\r\n");
    const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    // Navigate to the .ics so the OS hands it to the Calendar app: on a phone this opens
    // the "Add Event" screen directly; on desktop the browser saves/opens it via the same handler.
    window.location.href = url;
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  };

  const guestFirstName = bookings && bookings.length > 0
    ? bookings[0].guestName.split(" ")[0]
    : null;

  const allNonAirbnbBookings = (bookings ?? []);
  const totalStays = allNonAirbnbBookings.length;
  const totalNights = allNonAirbnbBookings.reduce((sum, b) => sum + (Number(b.duration) || 1), 0);
  const memberSince = allNonAirbnbBookings.length > 0
    ? format(parseISO(allNonAirbnbBookings.reduce((min, b) => dateKey(b) < min ? dateKey(b) : min, dateKey(allNonAirbnbBookings[0]))), "MMMM yyyy")
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
      <div key={dateKey(b) + b.room} className={`flex flex-col gap-2 py-3 border-b border-gray-100 last:border-0 ${isNext ? "pb-4" : ""} ${(isToday || isStayingNow) ? `-mx-4 px-4 rounded-2xl bg-amber-50 border border-amber-200 shadow-sm` : ""}`}>
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
              {format(checkIn, "MMMM d")} – {format(checkOut, "MMMM d, yyyy")}
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
        {isNext && airbnbAddress && (
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(airbnbAddress)}`}
            target="_blank"
            rel="noopener noreferrer"
            className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border ${theme.tagBg} ${theme.tagBorder} hover:brightness-95 active:brightness-90 transition`}
          >
            <svg className={`w-4 h-4 shrink-0 ${theme.textPrimary}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wide leading-none mb-0.5">Address · tap for directions</span>
              <span className={`text-sm font-semibold ${theme.textPrimaryDark} leading-snug`}>{airbnbAddress}</span>
            </div>
            <svg className="w-4 h-4 shrink-0 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </a>
        )}
        {isNext && room?.checkInInstructions && (
          <CheckInInstructionsPanel
            instructions={resolveInstructions(room.checkInInstructions, {
              guestName:    b.guestName.split(" ")[0],
              roomName:     room.name,
              roomCode:     room.roomCode ?? "",
              doorCode:     doorCode ?? "",
              checkInDate:  format(checkIn, "MMMM d, yyyy"),
              checkOutDate: format(checkOut, "MMMM d, yyyy"),
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
          gridTemplateRows: "auto auto auto auto 1fr",
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

        {/* Phone search (before recognition) / slim recognized bar (after) — one grid row either way */}
        {bookings === null ? (
          <div>
            <div className="flex gap-2 px-4 pt-3 pb-2">
              <input
                type="tel"
                placeholder="Your phone number"
                value={phone}
                onChange={(e) => { setPhone(e.target.value); setGuestPricing(new Map()); }}
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
        ) : (
          <div className="flex items-center justify-between gap-2 px-4 pt-3 pb-2">
            <span className="flex items-center gap-1.5 text-xs text-gray-400 min-w-0">
              <svg className="w-3.5 h-3.5 shrink-0 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              <span className="truncate">
                Showing bookings for <span className="font-semibold text-gray-500">{maskPhone(phone)}</span>
              </span>
            </span>
            <button
              type="button"
              onClick={handleClear}
              className={`shrink-0 text-xs font-semibold ${theme.textPrimary} hover:underline`}
            >
              Not you?
            </button>
          </div>
        )}

        {/* Welcome banner — pinned in its own grid row so it stays put while the list scrolls */}
        {guestFirstName ? (
          <div className="px-4 pt-3 pb-2">
            <GuestLoyaltyBanner
              firstName={guestFirstName}
              totalStays={totalStays}
              totalNights={totalNights}
              memberSince={memberSince}
            />
          </div>
        ) : (
          <div />
        )}

        {/* Results — grid row "1fr" fills remaining height */}
        <div className="overflow-y-auto px-4 pb-4">

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
                const stayingNow     = upcoming.filter((b) => dateKey(b) < today);
                const checkInToday   = upcoming.filter((b) => dateKey(b) === today);
                const futureBookings = upcoming.filter((b) => dateKey(b) > today);
                const next = upcoming[0];
                return (
                  <>
                    {stayingNow.map((b) => <div key={dateKey(b) + b.room} className="pt-2">{renderRow(b, b === next)}</div>)}
                    {checkInToday.map((b) => <div key={dateKey(b) + b.room} className="pt-2">{renderRow(b, b === next)}</div>)}
                    {futureBookings.length > 0 && (
                      <>
                        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide pt-3 pb-1">Upcoming</p>
                        {futureBookings.map((b: GuestBooking) => renderRow(b, b === next))}
                      </>
                    )}
                    <button
                      type="button"
                      onClick={handleAddToCalendar}
                      className={`w-full mt-4 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-white text-sm font-semibold ${theme.btn}`}
                    >
                      <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      Add my stays to calendar
                    </button>
                  </>
                );
              })()}
            </>
          )}

          {bookings !== null && houseRules?.trim() && (
            <div className={`rounded-xl border mt-3 ${theme.tagBg} ${theme.tagBorder}`}>
              {/* Collapsed by default — a single tappable row that never crowds the sheet */}
              <button
                type="button"
                onClick={() => setRulesOpen((o) => !o)}
                className="w-full flex items-center justify-between px-3 py-2"
              >
                <span className="flex items-center gap-2">
                  <svg className={`w-3.5 h-3.5 shrink-0 ${theme.textPrimary}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l9-9 9 9M5 10v10a1 1 0 001 1h3m10-11v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                  </svg>
                  <span className={`text-[11px] font-semibold ${theme.textPrimary}`}>House rules</span>
                </span>
                <svg
                  className={`w-3.5 h-3.5 text-gray-400 transition-transform ${rulesOpen ? "rotate-180" : ""}`}
                  fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {rulesOpen && (
                <p className="px-3 pb-2.5 text-[11px] text-gray-500 leading-relaxed whitespace-pre-line max-h-36 overflow-y-auto">
                  {houseRules.trim()}
                </p>
              )}
            </div>
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
                            Remove {format(parseISO(d), "MMMM d")}?
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
                          {format(parseISO(d), "EEE, MMMM d yyyy")}
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