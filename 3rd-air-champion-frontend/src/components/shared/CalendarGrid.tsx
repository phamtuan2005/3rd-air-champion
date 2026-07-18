import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import "../../styles/calendarStyle.css";
import {
  addDays,
  endOfMonth,
  getDay,
  isAfter,
  isBefore,
  isSameDay,
  isSameMonth,
  startOfToday,
} from "date-fns";
import { dayType } from "../../util/types/dayType";
import { bookingType } from "../../util/types/bookingType";
import { roomType } from "../../util/types/roomType";
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
  // TiMag guest mode: soft-hold dates selected for confirm-to-firm
  holdDates?: Date[];
  // TiMag guest mode: pre-filtered room list, bypasses active filter
  overrideRooms?: roomType[];
  onMonthChange: (month: Date) => void;
  // TiBook: instant single click; TiMag: uses double-click detection (300ms delay)
  onDateClick?: (date: Date) => void;
  onDoubleClick?: (date: Date) => void;
  // TiMag: guest name; TiBook: room name
  resolveBarLabel?: (booking: bookingType) => string;
  gapsMode?: boolean;
  // Reports whether today's tile is on the currently visible page (a month can span
  // several pages, so "current month" no longer implies "today is on screen").
  onTodayInViewChange?: (inView: boolean) => void;
}

const SUBROW_HEIGHT = 20;

