import { useEffect, useMemo, useRef, useState } from "react";
import "../../../styles/calendarStyle.css";
import { addDays, getDay, isBefore, isSameDay, isSameMonth, startOfToday } from "date-fns";
import { dayType } from "../../../util/types/dayType";
import { roomType } from "../../../util/types/roomType";
import { useTiBookTheme } from "../../../contexts/TiBookThemeContext";

interface GuestCalendarProps {
  currentMonth: Date;
  monthMap: Map<string, dayType>;
  rooms: roomType[];
  selectedRoomIds: Set<string> | null;
  cartDates: Map<string, string | null>;
  wishListDates?: Set<string>;
  scrollToTodayTrigger?: number;
  onMonthChange?: (month: Date) => void;
  onDateClick?: (date: Date) => void;
  onWishListClick?: (date: Date) => void;
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
  scrollToTodayTrigger = 0,
  onMonthChange,
  onDateClick,
  onWishListClick,
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
    }
  }, [scrollToTodayTrigger]);

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
    const day = monthMap.get(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`);
    if (!day) return { status: "available", roomsLeft: total };
    if (day.isBlocked) return { status: "blocked", roomsLeft: 0 };
    const bookedIds = new Set(day.bookings.map((b) => b.room?.id).filter(Boolean));
    const bookedScoped = scopedRooms.filter((r) => bookedIds.has(r.id)).length;
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

    const numberClass = [
      "text-sm sm:text-xl leading-none select-none",
      inCart ? "font-bold text-white" :
      (status === "available" || status === "partial") ? `font-bold ${theme.textPrimary}` :
      status === "past"      ? "text-gray-300" :
                               "text-gray-300 line-through",
    ].join(" ");

    const tileClass = [
      "border-r border-b border-gray-300 flex flex-col items-center justify-center gap-1 w-full h-full relative",
      isToday ? "react-calendar__custom_tile_today" : "",
      isOutside ? "opacity-20 pointer-events-none" : "",
      inCart ? "cursor-pointer" :
      canBook ? `cursor-pointer ${theme.tileHover} ${theme.tileActive} transition-colors` :
      canWishList ? "cursor-pointer hover:bg-amber-50 transition-colors" : "cursor-default",
    ].join(" ");

    return (
      <button
        key={date.toISOString()}
        type="button"
        className={tileClass}
        disabled={!canBook && !inCart && !canWishList}
        onClick={
          canBook || inCart ? () => onDateClick?.(date) :
          canWishList ? () => onWishListClick!(date) :
          undefined
        }
      >
        {inCart && (
          <div className={`absolute inset-1 rounded-lg ${theme.btn} pointer-events-none`} />
        )}
        <span className={`${numberClass} relative z-10`}>{date.getDate()}</span>
        {!inCart && (status === "available" || status === "partial") && roomsLeft > 0 && (
          <span className="text-[9px] font-semibold text-black leading-none">
            {roomsLeft} left
          </span>
        )}
        {!inCart && (status === "full" || status === "blocked") && (
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-[9px] text-gray-300 leading-none">sold out</span>
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
        {inCart && (
          <span className="text-[9px] text-white/70 leading-none relative z-10">✓</span>
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