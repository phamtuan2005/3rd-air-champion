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
  reservedStays?: MyStay[]; // (R) holds — drawn as a distinct "pending" ribbon
  reservedMap?: Map<string, Set<string>>;
  scrollToTodayTrigger?: number;
  scrollToMonthTrigger?: { month: Date; seq: number };
  simplified?: boolean;
  onMonthChange?: (month: Date) => void;
  onDateClick?: (date: Date) => void;
  onWishListClick?: (date: Date) => void;
  onMyStayClick?: (bookingId: string) => void;
  onReservedClick?: () => void; // tapping a held night opens the pay-reminder popup
}

const NUM_ROWS = 6;
const MONTHS_FORWARD = 36;

// Amber diagonal hatch overlaid on a (R) hold's room color so it reads as
// "pending / tentative", clearly different from a solid confirmed stay.
// The square a 45° pattern of 9px period tiles into (9 / sin 45°). Needed
// because background-position only lines segments up once the gradient has a
// size of its own rather than the element's.
const HOLD_HATCH_TILE = 12.728;
const HOLD_HATCH =
  "repeating-linear-gradient(45deg, rgba(217,119,6,0.62) 0 4px, rgba(255,255,255,0) 4px 9px)";

// ── Type and bar geometry, derived from the tile height ──────────────────────
//
// Lifted from TiMag's CalendarGrid, which sizes a guest name and its bar's
// corner radius FROM the lane they sit in rather than fixing both independently.
// TiBook's calendar is drag-resizable up to the full window, but every size in
// it was a literal tuned for the smallest state — so growing the calendar bought
// empty space around 26px ribbons and 13px labels instead of a bigger calendar.
//
// REF_TILE is the height those literals were chosen at; every ratio below
// reproduces them exactly there, so nothing moves until the guest drags.
const REF_TILE = 80;

// One knob over every piece of type in the calendar, on top of the ratios.
//
// The ratios alone only reproduce the old literals at REF_TILE — they fix the
// empty space in a grown calendar but leave a normal-sized one reading exactly
// as small as it did. This lifts the whole family: the guest is reading a room
// name and a night count on their own phone, not a spreadsheet.
//
// Type only. The bar geometry keeps its own ratios so the ribbon stays a ribbon
// and the PM-checkin / AM-checkout alignment is untouched.
const TYPE_BOOST = 1.15;

const clamp = (min: number, v: number, max: number) => Math.min(max, Math.max(min, v));

// 26px at the reference tile. Capped, because past a point a ribbon stops
// reading as a ribbon and the cell becomes a solid block of room colour.
const barHeightFor = (tile: number) => Math.round(clamp(24, (tile / REF_TILE) * 26, 60));

// The gap beneath the ribbon — 5px at the reference tile.
const barBottomFor = (tile: number) => Math.round(clamp(4, (tile / REF_TILE) * 5, 12));

// 0.5rem on a 26px bar, and never more than half the bar: past halfway the
// opposite corners meet and the bar loses the straight edge it butts against the
// next night with. Same rule, and the same reason, as TiMag's barRadiusFor.
const barRadiusFor = (barHeight: number) =>
  `${Math.min(barHeight / 2, barHeight * (8 / 26)).toFixed(1)}px`;

// The room name is sized FROM its bar, not from the tile, so a taller ribbon can
// never leave a small name floating in the middle of it. Was 13px in a 26px bar.
const barLabelFor = (barHeight: number) =>
  `${clamp(13, barHeight * 0.5 * TYPE_BOOST, 26).toFixed(1)}px`;

// The day number. Deliberately NOT boosted, and capped well below the others:
// it is the least useful thing in the cell. What the guest is scanning for is
// "3 left" and the room on their ribbon — a date they can find from its column.
// Boosted, it became the loudest thing on a page it should stay quiet on.
const dateFor = (tile: number) =>
  `${clamp(13, (tile / REF_TILE) * 16, 24).toFixed(1)}px`;

// "3 left" / "sold out" — was 9px, the smallest type anywhere in TiBook and the
// line that actually answers "can I book this night".
const metaFor = (tile: number) =>
  `${clamp(11, (tile / REF_TILE) * 9 * TYPE_BOOST, 19).toFixed(1)}px`;

