import { JSX, useEffect, useRef, useState } from "react";
import Calendar from "react-calendar";
import "./calendarStyle.css";
import { isSameDay, isWithinInterval, startOfToday } from "date-fns";
import { useMainViewContext } from "@/components/Context/MainViewContextProvider";
import { toZonedTime } from "date-fns-tz";

const MainCalendar = () => {
  const {
    currentMonth,
    monthMap,
    rooms,
    setCurrentMonth,
    setSelectedDate,
    roomFilter,
  } = useMainViewContext();
  const [months, setMonths] = useState<Date[]>([]);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const currentMonth = new Date();
    const monthsArray = [];
    for (let i = -24; i <= 36; i++) {
      // 2 years back, 3 years ahead
      monthsArray.push(
        new Date(currentMonth.getFullYear(), currentMonth.getMonth() + i, 1)
      );
    }
    setMonths(monthsArray);
  }, []);

  useEffect(() => {
    if (scrollContainerRef.current && months.length > 0) {
      const currentIndex = 24; // Middle month
      const calendarHeight = scrollContainerRef.current.offsetHeight;
      scrollContainerRef.current.scrollTop = currentIndex * calendarHeight;
    }
  }, [months]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement, UIEvent>) => {
    const scrollTop = (e.target as HTMLElement).scrollTop;
    const calendarHeight = (e.target as HTMLElement).offsetHeight;
    const snappedIndex = Math.round(scrollTop / calendarHeight);
    const snappedMonth = months[snappedIndex];
    if (snappedMonth) setCurrentMonth(snappedMonth);
  };

  const handleDayClick = (date: Date) => {
    setSelectedDate(date);
  };

  const customTileContent = ({ date, view }: { date: Date; view: string }) => {
    if (view === "month") {
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

      const day = monthMap.get(date.toISOString().split("T")[0]);
      if (day) {
        day.bookings.sort((a, b) => {
          return a.room.name.localeCompare(b.room.name);
        });

        // Initialize placeholders for the three rows
        const gridContent: {
          red: React.ReactNode;
          blue: React.ReactNode;
          green: React.ReactNode;
        } = {
          red: <div className="row-span-1 h-full min-h-[16px]" />, // Ensure full height
          blue: <div className="row-span-1 h-full min-h-[16px]" />,
          green: <div className="row-span-1 h-full min-h-[16px]" />,
        };

        // Fill the placeholders based on room name
        day.bookings.forEach((booking) => {
          const startDate = toZonedTime(booking.startDate, timeZone);
          const endDate = toZonedTime(booking.endDate, timeZone);

          const roundedClass = `${
            isSameDay(date, startDate) ? "rounded-l-lg" : ""
          } ${isSameDay(date, endDate) ? "rounded-r-lg" : ""}`;

          if (booking.room.name === "Cozy") {
            gridContent.red = (
              <div
                key="red"
                className={`bg-red-500 ${roundedClass} relative text-nowrap h-full flex items-center justify-center
               `}
                style={{ fontSize: `${0.65}rem` }}
              >
                <span>&nbsp;</span>
              </div>
            );
          } else if (booking.room.name === "Cute") {
            gridContent.blue = (
              <div
                key="blue"
                className={`bg-blue-500 ${roundedClass} relative text-nowrap h-full flex items-center justify-center`}
                style={{ fontSize: `${0.65}rem` }}
              >
                <span>&nbsp;</span>
              </div>
            );
          } else {
            gridContent.green = (
              <div
                key="green"
                className={`bg-green-500 ${roundedClass} relative text-nowrap h-full flex items-center justify-center`}
                style={{ fontSize: `${0.65}rem` }}
              >
                <span>&nbsp;</span>
              </div>
            );
          }
        });

        // Render the three grid rows
        return (
          <>
            {gridContent.red}
            {gridContent.blue}
            {gridContent.green}
          </>
        );
      }
    }

    return null;
  };

  const customTile = ({ date }: { date: Date }) => {
    const className = ["react-calendar__custom_tile"];

    if (isSameDay(date, startOfToday()))
      className.push("react-calendar__custom_tile_today");

    const day = monthMap.get(date.toISOString().split("T")[0]);

    if (day && day.bookings.some((booking) => booking.room.name === roomFilter))
      className.push("react-calendar__custom_tile_blocked");

    if (day && day.bookings.length === rooms.length)
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
        { isStart: false, isInbetween: false, isEnd: false }
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

  return (
    <div
      ref={scrollContainerRef}
      className="h-full overflow-y-scroll snap-y snap-mandatory"
      onScroll={handleScroll}
    >
      {months.map((month, index) => (
        <div key={index} className="snap-start h-full">
          <Calendar
            activeStartDate={month}
            showNavigation={false}
            showNeighboringMonth={false}
            value={currentMonth}
            onClickDay={handleDayClick}
            tileClassName={customTile}
            tileContent={customTileContent}
            calendarType="gregory"
          />
        </div>
      ))}
    </div>
  );
};

export default MainCalendar;
