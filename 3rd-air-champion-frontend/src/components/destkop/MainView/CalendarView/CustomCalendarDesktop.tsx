import { useEffect, useMemo, useRef, useState } from "react";
import "../../../../styles/calendarStyle.css";
import {
  addDays,
  endOfMonth,
  getDay,
  isAfter,
  isBefore,
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
  scrollToTodayTrigger: number;
  setCurrentMonth: React.Dispatch<React.SetStateAction<Date>>;
  setIsMobileModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setPaidDates: React.Dispatch<React.SetStateAction<Date[]>>;
  setSelectedDate: React.Dispatch<React.SetStateAction<Date>>;
}

const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

const SUBROW_HEIGHT = 20; // px — minimum height per sub-row (date number + each room bar)

interface PageLayout {
  month: Date;
  cells: (Date | null)[]; // numRows * 7 entries; null = empty cell
}

const CustomCalendar = ({
  currentMonth,
  currentAirBnBGuest,
  currentGuest,
  monthMap,
  paidDates,
  rooms,
  scrollToTodayTrigger,
  selectedRoomName,
  setCurrentBookings,
  setCurrentMonth,
  setIsMobileModalOpen,
  setPaidDates,
  setSelectedDate,
}: CustomCalendarProps) => {
  const [months, setMonths] = useState<Date[]>([]);
  const [visibleIndex, setVisibleIndex] = useState<number>(24);
  const [tileWidth, setTileWidth] = useState<number | null>(null);
  const [useMonthMap, setUseMonthMap] = useState<Map<string, dayType>>(monthMap);
  const usedRooms = useMemo(
    () =>
      rooms
        .filter((r) => r.active && (!selectedRoomName || r.name === selectedRoomName))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [selectedRoomName, rooms],
  );
  const maxRooms = usedRooms.length;
  const [containerHeight, setContainerHeight] = useState(0);
  const [pageLayouts, setPageLayouts] = useState<PageLayout[]>([]);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const calendarWrapperRef = useRef<HTMLDivElement>(null);

  const minRowHeight = (maxRooms + 1) * SUBROW_HEIGHT;
  const numRows =
    containerHeight > 0 ? Math.max(Math.floor(containerHeight / minRowHeight), 1) : 5;
  const rowHeight = containerHeight > 0 ? containerHeight / numRows : minRowHeight;

  // Build months array: 2 years back, 3 years ahead
  useEffect(() => {
    const now = new Date();
    const arr: Date[] = [];
    for (let i = -24; i <= 36; i++) {
      arr.push(new Date(now.getFullYear(), now.getMonth() + i, 1));
    }
    setMonths(arr);
  }, []);

  // Initial scroll to currentMonth
  useEffect(() => {
    if (scrollContainerRef.current && months.length > 0) {
      const today = new Date();
      const monthDiff =
        (currentMonth.getFullYear() - today.getFullYear()) * 12 +
        (currentMonth.getMonth() - today.getMonth());
      const targetIndex = 24 + monthDiff;
      const h = scrollContainerRef.current.offsetHeight;
      scrollContainerRef.current.scrollTop = targetIndex * h;
    }
  }, [months]); // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll-to-today button
  useEffect(() => {
    if (scrollToTodayTrigger > 0 && scrollContainerRef.current && months.length > 0) {
      const h = scrollContainerRef.current.offsetHeight;
      scrollContainerRef.current.scrollTop = 24 * h;
    }
  }, [scrollToTodayTrigger]); // eslint-disable-line react-hooks/exhaustive-deps

  // Measure tile width for guest-name truncation
  useEffect(() => {
    if (calendarWrapperRef.current) {
      const tile = calendarWrapperRef.current.querySelector(".react-calendar__custom_tile");
      if (tile) setTileWidth(tile.getBoundingClientRect().width);
    }
  }, [currentMonth]);

  // Reset modal / paid dates when guest filter changes
  useEffect(() => {
    setIsMobileModalOpen(false);
    if (!currentGuest && !currentAirBnBGuest) setPaidDates([]);
  }, [currentGuest, currentAirBnBGuest]);

  // Filter monthMap by guest
  useEffect(() => {
    if (currentGuest && !currentAirBnBGuest && useMonthMap.size > 0) {
      const filteredMap = new Map<string, dayType>();
      monthMap.forEach((dayEntry, date) => {
        const guestBookings = dayEntry.bookings.filter(
          (booking) => booking.guest.id == currentGuest,
        );
        if (guestBookings.length > 0) {
          filteredMap.set(date, { ...dayEntry, bookings: guestBookings });
        }
        const booking = guestBookings.find((b) => b.guest.id === currentGuest);
        if (booking) {
          const localDate = toZonedTime(date, timeZone);
          const localStartDate = toZonedTime(booking.startDate, timeZone);
          if (isSameDay(localDate, localStartDate) && isSameMonth(localDate, currentMonth)) {
            for (let i = 0; i < booking.duration; i += 1) {
              paidDates.push(toZonedTime(addDays(localStartDate, i), timeZone));
            }
          }
        }
      });
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
  }, [currentGuest, currentAirBnBGuest, monthMap]);

// Track container height via ResizeObserver
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(([entry]) => {
      setContainerHeight(entry.contentRect.height);
    });
    obs.observe(el);
    setContainerHeight(el.clientHeight);
    return () => obs.disconnect();
  }, []);

  // Build page layouts: each page = numRows rows, overflow propagates to next page
  useEffect(() => {
    if (months.length === 0 || numRows <= 0) return;
    const layouts: PageLayout[] = [];
    let overflowDate: Date | null = null;

    for (const month of months) {
      const monthEnd = new Date(month.getFullYear(), month.getMonth() + 1, 0);
      const hadOverflow = overflowDate !== null;
      const pageStart: Date = overflowDate ?? new Date(month.getFullYear(), month.getMonth(), 1);
      const startCol = getDay(pageStart);
      const totalCells = numRows * 7;
      const cells: (Date | null)[] = Array(totalCells).fill(null);

      let cellIdx = startCol;
      let cur: Date = pageStart;

      while (cellIdx < totalCells && !isAfter(cur, monthEnd)) {
        cells[cellIdx] = cur;
        cur = addDays(cur, 1);
        cellIdx++;
      }

      // If no overflow came in, fill leading cells with the previous month's trailing days
      // so the first row is always complete (e.g. May 31 appears before June 1)
      if (!hadOverflow) {
        const monthStart = new Date(month.getFullYear(), month.getMonth(), 1);
        for (let i = 0; i < startCol; i++) {
          cells[i] = addDays(monthStart, i - startCol);
        }
      }

      // If cur hasn't passed monthEnd, some days didn't fit → overflow to next page
      overflowDate = isAfter(cur, monthEnd) ? null : cur;
      layouts.push({ month, cells });
    }

    setPageLayouts(layouts);
  }, [months, numRows]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement, UIEvent>) => {
    const scrollTop = (e.target as HTMLElement).scrollTop;
    const calendarHeight = (e.target as HTMLElement).offsetHeight;
    const snappedIndex = Math.round(scrollTop / calendarHeight);
    const snappedMonth = months[snappedIndex];
    if (snappedMonth) {
      setCurrentMonth(snappedMonth);
      setVisibleIndex(snappedIndex);
    }
  };

  const handlePaidDates = (date: Date) => {
    const foundDate = paidDates.find((pd) => isSameDay(date, pd));
    setPaidDates(
      foundDate
        ? paidDates.filter((pd) => !isSameDay(date, pd))
        : [...paidDates, date],
    );
  };

  const onSingleClick = (date: Date) => {
    setSelectedDate(date);
    setIsMobileModalOpen(true);
    const day = useMonthMap.get(date.toISOString().split("T")[0]);
    setCurrentBookings(day?.bookings ?? null);
  };

  const onDoubleClick = (date: Date) => {
    if (currentGuest) {
      const bookedDate = useMonthMap.get(date.toISOString().split("T")[0]);
      if (bookedDate) handlePaidDates(date);
    }
  };

  const customTile = ({ date }: { date: Date; isOutside?: boolean }) => {
    const className = ["react-calendar__custom_tile"];

    if (isSameDay(date, startOfToday()))
      className.push("react-calendar__custom_tile_today");

    const day = useMonthMap.get(date.toISOString().split("T")[0]);

    if (day?.isBlocked) className.push("react-calendar__custom_tile_blocked");

    const totalAvailableRooms = new Set(
      usedRooms.map((room) => room.name.replace(/(.+?)\1+$/, "$1")),
    ).size;
    if (day && day.bookings.length >= totalAvailableRooms)
      className.push("react-calendar__custom_tile_full");

    if (!day || day.bookings.length === 0)
      className.push("react-calendar__custom_tile_no_booking");

    const isFutureOrToday = !isBefore(date, startOfToday());
    const visibleRooms = usedRooms.filter((r) => !selectedRoomName || r.name === selectedRoomName);
    if (
      isFutureOrToday &&
      !day?.isBlocked &&
      (!day || day.bookings.length === 0) &&
      !currentGuest &&
      !currentAirBnBGuest &&
      visibleRooms.length === 0
    )
      className.push("react-calendar__custom_tile_opportunity");

    if (day && day.bookings.length > 0)
      className.push("react-calendar__custom_tile_booking");

    if (currentGuest && paidDates.some((pd) => isSameDay(pd, date)))
      className.push("react-calendar__custom_tile_paid");

    return className;
  };

  const customTileContent = ({ date, view }: { date: Date; view: string; isOutside?: boolean }) => {
    if (view !== "month") return null;

    const day = useMonthMap.get(date.toISOString().split("T")[0]);
    const prevDay = useMonthMap.get(addDays(date, -1).toISOString().split("T")[0]);

    const checkoutBookings: bookingType[] = prevDay
      ? prevDay.bookings.filter((b) =>
          b.endDate && b.room && b.guest
            ? isSameDay(date, addDays(toZonedTime(b.endDate, timeZone), 1)) &&
              (!selectedRoomName || b.room.name === selectedRoomName)
            : false,
        )
      : [];

    const filteredDay =
      day && selectedRoomName
        ? { ...day, bookings: day.bookings.filter((b) => b.room?.name === selectedRoomName) }
        : day;

    const blockedRoomIds = new Set((day?.blockedRooms ?? []).map((r) => r.id));

    if (!filteredDay && checkoutBookings.length === 0 && blockedRoomIds.size === 0) {
      const visibleRooms = usedRooms.filter((r) => !selectedRoomName || r.name === selectedRoomName);
      if (visibleRooms.length === 0) return null;
      // Fall through: render an empty row per visible room so every cell in the
      // month has the same room structure, even when no bookings exist.
    }

    const sortedUsedRooms = [...usedRooms]
      .filter((r) => !selectedRoomName || r.name === selectedRoomName)
      .sort((a, b) => a.name.localeCompare(b.name));

    for (const blockedRoom of day?.blockedRooms ?? []) {
      if (!selectedRoomName || blockedRoom.name === selectedRoomName) {
        if (!sortedUsedRooms.find((r) => r.id === blockedRoom.id)) {
          sortedUsedRooms.push(blockedRoom);
        }
      }
    }
    sortedUsedRooms.sort((a, b) => a.name.localeCompare(b.name));

    const gridContent: Record<string, { am: bookingType | null; pm: bookingType | null }> = {};
    sortedUsedRooms.forEach((room) => {
      gridContent[room.name] = { am: null, pm: null };
    });

    const ensureGridRow = (room: roomType) => {
      if (!gridContent[room.name]) {
        gridContent[room.name] = { am: null, pm: null };
        sortedUsedRooms.push(room);
      }
    };

    checkoutBookings.forEach((booking) => {
      ensureGridRow(booking.room);
      gridContent[booking.room.name].am = booking;
    });

    if (filteredDay) {
      filteredDay.bookings.forEach((booking) => {
        if (!booking.startDate || !booking.endDate || !booking.room || !booking.guest) return;
        const startDate = toZonedTime(booking.startDate, timeZone);
        const dbEndDate = toZonedTime(booking.endDate, timeZone);
        const isStart = isSameDay(date, startDate);
        const isBetween =
          !isStart && isWithinInterval(date, { start: startDate, end: dbEndDate });

        ensureGridRow(booking.room);
        if (isBetween) gridContent[booking.room.name].am = booking;
        if (isStart || isBetween) gridContent[booking.room.name].pm = booking;
      });
    }

    sortedUsedRooms.sort((a, b) => a.name.localeCompare(b.name));

    const textSize = 0.65;

    return (
      <>
        {sortedUsedRooms.map((room) => {
          const { am: amBooking, pm: pmBooking } = gridContent[room.name];
          const isRoomBlocked = blockedRoomIds.has(room.id);

          if (!amBooking && !pmBooking) {
            const isFutureOrToday = !isBefore(date, startOfToday());
            if (isRoomBlocked) {
              return (
                <div key={room.name} className="row-span-1 min-h-[16px] relative">
                  <div
                    className="react-calendar__room_blocked_bar absolute inset-0"
                    style={{ left: "-1px", right: "-1px" }}
                  />
                </div>
              );
            }
            return (
              <div
                key={room.name}
                className={`row-span-1 min-h-[16px]${
                  isFutureOrToday && !currentGuest && !currentAirBnBGuest
                    ? " react-calendar__opportunity_row"
                    : ""
                }`}
              />
            );
          }

          const amColor = amBooking?.room?.name
            ? getRoomColor(amBooking.room.name, amBooking.room.color)
            : "";
          const amIsEnd = amBooking?.endDate
            ? isSameDay(date, addDays(toZonedTime(amBooking.endDate, timeZone), 1))
            : false;
          const pmStartDate = pmBooking?.startDate
            ? toZonedTime(pmBooking.startDate, timeZone)
            : null;
          const pmIsStart =
            pmBooking && pmStartDate ? isSameDay(date, pmStartDate) : false;
          const pmColor = pmBooking?.room?.name
            ? getRoomColor(pmBooking.room.name, pmBooking.room.color)
            : "";
          const pmTextColor =
            pmBooking?.guest?.name === "AirBnB" ? "text-white" : "text-black font-bold";

          const pmName = pmBooking
            ? pmBooking.guest?.name === "AirBnB" && pmBooking.alias
              ? `${pmBooking.alias} (A)`
              : currentGuest
                ? pmBooking.room?.name ?? ""
                : pmBooking.guest?.name ?? ""
            : "";

          let maxDuration = 1;
          if (pmBooking && pmIsStart) {
            const dayIndex = getDay(date);
            maxDuration = Math.max(
              pmBooking.duration - dayIndex > 1
                ? Math.min(pmBooking.duration, pmBooking.duration - dayIndex)
                : pmBooking.duration,
              1,
            );
            if (isSameDay(date, endOfMonth(date))) maxDuration = 1;
          }

          const availableTileWidth = tileWidth ? tileWidth * maxDuration - tileWidth / 5 : 0;

          const pmNameContent = pmIsStart ? (
            <span
              className="absolute top-auto left-1 truncate z-10"
              style={{ maxWidth: `${availableTileWidth - maxDuration * 3}px` }}
            >
              {pmBooking!.numberOfGuests > 1 ? `(${pmBooking!.numberOfGuests})` : ""}{" "}
              {pmName}
            </span>
          ) : null;

          return (
            <div
              key={room.name}
              className="row-span-1 min-h-[16px]"
              style={{ position: "relative" }}
            >
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
              {pmBooking ? (
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
              ) : isRoomBlocked ? (
                <div
                  className="react-calendar__room_blocked_bar"
                  style={{
                    position: "absolute",
                    top: 0,
                    bottom: 0,
                    left: "20%",
                    right: "0",
                  }}
                />
              ) : !isBefore(date, startOfToday()) && !currentGuest && !currentAirBnBGuest ? (
                <div
                  className="react-calendar__opportunity_pm"
                  style={{
                    position: "absolute",
                    top: 0,
                    bottom: 0,
                    left: "20%",
                    right: "0",
                  }}
                />
              ) : null}
            </div>
          );
        })}
      </>
    );
  };

  const getDayContent = useDoubleClick<Date>(onSingleClick, onDoubleClick);

  const displayLayouts =
    pageLayouts.length > 0
      ? pageLayouts
      : months.map((m) => ({ month: m, cells: [] as (Date | null)[] }));

  return (
    <div
      ref={scrollContainerRef}
      className="flex-1 min-h-0 overflow-y-scroll snap-y snap-mandatory"
      onScroll={handleScroll}
    >
      {displayLayouts.map((layout, index) => {
        const inWindow = Math.abs(index - visibleIndex) <= 1;
        return (
          <div
            key={index}
            className="snap-start h-full main-calendar-wrapper"
            ref={index === visibleIndex ? calendarWrapperRef : undefined}
          >
            {inWindow && layout.cells.length > 0 && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(7, 1fr)",
                  gridTemplateRows: `repeat(${numRows}, ${rowHeight}px)`,
                  height: "100%",
                  width: "100%",
                }}
              >
                {layout.cells.map((date, cellIdx) => {
                  if (!date) {
                    return <div key={cellIdx} />;
                  }

                  const isOutside = !isSameMonth(date, layout.month);
                  const classes = customTile({ date, isOutside });
                  if (isOutside) classes.push("react-calendar__custom_tile_outside");
                  const content = customTileContent({ date, view: "month", isOutside });

                  return (
                    <button
                      key={cellIdx}
                      className={classes.join(" ")}
                      type="button"
                      onClick={() => getDayContent(date)}
                      style={
                        { "--max-rows": (maxRooms + 1).toString() } as React.CSSProperties
                      }
                    >
                      <abbr aria-label={date.toLocaleDateString()}>
                        {date.getDate()}
                      </abbr>
                      {content}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default CustomCalendar;
