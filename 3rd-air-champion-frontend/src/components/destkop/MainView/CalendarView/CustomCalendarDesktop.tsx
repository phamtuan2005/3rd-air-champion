import { useEffect, useMemo, useState } from "react";
import { format, isSameDay } from "date-fns";
import { dayType } from "../../../../util/types/dayType";
import { bookingType } from "../../../../util/types/bookingType";
import { roomType } from "../../../../util/types/roomType";
import { toZonedTime } from "date-fns-tz";
import CalendarGrid from "../../../shared/CalendarGrid";
import CleanerAvatar from "../../../shared/CleanerAvatar";
import { getRoomColor } from "../../../../util/getRoomColor";
import { CleanerType } from "../../../../util/cleanerOperations";

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
  reservedMode?: boolean;
  // Clean mode: label each stay with the cleaner who turns the room over after it
  cleanMode?: boolean;
  cleanerByRoomMorning?: Map<string, CleanerType>;
  onCleanDayClick?: (date: Date) => void;
  onTodayInViewChange?: (inView: boolean) => void;
  rowsPerPage?: number;
  rowHeight?: number;
  onRowHeightChange?: (n: number) => void;
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
  reservedMode = false,
  cleanMode = false,
  cleanerByRoomMorning,
  onCleanDayClick,
  onTodayInViewChange,
  rowsPerPage,
  rowHeight,
  onRowHeightChange,
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
    // In Clean mode the tap answers the cleaning question, not the billing one —
    // the guest panel belongs to the Guest view.
    if (cleanMode && onCleanDayClick) {
      onCleanDayClick(date);
      return;
    }
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

  // Whoever prepared this room for this guest: assignments are dated by the
  // cleaning morning, which at near-full occupancy is the guest's arrival day.
  const cleanerFor = (booking: bookingType) => {
    const room = booking.room?.id;
    if (!room || !booking.startDate) return undefined;
    return cleanerByRoomMorning?.get(`${room}|${booking.startDate.split("T")[0]}`);
  };

  // Avatar inside the bar, so a cleaner is recognisable before the name is read
  // — the bars are narrow and a first name truncates on short stays.
  const resolveBarIcon = (booking: bookingType) => {
    if (!cleanMode) return null;
    const c = cleanerFor(booking);
    if (!c) return null;
    return (
      <CleanerAvatar
        name={c.name}
        photo={c.photo}
        character={c.character}
        sizeClass="h-4 w-4"
        textClass="text-[8px]"
      />
    );
  };

  // A cleaning into an EMPTY room: the turnover happened, but no guest arrived
  // to give it a bar. Without this the calendar silently dropped those, and
  // disagreed with the Plan tab about who worked that morning.
  const renderEmptyCell = (room: roomType, date: Date) => {
    if (!cleanMode) return null;
    const c = cleanerByRoomMorning?.get(`${room.id}|${format(date, "yyyy-MM-dd")}`);
    if (!c) return null;
    return (
      <span
        className="absolute inset-y-[1px] left-[20%] right-[-20%] flex items-center gap-0.5 overflow-hidden rounded-lg border border-dashed border-gray-500 pl-1 text-[0.8rem] font-bold text-black"
        title={`${c.name} cleaned ${room.name} — room stayed empty`}
      >
        {/* The room's own colour, faded, behind the label — the room stays
            identifiable at a glance, while the wash plus the dashed edge still
            reads as "cleaned, nobody in it" rather than an occupied night. */}
        <span className={`${getRoomColor(room.name, room.color)} absolute inset-0 opacity-40`} />
        <CleanerAvatar
          name={c.name}
          photo={c.photo}
          character={c.character}
          sizeClass="h-4 w-4"
          textClass="text-[8px]"
        />
        <span className="relative truncate">{c.name.trim().split(" ")[0]}</span>
      </span>
    );
  };

  const resolveBarLabel = (booking: bookingType) => {
    // Clean mode: same bars, same geometry — the label becomes the cleaner who
    // prepared this room for this guest, looked up on the stay's START date.
    //
    // The label is drawn once per stay, at its start, so it has to describe the
    // day the bar begins. Keying it to the checkout instead named whoever cleans
    // when the stay ENDS — days later, and nothing to do with the day you are
    // looking at, which is why the calendar disagreed with the Plan tab.
    //
    // At near-full occupancy a turnover is same-day: the outgoing guest's last
    // night is D-1, the cleaning is dated D, and the new guest arrives on D.
    if (cleanMode) {
      const cleaner = cleanerFor(booking);
      // "·" rather than blank for an unassigned turnover, so a hole in the
      // cleaning plan reads as a hole instead of missing data.
      return cleaner ? cleaner.name.trim().split(" ")[0] : "·";
    }
    if (booking.guest?.name === "AirBnB" && booking.alias) return `${booking.alias} (A)`;
    // (R) trails again, now that the amber hatch carries the meaning.
    //
    // It led while the text was the ONLY signal, so it had to survive a bar too
    // narrow for the whole label. The hatched banner is now visible whether or
    // not the label fits, which frees the name to start where the eye lands.
    if (currentGuest)
      return booking.reserved ? `${booking.room?.name ?? ""} (R)` : (booking.room?.name ?? "");
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
      resolveBarIcon={resolveBarIcon}
      renderEmptyCell={renderEmptyCell}
      gapsMode={gapsMode}
      // Muting rather than hiding: a held night means nothing without the stays
      // around it. Hiding the paid bookings would leave holds floating in what
      // looks like an empty month and invite double-booking the gap.
      dimBooking={reservedMode ? (b) => !b.reserved : undefined}
      onTodayInViewChange={onTodayInViewChange}
      rowsPerPage={rowsPerPage}
      rowHeight={rowHeight}
      onRowHeightChange={onRowHeightChange}
    />
  );
};

export default CustomCalendar;