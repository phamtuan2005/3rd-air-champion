import { useEffect, useMemo, useRef, useState } from "react";
import "../../styles/calendarStyle.css";
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
import { dayType } from "../../util/types/dayType";
import { bookingType } from "../../util/types/bookingType";
import { roomType } from "../../util/types/roomType";
import { toZonedTime } from "date-fns-tz";
import { useDoubleClick } from "../../util/useDoubleClick";
import { getRoomColor } from "../../util/getRoomColor";

interface CalendarGridProps {
  currentMonth: Date;
  monthMap: Map<string, dayType>;
  rooms: roomType[];
  selectedRoomName?: string | null;
  scrollToTodayTrigger?: number;
  // TiMag goes back 24 months; TiBook starts at today
  monthsBack?: number;
  // TiMag passes paid dates to highlight tiles
  paidDates?: Date[];
  // TiMag guest mode: pre-filtered room list, bypasses active filter
  overrideRooms?: roomType[];
  onMonthChange: (month: Date) => void;
  // TiBook: instant single click; TiMag: uses double-click detection (300ms delay)
  onDateClick?: (date: Date) => void;
  onDoubleClick?: (date: Date) => void;
  // TiMag: guest name; TiBook: room name
  resolveBarLabel?: (booking: bookingType) => string;
}

const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
const SUBROW_HEIGHT = 20;

interface PageLayout {
  month: Date;
  cells: (Date | null)[];
}

