import { useEffect, useMemo, useRef, useState } from "react";
import { addDays, format, parseISO, startOfToday } from "date-fns";
import CalendarNavigator from "../components/tibook/Calendar/CalendarNavigatorDesktop";
import NavBarDesktop from "../components/tibook/NavBarDesktop";
import { TiBookThemeProvider, useTiBookTheme } from "../contexts/TiBookThemeContext";
import { fetchHost } from "../util/hostOperations";
import { authorizeUser } from "../util/authorizeUser";
import { hostType } from "../util/types/hostType";
import { roomType } from "../util/types/roomType";
import GuestCalendar from "../components/tibook/Calendar/GuestCalendar";
import HostProfileBanner from "../components/tibook/HostProfileBanner";
import { dayType } from "../util/types/dayType";
import { fetchDays } from "../util/dayOperations";
import { fetchRooms } from "../util/roomOperations";
import BookingRequestModal from "../components/tibook/BookingRequestModal";
import RoomCards from "../components/tibook/RoomCards";
import MyBookingsSheet, { GuestBooking } from "../components/tibook/MyBookingsSheet";
import StayDetailPopup from "../components/tibook/StayDetailPopup";
import RoomPickerPopup from "../components/tibook/RoomPickerPopup";
import { getGuestWishList } from "../util/wishListOperations";
import { fetchBookingRequestsByHost, fetchCalendarBookingsByGuest } from "../util/bookingRequestOperations";

