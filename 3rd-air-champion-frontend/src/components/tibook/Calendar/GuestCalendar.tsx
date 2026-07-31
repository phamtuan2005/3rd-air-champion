import { useEffect, useMemo, useRef, useState } from "react";
import "../../../styles/calendarStyle.css";
import { addDays, getDay, isBefore, isSameDay, isSameMonth, parseISO, startOfToday } from "date-fns";
import { dayType } from "../../../util/types/dayType";
import { roomType } from "../../../util/types/roomType";
import { getRoomColor } from "../../../util/getRoomColor";
import { useTiBookTheme } from "../../../contexts/TiBookThemeContext";

// A guest's own confirmed stay, drawn as a spanning bar (not a dot).
export interface MyStay {
  id: string; // booking id — tapping the span opens this stay's detail
  startKey: string; // yyyy-MM-dd check-in
  nights: number;
  roomName: string;
  roomColor?: string;
}

interface GuestCalendarProps {
  currentMonth: Date;
  monthMap: Map<string, dayType>;
  rooms: roomType[];
  selectedRoomIds: Set<string> | null;
  cartDates: Map<string, string | null>;
  wishListDates?: Set<string>;
  newWishListDates?: Set<string>;
  myBookingDates?: Set<string>;
  myStays?: MyStay[];
  reservedMap?: Map<string, Set<string>>;
  scrollToTodayTrigger?: number;
  scrollToMonthTrigger?: { month: Date; seq: number };
  simplified?: boolean;
  onMonthChange?: (month: Date) => void;
  onDateClick?: (date: Date) => void;
  onWishListClick?: (date: Date) => void;
  onMyStayClick?: (bookingId: string) => void;
}

const NUM_ROWS = 6;
const MONTHS_FORWARD = 36;

const buildMonthCells = (month: Date): (Date | null)[] => {
  const cells: (Date | null)[] = Array(NUM_ROWS * 7).fill(null);
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1);
  const lastDay = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  const startCol = getDay(firstDay);

  for (let i = 0; i < startCol; i++) {
    cells[i] = addDays(firstDay, i - startCol);
  }
  for (let i = 0; i < lastDay.getDate(); i++) {
    cells[startCol + i] = new Date(month.getFullYear(), month.getMonth(), i + 1);
  }
  const lastFilled = startCol + lastDay.getDate();
  for (let i = lastFilled; i < NUM_ROWS * 7; i++) {
    cells[i] = addDays(lastDay, i - lastFilled + 1);
  }
  return cells;
};

type TileStatus = "available" | "partial" | "full" | "blocked" | "past";