const CalendarGrid = ({
  currentMonth,
  monthMap,
  rooms,
  selectedRoomName = null,
  scrollToTodayTrigger = 0,
  monthsBack = 24,
  paidDates = [],
  overrideRooms,
  onMonthChange,
  onDateClick,
  onDoubleClick,
  resolveBarLabel,
}: CalendarGridProps) => {
  const [months, setMonths] = useState<Date[]>([]);
  const [visibleIndex, setVisibleIndex] = useState<number>(monthsBack);
  const [tileWidth, setTileWidth] = useState<number | null>(null);
  const [containerHeight, setContainerHeight] = useState(0);
  const [pageLayouts, setPageLayouts] = useState<PageLayout[]>([]);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const calendarWrapperRef = useRef<HTMLDivElement>(null);
  const visibleIndexRef = useRef<number>(monthsBack);

  const usedRooms = useMemo(() => {
    const base = overrideRooms
      ? overrideRooms
      : rooms.filter((r) => r.active && (!selectedRoomName || r.name === selectedRoomName));
    return base.sort((a, b) => a.name.localeCompare(b.name));
  }, [overrideRooms, rooms, selectedRoomName]);

  const maxRooms = usedRooms.length;
  const minRowHeight = (maxRooms + 1) * SUBROW_HEIGHT;
  const numRows =
    containerHeight > 0 ? Math.max(Math.floor(containerHeight / minRowHeight), 1) : 5;
  const rowHeight =
    containerHeight > 0 ? Math.floor(containerHeight / numRows) : minRowHeight;

  useEffect(() => {
    const now = new Date();
    const arr: Date[] = [];
    for (let i = -monthsBack; i <= 36; i++) {
      arr.push(new Date(now.getFullYear(), now.getMonth() + i, 1));
    }
    setMonths(arr);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (scrollContainerRef.current && months.length > 0) {
      const today = new Date();
      const monthDiff =
        (currentMonth.getFullYear() - today.getFullYear()) * 12 +
        (currentMonth.getMonth() - today.getMonth());
      const targetIndex = monthsBack + monthDiff;
      const h = scrollContainerRef.current.offsetHeight;
      scrollContainerRef.current.scrollTop = targetIndex * h;
      visibleIndexRef.current = targetIndex;
    }
  }, [months]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (scrollToTodayTrigger > 0 && scrollContainerRef.current && months.length > 0) {
      const h = scrollContainerRef.current.offsetHeight;
      scrollContainerRef.current.scrollTop = monthsBack * h;
      visibleIndexRef.current = monthsBack;
    }
  }, [scrollToTodayTrigger]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (calendarWrapperRef.current) {
      const tile = calendarWrapperRef.current.querySelector(".react-calendar__custom_tile");
      if (tile) setTileWidth(tile.getBoundingClientRect().width);
    }
  }, [currentMonth]);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(([entry]) => {
      const h = entry.contentRect.height;
      setContainerHeight(h);
      if (h > 0) el.scrollTop = visibleIndexRef.current * h;
    });
    obs.observe(el);
    setContainerHeight(el.clientHeight);
    return () => obs.disconnect();
  }, []);

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

      if (!hadOverflow) {
        const monthStart = new Date(month.getFullYear(), month.getMonth(), 1);
        for (let i = 0; i < startCol; i++) {
          cells[i] = addDays(monthStart, i - startCol);
        }
      }

      overflowDate = isAfter(cur, monthEnd) ? null : cur;
      layouts.push({ month, cells });
    }

    setPageLayouts(layouts);
  }, [months, numRows]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.target as HTMLElement;
    const calendarHeight = el.offsetHeight;
    const snappedIndex = Math.round(el.scrollTop / calendarHeight);

    if (Math.abs(snappedIndex - visibleIndexRef.current) > 1) {
      el.scrollTop = visibleIndexRef.current * calendarHeight;
      return;
    }

    const snappedMonth = months[snappedIndex];
    if (snappedMonth) {
      onMonthChange(snappedMonth);
      setVisibleIndex(snappedIndex);
      visibleIndexRef.current = snappedIndex;
    }
  };

  const getTileClasses = (date: Date, pageMonth: Date) => {
    const className = ["react-calendar__custom_tile"];
    if (isSameDay(date, startOfToday())) className.push("react-calendar__custom_tile_today");
    const day = monthMap.get(date.toISOString().split("T")[0]);
    if (day?.isBlocked) className.push("react-calendar__custom_tile_blocked");
    const totalAvailableRooms = new Set(
      usedRooms.map((r) => r.name.replace(/(.+?)\1+$/, "$1")),
    ).size;
    if (day && day.bookings.length >= totalAvailableRooms)
      className.push("react-calendar__custom_tile_full");
    if (!day || day.bookings.length === 0)
      className.push("react-calendar__custom_tile_no_booking");
    if (day && day.bookings.length > 0) className.push("react-calendar__custom_tile_booking");
    if (paidDates.some((pd) => isSameDay(pd, date)))
      className.push("react-calendar__custom_tile_paid");
    if (!isSameMonth(date, pageMonth)) className.push("react-calendar__custom_tile_outside");
    return className;
  };

  const getTileContent = (date: Date) => {
    const day = monthMap.get(date.toISOString().split("T")[0]);
    const prevDay = monthMap.get(addDays(date, -1).toISOString().split("T")[0]);

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

    if (!filteredDay && checkoutBookings.length === 0 && blockedRoomIds.size === 0) {
      if (sortedUsedRooms.length === 0) return null;
    }

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
                <div key={room.name} className="row-span-1 h-full relative">
                  <div
                    className="react-calendar__room_blocked_bar absolute"
                    style={{ top: "1px", bottom: "1px", left: "-1px", right: "-1px" }}
                  />
                </div>
              );
            }
            const prevDayNoPm = prevDay
              ? !prevDay.bookings.some((b) => b.room?.name === room.name)
              : false;
            return (
              <div key={room.name} className="row-span-1 h-full relative">
                {isFutureOrToday && (
                  <div
                    className="react-calendar__opportunity_row absolute rounded-lg"
                    style={{ top: "1px", bottom: "1px", left: "20%", right: "-20%" }}
                  />
                )}
                {isFutureOrToday && prevDayNoPm && getDay(date) === 0 && (
                  <div
                    className="react-calendar__opportunity_pm absolute"
                    style={{
                      top: "1px",
                      bottom: "1px",
                      left: "-1px",
                      right: "80%",
                      borderTopRightRadius: "0.5rem",
                      borderBottomRightRadius: "0.5rem",
                    }}
                  />
                )}
              </div>
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
          const pmIsStart = pmBooking && pmStartDate ? isSameDay(date, pmStartDate) : false;
          const pmColor = pmBooking?.room?.name
            ? getRoomColor(pmBooking.room.name, pmBooking.room.color)
            : "";
          const pmTextColor =
            pmBooking?.guest?.name === "AirBnB" ? "text-white" : "text-black font-bold";

          const defaultLabel = pmBooking
            ? pmBooking.guest?.name === "AirBnB" && pmBooking.alias
              ? `${pmBooking.alias} (A)`
              : pmBooking.guest?.name ?? ""
            : "";
          const pmName = pmBooking
            ? (resolveBarLabel ? resolveBarLabel(pmBooking) : defaultLabel)
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

          const prevDayHadNoPmForRoom = prevDay
            ? !prevDay.bookings.some((b) => b.room?.name === room.name)
            : false;

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
              className="row-span-1 h-full"
              style={{ position: "relative" }}
            >
              {amBooking && (
                <div
                  className={`${amColor} ${amIsEnd ? "rounded-r-lg" : ""}`}
                  style={{
                    position: "absolute",
                    top: "1px",
                    bottom: "1px",
                    left: "-1px",
                    right: amIsEnd ? "80%" : "-1px",
                  }}
                />
              )}
              {pmBooking ? (
                <div
                  className={`${pmColor} ${pmTextColor} flex items-center`}
                  style={{
                    position: "absolute",
                    top: "1px",
                    bottom: "1px",
                    left: pmIsStart ? "20%" : "-1px",
                    right: "-1px",
                    fontSize: `${textSize}rem`,
                    borderTopLeftRadius: pmIsStart ? "0.5rem" : undefined,
                    borderBottomLeftRadius: pmIsStart ? "0.5rem" : undefined,
                  }}
                >
                  {pmNameContent}
                </div>
              ) : isRoomBlocked ? (
                <div
                  className="react-calendar__room_blocked_bar"
                  style={{
                    position: "absolute",
                    top: "1px",
                    bottom: "1px",
                    left: "20%",
                    right: "0",
                  }}
                />
              ) : !isBefore(date, startOfToday()) ? (
                <div
                  className="react-calendar__opportunity_pm rounded-r-lg"
                  style={{
                    position: "absolute",
                    top: "1px",
                    bottom: "1px",
                    left: "20%",
                    right: "-20%",
                    borderTopLeftRadius: "0.5rem",
                    borderBottomLeftRadius: "0.5rem",
                  }}
                />
              ) : null}
              {!amBooking &&
                prevDayHadNoPmForRoom &&
                getDay(date) === 0 &&
                !isBefore(date, startOfToday()) && (
                  <div
                    className="react-calendar__opportunity_pm absolute"
                    style={{
                      top: "1px",
                      bottom: "1px",
                      left: "-1px",
                      right: "80%",
                      borderTopRightRadius: "0.5rem",
                      borderBottomRightRadius: "0.5rem",
                    }}
                  />
                )}
            </div>
          );
        })}
      </>
    );
  };

  // Use double-click detection only when onDoubleClick is provided (TiMag).
  // TiBook gets an instant click with no delay.
  const getDayContent = useDoubleClick<Date>(
    onDateClick ?? (() => {}),
    onDoubleClick ?? (() => {}),
  );
  const handleTileClick = (date: Date) =>
    onDoubleClick ? getDayContent(date) : onDateClick?.(date);

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
                  borderTop: "1px solid #d1d5db",
                  borderLeft: "1px solid #d1d5db",
                }}
              >
                {layout.cells.map((date, cellIdx) => {
                  if (!date) return <div key={cellIdx} />;
                  const classes = getTileClasses(date, layout.month);
                  const content = getTileContent(date);
                  return (
                    <button
                      key={cellIdx}
                      type="button"
                      className={classes.join(" ")}
                      onClick={() => handleTileClick(date)}
                      style={
                        { "--max-rows": (maxRooms + 1).toString() } as React.CSSProperties
                      }
                    >
                      <abbr aria-label={date.toLocaleDateString()}>{date.getDate()}</abbr>
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

export default CalendarGrid;