import { useEffect, useMemo, useRef, useState } from "react";
import "../../../styles/calendarStyle.css";
import { addDays, format, getDay, isSameDay, isSameMonth, parseISO, startOfToday } from "date-fns";
import { holidayLabel, usHolidayOn, usHolidaysInMonth } from "../../../util/usHolidays";
import { dayType } from "../../../util/types/dayType";
import { roomType } from "../../../util/types/roomType";
import { getRoomColor } from "../../../util/getRoomColor";
import { useTiBookTheme, useRoomChip, useCalendarView } from "../../../contexts/TiBookThemeContext";
import { nightStatus } from "../../../util/nightStatus";
import GuestDayList from "./GuestDayList";
import { MONTHS_FORWARD, appliedMonthTrigger, HOLD_HATCH, HOLD_HATCH_TILE } from "./calendarScroll";

// A guest's own confirmed stay, drawn as a spanning bar (not a dot).
export interface MyStay {
  id: string; // booking id — tapping the span opens this stay's detail
  startKey: string; // yyyy-MM-dd check-in
  nights: number;
  roomName: string;
  roomColor?: string;
  // What the guest paid for the whole stay, when the backend says. Undefined
  // means unknown, not free — a family stay's 0 is a real answer.
  paid?: number;
}

export interface GuestCalendarProps {
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
  // This guest's own agreed rate per room id, where Anh-Tuan has set one. Only
  // the list shows it — a grid tile has no room — and a room without one
  // shows no price at all, never its list price (see HeroShell's myRate).
  myRates?: Map<string, number>;
  scrollToTodayTrigger?: number;
  scrollToMonthTrigger?: { month: Date; seq: number };
  simplified?: boolean;
  onMonthChange?: (month: Date) => void;
  onDateClick?: (date: Date) => void;
  onWishListClick?: (date: Date) => void;
  onMyStayClick?: (bookingId: string) => void;
  // The list's "Details" link on a stay: straight to that booking in Your
  // bookings, without the stay card on the way.
  onMyStayDetails?: (bookingId: string) => void;
  onReservedClick?: () => void; // tapping a held night opens the pay-reminder popup
  // The month grid a size up. Only the Hero layout asks for it — see the note
  // on the type formulas below for why the classic layout does not.
  largeType?: boolean;
}

const NUM_ROWS = 6;


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

/*
 * Two sizes of type: the classic layout's, and Hero's a size up (2026-10-01).
 *
 * The list was lifted to Airbnb's size that morning — about 22px on a phone —
 * and Anh-Tuan asked for the month to be raised as well. It was raised in both
 * layouts and shipped; he had meant Hero only, and asked for the classic
 * layout back as it was. So each formula takes `large`: false is the classic
 * grid exactly as it stood before that day, and true is Hero's.
 *
 * In the classic sizes a phone's default calendar (a row about 55px) sits on
 * every floor: the day number at 13px, "3 left" at 11. In the large ones a
 * tile still cannot go to the list's 22px — it is about 55px wide, and "sold
 * out" at 22px is 80 — so each piece is raised to what its own space allows,
 * and the meta lines are capped by the tile's WIDTH as well as scaled by its
 * height (see widthCap).
 *
 * Numbers, not px strings: the tight-row rules further down add them up to
 * know when a row is too short for what it is asked to stack.
 *
 * BROUGHT DOWN 2026-10-05, about halfway back to classic. At a phone's
 * default height a Hero cell is ~55px square, and it held a 19px day number
 * over "sold out" at 14-15px — the line ran edge to edge, today's outlined
 * cell clipped it to "old ou", and the month read as shouting ("why is the
 * hero calendar font size so huge"). Hero still reads a step above classic,
 * which is what was asked for on the 1st: 16px / 12.5px at the floor against
 * classic's 13 / 11.
 */
const px = (n: number) => Math.round(n * 10) / 10;

// The room name is sized FROM its bar, not from the tile, so a taller ribbon can
// never leave a small name floating in the middle of it. Classic: 13px in a
// 26px bar, boosted. Large: a 24px bar is the floor, and 15.5px sits inside it.
const barLabelFor = (barHeight: number, large: boolean) =>
  large
    ? px(clamp(14, barHeight * 0.52 * TYPE_BOOST, 26))
    : px(clamp(13, barHeight * 0.5 * TYPE_BOOST, 26));