const TiBookInner = () => {
  const { theme } = useTiBookTheme();
  useEffect(() => { document.title = "TiBook"; }, []);
  useEffect(() => {
    const link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    const prev = link?.getAttribute("href") ?? null;
    link?.setAttribute("href", "/tibookmanifest.webmanifest");
    return () => { if (link && prev) link.setAttribute("href", prev); };
  }, []);

  const [token, setToken] = useState<string | null>(localStorage.getItem("tiBookToken") ?? null);
  const [currentHost, setCurrentHost] = useState<hostType | null>(null);
  const [rooms, setRooms] = useState<roomType[]>([]);
  const [days, setDays] = useState<dayType[]>([]);
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [scrollToTodayTrigger, setScrollToTodayTrigger] = useState(0);
  const [scrollToMonthTrigger, setScrollToMonthTrigger] = useState<{ month: Date; seq: number } | null>(null);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedRoomIds, setSelectedRoomIds] = useState<Set<string> | null>(null);
  const [cartDates, setCartDates] = useState<Map<string, string | null>>(new Map());
  const [isSelecting, setIsSelecting] = useState(false);
  const [wishListDates, setWishListDates] = useState<Set<string>>(new Set());
  const [persistedWishListDates, setPersistedWishListDates] = useState<Set<string>>(new Set());
  const [guestPhone, setGuestPhone] = useState(() => localStorage.getItem("tiBookGuestPhone") ?? "");
  const [guestName, setGuestName] = useState(() => localStorage.getItem("tiBookGuestName") ?? "");
  const [guestBookings, setGuestBookings] = useState<GuestBooking[]>([]);
  const [reservedMap, setReservedMap] = useState<Map<string, Set<string>>>(new Map());
  const [myBookingsOpen, setMyBookingsOpen] = useState(false);
  const [bookingsFocusKey, setBookingsFocusKey] = useState<string | null>(null);
  const [stayPopupId, setStayPopupId] = useState<string | null>(null);
  const [roomPickerDate, setRoomPickerDate] = useState<Date | null>(null);
  const [bookAnother, setBookAnother] = useState<{ checkIn: Date; nights: number } | null>(null);
  const cohostNames = (import.meta.env.VITE_TI_BOOK_COHOST_NAMES as string | undefined)
    ?.split(",").map((s) => s.trim()).filter(Boolean) ?? [];

  const handleToggleRoom = (id: string) => {
    setSelectedRoomIds((prev) => {
      const next = new Set(prev ?? []);
      if (next.has(id)) { next.delete(id); return next.size === 0 ? null : next; }
      next.add(id);
      return next;
    });
  };

  const monthMap = useMemo(() => {
    const map = new Map<string, dayType>();
    days.forEach((day) => {
      const key = String(day.date).slice(0, 10);
      map.set(key, day);
    });
    return map;
  }, [days]);

  const authorizeTiBook = async () => {
    const tiBookEmail = import.meta.env.VITE_TI_BOOK_EMAIL;
    const tiBookPassword = import.meta.env.VITE_TI_BOOK_PASSWORD;
    return authorizeUser({ email: tiBookEmail, password: tiBookPassword })
      .then((result) => result.token)
      .catch((err) => { console.error("Error authorizing user:", err); });
  };

  useEffect(() => {
    authorizeTiBook().then((token) => {
      if (token) { setToken(token); localStorage.setItem("tiBookToken", token); }
    });
  }, []);

  useEffect(() => {
    if (!token) return;
    const hostId = import.meta.env.VITE_TI_BOOK_HOST_ID;
    if (!hostId) return;
    setIsLoading(true);
    fetchHost(hostId, token)
      .then((host) => {
        if (host) setCurrentHost({ ...host, id: hostId });
        return Promise.all([fetchRooms(hostId, token), fetchDays(host?.calendar as string, token), fetchBookingRequestsByHost(hostId, token)]);
      })
      .then(([rooms, days, requests]) => {
        setRooms(rooms);
        setDays(days);
        const map = new Map<string, Set<string>>();
        (requests ?? []).filter((r: any) => r.status === "reserved").forEach((r: any) => {
          const start = parseISO(String(r.date).slice(0, 10));
          for (let i = 0; i < r.duration; i++) {
            const d = addDays(start, i);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
            if (!map.has(key)) map.set(key, new Set());
            map.get(key)!.add(r.room);
          }
        });
        setReservedMap(map);
      })
      .finally(() => setIsLoading(false));
  }, [token]);

  useEffect(() => {
    if (cartDates.size === 0 && wishListDates.size === 0) setIsSelecting(false);
  }, [cartDates.size, wishListDates.size]);

  // Load wish list when phone + host are ready
  useEffect(() => {
    if (!guestPhone || !currentHost) return;
    getGuestWishList(currentHost.id, guestPhone)
      .then((result) => {
        const dates = new Set<string>(result.dates);
        setWishListDates(dates);
        setPersistedWishListDates(new Set(dates));
      })
      .catch(() => {});
  }, [guestPhone, currentHost]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load guest bookings for calendar dots when phone + host are ready.
  // Read calendar bookings only — the host's actual Day entries are the source
  // of truth (same source as "Your Bookings"). Booking requests are NOT flipped
  // to "cancelled" on unbook, so including them paints stale dots for cancelled stays.
  useEffect(() => {
    if (!guestPhone || !currentHost) return;
    fetchCalendarBookingsByGuest(currentHost.calendar, guestPhone)
      .then((calendarBookings) => {
        setGuestBookings(calendarBookings ?? []);
      })
      .catch(() => {});
  }, [guestPhone, currentHost]); // eslint-disable-line react-hooks/exhaustive-deps

  const myBookingDates = useMemo(() => {
    const dates = new Set<string>();
    guestBookings.filter((b) => b.status === "confirmed").forEach((b) => {
      const checkIn = parseISO(String(b.date).slice(0, 10));
      for (let i = 0; i < b.duration; i++) {
        const d = addDays(checkIn, i);
        dates.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
      }
    });
    return dates;
  }, [guestBookings]);

  // The guest's confirmed stays as spanning bars (room-coloured ribbons on the
  // calendar), plus the nearest upcoming/current one to open the calendar on.
  const myStays = useMemo(
    () =>
      guestBookings
        .filter((b) => b.status === "confirmed")
        .map((b) => {
          const room = rooms.find((r) => r.id === b.room);
          return {
            // The backend reuses `id` across a room's stays, so identify a stay
            // uniquely by check-in date + room instead.
            id: `${String(b.date).slice(0, 10)}|${b.room}`,
            startKey: String(b.date).slice(0, 10),
            nights: b.duration,
            roomName: room?.name ?? "",
            roomColor: room?.color,
          };
        }),
    [guestBookings, rooms],
  );

  // On open, a returning guest lands on their next stay (not a blank "today").
  // Only once, and never while they're actively picking new dates.
  const didNavToStayRef = useRef(false);
  useEffect(() => {
    if (didNavToStayRef.current || isSelecting) return;
    const today = startOfToday();
    const next = myStays
      .filter((s) => addDays(parseISO(s.startKey), s.nights) > today) // checks out in the future
      .sort((a, b) => (a.startKey < b.startKey ? -1 : 1))[0];
    if (!next) return;
    didNavToStayRef.current = true;
    const d = parseISO(next.startKey);
    setScrollToMonthTrigger({ month: new Date(d.getFullYear(), d.getMonth(), 1), seq: Date.now() });
  }, [myStays, isSelecting]);

  const keyOfDate = (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

  // Rooms actually free on a given date, within the current room scope.
  const availableRoomsForDate = (date: Date) => {
    const key = keyOfDate(date);
    const scopedRooms = rooms.filter((r) => r.active && (selectedRoomIds === null || selectedRoomIds.has(r.id)));
    const day = monthMap.get(key);
    const bookedIds = new Set<string>([
      ...(day?.bookings.map((b) => b.room?.id).filter(Boolean) as string[] ?? []),
      ...(reservedMap.get(key) ?? []),
      ...((day?.blockedRooms?.map((r) => r?.id).filter(Boolean) as string[]) ?? []),
    ]);
    return scopedRooms.filter((r) => !bookedIds.has(r.id));
  };

  // Commit a date to the cart for a specific room, and lock the room filter to it
  // so the rest of the stay is built in the same room and the picker doesn't
  // re-ask on every tap.
  const addCartDateForRoom = (date: Date, roomId: string) => {
    setIsSelecting(true);
    setSelectedRoomIds(new Set([roomId]));
    setScrollToMonthTrigger({ month: new Date(date.getFullYear(), date.getMonth(), 1), seq: Date.now() });
    setCartDates((prev) => new Map(prev).set(keyOfDate(date), roomId));
    setRoomPickerDate(null);
  };

  // Flexible guest: no room preference (null) — the host assigns any free room.
  // The filter is left untouched so the rest of the stay can also be added "any".
  const addCartDateAny = (date: Date) => {
    setIsSelecting(true);
    setScrollToMonthTrigger({ month: new Date(date.getFullYear(), date.getMonth(), 1), seq: Date.now() });
    setCartDates((prev) => new Map(prev).set(keyOfDate(date), null));
    setRoomPickerDate(null);
  };

  // "Book another room" for an existing stay's exact dates: rooms free on EVERY
  // night of the range (the guest's current room is booked those nights, so it's
  // naturally excluded — they only see OTHER options).
  const availableRoomsForRange = (checkIn: Date, nights: number) => {
    const freeOn = (date: Date, r: roomType) => {
      const key = keyOfDate(date);
      const day = monthMap.get(key);
      const bookedIds = new Set<string>([
        ...(day?.bookings.map((b) => b.room?.id).filter(Boolean) as string[] ?? []),
        ...(reservedMap.get(key) ?? []),
        ...((day?.blockedRooms?.map((rm) => rm?.id).filter(Boolean) as string[]) ?? []),
      ]);
      return !bookedIds.has(r.id);
    };
    const nightsArr = Array.from({ length: nights }, (_, i) => addDays(checkIn, i));
    return rooms.filter((r) => r.active && nightsArr.every((d) => freeOn(d, r)));
  };

  // Start a fresh selection over the whole range for the chosen room (or "any"),
  // then the guest reviews and hits "Request a Booking".
  const startRangeSelection = (checkIn: Date, nights: number, roomId: string | null) => {
    setIsSelecting(true);
    if (roomId) setSelectedRoomIds(new Set([roomId]));
    setScrollToMonthTrigger({ month: new Date(checkIn.getFullYear(), checkIn.getMonth(), 1), seq: Date.now() });
    const next = new Map<string, string | null>();
    for (let i = 0; i < nights; i++) next.set(keyOfDate(addDays(checkIn, i)), roomId);
    setCartDates(next);
    setBookAnother(null);
  };

  const toggleCartDate = (date: Date) => {
    const key = keyOfDate(date);
    // Tapping an already-selected date removes it.
    if (cartDates.has(key)) {
      setCartDates((prev) => {
        const next = new Map(prev);
        next.delete(key);
        return next;
      });
      return;
    }
    setIsSelecting(true);
    setScrollToMonthTrigger({ month: new Date(date.getFullYear(), date.getMonth(), 1), seq: Date.now() });
    // A room is already chosen (single-room filter) → add straight away.
    if (selectedRoomIds?.size === 1) {
      setCartDates((prev) => new Map(prev).set(key, Array.from(selectedRoomIds)[0]));
      return;
    }
    // Already building an "Any room" stay (every picked date is room-less) → keep
    // adding "any" without re-asking.
    const vals = [...cartDates.values()];
    if (vals.length > 0 && vals.every((v) => v === null)) {
      setCartDates((prev) => new Map(prev).set(key, null));
      return;
    }
    // Otherwise open the picker to DISCLOSE which room(s) are free and let the
    // guest choose (or "Any") — even for "1 left" it names the exact room.
    if (availableRoomsForDate(date).length > 0) setRoomPickerDate(date);
  };

  const handleWishListClick = (date: Date) => {
    setIsSelecting(true);
    setScrollToMonthTrigger({ month: new Date(date.getFullYear(), date.getMonth(), 1), seq: Date.now() });
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    setWishListDates((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const handlePhoneConfirmed = (phone: string) => {
    setGuestPhone(phone);
    if (currentHost) {
      getGuestWishList(currentHost.id, phone)
        .then((result) => {
          const dates = new Set<string>(result.dates);
          setWishListDates(dates);
          setPersistedWishListDates(new Set(dates));
        })
        .catch(() => {});
    }
  };

  const findFirstAvailableDate = (month: Date): Date => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    for (let d = 1; d <= daysInMonth; d++) {
      const candidate = new Date(month.getFullYear(), month.getMonth(), d);
      if (candidate < today) continue;
      const key = `${candidate.getFullYear()}-${String(candidate.getMonth() + 1).padStart(2, "0")}-${String(candidate.getDate()).padStart(2, "0")}`;
      const day = monthMap.get(key);
      if (!day || (!day.isBlocked && day.bookings.length === 0)) return candidate;
    }
    return new Date(month.getFullYear(), month.getMonth(), 1);
  };

  const openBookingModal = (date: Date | null) => {
    setSelectedDate(date ?? findFirstAvailableDate(currentMonth));
    setIsBookingModalOpen(true);
  };

  const newWishListDates = new Set([...wishListDates].filter((d) => !persistedWishListDates.has(d)));
  const hasSelection = cartDates.size > 0 || newWishListDates.size > 0;
  const barLabel = cartDates.size > 0 && newWishListDates.size > 0
    ? `${cartDates.size} date${cartDates.size > 1 ? "s" : ""} · ★ ${newWishListDates.size} wish list`
    : cartDates.size > 0
    ? `${cartDates.size} date${cartDates.size > 1 ? "s" : ""} selected`
    : `★ ${newWishListDates.size} wish list date${newWishListDates.size > 1 ? "s" : ""}`;

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <NavBarDesktop
        onBack={isSelecting ? () => setIsSelecting(false) : undefined}
        host={currentHost}
        cohostNames={cohostNames}
        isFullCalendar={isSelecting}
        onMyBookings={() => { setBookingsFocusKey(null); setMyBookingsOpen((o) => !o); }}
        guestName={guestBookings.find((b) => b.guestName)?.guestName ?? guestName}
        guestStays={guestBookings.length}
      />
      {currentHost && !isSelecting && <HostProfileBanner host={currentHost} cohostNames={cohostNames} />}
      {rooms.length > 0 && (
        <RoomCards
          rooms={rooms}
          selectedRoomIds={selectedRoomIds}
          onToggleRoom={handleToggleRoom}
          onSelectAll={() => setSelectedRoomIds(null)}
          compact={isSelecting}
        />
      )}
      <CalendarNavigator
        currentMonth={currentMonth}
        onScrollToToday={() => setScrollToTodayTrigger((n) => n + 1)}
        onBookingRequest={() => openBookingModal(null)}
      />
      {isLoading ? (
        <div className="flex flex-col items-center justify-center flex-1">
          <p className="text-gray-400 text-sm">Loading...</p>
        </div>
      ) : currentHost ? (
        <div
          className="flex-1 min-h-0 flex flex-col"
          onPointerDown={(e) => { if (!(e.target as HTMLElement).closest("button")) setIsSelecting(true); }}
        >
          <GuestCalendar
            currentMonth={currentMonth}
            monthMap={monthMap}
            rooms={rooms}
            selectedRoomIds={selectedRoomIds}
            cartDates={cartDates}
            wishListDates={wishListDates}
            newWishListDates={newWishListDates}
            myBookingDates={myBookingDates}
            myStays={myStays}
            reservedMap={reservedMap}
            scrollToTodayTrigger={scrollToTodayTrigger}
            scrollToMonthTrigger={scrollToMonthTrigger ?? undefined}
            simplified={!isSelecting}
            onMonthChange={setCurrentMonth}
            onDateClick={toggleCartDate}
            onWishListClick={handleWishListClick}
            onMyStayClick={setStayPopupId}
          />
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center flex-1">
          <p className="text-gray-400 text-sm">No host selected</p>
        </div>
      )}

      {/* Floating bar — shown for cart dates, wish list dates, or both */}
      {hasSelection && (
        <div className={`fixed bottom-0 inset-x-0 ${theme.btn} px-4 py-3 flex items-center justify-between z-40 shadow-lg`}>
          <span className="text-white text-sm font-medium">{barLabel}</span>
          <button
            type="button"
            className={`bg-white ${theme.reviewText} text-sm font-semibold px-4 py-1.5 rounded-full ${theme.tileActive}`}
            onClick={() => openBookingModal(null)}
          >
            Review Request →
          </button>
        </div>
      )}

      {myBookingsOpen && currentHost && (
        <MyBookingsSheet
          hostId={currentHost.id}
          calendarId={currentHost.calendar}
          doorCode={currentHost.doorCode}
          airbnbAddress={currentHost.airbnbAddress}
          initialPhone={guestPhone}
          initialName={guestName}
          focusKey={bookingsFocusKey ?? undefined}
          rooms={rooms}
          wishListDates={wishListDates}
          onToggleWishDate={(date) => setWishListDates((prev) => { const next = new Set(prev); if (next.has(date)) next.delete(date); else next.add(date); return next; })}
          onClose={() => { setMyBookingsOpen(false); setBookingsFocusKey(null); }}
          onPhoneConfirmed={handlePhoneConfirmed}
          onClear={() => { setGuestPhone(""); setGuestName(""); setGuestBookings([]); setWishListDates(new Set()); setPersistedWishListDates(new Set()); setCartDates(new Map()); setSelectedRoomIds(null); localStorage.removeItem("tiBookGuestName"); }}
          cancellationFullRefundDays={currentHost.cancellationFullRefundDays}
          cancellationHalfRefundDays={currentHost.cancellationHalfRefundDays}
          houseRules={currentHost.houseRules}
        />
      )}

      {isBookingModalOpen && currentHost && (
        <BookingRequestModal
          hostId={currentHost.id}
          calendarId={currentHost.calendar}
          token={token as string}
          rooms={rooms}
          monthMap={monthMap}
          selectedDate={selectedDate}
          selectedRoomIds={selectedRoomIds}
          cartDates={cartDates}
          wishListDates={newWishListDates}
          allWishListDates={wishListDates}
          savedPhone={guestPhone}
          savedName={guestName}
          onClose={() => setIsBookingModalOpen(false)}
          onSuccess={() => setCartDates(new Map())}
          onRemoveCartRange={(keys) => setCartDates((prev) => { const next = new Map(prev); keys.forEach((k) => next.delete(k)); return next; })}
          cancellationFullRefundDays={currentHost.cancellationFullRefundDays}
          cancellationHalfRefundDays={currentHost.cancellationHalfRefundDays}
          houseRules={currentHost.houseRules}
          onRemoveWishDate={(date) => setWishListDates((prev) => { const next = new Set(prev); next.delete(date); return next; })}
          onWishListSent={(phone, name, newDates) => {
            localStorage.setItem("tiBookGuestPhone", phone);
            localStorage.setItem("tiBookGuestName", name);
            setGuestPhone(phone);
            setGuestName(name);
            const dates = new Set<string>(newDates);
            setWishListDates(dates);
            setPersistedWishListDates(new Set(dates));
          }}
        />
      )}

      {/* Tap a stay on the calendar → a light detail card for that stay */}
      {stayPopupId && currentHost && (() => {
        const b = guestBookings.find(
          (x) => `${String(x.date).slice(0, 10)}|${x.room}` === stayPopupId,
        );
        if (!b) return null;
        const room = rooms.find((r) => r.id === b.room);
        const checkIn = parseISO(String(b.date).slice(0, 10));
        return (
          <StayDetailPopup
            roomName={room?.name ?? ""}
            roomColor={room?.color}
            roomCode={room?.roomCode}
            checkIn={checkIn}
            checkOut={addDays(checkIn, b.duration)}
            nights={b.duration}
            guests={b.numberOfGuests}
            address={currentHost.airbnbAddress}
            doorCode={currentHost.doorCode}
            hostPhone={currentHost.phone}
            hostName={currentHost.name}
            onViewDetails={() => {
              setBookingsFocusKey(`${String(b.date).slice(0, 10)}${b.room}`);
              setStayPopupId(null);
              setMyBookingsOpen(true);
            }}
            onBookAnother={() => {
              setStayPopupId(null);
              setBookAnother({ checkIn, nights: b.duration });
            }}
            onClose={() => setStayPopupId(null)}
          />
        );
      })()}

      {/* Book another room for an existing stay's exact dates (e.g. parents) */}
      {bookAnother && (() => {
        const checkOut = addDays(bookAnother.checkIn, bookAnother.nights);
        const subtitle = `${format(bookAnother.checkIn, "MMM d")} → ${format(checkOut, "MMM d")} · ${bookAnother.nights} night${bookAnother.nights === 1 ? "" : "s"}`;
        return (
          <RoomPickerPopup
            date={bookAnother.checkIn}
            rooms={availableRoomsForRange(bookAnother.checkIn, bookAnother.nights)}
            title="Book another room"
            subtitle={subtitle}
            onPick={(roomId) => startRangeSelection(bookAnother.checkIn, bookAnother.nights, roomId)}
            onAny={() => startRangeSelection(bookAnother.checkIn, bookAnother.nights, null)}
            onClose={() => setBookAnother(null)}
          />
        );
      })()}

      {/* Tap an open date → pick the exact room right away (1-left names it) */}
      {roomPickerDate && (
        <RoomPickerPopup
          date={roomPickerDate}
          rooms={availableRoomsForDate(roomPickerDate)}
          onPick={(roomId) => addCartDateForRoom(roomPickerDate, roomId)}
          onAny={() => addCartDateAny(roomPickerDate)}
          onClose={() => setRoomPickerDate(null)}
        />
      )}
    </div>
  );
};

const TiBook = () => (
  <TiBookThemeProvider>
    <TiBookInner />
  </TiBookThemeProvider>
);

export default TiBook;