// Key a grid cell by its LOCAL calendar day. date.toISOString() converts to UTC, which
// shifts the day for east-of-UTC timezones and breaks monthMap lookups; local components
// stay stable in every timezone and match the monthMap keys.
const localDateKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

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
  holdDates = [],
  overrideRooms,
  onMonthChange,
  onDateClick,
  onDoubleClick,
  resolveBarLabel,
  gapsMode = false,
  onTodayInViewChange,
}: CalendarGridProps) => {
  const [months, setMonths] = useState<Date[]>([]);
  const [visibleIndex, setVisibleIndex] = useState<number>(monthsBack);
  const [tileWidth, setTileWidth] = useState<number | null>(null);
  const [containerHeight, setContainerHeight] = useState(0);
  const [pageLayouts, setPageLayouts] = useState<PageLayout[]>([]);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const calendarWrapperRef = useRef<HTMLDivElement>(null);
  const visibleIndexRef = useRef<number>(monthsBack);
  // Track the month currently in view (not just the page index) so we can re-anchor
  // to the same month when the page count changes — e.g. rooms added, container resized.
  const visibleMonthRef = useRef<Date>(currentMonth);
  const didInitScrollRef = useRef(false);
  // While the layout reflows (rooms filtered, resized), the page count changes and the
  // browser fires transient scroll events from the old scrollTop. Ignore scroll handling
  // until this timestamp so a reflow can't hijack the visible month to a far page.
  const suppressScrollUntilRef = useRef(0);

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

  // A month may span several pages; map each month to the index of its first page.
  const monthPageStarts = useMemo(() => {
    const map = new Map<string, number>();
    pageLayouts.forEach((l, i) => {
      const key = `${l.month.getFullYear()}-${l.month.getMonth()}`;
      if (!map.has(key)) map.set(key, i);
    });
    return map;
  }, [pageLayouts]);

  const firstPageIndexOfMonth = (d: Date) =>
    monthPageStarts.get(`${d.getFullYear()}-${d.getMonth()}`) ?? null;

  // The page whose cells actually contain this date (today may sit on page 2/3 of its month).
  const pageIndexContainingDate = (d: Date) => {
    const idx = pageLayouts.findIndex((l) => l.cells.some((c) => c && isSameDay(c, d)));
    return idx >= 0 ? idx : null;
  };

  useEffect(() => {
    const now = new Date();
    const arr: Date[] = [];
    for (let i = -monthsBack; i <= 36; i++) {
      arr.push(new Date(now.getFullYear(), now.getMonth() + i, 1));
    }
    setMonths(arr);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Anchor to the visible month's first page whenever the page layout changes
  // (initial load, container resize, rooms added/removed). Because a month can now
  // own multiple pages, page indices shift when rows-per-page changes — re-deriving
  // from the month keeps the same month on screen instead of drifting.
  // useLayoutEffect: re-anchor synchronously after the DOM mutates and BEFORE paint, so the
  // correct scrollTop is in place before the browser dispatches any reflow scroll event.
  useLayoutEffect(() => {
    const el = scrollContainerRef.current;
    if (!el || pageLayouts.length === 0) return;
    const h = el.offsetHeight;
    if (h === 0) return;
    // First positioning lands on the page that actually contains today; later runs
    // (resize / rooms changed) re-anchor to the visible month so we don't drift.
    let idx: number | null;
    if (!didInitScrollRef.current) {
      // A remount can happen mid-session — e.g. an AirBnB price edit flips
      // isCalendarLoading, which unmounts and remounts the grid. If the user was
      // viewing another month, re-anchor to THAT month instead of snapping to today.
      const anchor = visibleMonthRef.current;
      const today = startOfToday();
      const anchorIsThisMonth =
        anchor.getFullYear() === today.getFullYear() && anchor.getMonth() === today.getMonth();
      idx = anchorIsThisMonth
        ? (pageIndexContainingDate(today) ?? firstPageIndexOfMonth(anchor))
        : firstPageIndexOfMonth(anchor);
      didInitScrollRef.current = true;
    } else {
      idx = firstPageIndexOfMonth(visibleMonthRef.current);
    }
    const target = idx ?? 0;
    el.scrollTop = target * h;
    visibleIndexRef.current = target;
    // Ignore scroll events briefly so the reflow's transient scroll can't override the anchor.
    suppressScrollUntilRef.current = performance.now() + 250;
    setVisibleIndex(target);
  }, [pageLayouts, containerHeight]); // eslint-disable-line react-hooks/exhaustive-deps

  // Tell the parent whether today is on the visible page (drives the Today button).
  useEffect(() => {
    if (!onTodayInViewChange) return;
    const cells = pageLayouts[visibleIndex]?.cells ?? [];
    onTodayInViewChange(cells.some((c) => c && isSameDay(c, startOfToday())));
  }, [visibleIndex, pageLayouts, onTodayInViewChange]);

  useEffect(() => {
    if (scrollToTodayTrigger > 0 && scrollContainerRef.current && pageLayouts.length > 0) {
      const today = new Date();
      const idx = pageIndexContainingDate(startOfToday()) ?? firstPageIndexOfMonth(today) ?? monthsBack;
      const h = scrollContainerRef.current.offsetHeight;
      scrollContainerRef.current.scrollTop = idx * h;
      visibleIndexRef.current = idx;
      visibleMonthRef.current = new Date(today.getFullYear(), today.getMonth(), 1);
      setVisibleIndex(idx);
    }
  }, [scrollToTodayTrigger]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    // Only record the height here; the month-anchor effect (keyed on containerHeight)
    // owns scroll positioning so it always re-derives the page from the visible month.
    // Tile width = container / 7 (the grid is 7 equal columns). Deriving it here instead
    // of measuring a rendered tile avoids the first-load race where no tile exists yet,
    // which left tileWidth null and let guest names overflow across tiles until a scroll.
    const obs = new ResizeObserver(([entry]) => {
      setContainerHeight(entry.contentRect.height);
      setTileWidth(entry.contentRect.width / 7);
    });
    obs.observe(el);
    setContainerHeight(el.clientHeight);
    setTileWidth(el.clientWidth / 7);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (months.length === 0 || numRows <= 0) return;
    const layouts: PageLayout[] = [];
    const totalCells = numRows * 7;

    for (const month of months) {
      const monthStart = new Date(month.getFullYear(), month.getMonth(), 1);
      const monthEnd = new Date(month.getFullYear(), month.getMonth() + 1, 0);
      // Each month is self-contained: if its weeks don't fit in one page, emit
      // continuation pages for the SAME month rather than spilling into the next.
      let pageStart: Date = monthStart;
      let isFirstPage = true;

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const cells: (Date | null)[] = Array(totalCells).fill(null);
        let cellIdx = getDay(pageStart);
        let cur: Date = pageStart;
        while (cellIdx < totalCells && !isAfter(cur, monthEnd)) {
          cells[cellIdx] = cur;
          cur = addDays(cur, 1);
          cellIdx++;
        }

        // Leading neighbor-month days only on the month's first page (for week alignment).
        if (isFirstPage) {
          const startCol = getDay(monthStart);
          for (let i = 0; i < startCol; i++) {
            cells[i] = addDays(monthStart, i - startCol);
          }
        }

        layouts.push({ month, cells });

        if (isAfter(cur, monthEnd)) break; // month fully placed
        // A page only overflows when it filled completely (last cell = Saturday),
        // so the continuation always resumes on the next Sunday — week alignment holds.
        pageStart = cur;
        isFirstPage = false;
      }
    }

    setPageLayouts(layouts);
  }, [months, numRows]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    // Skip scrolls fired by a layout reflow (the page count just changed) — they carry a
    // stale scrollTop that would otherwise re-point the visible month to the wrong page.
    if (performance.now() < suppressScrollUntilRef.current) return;
    const el = e.target as HTMLElement;
    const calendarHeight = el.offsetHeight;
    const snappedIndex = Math.round(el.scrollTop / calendarHeight);

    if (Math.abs(snappedIndex - visibleIndexRef.current) > 1) {
      el.scrollTop = visibleIndexRef.current * calendarHeight;
      return;
    }

    const layout = pageLayouts[snappedIndex];
    if (layout) {
      onMonthChange(layout.month);
      visibleMonthRef.current = layout.month;
      setVisibleIndex(snappedIndex);
      visibleIndexRef.current = snappedIndex;
    }
  };

  const getTileClasses = (date: Date, pageMonth: Date) => {
    const className = ["react-calendar__custom_tile"];
    if (isSameDay(date, startOfToday())) className.push("react-calendar__custom_tile_today");
    const day = monthMap.get(localDateKey(date));
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
    if (holdDates.some((hd) => isSameDay(hd, date)))
      className.push("react-calendar__custom_tile_hold");
    if (!isSameMonth(date, pageMonth)) className.push("react-calendar__custom_tile_outside");
    return className;
  };

  const getTileContent = (date: Date) => {
    const day = monthMap.get(localDateKey(date));
    const prevDay = monthMap.get(localDateKey(addDays(date, -1)));

    // Compare calendar days as yyyy-MM-dd strings — timezone-stable and consistent with the
    // monthMap keys. (isSameDay + toZonedTime shifted bars by a day off the host's timezone.)
    const cellKey = localDateKey(date);
    const dayKey = (d: string | Date) => String(d).slice(0, 10);
    const addDayKey = (key: string, n: number) =>
      localDateKey(addDays(new Date(`${key}T12:00:00`), n));

    const checkoutBookings: bookingType[] = prevDay
      ? prevDay.bookings.filter((b) =>
          b.endDate && b.room && b.guest
            ? cellKey === addDayKey(dayKey(b.endDate), 1) &&
              (!selectedRoomName || b.room.name === selectedRoomName)
            : false,
        )
      : [];

    const filteredDay =
      day && selectedRoomName
        ? { ...day, bookings: day.bookings.filter((b) => b.room?.name === selectedRoomName) }
        : day;

    const blockedRoomIds = new Set((day?.blockedRooms ?? []).map((r) => r.id));

    const usedRoomIdSet = new Set(usedRooms.map((r) => r.id));

    const sortedUsedRooms = [...usedRooms]
      .filter((r) => !selectedRoomName || r.name === selectedRoomName)
      .sort((a, b) => a.name.localeCompare(b.name));

    for (const blockedRoom of day?.blockedRooms ?? []) {
      if (!selectedRoomName || blockedRoom.name === selectedRoomName) {
        if (!sortedUsedRooms.find((r) => r.id === blockedRoom.id)) {
          if (usedRoomIdSet.has(blockedRoom.id)) sortedUsedRooms.push(blockedRoom);
        }
      }
    }
    sortedUsedRooms.sort((a, b) => a.name.localeCompare(b.name));

    if (!filteredDay && checkoutBookings.length === 0 && blockedRoomIds.size === 0) {
      if (sortedUsedRooms.length === 0 || overrideRooms) return null;
    }

    const gridContent: Record<string, { am: bookingType | null; pm: bookingType | null }> = {};
    sortedUsedRooms.forEach((room) => {
      gridContent[room.name] = { am: null, pm: null };
    });

    const ensureGridRow = (room: roomType) => {
      if (!gridContent[room.name] && usedRoomIdSet.has(room.id)) {
        gridContent[room.name] = { am: null, pm: null };
        sortedUsedRooms.push(room);
      }
    };

    checkoutBookings.forEach((booking) => {
      ensureGridRow(booking.room);
      if (!gridContent[booking.room.name]) return;
      gridContent[booking.room.name].am = booking;
    });

    if (filteredDay) {
      filteredDay.bookings.forEach((booking) => {
        if (!booking.startDate || !booking.endDate || !booking.room || !booking.guest) return;
        const startKey = dayKey(booking.startDate);
        const endKey = dayKey(booking.endDate);
        const isStart = cellKey === startKey;
        const isBetween = !isStart && cellKey > startKey && cellKey <= endKey;
        ensureGridRow(booking.room);
        if (!gridContent[booking.room.name]) return;
        if (isBetween) gridContent[booking.room.name].am = booking;
        if (isStart || isBetween) gridContent[booking.room.name].pm = booking;
      });
    }

    sortedUsedRooms.sort((a, b) => a.name.localeCompare(b.name));

    // Gaps mode: replace all bars with green availability bars
    if (gapsMode) {
      const isFutureOrToday = !isBefore(date, startOfToday());
      const isSunday = getDay(date) === 0;
      return (
        <>
          {sortedUsedRooms.map((room) => {
            if (!isFutureOrToday) return <div key={room.name} className="row-span-1 h-full" />;

            const { pm: pmBooking } = gridContent[room.name] ?? { am: null, pm: null };
            const roomColor = getRoomColor(room.name, room.color);

            // A blocked room is unavailable, not an open gap — show nothing for it.
            if (pmBooking !== null || blockedRoomIds.has(room.id)) {
              return <div key={room.name} className="row-span-1 h-full" />;
            }

            // Room is free tonight — identical geometry to opportunity_row, room color instead of amber dashed
            const prevDayNoPm = prevDay
              ? !prevDay.bookings.some((b) => b.room?.name === room.name)
              : true;
            return (
              <div key={room.name} className="row-span-1 h-full relative">
                {/* Sunday AM cap — same condition as opportunity_row */}
                {isSunday && prevDayNoPm && (
                  <div
                    className={roomColor}
                    style={{
                      position: "absolute",
                      top: "1px",
                      bottom: "1px",
                      left: "-1px",
                      right: "80%",
                      borderTopRightRadius: "0.5rem",
                      borderBottomRightRadius: "0.5rem",
                    }}
                  />
                )}
                <div
                  className={`${roomColor} flex items-center overflow-hidden rounded-lg`}
                  style={{
                    position: "absolute",
                    top: "1px",
                    bottom: "1px",
                    left: "20%",
                    right: "-20%",
                    fontSize: "0.65rem",
                    fontWeight: 700,
                    paddingLeft: "4px",
                  }}
                >
                  {room.name}
                </div>
              </div>
            );
          })}
        </>
      );
    }

    const textSize = 0.65;

    return (
      <>
        {sortedUsedRooms.map((room) => {
          const { am: amBooking, pm: pmBooking } = gridContent[room.name];
          const isRoomBlocked = blockedRoomIds.has(room.id);
          // Blocked bars follow the same PM-checkin / AM-checkout geometry as bookings:
          // the block's first night starts at 20%, and the morning after its last night
          // gets a hatched AM cap (0–20%) instead of ending abruptly at midnight.
          const prevRoomBlocked = prevDay
            ? (prevDay.blockedRooms ?? []).some((r) => r.id === room.id)
            : false;

          if (!amBooking && !pmBooking) {
            if (overrideRooms && !isRoomBlocked) return <div key={room.name} className="row-span-1 h-full" />;
            const isFutureOrToday = !isBefore(date, startOfToday());
            if (isRoomBlocked) {
              return (
                <div key={room.name} className="row-span-1 h-full relative">
                  <div
                    className="react-calendar__room_blocked_bar absolute"
                    style={{
                      top: "1px",
                      bottom: "1px",
                      left: prevRoomBlocked ? "-1px" : "20%",
                      right: "-1px",
                      borderTopLeftRadius: prevRoomBlocked ? undefined : "0.5rem",
                      borderBottomLeftRadius: prevRoomBlocked ? undefined : "0.5rem",
                    }}
                  />
                </div>
              );
            }
            const prevDayNoPm = prevDay
              ? !prevDay.bookings.some((b) => b.room?.name === room.name)
              : false;
            return (
              <div key={room.name} className="row-span-1 h-full relative">
                {/* Checkout-morning cap of a blocked range that ended last night */}
                {prevRoomBlocked && (
                  <div
                    className="react-calendar__room_blocked_bar absolute"
                    style={{ top: "1px", bottom: "1px", left: "-1px", right: "80%", borderTopRightRadius: "0.5rem", borderBottomRightRadius: "0.5rem" }}
                  />
                )}
                {isFutureOrToday && (
                  <div
                    className="react-calendar__opportunity_row absolute rounded-lg"
                    style={{ top: "1px", bottom: "1px", left: "20%", right: "-20%" }}
                  />
                )}
                {isFutureOrToday && prevDayNoPm && !prevRoomBlocked && getDay(date) === 0 && (
                  <div
                    className="react-calendar__opportunity_pm absolute"
                    style={{ top: "1px", bottom: "1px", left: "-1px", right: "80%", borderTopRightRadius: "0.5rem", borderBottomRightRadius: "0.5rem" }}
                  />
                )}
              </div>
            );
          }

          const amColor = amBooking?.room?.name
            ? getRoomColor(amBooking.room.name, amBooking.room.color)
            : "";
          const amIsEnd = amBooking?.endDate
            ? cellKey === addDayKey(dayKey(amBooking.endDate), 1)
            : false;
          const pmIsStart = pmBooking?.startDate ? cellKey === dayKey(pmBooking.startDate) : false;
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

          const isMissingProfit =
            pmBooking?.guest?.name === "AirBnB" && !pmBooking.airbnbPrice && !pmBooking.airbnbBlocked;

          const pmNameContent = pmIsStart ? (
            <span
              className="absolute top-auto left-1 truncate z-10 flex items-center gap-0.5"
              style={{ maxWidth: `${availableTileWidth - maxDuration * 3}px` }}
            >
              {isMissingProfit && (
                <span className="flex-shrink-0 bg-orange-400 text-white rounded-full text-[8px] font-bold px-1 leading-none py-px">
                  $?
                </span>
              )}
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
                    right: "-1px",
                    borderTopLeftRadius: "0.5rem",
                    borderBottomLeftRadius: "0.5rem",
                  }}
                />
              ) : !isBefore(date, startOfToday()) && !overrideRooms ? (
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
              {/* Checkout-morning cap of a blocked range that ended last night */}
              {!amBooking && prevRoomBlocked && (
                <div
                  className="react-calendar__room_blocked_bar absolute"
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
              {!amBooking &&
                prevDayHadNoPmForRoom &&
                !prevRoomBlocked &&
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
                      style={{ "--max-rows": (maxRooms + 1).toString() } as React.CSSProperties}
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