// The day number. Classic leaves it unboosted and capped below the others:
// "the least useful thing in the cell", found from its column, and boosted it
// became the loudest thing on a page it should stay quiet on. In Hero the
// month is the larger part of the screen and the number leads: 16px at the
// floor, 19 at the reference tile (19 and 22 until 2026-10-05 — see above).
const dateFor = (tile: number, large: boolean) =>
  large ? px(clamp(16, (tile / REF_TILE) * 19, 26)) : px(clamp(13, (tile / REF_TILE) * 16, 24));

// "3 left" / "sold out" — the line that actually answers "can I book this
// night". Classic: was 9px, the smallest type in TiBook, now 11 at the floor.
const metaFor = (tile: number, large: boolean) =>
  large
    ? px(clamp(12.5, (tile / REF_TILE) * 11 * TYPE_BOOST, 20))
    : px(clamp(11, (tile / REF_TILE) * 9 * TYPE_BOOST, 19));

// The wish-list star and the ⏳ hold badge — classic was 11px, 13 at the floor.
const glyphFor = (tile: number, large: boolean) =>
  large
    ? px(clamp(14, (tile / REF_TILE) * 12 * TYPE_BOOST, 24))
    : px(clamp(13, (tile / REF_TILE) * 11 * TYPE_BOOST, 24));

// The largest size at which a line `ems` wide still fits across a tile, with
// a pixel of air each side. Before the tile has been measured there is no cap.
const widthCap = (size: number, tileWidth: number, ems: number) =>
  tileWidth > 0 ? px(Math.min(size, (tileWidth - 2) / ems)) : size;
// How wide each line is, in ems — measured in Chromium on the rendered tile
// (3.71, 2.35 and 3.22), each rounded up a little for other faces. On a 320px
// phone a tile is 45.6px, where "sold out" comes to 11.6px: above the 11 it
// was, which is the one rule these caps must never break — never smaller.
const SOLD_OUT_EMS = 3.75; // "sold out"
const LEFT_EMS = 2.45; // "3 left"
const PICKED_EMS = 3.25; // "✓ 3 left", on a night the guest has picked
// A room name on a ribbon, per letter, at bold: "King" measured 2.32em.
const BAR_LABEL_EMS_PER_CHAR = 0.6;

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

