import { useEffect, useMemo, useState } from "react";
import { isSameDay } from "date-fns";
import { dayType } from "../../../../util/types/dayType";
import { bookingType } from "../../../../util/types/bookingType";
import { roomType } from "../../../../util/types/roomType";
import { toZonedTime } from "date-fns-tz";
import CalendarGrid from "../../../shared/CalendarGrid";

interface CustomCalendarProps {
  currentMonth: Date;
  currentAirBnBGuest: string | null;
  currentGuest: string | null;
  monthMap: Map<string, dayType>;
  paidDates: Date[];
  rooms: roomType[];
  selectedRoomName: string | null;
  setCurrentBookings: React.Dispatch<
    React.SetStateAction<bookingType[] | null | undefined>
  >;
  scrollToTodayTrigger: number;
  setCurrentMonth: React.Dispatch<React.SetStateAction<Date>>;
  setIsMobileModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setPaidDates: React.Dispatch<React.SetStateAction<Date[]>>;
  setSelectedDate: React.Dispatch<React.SetStateAction<Date>>;
  // Guest mode: soft-hold dates selected for batch confirm-to-firm
  holdDates: Date[];
  setHoldDates: React.Dispatch<React.SetStateAction<Date[]>>;
  gapsMode?: boolean;
  onTodayInViewChange?: (inView: boolean) => void;
}

const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

const CustomCalendar = ({
  currentMonth,
  currentAirBnBGuest,
  currentGuest,
  monthMap,
  paidDates,
  rooms,
  selectedRoomName,
  setCurrentBookings,
  scrollToTodayTrigger,
  setCurrentMonth,
  setIsMobileModalOpen,
  setPaidDates,
  setSelectedDate,
  holdDates,
  setHoldDates,
  gapsMode = false,
  onTodayInViewChange,
}: CustomCalendarProps) => {
  const [useMonthMap, setUseMonthMap] = useState<Map<string, dayType>>(monthMap);

  // Rooms visible in guest mode: only rooms that had bookings for this guest
  const overrideRooms = useMemo(() => {
    if (!currentGuest && !currentAirBnBGuest) return undefined;
    const roomMap = new Map<string, roomType>();
    const monthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const monthEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
    monthMap.forEach((dayEntry, dateStr) => {
      const date = toZonedTime(dateStr, timeZone);
      if (date < monthStart || date > monthEnd) return;
      dayEntry.bookings.forEach((booking) => {
        const matchesGuest = currentGuest
          ? booking.guest?.id == currentGuest
          : booking.alias === currentAirBnBGuest;
        if (matchesGuest && booking.room && (!selectedRoomName || booking.room.name === selectedRoomName)) {
          roomMap.set(booking.room.name, booking.room);
        }
      });
    });
    return [...roomMap.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [currentGuest, currentAirBnBGuest, monthMap, currentMonth, selectedRoomName]);

  // Filter monthMap to only this guest's bookings
  useEffect(() => {
    if (currentGuest && !currentAirBnBGuest && useMonthMap.size > 0) {
      const filteredMap = new Map<string, dayType>();
      const newPaidDates: Date[] = [];
      monthMap.forEach((dayEntry, date) => {
        const guestBookings = dayEntry.bookings.filter(
          (booking) => booking.guest.id == currentGuest,
        );
        if (guestBookings.length > 0) {
          filteredMap.set(date, { ...dayEntry, bookings: guestBookings });
        }
      });
      setPaidDates(newPaidDates);
      setUseMonthMap(filteredMap);
    } else if (currentAirBnBGuest && useMonthMap.size > 0) {
      const filteredMap = new Map<string, dayType>();
      monthMap.forEach((dayEntry, date) => {
        const airbnbBookings = dayEntry.bookings.filter(
          (booking) => booking.alias === currentAirBnBGuest,
        );
        if (airbnbBookings.length > 0) {
          filteredMap.set(date, { ...dayEntry, bookings: airbnbBookings });
        }
        setUseMonthMap(filteredMap);
      });
    } else {
      setUseMonthMap(monthMap);
    }
  }, [currentGuest, currentAirBnBGuest, monthMap]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset modal / paid dates / hold selection when guest filter changes
  useEffect(() => {
    setIsMobileModalOpen(false);
    setHoldDates([]);
    if (!currentGuest && !currentAirBnBGuest) setPaidDates([]);
  }, [currentGuest, currentAirBnBGuest]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
    setIsMobileModalOpen(true);
    const dateKey = date.toISOString().split("T")[0];
    const day = useMonthMap.get(dateKey);
    setCurrentBookings(day?.bookings ?? null);
  };

  const handleDoubleClick = (date: Date) => {
    if (currentGuest) {
      const bookedDate = useMonthMap.get(date.toISOString().split("T")[0]);
      if (!bookedDate) return;
      // Soft-hold night → toggle it in the confirm-to-firm selection (amber ring).
      const reservedBooking = bookedDate.bookings.find((b) => b.reserved);
      if (reservedBooking) {
        setHoldDates((prev) =>
          prev.some((hd) => isSameDay(hd, date))
            ? prev.filter((hd) => !isSameDay(hd, date))
            : [...prev, date],
        );
        return;
      }
      const booking = bookedDate.bookings.find((b) => !b.reserved);
      if (!booking) return;
      // Firm night → cycle: paid (red) → downgrade-selected (amber) → clear.
      // Marking paid stays a single double-tap, so the billing flow is unchanged.
      const isPaid = paidDates.some((pd) => isSameDay(pd, date));
      const isHeld = holdDates.some((hd) => isSameDay(hd, date));
      if (!isPaid && !isHeld) {
        setPaidDates([...paidDates, date]);
      } else if (isPaid) {
        setPaidDates(paidDates.filter((pd) => !isSameDay(pd, date)));
        setHoldDates((prev) => [...prev, date]);
      } else {
        setHoldDates((prev) => prev.filter((hd) => !isSameDay(hd, date)));
      }
    }
  };

  const resolveBarLabel = (booking: bookingType) => {
    if (booking.guest?.name === "AirBnB" && booking.alias) return `${booking.alias} (A)`;
    if (currentGuest) return booking.reserved ? `${booking.room?.name ?? ""} (R)` : (booking.room?.name ?? "");
    if (booking.reserved) return `${booking.guest.name} (R)`;
    return booking.guest?.name ?? "";
  };

  return (
    <CalendarGrid
      currentMonth={currentMonth}
      monthMap={useMonthMap}
      rooms={rooms}
      selectedRoomName={selectedRoomName}
      scrollToTodayTrigger={scrollToTodayTrigger}
      monthsBack={24}
      paidDates={paidDates}
      holdDates={holdDates}
      overrideRooms={overrideRooms}
      onMonthChange={setCurrentMonth}
      onDateClick={handleDateClick}
      onDoubleClick={handleDoubleClick}
      resolveBarLabel={resolveBarLabel}
      gapsMode={gapsMode}
      onTodayInViewChange={onTodayInViewChange}
    />
  );
};

export default CustomCalendar;