// The wish-list star and the ⏳ hold badge — was 11px.
const glyphFor = (tile: number) =>
  `${clamp(13, (tile / REF_TILE) * 11 * TYPE_BOOST, 24).toFixed(1)}px`;

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
  reservedStays,
  reservedMap,
  scrollToTodayTrigger = 0,
  scrollToMonthTrigger,
  simplified = false,
  onMonthChange,
  onDateClick,
  onWishListClick,
  onMyStayClick,
  onReservedClick,
}: GuestCalendarProps) => {
  const { theme } = useTiBookTheme();
  const [months, setMonths] = useState<Date[]>([]);
  const [visibleIndex, setVisibleIndex] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);
  // Grid is 7 equal columns, so a tile is a seventh of the scroller. Needed to
  // size a room label that spans more than the cell it starts in.
  const [tileWidth, setTileWidth] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const visibleIndexRef = useRef(0);

  const rowHeight = containerHeight > 0 ? Math.floor(containerHeight / NUM_ROWS) : REF_TILE;

  // Everything the tile draws, sized from the tile. Computed once per render
  // rather than per cell — 42 cells a page, and none of them differ.
  const barHeight = barHeightFor(rowHeight);
  const barBottom = barBottomFor(rowHeight);
  const barRadius = barRadiusFor(barHeight);
  const barLabelSize = barLabelFor(barHeight);
  const dateSize = dateFor(rowHeight);
  const metaSize = metaFor(rowHeight);
  const glyphSize = glyphFor(rowHeight);

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
        pm?: { id: string; roomName: string; roomColor?: string; isStart: boolean; nights: number };
        am?: { id: string; roomName: string; roomColor?: string };
      }
    >();
    (myStays ?? []).forEach((s) => {
      if (!s.nights || s.nights < 1) return;
      const start = parseISO(s.startKey);
      for (let i = 0; i < s.nights; i++) {
        const k = dk(addDays(start, i));
        map.set(k, { ...map.get(k), pm: { id: s.id, roomName: s.roomName, roomColor: s.roomColor, isStart: i === 0, nights: s.nights } });
      }
      const co = dk(addDays(start, s.nights));
      map.set(co, { ...map.get(co), am: { id: s.id, roomName: s.roomName, roomColor: s.roomColor } });
    });
    return map;
  }, [myStays]);

  // Same geometry for (R) HOLDS, drawn distinctly (see render) as "pending".
  const reservedBars = useMemo(() => {
    const map = new Map<
      string,
      {
        pm?: { roomName: string; roomColor?: string; isStart: boolean; nights: number };
        am?: { roomName: string; roomColor?: string };
      }
    >();
    (reservedStays ?? []).forEach((s) => {
      if (!s.nights || s.nights < 1) return;
      const start = parseISO(s.startKey);
      for (let i = 0; i < s.nights; i++) {
        const k = dk(addDays(start, i));
        map.set(k, { ...map.get(k), pm: { roomName: s.roomName, roomColor: s.roomColor, isStart: i === 0, nights: s.nights } });
      }
      const co = dk(addDays(start, s.nights));
      map.set(co, { ...map.get(co), am: { roomName: s.roomName, roomColor: s.roomColor } });
    });
    return map;
  }, [reservedStays]);

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

  // Apply a scroll-to-month request ONCE per trigger, but only once the calendar
  // is actually ready (months built + a real height). Depending on months +
  // containerHeight means a trigger that arrives before the calendar is laid out
  // (e.g. a returning guest's bookings resolving fast) still lands when it's
  // ready, instead of being silently dropped against a 0-height container.
  const appliedTriggerSeq = useRef(0);
  useEffect(() => {
    if (!scrollToMonthTrigger || scrollToMonthTrigger.seq === appliedTriggerSeq.current) return;
    const el = scrollContainerRef.current;
    if (!el || !months.length || el.offsetHeight <= 0) return;
    appliedTriggerSeq.current = scrollToMonthTrigger.seq;
    const today = new Date();
    const idx = Math.max(0,
      (scrollToMonthTrigger.month.getFullYear() - today.getFullYear()) * 12 +
      (scrollToMonthTrigger.month.getMonth() - today.getMonth())
    );
    el.scrollTop = idx * el.offsetHeight;
    visibleIndexRef.current = idx;
    setVisibleIndex(idx);
  }, [scrollToMonthTrigger, months, containerHeight]);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(([entry]) => {
      const h = entry.contentRect.height;
      setContainerHeight(h);
      setTileWidth(entry.contentRect.width / 7);
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
    // Only an OCCUPIED night (a PM bar) is "your stay" for interaction — it opens
    // the detail and isn't bookable. The AM checkout cap is a visual only: that
    // night is free again, so the cell stays bookable for a fresh check-in.
    const isStayNight = !!bars?.pm && !inCart;
    const stayId = bars?.pm?.id;
    // A held (R) night — occupied for this guest but unpaid. Tapping opens the pay
    // reminder. Confirmed stays win if a date somehow has both.
    const resBars = reservedBars.get(dateKey);
    const isReservedNight = !!resBars?.pm && !inCart && !isStayNight;

    // How wide a room name may run, in px.
    //
    // The ribbon's first night starts at 20% of its cell, so a 2-night "Queen"
    // had ~80% of one tile to live in and truncated to "Qu…". The bar continues
    // across the following cells, so the label may too — it is drawn once, on
    // the first night, and simply allowed to overhang.
    //
    // Clamped to the nights left in THIS week row: a wider span escapes the row
    // and paints over whatever the browser lays out to its right, which on the
    // next row is a different week entirely. Same clamp, and the same reason, as
    // TiMag's calendar labels.
    const labelWidthFor = (nights: number) => {
      if (!tileWidth) return undefined;
      const nightsInRow = Math.max(1, Math.min(nights, 7 - getDay(date)));
      // Less the 20% indent the first night starts at, and a little breathing
      // room so the name never runs flush into the next stay's bar.
      return tileWidth * nightsInRow - tileWidth * 0.2 - 8;
    };

    // One origin for the whole week row, so the stripes of a held stay carry on
    // across the seams between its nights instead of restarting at each.
    //
    // backgroundSize is not optional here. Without it a CSS gradient is sized to
    // its ELEMENT, and shifting the position of an element-sized gradient just
    // moves seams inside the bar rather than lining the segments up — which is
    // why the shift alone changed nothing. Pinning a fixed square tile gives the
    // pattern a period in x, and the shift then lands every segment on the same
    // phase. Same pairing calendarStyle.css already uses for blocked bars.
    //
    // 12.728 = the 9px stripe period at 45°, divided by sin 45° — the square
    // that a -45° pattern of that period tiles into.
    const hatchPhase = (leftPx: number): React.CSSProperties =>
      tileWidth
        ? {
            backgroundSize: `${HOLD_HATCH_TILE}px ${HOLD_HATCH_TILE}px`,
            backgroundPosition: `${-(getDay(date) * tileWidth + leftPx)}px 0px`,
          }
        : {};

    const numberClass = [
      // No text-* size here: the size comes from the tile, via dateSize below.
      "leading-none select-none",
      inCart ? "font-bold text-white" :
      isWishlisted ? "text-gray-500 line-through" :
      (status === "available" || status === "partial") ? `font-bold ${theme.textPrimary}` :
      status === "past"      ? "text-gray-300" :
                               "text-gray-300 line-through",
    ].join(" ");

    const tileClass = [
      // Day number sits near the TOP of the cell (matches TiMag); the stay ribbon
      // lives at the bottom.
      // overflow-visible: a room name on a multi-night stay is drawn once, on the
      // first night, and overhangs into the cells the ribbon continues through.
      // A button does not reliably let its content escape without being told to.
      "border-r border-b border-gray-300 flex flex-col items-center justify-start gap-0.5 pt-1 w-full h-full relative overflow-visible",
      isToday ? "react-calendar__custom_tile_today" : "",
      isOutside ? "opacity-20 pointer-events-none" : "",
      inCart ? "cursor-pointer" :
      isStayNight || isReservedNight ? "cursor-pointer" :
      canBook ? `cursor-pointer ${theme.tileHover} ${theme.tileActive} transition-colors` :
      canWishList ? "cursor-pointer hover:bg-gray-100 transition-colors" : "cursor-default",
    ].join(" ");

    return (
      <button
        key={date.toISOString()}
        type="button"
        className={tileClass}
        disabled={!canBook && !inCart && !canWishList && !isStayNight && !isReservedNight}
        onClick={
          isStayNight && stayId ? () => onMyStayClick?.(stayId) :
          isReservedNight ? () => onReservedClick?.() :
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
        <span className={`${numberClass} relative z-10`} style={{ fontSize: dateSize }}>
          {date.getDate()}
        </span>
        {/* Availability stays visible whether or not the night is picked — it's
            info the guest wants either way; a ✓ marks it selected. */}
        {!simplified && (status === "available" || status === "partial") && roomsLeft > 0 && (
          <span
            className={`relative z-10 font-semibold leading-none ${inCart ? "text-white" : "text-black"}`}
            style={{ fontSize: metaSize }}
          >
            {inCart ? "✓ " : ""}
            {roomsLeft} left
          </span>
        )}
        {!simplified && !inCart && !isStayNight && (status === "full" || status === "blocked") && (
          <div className="relative z-10 flex flex-col items-center gap-0.5">
            {/* Keep "sold out" visible even when wish-listed — the gray wish-list
                overlay otherwise hides it and the date looks bookable again. */}
            <span className="font-medium text-gray-500 leading-none" style={{ fontSize: metaSize }}>
              sold out
            </span>
            {canWishList && (
              <span
                className="leading-none z-10 relative cursor-pointer"
                style={{ fontSize: glyphSize }}
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
            className={`${getRoomColor(bars.am.roomName, bars.am.roomColor)} pointer-events-none`}
            style={{
              position: "absolute",
              bottom: barBottom,
              height: barHeight,
              left: "-1px",
              right: "80%",
              borderTopRightRadius: barRadius,
              borderBottomRightRadius: barRadius,
            }}
          />
        )}
        {bars?.pm && !inCart && (
          <div
            className={`${getRoomColor(bars.pm.roomName, bars.pm.roomColor)} pointer-events-none flex items-center`}
            style={{
              position: "absolute",
              bottom: barBottom,
              height: barHeight,
              left: bars.pm.isStart ? "20%" : "-1px",
              right: "-1px",
              borderTopLeftRadius: bars.pm.isStart ? barRadius : undefined,
              borderBottomLeftRadius: bars.pm.isStart ? barRadius : undefined,
              // Lifts the overhanging label above the following nights' bars,
              // which are later siblings and would otherwise paint over it.
              zIndex: bars.pm.isStart ? 10 : undefined,
            }}
          >
            {bars.pm.isStart && (
              <span
                className="shrink-0 truncate px-1 font-bold leading-none text-black"
                style={{ fontSize: barLabelSize, maxWidth: labelWidthFor(bars.pm.nights) }}
              >
                {bars.pm.roomName}
              </span>
            )}
          </div>
        )}
        {/* (R) HOLD — same ribbon geometry, but a dashed amber outline + amber
            hatch fill + a ⏳ corner badge so it clearly reads as "pending", NOT a
            confirmed stay, while the full room name stays readable. */}
        {/* A held stay is drawn as SEVERAL divs — an AM cap, whole days, a PM
            start — and each would begin the -45° stripe at its own left edge,
            so the hatching visibly breaks at every seam between nights.
            Phase-shift each segment's background to one shared origin across
            the week and the stripes run unbroken. Same fix TiMag's CalendarGrid
            already carries; this calendar had the hatch copied over without it.
            leftPx is the segment's own offset: a PM start begins 20% into its
            tile, the others at the tile edge. */}
        {resBars?.am && !inCart && (
          <div
            className={`${getRoomColor(resBars.am.roomName, resBars.am.roomColor)} border-y-2 border-dashed border-amber-500 pointer-events-none`}
            style={{
              position: "absolute",
              bottom: barBottom,
              height: barHeight,
              left: "-1px",
              right: "80%",
              borderTopRightRadius: barRadius,
              borderBottomRightRadius: barRadius,
              backgroundImage: HOLD_HATCH,
              ...hatchPhase(-1),
            }}
          />
        )}
        {resBars?.pm && !inCart && (
          <div
            className={`${getRoomColor(resBars.pm.roomName, resBars.pm.roomColor)} border-y-2 border-dashed border-amber-500 pointer-events-none flex items-center`}
            style={{
              position: "absolute",
              bottom: barBottom,
              height: barHeight,
              left: resBars.pm.isStart ? "20%" : "-1px",
              right: "-1px",
              borderTopLeftRadius: resBars.pm.isStart ? barRadius : undefined,
              borderBottomLeftRadius: resBars.pm.isStart ? barRadius : undefined,
              backgroundImage: HOLD_HATCH,
              ...hatchPhase(resBars.pm.isStart ? tileWidth * 0.2 : -1),
              zIndex: resBars.pm.isStart ? 10 : undefined,
            }}
          >
            {resBars.pm.isStart && (
              <span
                className="shrink-0 truncate px-1 font-bold leading-none text-black"
                style={{ fontSize: barLabelSize, maxWidth: labelWidthFor(resBars.pm.nights) }}
              >
                {resBars.pm.roomName}
              </span>
            )}
          </div>
        )}
        {/* Glass badge marking the hold's start — sits above the number, clear of
            the ribbon so it doesn't crowd the room name. */}
        {resBars?.pm?.isStart && !inCart && (
          <span
            className="pointer-events-none absolute right-0.5 top-0.5 z-20 leading-none"
            style={{ fontSize: glyphSize }}
          >
            ⏳
          </span>
        )}
      </button>
    );
  };

  return (
    <div
      ref={scrollContainerRef}
      // overscroll-contain: the page around this can now scroll on a short
      // screen, and without this a swipe that reaches the first or last month
      // would carry on into the page — paging the calendar would drag the whole
      // layout about under the guest's thumb.
      className="flex-1 min-h-0 overflow-y-scroll overscroll-contain snap-y snap-mandatory"
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