const MonthGrid = ({
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
  largeType = false,
}: GuestCalendarProps) => {
  const { theme } = useTiBookTheme();
  const roomChip = useRoomChip();
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
  const barLabelSize = barLabelFor(barHeight, largeType);
  const dateSize = dateFor(rowHeight, largeType);
  const metaSize = metaFor(rowHeight, largeType);
  const glyphSize = glyphFor(rowHeight, largeType);
  // The two meta lines, each as large as the tile is wide enough for. Only the
  // large sizes need the cap; the classic ones fit a tile at every width and
  // are left exactly as they were.
  const leftSize = largeType ? widthCap(metaSize, tileWidth, LEFT_EMS) : metaSize;
  const soldSize = largeType ? widthCap(metaSize, tileWidth, SOLD_OUT_EMS) : metaSize;
  // A picked night is a green box inset 4px each side, so its line has that
  // much less to fit in. Capped against the tile it poked out of the box on a
  // 320px phone, and lost the edge of its tick.
  const pickedSize = largeType
    ? widthCap(metaSize, tileWidth > 0 ? tileWidth - 7 : 0, PICKED_EMS)
    : metaSize;
  // The classic size of a ribbon's name: half the bar, boosted. The floor
  // barLabelSizeFor never goes under, and in the classic layout the size itself.
  const barLabelFloor = barLabelFor(barHeight, false);

  const scopedRooms = useMemo(
    () => rooms.filter((r) => r.active && (selectedRoomIds === null || selectedRoomIds.has(r.id))),
    [rooms, selectedRoomIds],
  );

  /*
   * "N left" counts how many of the rooms you are LOOKING AT are free. Scoped
   * to a single room it is always "1 left", on every open night, which tells a
   * guest nothing they did not get from the night being open at all — and in
   * the Hero layout, where picking one room is the normal way to read the
   * month, it was noise on every cell.
   *
   * So the count appears only when there is something to count. It still does
   * the work it was for on "all rooms", which is the case where three-left and
   * one-left are genuinely different news.
   */
  const showRoomsLeft = scopedRooms.length > 1;

  /*
   * A short row cannot hold a number, "sold out" AND a star stacked. The tile
   * is overflow-visible (a room name on a stay ribbon has to escape its cell),
   * so they do not clip — they spill into the row below, and a wish-list star
   * ended up sitting on the next week's dates.
   *
   * Below this height the star moves to the corner of the tile, where it costs
   * the stack no height at all. Side by side was tried first and was worse: a
   * cell is only about 55px wide, so "sold out" wrapped to two lines to make
   * room for it.
   *
   * The star keeps working at every size, which matters more than keeping it
   * under the words: hiding it would take the wish list away from exactly the
   * guests on the smallest screens.
   *
   * In the classic sizes this is the literal 52 it always was, true for a 13px
   * number over an 11px line. In the large ones it is added up from the sizes
   * themselves: a fixed number would let the star spill again on every row
   * between the old threshold and the taller stack.
   */
  const TILE_PAD = 4; // the tile's own pt-1
  const STACK_GAP = 2; // gap-0.5 between stacked lines
  const tightRow = largeType
    ? rowHeight < TILE_PAD + dateSize + STACK_GAP + soldSize + STACK_GAP + glyphSize + STACK_GAP
    : rowHeight < 52;

  /*
   * Tighter still, and the words themselves have to go.
   *
   * A number is 13px at the floor and "sold out" another 11px; stacked with the
   * cell's own padding that wants about 30px, and half a phone's calendar on a
   * 320px screen leaves 28. Below this the meta line is dropped and the number
   * carries the night on its own — struck through and grey for a night that is
   * gone, accent-coloured for one that is free, which is the same thing the
   * words were saying. The tick on a night the guest picked stays: that is
   * their own doing, not a status.
   *
   * 36 in the classic sizes, as it always was; added up from the sizes in the
   * large ones, like tightRow and for the same reason.
   */
  const veryTightRow = largeType
    ? rowHeight < TILE_PAD + dateSize + STACK_GAP + soldSize + STACK_GAP
    : rowHeight < 36;

  /*
   * A night under the guest's own ribbon has three things to stack: the
   * number, "N left" and the ribbon itself. At the old sizes the words and the
   * ribbon overlapped by 3px, which nobody saw; a size up, "5 left" was drawn
   * across the ribbon and the room name — caught in a browser at a phone's
   * default calendar, where a row is 55px and the three want 68.
   *
   * So on those nights the count shows only when the row is tall enough to
   * hold all three. It is the line to give up: the ribbon already says the
   * guest has this night, and how many OTHER rooms are free on it is the least
   * of what they came to read there. Drag the calendar taller and it is back.
   *
   * Large sizes only. The classic layout keeps the count on those nights, as
   * it always has.
   */
  const metaFitsOverBar =
    !largeType ||
    rowHeight >= TILE_PAD + dateSize + STACK_GAP + leftSize + STACK_GAP + barHeight + barBottom;

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
  // "Once" is once per visit, not per mount — see calendarScroll.
  useEffect(() => {
    if (!scrollToMonthTrigger || scrollToMonthTrigger.seq === appliedMonthTrigger.seq) return;
    const el = scrollContainerRef.current;
    if (!el || !months.length || el.offsetHeight <= 0) return;
    appliedMonthTrigger.seq = scrollToMonthTrigger.seq;
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

  // The rule lives in util/nightStatus so the day-by-day list reads the same one.
  const getStatus = (date: Date) => nightStatus(date, scopedRooms, monthMap, reservedMap);

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
    const holiday = isOutside ? undefined : usHolidayOn(dateKey);
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
      //
      // That room used to be 8px on top of the span's own px-1, which spent 16px
      // of a one-night bar — about a quarter of it — on air. "King" fitted and
      // "Queen" did not, so two stays of identical length showed one name whole
      // and the other as "Qu...". A room name is five letters at most; the bar
      // is wide enough for it if the padding is not eating it.
      return tileWidth * nightsInRow - tileWidth * 0.2 - 3;
    };

    // The name on a ribbon is a size up with the rest of the grid, but only as
    // far as its own run of nights has room for, and never below what it was.
    // A one-cell ribbon is about 45px on a phone, and at the new size "King"
    // came out as "Ki…" where it had fitted before — seen in a browser on a
    // stay starting on a Saturday. A stay across several cells has the room
    // and takes the larger size.
    const barLabelSizeFor = (name: string, nights: number) => {
      const room = labelWidthFor(nights);
      if (!room) return barLabelSize;
      // Less the span's own px-1 each side.
      const fit = (room - 8) / (Math.max(1, name.length) * BAR_LABEL_EMS_PER_CHAR);
      return px(Math.max(barLabelFloor, Math.min(barLabelSize, fit)));
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

    // Sold out reads the way Airbnb draws it: the number in a mid grey with a
    // line clean through it, beside bold open nights — so a guest sees which
    // dates they cannot have before reading a word (Anh-Tuan, 2026-10-05).
    //
    // It used `dim`, the same pale grey as a night that has passed, and a
    // hairline that all but vanished in it: sold out and gone looked alike.
    // Now gone stays faded with no line, and sold out is a shade darker with a
    // line thick enough to see on a phone. The list view uses the same pair.
    //
    // Never on the guest's OWN nights (TIBOOK.md rule 4). Their stay or hold
    // makes the night "full" to the availability rule, and a line through a
    // date they hold tells them they cannot have it.
    const struck = `line-through decoration-[1.5px] ${theme.surfaceMuted2}`;
    const numberClass = [
      // No text-* size here: the size comes from the tile, via dateSize below.
      "leading-none select-none",
      inCart ? "font-bold text-white" :
      isStayNight || isReservedNight ? `font-bold ${theme.surfaceText}` :
      isWishlisted ? struck :
      (status === "available" || status === "partial") ? `font-bold ${theme.textPrimary}` :
      status === "past"      ? theme.dim :
                               struck,
    ].join(" ");

    const tileClass = [
      // Day number sits near the TOP of the cell (matches TiMag); the stay ribbon
      // lives at the bottom.
      // overflow-visible: a room name on a multi-night stay is drawn once, on the
      // first night, and overhangs into the cells the ribbon continues through.
      // A button does not reliably let its content escape without being told to.
      `border-r border-b ${theme.gridLine} flex flex-col items-center justify-start gap-0.5 pt-1 w-full h-full relative overflow-visible`,
      isToday ? "react-calendar__custom_tile_today" : "",
      isOutside ? "opacity-20 pointer-events-none" : "",
      // A holiday's whole cell is tinted, not just dotted. Returning guests
      // book by pattern — every Monday and Tuesday — and a dot alone let a
      // holiday ride along unnoticed into a request they then had to cancel
      // (2026-10-05). The theme's alert wash, so it reads in both skins.
      holiday && !inCart ? theme.alertFill : "",
      inCart ? "cursor-pointer" :
      isStayNight || isReservedNight ? "cursor-pointer" :
      canBook ? `cursor-pointer ${theme.tileHover} ${theme.tileActive} transition-colors` :
      canWishList ? `cursor-pointer ${theme.tileWishHover} transition-colors` : "cursor-default",
    ].join(" ");

    return (
      <button
        key={date.toISOString()}
        type="button"
        className={tileClass}
        // The holiday's name, for a mouse and for a screen reader. A phone
        // reads it in the line above the grid instead.
        title={holiday ? holidayLabel(holiday) : undefined}
        aria-label={holiday ? `${format(date, "MMMM d")}, ${holidayLabel(holiday)}` : undefined}
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
        {/* A US federal holiday: a dot in the corner, the way a printed
            calendar marks one. A cell on a phone has no room for "Columbus
            Day"; the line above the grid names it. White on a picked night,
            where the theme's red would sit on the theme's fill. */}
        {/* And a dashed outline: the tint alone all but vanished in the dark
            skin, where the alert wash is 12% red on near-black. */}
        {holiday && !inCart && (
          <div aria-hidden className={`pointer-events-none absolute inset-0.5 rounded-md border-2 border-dashed ${theme.alertBorder}`} />
        )}
        {holiday && (
          <span
            aria-hidden
            className={`pointer-events-none absolute left-1 top-1 z-20 h-2 w-2 rounded-full bg-current ${inCart ? "text-white" : theme.alertText}`}
          />
        )}
        {isNewWishList && !inCart && (
          <div className={`absolute inset-1 rounded-lg ${theme.tileWishBg} pointer-events-none`} />
        )}
        <span className={`${numberClass} relative z-10`} style={{ fontSize: dateSize }}>
          {date.getDate()}
        </span>
        {/* Availability stays visible whether or not the night is picked — it's
            info the guest wants either way; a ✓ marks it selected. */}
        {!simplified && (status === "available" || status === "partial") && roomsLeft > 0 && (inCart || (showRoomsLeft && !veryTightRow && (metaFitsOverBar || !(isStayNight || isReservedNight)))) && (
          <span
            className={`relative z-10 font-semibold leading-none ${inCart ? "text-white" : theme.tileText}`}
            // A picked night carries the tick as well, a wider line with its
            // own cap.
            style={{ fontSize: inCart ? pickedSize : leftSize }}
          >
            {/* The tick stays whatever the scope: it is the guest's own
                selection, not a count. */}
            {inCart ? "✓" : ""}
            {showRoomsLeft && !veryTightRow ? `${inCart ? " " : ""}${roomsLeft} left` : ""}
          </span>
        )}
        {!simplified && !inCart && !isStayNight && (status === "full" || status === "blocked") && (
          <>
            {!veryTightRow && (
            <div className="relative z-10 flex flex-col items-center gap-0.5">
              {/* Keep "sold out" visible even when wish-listed — the gray wish-list
                  overlay otherwise hides it and the date looks bookable again. */}
              <span className={`${largeType ? "whitespace-nowrap " : ""}font-medium leading-none ${theme.surfaceMuted}`} style={{ fontSize: soldSize }}>
                sold out
              </span>
              {canWishList && !tightRow && (
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
            {canWishList && tightRow && (
              <span
                className="absolute bottom-0 right-0.5 z-20 cursor-pointer leading-none"
                style={{ fontSize: glyphSize }}
                title={isWishlisted ? "Remove from wish list" : "Add to wish list"}
                onClick={(e) => { e.stopPropagation(); onWishListClick!(date); }}
              >
                {isWishlisted ? "★" : "☆"}
              </span>
            )}
          </>
        )}
        {/* The guest's own stay — a spanning ribbon (AM checkout cap + PM
            check-in/continuing bar) that connects across cells, room-colored,
            labelled with the room on the check-in day. */}
        {bars?.am && !inCart && (
          <div
            className={`${roomChip({ name: bars.am.roomName, color: bars.am.roomColor }, "bar")} pointer-events-none`}
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
            className={`${roomChip({ name: bars.pm.roomName, color: bars.pm.roomColor }, "bar")} pointer-events-none flex items-center`}
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
                className="shrink-0 truncate px-0.5 font-bold leading-none text-black"
                style={{ fontSize: barLabelSizeFor(bars.pm.roomName, bars.pm.nights), maxWidth: labelWidthFor(bars.pm.nights) }}
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
                className="shrink-0 truncate px-0.5 font-bold leading-none text-black"
                style={{ fontSize: barLabelSizeFor(resBars.pm.roomName, resBars.pm.nights), maxWidth: labelWidthFor(resBars.pm.nights) }}
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

  // The US federal holidays in the month on screen, named under the grid —
  // the cells only carry a dot. Under, not over: above, it came between the
  // weekday letters and the dates they head. Always one line, even in a month with none: if it came and
  // went, the grid below would change height as the guest paged, and every
  // row would resize under their thumb.
  const shownMonth = pageLayouts[visibleIndex]?.month;
  const monthHolidays = shownMonth ? usHolidaysInMonth(shownMonth.getFullYear(), shownMonth.getMonth()) : [];

  return (
    <div className="flex flex-1 min-h-0 flex-col">
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
                  borderTop: "1px solid var(--tibook-grid-line)",
                  borderLeft: "1px solid var(--tibook-grid-line)",
                }}
              >
                {layout.cells.map((date, cellIdx) =>
                  date ? (
                    renderTile(date, layout.month)
                  ) : (
                    <div key={cellIdx} className={`border-r border-b ${theme.gridLine}`} />
                  ),
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
    {/* No banner at all for a month without a holiday. It used to print "No US
        federal holidays in August", a whole row spent saying nothing; the grid
        takes the room instead. */}
    {shownMonth && monthHolidays.length > 0 && (
      <div
        className={`flex h-6 shrink-0 items-center gap-1.5 overflow-x-auto overflow-y-hidden whitespace-nowrap border-t px-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden text-[12px] leading-none ${theme.gridLine} ${theme.surfaceMuted}`}
      >
        {/* The line swipes sideways instead of clipping at "…". A month with
            three holidays is longer than a phone is wide, and the ones past the
            edge were unreadable — only the first could be seen.
            Every holiday opens with its own bullet, in the same text as the
            line. A drawn dot before the first and a typed "•" between the rest
            came out two sizes, so one bullet does both jobs now. */}
        <span className={`shrink-0 whitespace-pre font-semibold ${theme.alertText}`}>
          {monthHolidays
            .map(({ key, holiday }) => `• ${format(parseISO(key), "EEE MMM d")} – ${holidayLabel(holiday)}`)
            .join("  ")}
        </span>
      </div>
    )}
    </div>
  );
};

/*
 * The guest's calendar, as a month grid or as a day-by-day list — whichever
 * they last chose on this device.
 *
 * Both views take the same props and print from the same nightStatus rule, so
 * switching is only a change of arrangement: the guest keeps their picked
 * dates, their wish list and their place in the month. The switch happens here
 * rather than where the calendar is mounted so that neither layout (stacked or
 * Hero) needs to know there are two views.
 */
const GuestCalendar = (props: GuestCalendarProps) => {
  const { calendarView } = useCalendarView();
  return calendarView === "list" ? <GuestDayList {...props} /> : <MonthGrid {...props} />;
};

export default GuestCalendar;