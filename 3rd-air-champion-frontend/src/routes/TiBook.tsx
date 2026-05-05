import { useEffect, useMemo, useState } from "react";
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
import { toZonedTime } from "date-fns-tz";
import { fetchRooms } from "../util/roomOperations";
import BookingRequestModal from "../components/tibook/BookingRequestModal";
import RoomCards from "../components/tibook/RoomCards";
import WishListSummarySheet from "../components/tibook/WishListSummarySheet";
import { getGuestWishList } from "../util/wishListOperations";

const TiBookInner = () => {
  const { theme } = useTiBookTheme();
  useEffect(() => { document.title = "TiBook"; }, []);

  const [token, setToken] = useState<string | null>(
    localStorage.getItem("tiBookToken") ?? null,
  );
  const [currentHost, setCurrentHost] = useState<hostType | null>(null);
  const [rooms, setRooms] = useState<roomType[]>([]);
  const [days, setDays] = useState<dayType[]>([]);
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [scrollToTodayTrigger, setScrollToTodayTrigger] = useState(0);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedRoomIds, setSelectedRoomIds] = useState<Set<string> | null>(null);
  const [cartDates, setCartDates] = useState<Map<string, string | null>>(new Map());
  const [isSelecting, setIsSelecting] = useState(false);
  const [wishListDates, setWishListDates] = useState<Set<string>>(new Set());
  const [wishListSummaryOpen, setWishListSummaryOpen] = useState(false);
  const [guestPhone, setGuestPhone] = useState(() => localStorage.getItem("tiBookGuestPhone") ?? "");
  const [guestName, setGuestName] = useState(() => localStorage.getItem("tiBookGuestName") ?? "");
  const cohostNames = (import.meta.env.VITE_TI_BOOK_COHOST_NAMES as string | undefined)?.split(',').map((s) => s.trim()).filter(Boolean) ?? [];

  const handleToggleRoom = (id: string) => {
    setSelectedRoomIds((prev) => {
      const next = new Set(prev ?? []);
      if (next.has(id)) {
        next.delete(id);
        return next.size === 0 ? null : next;
      }
      next.add(id);
      return next;
    });
  };

  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const monthMap = useMemo(() => {
    const map = new Map<string, dayType>();
    days.forEach((day) => {
      const key = toZonedTime(day.date, timeZone).toISOString().split("T")[0];
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
      if (token) {
        setToken(token);
        localStorage.setItem("tiBookToken", token);
      }
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
        return Promise.all([
          fetchRooms(hostId, token),
          fetchDays(host?.calendar as string, token),
        ]);
      })
      .then(([rooms, days]) => {
        setRooms(rooms);
        setDays(days);
      })
      .finally(() => setIsLoading(false));
  }, [token]);

  useEffect(() => {
    if (cartDates.size === 0) setIsSelecting(false);
  }, [cartDates.size]);

  const toggleCartDate = (date: Date) => {
    setIsSelecting(true);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    let roomId: string | null = selectedRoomIds?.size === 1 ? Array.from(selectedRoomIds)[0] : null;

    if (roomId === null) {
      const scopedRooms = rooms.filter((r) => r.active && (selectedRoomIds === null || selectedRoomIds.has(r.id)));
      const day = monthMap.get(key);
      if (day) {
        const bookedIds = new Set(day.bookings.map((b) => b.room?.id).filter(Boolean));
        const available = scopedRooms.filter((r) => !bookedIds.has(r.id));
        if (available.length === 1) roomId = available[0].id;
      }
    }

    setCartDates((prev) => {
      const next = new Map(prev);
      if (next.has(key)) next.delete(key);
      else next.set(key, roomId);
      return next;
    });
  };

  // Load wish list when guest phone is already known and host is ready
  useEffect(() => {
    if (!guestPhone || !currentHost) return;
    getGuestWishList(currentHost.id, guestPhone)
      .then((result) => setWishListDates(new Set(result.dates)))
      .catch(() => {});
  }, [guestPhone, currentHost]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleWishListClick = (date: Date) => {
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    setWishListDates((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleSendSuccess = (phone: string, name: string, newDates: string[]) => {
    localStorage.setItem("tiBookGuestPhone", phone);
    localStorage.setItem("tiBookGuestName", name);
    setGuestPhone(phone);
    setGuestName(name);
    setWishListDates(new Set(newDates));
    setWishListSummaryOpen(false);
  };

  const findFirstAvailableDate = (month: Date): Date => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    for (let d = 1; d <= daysInMonth; d++) {
      const candidate = new Date(month.getFullYear(), month.getMonth(), d);
      if (candidate < today) continue;
      const key = candidate.toISOString().split("T")[0];
      const day = monthMap.get(key);
      if (!day || (!day.isBlocked && day.bookings.length === 0)) return candidate;
    }
    return new Date(month.getFullYear(), month.getMonth(), 1);
  };

  const openBookingModal = (date: Date | null) => {
    setSelectedDate(date ?? findFirstAvailableDate(currentMonth));
    setIsBookingModalOpen(true);
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <NavBarDesktop onBack={isSelecting ? () => { setIsSelecting(false); setCartDates(new Map()); } : undefined} />
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
        <div className="flex-1 min-h-0 flex flex-col" onPointerDown={() => setIsSelecting(true)}>
          <GuestCalendar
            currentMonth={currentMonth}
            monthMap={monthMap}
            rooms={rooms}
            selectedRoomIds={selectedRoomIds}
            cartDates={cartDates}
            wishListDates={wishListDates}
            scrollToTodayTrigger={scrollToTodayTrigger}
            simplified={!isSelecting}
            onMonthChange={setCurrentMonth}
            onDateClick={toggleCartDate}
            onWishListClick={handleWishListClick}
          />
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center flex-1">
          <p className="text-gray-400 text-sm">No host selected</p>
        </div>
      )}

      {/* Floating wish list summary bar */}
      {wishListDates.size > 0 && !wishListSummaryOpen && (
        <div className="fixed bottom-0 inset-x-0 z-30 flex justify-center pointer-events-none" style={{ bottom: cartDates.size > 0 ? "56px" : "0" }}>
          <button
            type="button"
            onClick={() => setWishListSummaryOpen(true)}
            className="pointer-events-auto mb-3 bg-white border border-amber-300 shadow-md text-amber-700 text-sm font-semibold px-4 py-2 rounded-full flex items-center gap-2"
          >
            <span>★</span>
            <span>{wishListDates.size} date{wishListDates.size !== 1 ? "s" : ""} saved</span>
            <span className="text-amber-400">→ View</span>
          </button>
        </div>
      )}

      {/* Floating cart bar */}
      {cartDates.size > 0 && (
        <div className={`fixed bottom-0 inset-x-0 ${theme.btn} px-4 py-3 flex items-center justify-between z-40 shadow-lg`}>
          <span className="text-white text-sm font-medium">
            {cartDates.size} date{cartDates.size > 1 ? "s" : ""} selected
          </span>
          <button
            type="button"
            className={`bg-white ${theme.reviewText} text-sm font-semibold px-4 py-1.5 rounded-full ${theme.tileActive}`}
            onClick={() => openBookingModal(null)}
          >
            Review Request →
          </button>
        </div>
      )}

      {wishListSummaryOpen && currentHost && (
        <WishListSummarySheet
          hostId={currentHost.id}
          wishListDates={wishListDates}
          guestPhone={guestPhone}
          guestName={guestName}
          onClose={() => setWishListSummaryOpen(false)}
          onToggleDate={(date) => setWishListDates((prev) => { const next = new Set(prev); if (next.has(date)) next.delete(date); else next.add(date); return next; })}
          onSendSuccess={handleSendSuccess}
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
          onClose={() => setIsBookingModalOpen(false)}
          onSuccess={() => setCartDates(new Map())}
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