const GuestCalendar = ({
  currentMonth,
  monthMap,
  rooms,
  selectedRoomIds,
  cartDates,
  wishListDates,
  newWishListDates,
  myStays,
  reservedMap,
  scrollToTodayTrigger = 0,
  scrollToMonthTrigger,
  simplified = false,
  onMonthChange,
  onDateClick,
  onWishListClick,
  onMyStayClick,
}: GuestCalendarProps) => {
  const { theme } = useTiBookTheme();
  const [months, setMonths] = useState<Date[]>([]);
  const [visibleIndex, setVisibleIndex] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const visibleIndexRef = useRef(0);

  const rowHeight = containerHeight > 0 ? Math.floor(containerHeight / NUM_ROWS) : 80;

  const scopedRooms = useMemo(
    () => rooms.filter((r) => r.active && (selectedRoomIds === null || selectedRoomIds.has(r.id))),
    [rooms, selectedRoomIds],
  );

  // The guest's own stays as bar segments per day: a PM segment on every night
  // (check-in day starts at 20%), and an AM cap on the check-out morning — the
  // same PM-checkin/AM-checkout geometry as the TiMag calendar, so a stay reads
  // as a continuous colored ribbon instead of scattered dots.
  const dk = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const stayBars = useMemo(() => {
    const map = new Map<
      string,
      {
        pm?: { id: string; roomName: string; roomColor?: string; isStart: boolean };
        am?: { id: string; roomName: string; roomColor?: string };
      }
    >();
    (myStays ?? []).forEach((s) => {
      if (!s.nights || s.nights < 1) return;
      const start = parseISO(s.startKey);
      for (let i = 0; i < s.nights; i++) {
        const k = dk(addDays(start, i));
        map.set(k, { ...map.get(k), pm: { id: s.id, roomName: s.roomName, roomColor: s.roomColor, isStart: i === 0 } });
      }
      const co = dk(addDays(start, s.nights));
      map.set(co, { ...map.get(co), am: { id: s.id, roomName: s.roomName, roomColor: s.roomColor } });
    });
    return map;
  }, [myStays]);

  useEffect(() => {
    const now = new Date();
    const arr: Date[] = [];
    for (let i = 0; i <= MONTHS_FORWARD; i++) {
      arr.push(new Date(now.getFullYear(), now.getMonth() + i, 1));
    }
    setMonths(arr);
  }, []);

  useEffect(() => {
    if (scrollContainerRef.current && months.length > 0) {
      const today = new Date();
      const monthDiff =
        (currentMonth.getFullYear() - today.getFullYear()) * 12 +
        (currentMonth.getMonth() - today.getMonth());
      const targetIndex = Math.max(0, monthDiff);
      const h = scrollContainerRef.current.offsetHeight;
      scrollContainerRef.current.scrollTop = targetIndex * h;
      visibleIndexRef.current = targetIndex;
    }
  }, [months]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (scrollToTodayTrigger > 0 && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
      visibleIndexRef.current = 0;
      setVisibleIndex(0);
    }
  }, [scrollToTodayTrigger]);

  useEffect(() => {
    if (!scrollToMonthTrigger || !months.length || !scrollContainerRef.current) return;
    const today = new Date();
    const idx = Math.max(0,
      (scrollToMonthTrigger.month.getFullYear() - today.getFullYear()) * 12 +
      (scrollToMonthTrigger.month.getMonth() - today.getMonth())
    );
    const h = scrollContainerRef.current.offsetHeight;
    scrollContainerRef.current.scrollTop = idx * h;
    visibleIndexRef.current = idx;
    setVisibleIndex(idx);
  }, [scrollToMonthTrigger]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const pageLayouts = useMemo(
    () => months.map((month) => ({ month, cells: buildMonthCells(month) })),
    [months],
  );

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.target as HTMLElement;
    const h = el.offsetHeight;
    const snappedIndex = Math.round(el.scrollTop / h);

    if (Math.abs(snappedIndex - visibleIndexRef.current) > 1) {
      el.scrollTop = visibleIndexRef.current * h;
      return;
    }

    const snappedMonth = months[snappedIndex];
    if (snappedMonth) {
      onMonthChange?.(snappedMonth);
      setVisibleIndex(snappedIndex);
      visibleIndexRef.current = snappedIndex;
    }
  };

  const getStatus = (date: Date): { status: TileStatus; roomsLeft: number } => {
    if (isBefore(date, startOfToday())) return { status: "past", roomsLeft: 0 };
    const total = scopedRooms.length;
    const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    const day = monthMap.get(dateKey);
    if (day?.isBlocked) return { status: "blocked", roomsLeft: 0 };
    // Unavailable = booked + reserved + host-blocked rooms. Per-room blocks live in day.blockedRooms
    // (day.isBlocked only covers whole-day blocks); without them, blocked rooms stayed bookable here.
    const unavailableIds = new Set<string>(day?.bookings.map((b) => b.room?.id).filter(Boolean) as string[] ?? []);
    reservedMap?.get(dateKey)?.forEach((id) => unavailableIds.add(id));
    day?.blockedRooms?.forEach((r) => { if (r?.id) unavailableIds.add(r.id); });
    const bookedScoped = scopedRooms.filter((r) => unavailableIds.has(r.id)).length;
    const roomsLeft = Math.max(total - bookedScoped, 0);
    if (roomsLeft === 0) return { status: "full", roomsLeft: 0 };
    if (bookedScoped > 0) return { status: "partial", roomsLeft };
    return { status: "available", roomsLeft: total };
  };

  const renderTile = (date: Date, pageMonth: Date) => {
    const isOutside = !isSameMonth(date, pageMonth);
    const isToday = isSameDay(date, startOfToday());
    const { status, roomsLeft } = getStatus(date);
    const canBook = !isOutside && (status === "available" || status === "partial");
    const canWishList = !isOutside && !!onWishListClick && (status === "full" || status === "blocked");
    const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    const inCart = cartDates.has(dateKey);
    const isWishlisted = wishListDates?.has(dateKey) ?? false;
    const isNewWishList = newWishListDates?.has(dateKey) ?? false;
    const bars = stayBars.get(dateKey);
    const hasStay = (!!bars?.pm || !!bars?.am) && !inCart;
    const stayId = bars?.pm?.id ?? bars?.am?.id;

    const numberClass = [
      "text-sm sm:text-xl leading-none select-none",
      inCart ? "font-bold text-white" :
      isWishlisted ? "text-gray-500 line-through" :
      (status === "available" || status === "partial") ? `font-bold ${theme.textPrimary}` :
      status === "past"      ? "text-gray-300" :
                               "text-gray-300 line-through",
    ].join(" ");

    const tileClass = [
      // Day number sits near the TOP of the cell (matches TiMag); the stay ribbon
      // lives at the bottom.
      "border-r border-b border-gray-300 flex flex-col items-center justify-start gap-0.5 pt-1 w-full h-full relative",
      isToday ? "react-calendar__custom_tile_today" : "",
      isOutside ? "opacity-20 pointer-events-none" : "",
      inCart ? "cursor-pointer" :
      hasStay ? "cursor-pointer" :
      canBook ? `cursor-pointer ${theme.tileHover} ${theme.tileActive} transition-colors` :
      canWishList ? "cursor-pointer hover:bg-gray-100 transition-colors" : "cursor-default",
    ].join(" ");

    return (
      <button
        key={date.toISOString()}
        type="button"
        className={tileClass}
        disabled={!canBook && !inCart && !canWishList && !hasStay}
        onClick={
          hasStay && stayId ? () => onMyStayClick?.(stayId) :
          canBook || inCart ? () => onDateClick?.(date) :
          canWishList ? () => onWishListClick!(date) :
          undefined
        }
      >
        {inCart && (
          <div className={`absolute inset-1 rounded-lg ${theme.btn} pointer-events-none`} />
        )}
        {isNewWishList && !inCart && (
          <div className="absolute inset-1 rounded-lg bg-gray-200 pointer-events-none" />
        )}
        <span className={`${numberClass} relative z-10`}>{date.getDate()}</span>
        {/* Availability stays visible whether or not the night is picked — it's
            info the guest wants either way; a ✓ marks it selected. */}
        {!simplified && (status === "available" || status === "partial") && roomsLeft > 0 && (
          <span
            className={`relative z-10 text-[9px] font-semibold leading-none ${inCart ? "text-white" : "text-black"}`}
          >
            {inCart ? "✓ " : ""}
            {roomsLeft} left
          </span>
        )}
        {!simplified && !inCart && !hasStay && (status === "full" || status === "blocked") && (
          <div className="relative z-10 flex flex-col items-center gap-0.5">
            {/* Keep "sold out" visible even when wish-listed — the gray wish-list
                overlay otherwise hides it and the date looks bookable again. */}
            <span className="text-[9px] font-medium text-gray-500 leading-none">sold out</span>
            {canWishList && (
              <span
                className="text-[11px] leading-none z-10 relative cursor-pointer"
                title={isWishlisted ? "Remove from wish list" : "Add to wish list"}
                onClick={(e) => { e.stopPropagation(); onWishListClick!(date); }}
              >
                {isWishlisted ? "★" : "☆"}
              </span>
            )}
          </div>
        )}
        {/* The guest's own stay — a spanning ribbon (AM checkout cap + PM
            check-in/continuing bar) that connects across cells, room-colored,
            labelled with the room on the check-in day. */}
        {bars?.am && !inCart && (
          <div
            className={`${getRoomColor(bars.am.roomName, bars.am.roomColor)} rounded-r-lg pointer-events-none`}
            style={{ position: "absolute", bottom: "5px", height: "20px", left: "-1px", right: "80%" }}
          />
        )}
        {bars?.pm && !inCart && (
          <div
            className={`${getRoomColor(bars.pm.roomName, bars.pm.roomColor)} pointer-events-none flex items-center overflow-hidden`}
            style={{
              position: "absolute",
              bottom: "5px",
              height: "20px",
              left: bars.pm.isStart ? "20%" : "-1px",
              right: "-1px",
              borderTopLeftRadius: bars.pm.isStart ? "0.5rem" : undefined,
              borderBottomLeftRadius: bars.pm.isStart ? "0.5rem" : undefined,
            }}
          >
            {bars.pm.isStart && (
              <span className="truncate px-1 text-[11px] font-bold leading-none text-black sm:text-xs">
                {bars.pm.roomName}
              </span>
            )}
          </div>
        )}
      </button>
    );
  };

  return (
    <div
      ref={scrollContainerRef}
      className="flex-1 min-h-0 overflow-y-scroll snap-y snap-mandatory"
      onScroll={handleScroll}
    >
      {pageLayouts.map((layout, index) => {
        const inWindow = Math.abs(index - visibleIndex) <= 1;
        return (
          <div key={index} className="snap-start h-full">
            {inWindow && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(7, 1fr)",
                  gridTemplateRows: `repeat(${NUM_ROWS}, ${rowHeight}px)`,
                  height: "100%",
                  width: "100%",
                  borderTop: "1px solid #d1d5db",
                  borderLeft: "1px solid #d1d5db",
                }}
              >
                {layout.cells.map((date, cellIdx) =>
                  date ? (
                    renderTile(date, layout.month)
                  ) : (
                    <div key={cellIdx} className="border-r border-b border-gray-300" />
                  ),
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default GuestCalendar;