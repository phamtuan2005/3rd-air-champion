import { useEffect, useRef, useState } from "react";
import Calendar from "react-calendar";
import "../../../../styles/calendarStyle.css";
import {
  addDays,
  endOfMonth,
  getDay,
  isSameDay,
  isSameMonth,
  isWithinInterval,
  startOfToday,
} from "date-fns";
import { dayType } from "../../../../util/types/dayType";
import { bookingType } from "../../../../util/types/bookingType";
import { roomType } from "../../../../util/types/roomType";
import { toZonedTime } from "date-fns-tz";
import { useDoubleClick } from "../../../../util/useDoubleClick";
import { getRoomColor } from "../../../../util/getRoomColor";

interface CustomCalendarProps {
  currentMonth: Date;
  currentAirBnBGuest: string | null;
  currentGuest: string | null;
  monthMap: Map<string, dayType>;
  paidDates: Date[];
  rooms: roomType[];
  setCurrentBookings: React.Dispatch<
    React.SetStateAction<bookingType[] | null | undefined>
  >;
  setCurrentMonth: React.Dispatch<React.SetStateAction<Date>>;
  setIsMobileModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setPaidDates: React.Dispatch<React.SetStateAction<Date[]>>;
  setSelectedDate: React.Dispatch<React.SetStateAction<Date>>;
}

