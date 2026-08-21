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
import ReservedHoldsPopup from "../components/tibook/ReservedHoldsPopup";
import { getGuestWishList } from "../util/wishListOperations";
import { fetchBookingRequestsByHost, fetchCalendarBookingsByGuest } from "../util/bookingRequestOperations";
import { fetchGuestByPhone } from "../util/guestOperations";

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
  // The calendar is a draggable panel: dragOffset is how far (px) it has been
  // pulled up over the banner + room filter (0 = browse, headerH = full window).
  // "Selecting" (interactive calendar) is derived — any real expansion counts.
  const [dragOffset, setDragOffset] = useState(0);
  const [headerH, setHeaderH] = useState(0);
  const [dragging, setDragging] = useState(false);
  const headerRef = useRef<HTMLDivElement>(null);
  const gripRef = useRef<{ y: number; start: number } | null>(null);
  const isSelecting = dragOffset > 24;
  const expandCal = () => setDragOffset(headerRef.current?.offsetHeight ?? headerH);
  const collapseCal = () => setDragOffset(0);
  const [wishListDates, setWishListDates] = useState<Set<string>>(new Set());
  const [persistedWishListDates, setPersistedWishListDates] = useState<Set<string>>(new Set());
  const [guestPhone, setGuestPhone] = useState(() => localStorage.getItem("tiBookGuestPhone") ?? "");
  const [guestName, setGuestName] = useState(() => localStorage.getItem("tiBookGuestName") ?? "");
  const [guestBookings, setGuestBookings] = useState<GuestBooking[]>([]);
  // A guest we already recognise by name has seen the rooms — the photo banner
  // is a first-visit pitch, and on their return it is just height taken from the
  // calendar they came for. Opened by hand with "Photos ▾"; not persisted, so
  // every visit starts on the calendar.
  // Open by default now, for everyone. It used to start shut for a returning
  // guest, on the reasoning that they had already seen the rooms — but the
  // cards carry THEIR agreed rate now, which is the one thing on this screen a
  // returning guest cannot get anywhere else. The introduction above collapses
  // for them instead; the height goes to what is new, not to what they know.
  // Still theirs to shut with "Photos ▾".
  const [roomsExpanded, setRoomsExpanded] = useState(true);
  const [reservedMap, setReservedMap] = useState<Map<string, Set<string>>>(new Map());
  const [myBookingsOpen, setMyBookingsOpen] = useState(false);
  const [bookingsFocusKey, setBookingsFocusKey] = useState<string | null>(null);
  const [stayPopupId, setStayPopupId] = useState<string | null>(null);
  const [reservedPopupOpen, setReservedPopupOpen] = useState(false);
  const reservedAutoShownRef = useRef<string | null>(null);
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

  // Measure the header stack (banner + room filter) so the calendar can slide
  // up over exactly its height and stop at full window. Keep a fully-open panel
  // pinned open if the header height changes (e.g. banner image loads).
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const measure = () => {
      const nh = el.offsetHeight;
      setHeaderH((prev) => {
        setDragOffset((off) => (prev > 0 && off >= prev - 2 ? nh : Math.min(off, nh)));
        return nh;
      });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [currentHost, rooms.length]);

  const onGripDown = (e: React.PointerEvent) => {
    gripRef.current = { y: e.clientY, start: dragOffset };
    setDragging(true);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onGripMove = (e: React.PointerEvent) => {
    const g = gripRef.current;
    if (!g) return;
    const dy = g.y - e.clientY; // drag up => positive => expand
    setDragOffset(Math.max(0, Math.min(headerH, g.start + dy)));
  };
  const onGripUp = () => {
    gripRef.current = null;
    setDragging(false);
  };

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

  // Reserved (R) holds — rooms the host is holding for this guest that aren't paid
  // yet. NOT drawn as confirmed stays (myStays filters "confirmed"); surfaced only
  // in a gentle "please pay or it may be released" popup. Upcoming holds only.
  const reservedStays = useMemo(
    () =>
      guestBookings
        .filter((b) => b.status === "reserved")
        .map((b) => {
          const room = rooms.find((r) => r.id === b.room);
          const startKey = String(b.date).slice(0, 10);
          const checkIn = parseISO(startKey);
          return {
            id: `${startKey}|${b.room}`,
            startKey,
            roomName: room?.name ?? "Room",
            roomColor: room?.color,
            checkIn,
            checkOut: addDays(checkIn, b.duration),
            nights: b.duration,
          };
        })
        .filter((h) => h.checkOut > startOfToday()),
    [guestBookings, rooms],
  );

  // Auto-open the holds popup ONCE per session per unique set of holds (so it
  // nudges without nagging on every navigation; a new hold re-triggers it). The
  // amber banner stays available to reopen it anytime.
  useEffect(() => {
    if (reservedStays.length === 0) return;
    const sig = reservedStays
      .map((s) => `${s.roomName}|${format(s.checkIn, "yyyy-MM-dd")}`)
      .sort()
      .join(",");
    if (reservedAutoShownRef.current === sig || sessionStorage.getItem("tiBookReservedSeen") === sig)
      return;
    reservedAutoShownRef.current = sig;
    sessionStorage.setItem("tiBookReservedSeen", sig);
    setReservedPopupOpen(true);
  }, [reservedStays]);

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

  // Commit a date to the cart for a specific room. The choice is PER DATE only —
  // it must NOT lock the global room filter, or every other date would be forced
  // into this same room. Each new date re-asks so the guest can mix rooms.
  const addCartDateForRoom = (date: Date, roomId: string) => {
    expandCal();
    setScrollToMonthTrigger({ month: new Date(date.getFullYear(), date.getMonth(), 1), seq: Date.now() });
    setCartDates((prev) => new Map(prev).set(keyOfDate(date), roomId));
    setRoomPickerDate(null);
  };

  // Flexible guest: no room preference (null) — the host assigns any free room.
  // The filter is left untouched so the rest of the stay can also be added "any".
  const addCartDateAny = (date: Date) => {
    expandCal();
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
    expandCal();
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
    expandCal();
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
    expandCal();
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

  // The same name the nav bar greets them by. Tying the two together means the
  // banner can only shrink on a screen that already says who the guest is —
  // a stranger is never quietly dropped into the reduced view.
  const greetedName = guestBookings.find((b) => b.guestName)?.guestName ?? guestName;
  const isReturningGuest = !!greetedName.trim();
  // Somebody this browser has booked with before. Deliberately the PHONE, not
  // the name: the phone is what is saved first and what every lookup keys on,
  // and a guest whose name never came back is still not a stranger.
  const isKnownVisitor = isReturningGuest || !!guestPhone.trim();

  // What THIS guest pays, not what the room lists at.
  //
  // A returning guest on an agreed rate could only see it several taps into a
  // booking request, so the room cards quoted them a price that was not theirs.
  // Asking "what's my rate?" should not require starting a booking.
  const [myRates, setMyRates] = useState<Map<string, number>>(new Map());
  useEffect(() => {
    if (!guestPhone || !currentHost) {
      setMyRates(new Map());
      return;
    }
    fetchGuestByPhone(guestPhone, currentHost.id)
      .then((guest) => {
        const next = new Map<string, number>();
        (guest?.pricing ?? []).forEach((p: { room: string; price: number }) => {
          if (typeof p.price === "number") next.set(p.room, p.price);
        });
        setMyRates(next);
      })
      // A rate we cannot fetch is simply not shown. The room's own price is
      // still there, and a wrong price is far worse than a missing one.
      .catch(() => setMyRates(new Map()));
  }, [guestPhone, currentHost]);

  // DYNAMIC viewport height. Plain 100vh (h-screen) is the height the page would
  // have with the browser chrome hidden, so on an iPhone the layout is taller
  // than the screen actually showing it — the header stack fills what you can
  // see and the calendar sits below the fold, looking like it never rendered.
  // 100dvh tracks the visible height; h-screen stays as the fallback for
  // anything without dvh. Same fix TiMag's root already carries.
  return (
    <div className="flex h-screen flex-col overflow-hidden supports-[height:100dvh]:h-[100dvh]">
      <NavBarDesktop
        onBack={isSelecting ? collapseCal : undefined}
        host={currentHost}
        cohostNames={cohostNames}
        isFullCalendar={isSelecting}
        onMyBookings={() => { setBookingsFocusKey(null); setMyBookingsOpen((o) => !o); }}
        guestName={greetedName}
        guestStays={guestBookings.filter((b) => b.status === "confirmed").length}
      />
      {/* Scrolls when it has to.
          The column was overflow-hidden at a fixed viewport height, which only
          works if you assume the screen is tall enough for the header stack AND
          a usable calendar. On a short phone the calendar was squeezed to a
          sliver with no way to reach it — the layout had decided the device was
          wrong. Now the calendar keeps a floor (below) and this container
          scrolls if the sum no longer fits. On a normal phone nothing overflows,
          so nothing scrolls and the behaviour is exactly as before. */}
      <div className="relative flex flex-1 min-h-0 flex-col overflow-y-auto">
        {/* Header stack — host banner + room filter. The calendar panel slides up
            over these as the grip is dragged, until it fills the window. */}
        <div ref={headerRef} className="shrink-0">
          {currentHost && (
            <HostProfileBanner
              host={currentHost}
              cohostNames={cohostNames}
              defaultExpanded={!isKnownVisitor}
            />
          )}
          {rooms.length > 0 && (
            <RoomCards
              rooms={rooms}
              selectedRoomIds={selectedRoomIds}
              onToggleRoom={handleToggleRoom}
              onSelectAll={() => setSelectedRoomIds(null)}
              myRates={myRates}
              compact={isReturningGuest && !roomsExpanded}
              onToggleCompact={isReturningGuest ? () => setRoomsExpanded((o) => !o) : undefined}
            />
          )}
        </div>

        {isLoading ? (
          <div className="flex flex-1 flex-col items-center justify-center">
            <p className="text-gray-400 text-sm">Loading...</p>
          </div>
        ) : currentHost ? (
          <div
            className="relative z-10 flex flex-1 min-h-0 flex-col bg-white"
            style={{
              marginTop: -dragOffset,
              transition: dragging ? "none" : "margin-top 0.25s ease",
            }}
          >
            {/* Drag grip — pull up to grow the calendar over the banner & rooms
                (all the way to full window), pull down to bring them back. */}
            <div
              className="flex shrink-0 cursor-ns-resize touch-none select-none items-center justify-center pb-1 pt-1.5"
              onPointerDown={onGripDown}
              onPointerMove={onGripMove}
              onPointerUp={onGripUp}
            >
              <span className="h-1.5 w-10 rounded-full bg-gray-300" />
            </div>
            {/* Reduced room filter — kept visible once the calendar covers the
                full room banner, so the guest can still scope rooms at full size. */}
            {rooms.length > 0 && isSelecting && (
              <RoomCards
                rooms={rooms}
                selectedRoomIds={selectedRoomIds}
                onToggleRoom={handleToggleRoom}
                onSelectAll={() => setSelectedRoomIds(null)}
                compact
              />
            )}
            <CalendarNavigator
              currentMonth={currentMonth}
              onScrollToToday={() => setScrollToTodayTrigger((n) => n + 1)}
              onBookingRequest={() => openBookingModal(null)}
            />
            {/* Gentle reminder that room(s) are being held pending payment */}
            {reservedStays.length > 0 && !isSelecting && (
              <button
                type="button"
                onClick={() => setReservedPopupOpen(true)}
                className="flex shrink-0 items-center justify-center gap-1.5 border-y border-amber-200 bg-amber-50 px-4 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-100"
              >
                ⏳ {reservedStays.length} room{reservedStays.length === 1 ? "" : "s"} held for you — tap to review &amp; pay
              </button>
            )}
            {/* The floor. Six week-rows at a tappable height: below this the
                grid stops being a calendar, so instead of shrinking further it
                keeps this height and the column above scrolls to reach it. */}
            <div className="flex min-h-[17rem] flex-1 flex-col">
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
                reservedStays={reservedStays}
                reservedMap={reservedMap}
                scrollToTodayTrigger={scrollToTodayTrigger}
                scrollToMonthTrigger={scrollToMonthTrigger ?? undefined}
                simplified={!isSelecting}
                onMonthChange={setCurrentMonth}
                onDateClick={toggleCartDate}
                onWishListClick={handleWishListClick}
                onMyStayClick={setStayPopupId}
                onReservedClick={() => setReservedPopupOpen(true)}
              />
            </div>
          </div>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center">
            <p className="text-gray-400 text-sm">No host selected</p>
          </div>
        )}
      </div>

      {/* Selection bar — shown for cart dates, wish list dates, or both.
          A ROW of the column, not a fixed overlay. Fixed, it sat on top of the
          calendar and hid the last week or two — and on a short phone those are
          exactly the nights being picked, so the bar covered the thing it was
          reporting on. As a row it takes its own height and the calendar keeps
          the rest.
          Same type step as the request modal it opens, so the last thing read
          before that modal is not smaller than what follows. */}
      {hasSelection && (
        <div className={`tibook-type tibook-type-lg shrink-0 ${theme.btn} px-4 py-2.5 flex items-center justify-between gap-3 z-40 shadow-lg`}>
          <span className="min-w-0 text-white text-sm font-medium">{barLabel}</span>
          <button
            type="button"
            className={`shrink-0 whitespace-nowrap bg-white ${theme.reviewText} text-sm font-semibold px-4 py-1.5 rounded-full ${theme.tileActive}`}
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
          isReturningGuest={isReturningGuest}
          onClose={() => setIsBookingModalOpen(false)}
          onSuccess={() => setCartDates(new Map())}
          onRemoveCartRange={(keys) => setCartDates((prev) => { const next = new Map(prev); keys.forEach((k) => next.delete(k)); return next; })}
          onAddCartDates={(keys) =>
            // Typed dates land in the cart as "any room", the same as the
            // already-building-an-any-room-stay path in toggleCartDate. A guest
            // listing seven scattered nights is not choosing a room per night;
            // the host assigns them.
            setCartDates((prev) => {
              const next = new Map(prev);
              keys.forEach((k) => {
                if (!next.has(k)) next.set(k, null);
              });
              return next;
            })
          }
          roomsFreeOn={(key) => availableRoomsForDate(new Date(key + "T00:00:00")).length}
          myBookedDates={myBookingDates}
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

      {/* Rooms held for the guest, pending payment — gentle nudge to pay */}
      {reservedPopupOpen && reservedStays.length > 0 && (
        <ReservedHoldsPopup
          holds={reservedStays}
          hostName={currentHost?.name}
          hostPhone={currentHost?.phone}
          onClose={() => setReservedPopupOpen(false)}
        />
      )}

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