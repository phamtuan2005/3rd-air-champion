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
  selectedRoomName: string | null;
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
  selectedRoomName,
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

    useMonthMap.forEach((dayEntry, dateString) => {
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
  }, [currentMonth, useMonthMap]);

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
    }

    return className;
  };

  const customTileContent = ({ date, view }: { date: Date; view: string }) => {
    if (view === "month") {
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

      const day = useMonthMap.get(date.toISOString().split("T")[0]);

      // Checkouts: a booking's checkout morning is endDate (last night) + 1 day.
      // That checkout day has no booking record of its own, so we look at the
      // previous day's records to find any bookings whose checkout falls today.
      const prevDay = useMonthMap.get(
        addDays(date, -1).toISOString().split("T")[0],
      );
      const checkoutBookings: bookingType[] = prevDay
        ? prevDay.bookings.filter((b) =>
            b.endDate && b.room && b.guest
              ? isSameDay(
                  date,
                  addDays(toZonedTime(b.endDate, timeZone), 1),
                ) && (!selectedRoomName || b.room.name === selectedRoomName)
              : false,
          )
        : [];

      const filteredDay = day && selectedRoomName
        ? { ...day, bookings: day.bookings.filter((b) => b.room?.name === selectedRoomName) }
        : day;

      if (!filteredDay && checkoutBookings.length === 0) return null;

      if (filteredDay || checkoutBookings.length > 0) {
        // Spread to avoid mutating state; extra rooms are added lazily via ensureGridRow
        const sortedUsedRooms = [...usedRooms]
          .filter((r) => !selectedRoomName || r.name === selectedRoomName)
          .sort((a, b) => a.name.localeCompare(b.name));

        // Each room tracks two slots:
        //   am = guest checking OUT (still occupying in the morning until ~11am)
        //   pm = guest checking IN  (arriving in the afternoon from ~2pm)
        const gridContent: Record<
          string,
          { am: bookingType | null; pm: bookingType | null }
        > = {};
        sortedUsedRooms.forEach((room) => {
          gridContent[room.name] = { am: null, pm: null };
        });

        // Helper: get or create a gridContent entry for a room that may not
        // be in usedRooms yet (usedRooms can be stale between re-renders).
        const ensureGridRow = (room: roomType) => {
          if (!gridContent[room.name]) {
            gridContent[room.name] = { am: null, pm: null };
            sortedUsedRooms.push(room);
          }
        };

        // AM slot: populate from previous day's bookings whose checkout is today
        checkoutBookings.forEach((booking) => {
          ensureGridRow(booking.room);
          gridContent[booking.room.name].am = booking;
        });

        // Current day: check-ins (isStart) and mid-stay nights (isBetween)
        if (filteredDay) {
          filteredDay.bookings.forEach((booking) => {
            if (!booking.startDate || !booking.endDate || !booking.room || !booking.guest) return;

            const startDate = toZonedTime(booking.startDate, timeZone);
            const dbEndDate = toZonedTime(booking.endDate, timeZone);

            const isStart = isSameDay(date, startDate);
            // isBetween: any night after check-in up to and including the last night
            const isBetween =
              !isStart &&
              isWithinInterval(date, { start: startDate, end: dbEndDate });

            ensureGridRow(booking.room);

            // AM slot for mid-stay: guest occupied the room last night too
            if (isBetween) {
              gridContent[booking.room.name].am = booking;
            }
            // PM slot: guest is arriving or still in-stay
            if (isStart || isBetween) {
              gridContent[booking.room.name].pm = booking;
            }
          });
        }

        // Re-sort in case ensureGridRow added new rooms
        sortedUsedRooms.sort((a, b) => a.name.localeCompare(b.name));

        const textSize = 0.65;

        return (
          <>
            {sortedUsedRooms.map((room) => {
              const { am: amBooking, pm: pmBooking } = gridContent[room.name];

              if (!amBooking && !pmBooking) {
                return (
                  <div key={room.name} className="row-span-1 min-h-[16px]" />
                );
              }

              // AM slot (checkout side — left half)
              const amColor = amBooking?.room?.name
                ? getRoomColor(amBooking.room.name)
                : "";
              const amIsEnd =
                amBooking?.endDate
                  ? isSameDay(date, addDays(toZonedTime(amBooking.endDate, timeZone), 1))
                  : false;
              // PM slot (checkin side — right half)
              const pmStartDate =
                pmBooking?.startDate
                  ? toZonedTime(pmBooking.startDate, timeZone)
                  : null;
              const pmIsStart =
                pmBooking && pmStartDate
                  ? isSameDay(date, pmStartDate)
                  : false;
              const pmColor = pmBooking?.room?.name
                ? getRoomColor(pmBooking.room.name)
                : "";
              const pmTextColor =
                pmBooking?.guest?.name === "AirBnB"
                  ? "text-white"
                  : "text-black font-bold";

              // Guest name shown in the PM slot on check-in day only
              const pmName = pmBooking
                ? pmBooking.guest?.name === "AirBnB" && pmBooking.alias
                  ? `${pmBooking.alias} (A)`
                  : currentGuest
                    ? pmBooking.room?.name ?? ""
                    : pmBooking.guest?.name ?? ""
                : "";

              // Available width for name text: starts from the PM half of the
              // check-in tile, so subtract half a tile from the total span.
              let maxDuration = 1;
              if (pmBooking && pmIsStart) {
                const dayIndex = getDay(date);
                maxDuration = Math.max(
                  pmBooking.duration - dayIndex > 1
                    ? Math.min(
                        pmBooking.duration,
                        pmBooking.duration - dayIndex,
                      )
                    : pmBooking.duration,
                  1,
                );
                if (isSameDay(date, endOfMonth(date))) maxDuration = 1;
              }

              const availableTileWidth = tileWidth
                ? tileWidth * maxDuration - tileWidth / 5
                : 0;

              const pmNameContent = pmIsStart ? (
                <span
                  className="absolute top-auto left-1 truncate z-10"
                  style={{
                    maxWidth: `${availableTileWidth - maxDuration * 3}px`,
                  }}
                >
                  {pmBooking!.numberOfGuests > 1
                    ? `(${pmBooking!.numberOfGuests})`
                    : ""}{" "}
                  {pmName}
                </span>
              ) : null;

              return (
                <div
                  key={room.name}
                  className="row-span-1 min-h-[16px]"
                  style={{ position: "relative" }}
                >
                  {/* AM slot — checkout side: left 1/3 + 1px bleed left so the
                      bar bridges any sub-pixel gap with the previous tile's PM bar */}
                  {amBooking && (
                    <div
                      className={`${amColor} ${amIsEnd ? "rounded-r-lg" : ""}`}
                      style={{
                        position: "absolute",
                        top: 0,
                        bottom: 0,
                        left: "-1px",
                        right: amIsEnd ? "80%" : "-1px",
                      }}
                    />
                  )}
                  {/* PM slot — checkin side: right 2/3 + 1px bleed right so the
                      bar bridges any sub-pixel gap with the next tile's AM bar */}
                  {pmBooking && (
                    <div
                      className={`${pmColor} ${pmIsStart ? "rounded-l-lg" : ""} ${pmTextColor} flex items-center`}
                      style={{
                        position: "absolute",
                        top: 0,
                        bottom: 0,
                        left: pmIsStart ? "20%" : "-1px",
                        right: "-1px",
                        fontSize: `${textSize}rem`,
                      }}
                    >
                      {pmNameContent}
                    </div>
                  )}
                </div>
              );
            })}
          </>
        );
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