const CustomCalendar = ({
  currentMonth,
  currentAirBnBGuest,
  currentGuest,
  monthMap,
  paidDates,
  rooms,
  setCurrentBookings,
  setCurrentMonth,
  setIsMobileModalOpen,
  setPaidDates,
  setSelectedDate,
}: CustomCalendarProps) => {
  const [months, setMonths] = useState<Date[]>([]);
  const [tileWidth, setTileWidth] = useState<number | null>(null);
  const [useMonthMap, setUseMonthMap] =
    useState<Map<string, dayType>>(monthMap);
  const [maxRooms, setMaxRooms] = useState<number>(rooms.length);
  const [usedRooms, setUsedRooms] = useState<roomType[]>(rooms);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const calendarWrapperRef = useRef<HTMLDivElement>(null); // Wrapper div ref

  useEffect(() => {
    const currentMonth = new Date();
    const monthsArray = [];
    for (let i = -24; i <= 36; i++) {
      // 2 years back, 3 years ahead
      const month = new Date(
        currentMonth.getFullYear(),
        currentMonth.getMonth() + i,
        1,
      );
      monthsArray.push(month);
    }

    setMonths(monthsArray);
  }, []);

  useEffect(() => {
    if (scrollContainerRef.current && months.length > 0) {
      const currentIndex = 24; // Current month in the middle
      const calendarHeight = scrollContainerRef.current.offsetHeight;
      scrollContainerRef.current.scrollTop = currentIndex * calendarHeight;
    }
  }, [months]);

  useEffect(() => {
    if (calendarWrapperRef.current) {
      // Find the first tile element inside the calendar wrapper
      const tile = calendarWrapperRef.current.querySelector(
        ".react-calendar__tile",
      );
      if (tile) {
        setTileWidth(tile.getBoundingClientRect().width);
      }
    }
  }, [currentMonth]);

  useEffect(() => {
    if (currentGuest && !currentAirBnBGuest && useMonthMap.size > 0) {
      setIsMobileModalOpen(false);
      const filteredMap = new Map<string, dayType>();

      monthMap.forEach((dayEntry, date) => {
        const guestBookings = dayEntry.bookings.filter(
          (booking) => booking.guest.id == currentGuest,
        );

        if (guestBookings.length > 0) {
          const filteredDayEntry: dayType = {
            ...dayEntry,
            bookings: guestBookings,
          };
          filteredMap.set(date, filteredDayEntry);
        }

        const booking = guestBookings.find(
          (booking) => booking.guest.id === currentGuest,
        );

        if (booking) {
          const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
          const localDate = toZonedTime(date, timeZone);
          const localStartDate = toZonedTime(booking.startDate, timeZone);

          if (
            isSameDay(localDate, localStartDate) &&
            isSameMonth(localDate, currentMonth)
          ) {
            for (let i = 0; i < booking.duration; i += 1) {
              paidDates.push(toZonedTime(addDays(localStartDate, i), timeZone));
            }
          }
        }
      });

      setUseMonthMap(filteredMap);
    } else if (currentAirBnBGuest && useMonthMap.size > 0) {
      setIsMobileModalOpen(false);
      const filteredMap = new Map<string, dayType>();

      monthMap.forEach((dayEntry, date) => {
        const airbnbBookings = dayEntry.bookings.filter(
          (booking) => booking.alias === currentAirBnBGuest,
        );

        if (airbnbBookings.length > 0) {
          const filteredDayEntry: dayType = {
            ...dayEntry,
            bookings: airbnbBookings,
          };
          filteredMap.set(date, filteredDayEntry);
        }

        setUseMonthMap(filteredMap);
      });
    } else {
      setIsMobileModalOpen(false);
      setPaidDates([]);
      setUseMonthMap(monthMap);
    }
  }, [currentGuest, currentAirBnBGuest]);

  useEffect(() => {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    let currentMaxRooms = 0;
    const roomsInMonth: roomType[] = [];
    const usedRoomsInMonth = new Set<string>();

    monthMap.forEach((dayEntry, dateString) => {
      const localDate = toZonedTime(dateString.split("T")[0], timeZone);

      if (isSameMonth(localDate, currentMonth)) {
        dayEntry.bookings.map((booking) => {
          if (!usedRoomsInMonth.has(booking.room.name))
            roomsInMonth.push(booking.room);
          usedRoomsInMonth.add(booking.room.name);
        });
        currentMaxRooms = Math.max(
          currentMaxRooms,
          dayEntry.bookings.length,
          roomsInMonth.length,
        );
      }
    });

    setMaxRooms(currentMaxRooms);
    setUsedRooms(roomsInMonth);
  }, [currentMonth]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      // Select all calendar tiles and update their CSS variable
      document
        .querySelectorAll(".react-calendar__custom_tile")
        .forEach((tile) => {
          (tile as HTMLElement).style.setProperty(
            "--max-rows",
            (maxRooms + 1).toString(),
          );
        });
    }
  }, [maxRooms, currentMonth]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement, UIEvent>) => {
    const scrollTop = (e.target as HTMLElement).scrollTop;
    const calendarHeight = (e.target as HTMLElement).offsetHeight;
    const snappedIndex = Math.round(scrollTop / calendarHeight);
    const snappedMonth = months[snappedIndex];
    if (snappedMonth) {
      setCurrentMonth(snappedMonth);
    }
  };

  const handlePaidDates = (date: Date) => {
    let updatedPaidDates: Date[];

    const foundDate = paidDates.find((paidDate) => isSameDay(date, paidDate));

    if (foundDate) {
      updatedPaidDates = paidDates.filter(
        (paidDate) => !isSameDay(date, paidDate),
      );
    } else {
      updatedPaidDates = [...paidDates, date];
    }

    setPaidDates(updatedPaidDates);
  };

  const onSingleClick = (date: Date) => {
    // select the date
    setSelectedDate(date);
    setIsMobileModalOpen(true);
    const day = useMonthMap.get(date.toISOString().split("T")[0]);

    if (day && day.bookings) {
      setCurrentBookings(day.bookings);
    } else setCurrentBookings(null);
  };

  const onDoubleClick = (date: Date) => {
    if (currentGuest) {
      const bookedDate = useMonthMap.get(date.toISOString().split("T")[0]);
      if (bookedDate) handlePaidDates(date);
    }
  };

  const customTile = ({ date }: { date: Date }) => {
    const className = ["react-calendar__custom_tile"];

    if (isSameDay(date, startOfToday()))
      className.push("react-calendar__custom_tile_today");

    if (paidDates.length > 0) {
      if (
        currentGuest &&
        paidDates.find((paidDate) => isSameDay(paidDate, date))
      )
        className.push("react-calendar__custom_tile_paid");
    }

    const day = useMonthMap.get(date.toISOString().split("T")[0]);

    if (day && day.isBlocked)
      className.push("react-calendar__custom_tile_blocked");

    const totalAvailableRooms = new Set(
      usedRooms.map((room) => room.name.replace(/(.+?)\1+$/, "$1")),
    ).size;
    if (day && day.bookings.length >= totalAvailableRooms)
      className.push("react-calendar__custom_tile_full");

    // Add styling for non-booked days
    if (!day || (day.bookings && day.bookings.length === 0)) {
      className.push("react-calendar__custom_tile_no_booking");
    }

    if (day && day.bookings.length > 0) {
      className.push("react-calendar__custom_tile_booking");
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

      // Aggregate booking conditions in one pass
      const { isStart, isInbetween, isEnd } = day.bookings.reduce(
        (acc, booking) => {
          const startDate = toZonedTime(booking.startDate, timeZone);
          const endDate = toZonedTime(booking.endDate, timeZone);

          if (
            isWithinInterval(date, { start: startDate, end: endDate }) &&
            !(isSameDay(date, startDate) || isSameDay(date, endDate))
          ) {
            acc.isInbetween = true;
          }

          if (isSameDay(date, startDate)) acc.isStart = true;
          if (isSameDay(date, endDate)) acc.isEnd = true;

          return acc;
        },
        { isStart: false, isInbetween: false, isEnd: false },
      );

      // Refined class assignment logic
      if (isInbetween) {
        className.push("react-calendar__custom_tile_booking_between");
      } else {
        if (isStart && !isEnd) {
          className.push("react-calendar__custom_tile_booking_start");
        }
        if (isEnd && !isStart) {
          className.push("react-calendar__custom_tile_booking_end");
        }
      }
    }

    return className;
  };

  const customTileContent = ({ date, view }: { date: Date; view: string }) => {
    if (view === "month") {
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

      const day = useMonthMap.get(date.toISOString().split("T")[0]);
      if (day) {
        const sortedUsedRooms = usedRooms.sort((a, b) =>
          a.name.localeCompare(b.name),
        );

        // Initialize grid with empty placeholders
        const gridContent: Record<string, React.ReactNode> = {};
        sortedUsedRooms.forEach((room) => {
          gridContent[room.name] = (
            <div key={room.name} className="row-span-1 h-full min-h-[16px]" />
          );
        });

        // Fill placeholders with actual booking data
        day.bookings.forEach((booking) => {
          const startDate = toZonedTime(booking.startDate, timeZone);
          const endDate = toZonedTime(booking.endDate, timeZone);

          const name =
            booking.guest.name === "AirBnB" && booking.alias
              ? `${booking.alias} (A)`
              : currentGuest
                ? booking.room.name
                : booking.guest.name;

          const dayIndex = getDay(date);
          let maxDuration = Math.max(
            booking.duration - dayIndex > 1
              ? Math.min(booking.duration, booking.duration - dayIndex)
              : booking.duration,
            1,
          );

          if (isSameDay(date, endOfMonth(date))) maxDuration = 1;

          const availableTileWidth = tileWidth ? tileWidth * maxDuration : 0;

          const textSize = 0.65;

          const content = isSameDay(date, startDate) ? (
            <span
              className="absolute top-auto left-1 truncate z-10"
              style={{
                maxWidth: `${availableTileWidth - maxDuration * 3}px`,
              }}
            >
              {booking.numberOfGuests > 1 ? `(${booking.numberOfGuests})` : ""}{" "}
              {name}
            </span>
          ) : (
            <span>&nbsp;</span>
          );

          const roundedClass = `${
            isSameDay(date, startDate) ? "rounded-l-lg" : ""
          } ${isSameDay(date, endDate) ? "rounded-r-lg" : ""}`;

          const roomColor = getRoomColor(booking.room.name);

          gridContent[booking.room.name] = (
            <div
              key={booking.room.name}
              className={`${roomColor} ${roundedClass} relative text-nowrap h-full flex items-center pl-1 ${
                booking.guest.name === "AirBnB"
                  ? "text-white"
                  : "text-black font-bold"
              } justify-center`}
              style={{ fontSize: `${textSize}rem` }}
            >
              {content}
            </div>
          );
        });

        // Render all rooms in order (even if unoccupied)
        return <>{sortedUsedRooms.map((room) => gridContent[room.name])}</>;
      }
    }

    return null;
  };

  const getDayContent = useDoubleClick<Date>(onSingleClick, onDoubleClick);

  return (
    <div
      ref={scrollContainerRef}
      className="h-full overflow-y-scroll snap-y snap-mandatory"
      onScroll={handleScroll}
    >
      {months.map((month, index) => (
        <div key={index} className="snap-start h-full" ref={calendarWrapperRef}>
          <Calendar
            activeStartDate={month}
            showNavigation={false}
            showNeighboringMonth={false}
            value={currentMonth}
            onClickDay={getDayContent}
            tileClassName={customTile}
            tileContent={customTileContent}
            calendarType="gregory"
          />
        </div>
      ))}
    </div>
  );
};

export default CustomCalendar;
