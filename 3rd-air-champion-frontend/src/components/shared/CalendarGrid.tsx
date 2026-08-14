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
  // Optional node drawn inside the bar before its label — TiMag's Clean mode
  // uses it for the cleaner's avatar, so a bar is recognisable before it's read.
  resolveBarIcon?: (booking: bookingType) => React.ReactNode;
  // Content for a room/day with no booking at all. Clean mode marks cleanings
  // that happened into an empty room; returning null keeps the cell as it was.
  renderEmptyCell?: (room: roomType, date: Date) => React.ReactNode;
  gapsMode?: boolean;
  // Reports whether today's tile is on the currently visible page (a month can span
  // several pages, so "current month" no longer implies "today is on screen").
  onTodayInViewChange?: (inView: boolean) => void;
  // Host-tunable cap on weeks-per-page for narrow phones (default 4). Stored
  // per-device; only bites on narrow screens in full-calendar mode.
  rowsPerPage?: number;
  // Height of one room's lane in px. The colour bar fills the lane and the
  // guest name is sized from it, so this scales both together.
  rowHeight?: number;
  // Supplied by TiMag only. Its presence is what puts the resize grip on the
  // calendar — TiBook has no per-device lane setting and gets no grip.
  onRowHeightChange?: (n: number) => void;
  // Returns true for a booking that should recede into the background. Its mere
  // presence also means "a lens is on", which suppresses the availability bars —
  // an open night is not what is being looked for.
  dimBooking?: (booking: bookingType) => boolean;
  // A yyyy-MM-dd day to bring on screen — TiMag points this at the stay of the
  // guest being filtered. A DATE, not a month, because a month does not fit on
  // one page on a phone: naming the month there lands on its first page, which
  // for a stay in the last week is a page the guest does not appear on.
  revealDate?: string | null;
}

// Default lane height. Overridable per device via the rowHeight prop — this
// stays the fallback for callers that do not set it (TiBook).
const SUBROW_HEIGHT = 26; // color-box height per room row (was 20; +30% for legibility)

// The guest name is sized FROM the lane height rather than set independently, so
// a taller lane cannot leave a small name floating in whitespace.
//
// Todays size is the FLOOR, not the midpoint. Scaling is one-way on purpose:
// the grip exists to make names bigger, and nobody drags it hoping for smaller
// ones. Below the 26px default the lane closes in around type that stays put;
// above it, the two grow together.
const labelRemFor = (laneHeight: number) =>
  Math.min(1.5, Math.max(0.8, (laneHeight / 26) * 0.8));

// The date number lives in the tile grid first row, which is one lane tall, so
// it has to scale with the lane too — otherwise a resized calendar ends up with
// big guest names and a date stranded at its original size. Same ratio as the
// CSS rule it overrides (0.9rem at the 26px default), so nothing moves until
// the host actually drags the grip.
// Corner radius of a booking bar, as a FRACTION of the lane it sits in.
//
// It was a fixed 0.5rem. A fixed radius on a growing bar is a different shape,
// not the same shape larger: at 26px the corner is a third of the bar's height
// and reads as a rounded capsule end; at 48px the same 8px is a sixth of it and
// reads as a near-square block. Scaling keeps the silhouette the host learned.
//
// Capped at half the bar height, which is the point where opposite corners meet
// — beyond that the radius is silently clamped by the browser anyway, and the
// bar would stop having a straight edge to butt against the next night.
// A held (R) night: room colour under a 45-degree amber hatch, with a dashed
// amber edge. Lifted verbatim from TiBook's guest calendar so one stay looks the
// same to the host and to the guest looking at their own booking.
//
// Pattern rather than a flat tint, because "held but unpaid" is a state, not
// another room colour — hatching reads as provisional at a glance and survives
// being seen next to any of the five room colours. The dashed edge is drawn
// INSIDE the bar's box, so the shared PM-checkin / AM-checkout geometry is
// untouched and no gaps open between nights.
const HOLD_HATCH =
  "repeating-linear-gradient(45deg, rgba(217,119,6,0.62) 0 4px, rgba(255,255,255,0) 4px 9px)";
const HOLD_EDGE = "border-y-2 border-dashed border-amber-500";

const RADIUS_RATIO = 8 / 26; // the tuned look at the default lane height
const barRadiusFor = (laneHeight: number) => {
  const barHeight = Math.max(1, laneHeight - 2); // top/bottom inset 1px each
  return `${Math.min(barHeight / 2, laneHeight * RADIUS_RATIO).toFixed(1)}px`;
};

const dateRemFor = (laneHeight: number) =>
  Math.min(1.7, Math.max(0.9, (laneHeight / 26) * 0.9));

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
  resolveBarIcon,
  renderEmptyCell,
  gapsMode = false,
  onTodayInViewChange,
  rowsPerPage = 4,
  rowHeight: laneHeight = SUBROW_HEIGHT,
  onRowHeightChange,
  dimBooking,
  revealDate = null,
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

  // Guest mode only: pack the guest's stays into overlap "lanes" (classic
  // interval packing) so N NON-overlapping bookings share ONE row instead of one
  // row per room. Row count = max simultaneous stays (usually 1). Keyed by
  // room+dates (per-night copies may have different _ids), not booking id.
  const guestLanes = useMemo(() => {
    if (!overrideRooms) return null;
    const dk = (d: string) => String(d).slice(0, 10);
    const stays = new Map<string, { start: string; end: string }>();
    monthMap.forEach((day) =>
      day.bookings.forEach((b) => {
        if (!b.room || !b.startDate || !b.endDate) return;
        const key = `${b.room.id}|${dk(b.startDate)}|${dk(b.endDate)}`;
        if (!stays.has(key)) stays.set(key, { start: dk(b.startDate), end: dk(b.endDate) });
      }),
    );
    const ordered = [...stays.entries()].sort(
      (a, b) => a[1].start.localeCompare(b[1].start) || a[1].end.localeCompare(b[1].end),
    );
    const laneEnds: string[] = []; // last end-night per lane
    const laneOf = new Map<string, number>();
    for (const [key, s] of ordered) {
      // First lane whose previous stay ended before this one starts (no shared night).
      let lane = laneEnds.findIndex((end) => end < s.start);
      if (lane === -1) {
        lane = laneEnds.length;
        laneEnds.push(s.end);
      } else {
        laneEnds[lane] = s.end;
      }
      laneOf.set(key, lane);
    }
    return { laneOf, count: Math.max(laneEnds.length, 1) };
  }, [overrideRooms, monthMap]);

  const maxRooms = guestLanes ? guestLanes.count : usedRooms.length;
  const minRowHeight = (maxRooms + 1) * laneHeight;
  // On a narrow phone (FULL-calendar mode only), cap weeks-per-page so each
  // week-row is taller and more legible — and the current week is far less likely
  // to sit crushed at the very bottom of a packed page. Desktop keeps the whole
  // month, so the cap only kicks in below the `sm` breakpoint. In the FILTERED
  // views — single-guest (guestLanes) or single-room (selectedRoomName) — the rows
  // are short (one lane/room), so we show the whole month on one page instead: no
  // cap there, and the per-device setting doesn't apply. The cap value is
  // host-tunable per device (rowsPerPage), defaulting to 4.
  const isFilteredView = !!guestLanes || !!selectedRoomName;
  const maxRowsNarrow = Math.max(1, rowsPerPage);
  const isNarrow = tileWidth != null && tileWidth * 7 < 640;
  const fitRows =
    containerHeight > 0 ? Math.max(Math.floor(containerHeight / minRowHeight), 1) : 5;
  const numRows = isNarrow && !isFilteredView ? Math.min(fitRows, maxRowsNarrow) : fitRows;
  // On a narrow phone, rows keep their NATURAL height (bars packed, no stretch)
  // instead of dividing the screen among them — the calendar simply ends partway
  // down with whitespace below the last week. Desktop still fills its column.
  const rowHeight = isNarrow
    ? minRowHeight
    : containerHeight > 0
      ? Math.floor(containerHeight / numRows)
      : minRowHeight;
  // A little breathing room between week-rows on the phone (uses some of the
  // bottom whitespace); zero on desktop where rows fill the column edge-to-edge.
  const rowGap = isNarrow ? 6 : 0;

  // Which way pages advance.
  //
  // A page of three weeks or more reads as a document, and the hand reaches to
  // scroll DOWN for the next chunk. A page of one or two weeks reads as a
  // filmstrip, where the same hand expects to swipe SIDEWAYS -- scrolling down
  // a two-week strip feels like something is missing below.
  //
  // Both axes are driven by native CSS scroll-snap rather than a custom touch
  // handler, so momentum, snapping, trackpads and keyboards keep working, and
  // nothing competes with the tap / double-tap gestures the tiles already own.
  const horizontalPaging = numRows <= 2;
  const pageSpan = (el: HTMLElement) => (horizontalPaging ? el.offsetWidth : el.offsetHeight);
  const pageOffset = (el: HTMLElement) => (horizontalPaging ? el.scrollLeft : el.scrollTop);
  const scrollToPage = (el: HTMLElement, index: number) => {
    if (horizontalPaging) el.scrollLeft = index * pageSpan(el);
    else el.scrollTop = index * pageSpan(el);
  };

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
  // A date also appears as a neighbor-month filler on the adjacent month's page, so prefer
  // the page that owns the date's month; only fall back to a filler occurrence.
  const pageIndexContainingDate = (d: Date) => {
    const has = (l: PageLayout) => l.cells.some((c) => c && isSameDay(c, d));
    const owned = pageLayouts.findIndex((l) => isSameMonth(l.month, d) && has(l));
    if (owned >= 0) return owned;
    const idx = pageLayouts.findIndex(has);
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
    const h = pageSpan(el);
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
    scrollToPage(el, target);
    visibleIndexRef.current = target;
    // Ignore scroll events briefly so the reflow's transient scroll can't override the anchor.
    suppressScrollUntilRef.current = performance.now() + 250;
    setVisibleIndex(target);
  }, [pageLayouts, containerHeight]); // eslint-disable-line react-hooks/exhaustive-deps

  // Follow the currentMonth prop when the PARENT moves it.
  //
  // The visible month is normally an output of this grid: you scroll, and
  // onMonthChange reports where you landed. But it is also driven from outside —
  // filtering a guest jumps to a month that guest actually stays in — and that
  // set was silently dropped, because currentMonth was read once at mount to
  // seed visibleMonthRef and never again. The grid stayed on the month it was
  // already showing while the data around it was filtered down to a guest who is
  // not there: every tile returned null and the whole calendar went blank.
  //
  // Nothing moves while the two agree, so this cannot fight scrolling: the
  // scroll handler sets visibleMonthRef first and only then reports the same
  // month upward. A month spanning several pages compares by month, not by page,
  // so paging within it does not snap back to its first page either.
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el || pageLayouts.length === 0) return;
    const shown = visibleMonthRef.current;
    if (
      shown.getFullYear() === currentMonth.getFullYear() &&
      shown.getMonth() === currentMonth.getMonth()
    )
      return;
    const idx = firstPageIndexOfMonth(currentMonth);
    // Outside the rendered window (24 months back / 36 forward) — leave the grid
    // where it is rather than scrolling somewhere arbitrary.
    if (idx == null) return;
    scrollToPage(el, idx);
    visibleMonthRef.current = pageLayouts[idx].month;
    visibleIndexRef.current = idx;
    // The programmatic scroll fires a scroll event carrying the old position.
    suppressScrollUntilRef.current = performance.now() + 250;
    setVisibleIndex(idx);
  }, [currentMonth, pageLayouts]); // eslint-disable-line react-hooks/exhaustive-deps

  // Bring a specific DAY on screen, not just its month.
  //
  // Declared after the month-follow effect so it wins: a month is only enough
  // when the month fits on one page. On a phone in a filtered view the lanes are
  // short, fitRows lands around five, and a six-week month splits across two
  // pages — so naming the month put the host on page one while the guest they
  // filtered was on page two. Desktop fits the whole month on one page, which is
  // why this only ever showed up on the phone.
  //
  // Re-asserted whenever pageLayouts change, because a page index means nothing
  // across a re-layout: filtering collapses five room rows into one lane, which
  // changes rows-per-page, the page count, and on a phone the paging axis too.
  // While a filter is on, re-anchoring to its subject is the wanted behaviour.
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!revealDate || !el || pageLayouts.length === 0) return;
    // Noon: far from both midnights, so no timezone or DST edge can move the day.
    const idx = pageIndexContainingDate(new Date(`${revealDate}T12:00:00`));
    if (idx == null) return;
    scrollToPage(el, idx);
    const layout = pageLayouts[idx];
    if (layout) {
      visibleMonthRef.current = layout.month;
      // Keep the header on the month actually shown; without this the month
      // label and the page disagree whenever the revealed day sits on a
      // continuation page.
      onMonthChange(layout.month);
    }
    visibleIndexRef.current = idx;
    suppressScrollUntilRef.current = performance.now() + 250;
    setVisibleIndex(idx);
  }, [revealDate, pageLayouts]); // eslint-disable-line react-hooks/exhaustive-deps

  // Tell the parent whether today is on the visible page (drives the Today button).
  useEffect(() => {
    if (!onTodayInViewChange) return;
    const cells = pageLayouts[visibleIndex]?.cells ?? [];
    onTodayInViewChange(cells.some((c) => c && isSameDay(c, startOfToday())));
  }, [visibleIndex, pageLayouts, onTodayInViewChange]);

  // iOS Safari: nudge the page you land on into repainting.
  //
  // Safari updates the geometry of absolutely positioned children inside a
  // scrolling container but does not always redraw their rounded clip, so every
  // bar on an arriving page shows square corners. The radius is in the markup
  // the whole time — dragging the row-height grip cured it, as ANY style change
  // would. Verified desktop-only-clean on a current build; the phone is the one
  // that needs this.
  //
  // A hair of opacity for a single frame is the cheapest thing that forces a
  // repaint: one element, once per page change, and 0.999 is not a visible
  // difference. Promoting every page to its own layer up front was tried first
  // and did nothing — a layer that already exists does not repaint on arrival
  // either, which is the whole problem.
  // KNOWN, UNFIXED: bars paint stale on an arriving page.
  //
  // Corners come back square and availability runs look broken until anything
  // forces a repaint. It is cosmetic and clears the moment the host touches the
  // calendar. Established by `getComputedStyle`: every bar has an IDENTICAL
  // radius, left, right and width before and after the cure, so the markup is
  // correct and the browser simply does not redraw it. Reproduces in desktop
  // Chrome as well as on the phone.
  //
  // A repaint nudge (a sub-pixel lane-height change on page arrival) DID fix it
  // and was removed at the host's request: it flickered, and a workaround that
  // trades one visible defect for another is not worth keeping. Three variants
  // were tried — opacity touch, per-page compositing layer, lane-height nudge —
  // and only the last worked, at that cost.
  //
  // The real fix is architectural. Every bar is drawn OUTSIDE its own grid cell
  // (`left: -1px`, `right: -20%`) so a stay is N elements each bleeding into its
  // neighbour. Elements living outside the box they belong to are exactly what a
  // browser's repaint region misses — and it is the same design that let a guest
  // label print onto the next page in 2w mode. Drawing a stay as ONE element
  // spanning its columns would retire both bugs and the geometry rule every new
  // bar has to be kept consistent with.

  // Reconcile the page AFTER scrolling stops.
  //
  // One page per gesture is enforced natively by scroll-snap-stop; this is the
  // fallback for browsers without it. Correcting mid-flight fought the momentum
  // and landed the host between pages, so it waits for the scroll to settle.
  const nudgeTimerRef = useRef<number | null>(null);

  const scheduleSettle = () => {
    if (nudgeTimerRef.current !== null) window.clearTimeout(nudgeTimerRef.current);
    nudgeTimerRef.current = window.setTimeout(() => {
      const el = scrollContainerRef.current;
      const span = el ? pageSpan(el) : 0;
      if (!el || span <= 0) return;
      const snapped = Math.round(pageOffset(el) / span);
      const delta = snapped - visibleIndexRef.current;
      if (Math.abs(delta) > 1) goToPage(visibleIndexRef.current + (delta > 0 ? 1 : -1));
    }, 120);
  };

  useEffect(
    () => () => {
      if (nudgeTimerRef.current !== null) window.clearTimeout(nudgeTimerRef.current);
    },
    [],
  );

  useEffect(() => {
    if (scrollToTodayTrigger > 0 && scrollContainerRef.current && pageLayouts.length > 0) {
      const today = new Date();
      const idx = pageIndexContainingDate(startOfToday()) ?? firstPageIndexOfMonth(today) ?? monthsBack;
      scrollToPage(scrollContainerRef.current, idx);
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

        // Trailing neighbor-month days, mirroring the leading fill: only on the page
        // that completes the month, and only out to the end of the week containing
        // monthEnd. Whole rows past that week stay null so the page doesn't grow a
        // spurious extra week of next month.
        if (isAfter(cur, monthEnd)) {
          const lastIdx = cellIdx - 1;
          const trailing = 6 - (lastIdx % 7);
          for (let i = 1; i <= trailing && lastIdx + i < totalCells; i++) {
            cells[lastIdx + i] = addDays(monthEnd, i);
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

  // Page with the CROSS-AXIS gesture, whichever way the pages are laid out.
  //
  // Each mode has a native axis that scroll-snap owns: vertical mode scrolls
  // down, horizontal mode swipes sideways. The other axis was dead. But the row
  // count is a layout decision, not an instruction about how to navigate — at
  // three weeks a filtered view packs into one or two lanes and the hand
  // reaches sideways; at one week people still flick up for "next". So the free
  // axis pages too, and the calendar answers to whichever gesture you try.
  const swipeRef = useRef<{ x: number; y: number; t: number } | null>(null);
  const lastWheelRef = useRef(0);

  // Move by one page and repeat the bookkeeping the scroll handler does —
  // without it the month label and the Today button still describe the page you
  // just left.
  const goToPage = (next: number) => {
    const el = scrollContainerRef.current;
    if (!el || next < 0 || next >= pageLayouts.length) return;
    scrollToPage(el, next);
    const layout = pageLayouts[next];
    if (layout) {
      onMonthChange(layout.month);
      visibleMonthRef.current = layout.month;
    }
    visibleIndexRef.current = next;
    setVisibleIndex(next);
    // The programmatic scroll fires a scroll event carrying the old position.
    suppressScrollUntilRef.current = performance.now() + 250;
  };

  const onTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    const t = e.touches[0];
    swipeRef.current = { x: t.clientX, y: t.clientY, t: performance.now() };
  };

  const onTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    const start = swipeRef.current;
    swipeRef.current = null;
    if (!start) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    // The axis scroll-snap does NOT own is the one that pages here.
    const paging = horizontalPaging ? dy : dx;
    const other = horizontalPaging ? dx : dy;
    // Deliberately strict, because the tiles already own tap and double-tap and
    // there is a draggable hold bar: a tap barely moves, and a scroll along the
    // native axis is dominated by that axis. Only a fast, clearly cross-axis
    // drag pages.
    if (performance.now() - start.t > 600) return;
    if (Math.abs(paging) < 60 || Math.abs(paging) < Math.abs(other) * 2) return;
    // Content moving up or left means "next", in either layout.
    goToPage(visibleIndexRef.current + (paging < 0 ? 1 : -1));
  };

  // Desktop equivalent for horizontal mode, where a wheel has nothing to scroll.
  // Rate-limited: a trackpad emits a burst of small deltas per flick, which
  // would otherwise skip several pages at once.
  const onWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (!horizontalPaging) return;
    if (Math.abs(e.deltaY) < 30) return;
    const now = performance.now();
    if (now - lastWheelRef.current < 400) return;
    lastWheelRef.current = now;
    goToPage(visibleIndexRef.current + (e.deltaY > 0 ? 1 : -1));
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    // Scheduled FIRST, before the suppression bail-out below returns. A stale
    // scroll must not move the visible month, but it still leaves the page
    // needing a repaint.
    scheduleSettle();

    // Skip scrolls fired by a layout reflow (the page count just changed) — they carry a
    // stale scrollTop that would otherwise re-point the visible month to the wrong page.
    if (performance.now() < suppressScrollUntilRef.current) return;
    const el = e.target as HTMLElement;
    const calendarHeight = pageSpan(el);
    const snappedIndex = Math.round(pageOffset(el) / calendarHeight);

    // No correction while the finger or the fling is still moving. One page per
    // gesture is enforced natively by scroll-snap-stop, and reconciled after the
    // scroll settles (scheduleSettle) for anything that slips past it.

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
    // Declared here, above EVERY branch — not beside the bars that use them.
    //
    // Gaps mode returns early, from a nested map(), and read both of these. With
    // the declarations further down the function that is a temporal dead zone:
    // the callback runs before the const is initialised, throws a ReferenceError
    // and takes the whole calendar blank. TypeScript cannot see it, because from
    // inside a closure it cannot prove when the callback runs.
    //
    // Size of the guest name, and the corner radius every bar shares — both
    // derived from the lane height so the calendar scales as one piece.
    const textSize = labelRemFor(laneHeight);
    const R = barRadiusFor(laneHeight);
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

    // Blocked-bar hatch: a blocked range is drawn as several divs (PM start, full days,
    // AM cap), each of which would start the -45° stripe pattern at its own corner —
    // making the stripes visibly break at every seam. Phase-shift each segment's
    // background to a shared global origin so the stripes run continuously.
    const hatchPhase = (leftPx: number): React.CSSProperties =>
      tileWidth ? { backgroundPosition: `${-(getDay(date) * tileWidth + leftPx)}px 0px` } : {};

    const usedRoomIdSet = new Set(usedRooms.map((r) => r.id));

    // In guest mode, rows are LANES (packed by overlap), not rooms. The grid
    // slot a booking lands in is its lane; bars still color/label by their own
    // room, so appearance is unchanged — only the row it sits in differs.
    const laneMode = !!guestLanes;
    const keyOf = (b: bookingType) =>
      laneMode
        ? `lane-${
            guestLanes!.laneOf.get(`${b.room?.id}|${dayKey(b.startDate)}|${dayKey(b.endDate)}`) ?? 0
          }`
        : b.room.name;

    const sortedUsedRooms: roomType[] = laneMode
      ? Array.from(
          { length: guestLanes!.count },
          (_, i) => ({ id: `lane-${i}`, name: `lane-${i}` }) as roomType,
        )
      : [...usedRooms]
          .filter((r) => !selectedRoomName || r.name === selectedRoomName)
          .sort((a, b) => a.name.localeCompare(b.name));

    if (!laneMode) {
      for (const blockedRoom of day?.blockedRooms ?? []) {
        if (!selectedRoomName || blockedRoom.name === selectedRoomName) {
          if (!sortedUsedRooms.find((r) => r.id === blockedRoom.id)) {
            if (usedRoomIdSet.has(blockedRoom.id)) sortedUsedRooms.push(blockedRoom);
          }
        }
      }
      sortedUsedRooms.sort((a, b) => a.name.localeCompare(b.name));
    }

    if (!filteredDay && checkoutBookings.length === 0 && blockedRoomIds.size === 0) {
      if (sortedUsedRooms.length === 0 || overrideRooms) return null;
    }

    const gridContent: Record<string, { am: bookingType | null; pm: bookingType | null }> = {};
    sortedUsedRooms.forEach((room) => {
      gridContent[room.name] = { am: null, pm: null };
    });

    const ensureGridRow = (room: roomType) => {
      if (laneMode) return; // lanes are pre-built above
      if (!gridContent[room.name] && usedRoomIdSet.has(room.id)) {
        gridContent[room.name] = { am: null, pm: null };
        sortedUsedRooms.push(room);
      }
    };

    checkoutBookings.forEach((booking) => {
      ensureGridRow(booking.room);
      const k = keyOf(booking);
      if (!gridContent[k]) return;
      gridContent[k].am = booking;
    });

    if (filteredDay) {
      filteredDay.bookings.forEach((booking) => {
        if (!booking.startDate || !booking.endDate || !booking.room || !booking.guest) return;
        const startKey = dayKey(booking.startDate);
        const endKey = dayKey(booking.endDate);
        const isStart = cellKey === startKey;
        const isBetween = !isStart && cellKey > startKey && cellKey <= endKey;
        ensureGridRow(booking.room);
        const k = keyOf(booking);
        if (!gridContent[k]) return;
        if (isBetween) gridContent[k].am = booking;
        if (isStart || isBetween) gridContent[k].pm = booking;
      });
    }

    if (!laneMode) sortedUsedRooms.sort((a, b) => a.name.localeCompare(b.name));

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
                      borderTopRightRadius: R,
                      borderBottomRightRadius: R,
                    }}
                  />
                )}
                <div
                  className={`${roomColor} flex items-center overflow-hidden`}
                  style={{
                    borderRadius: R,
                    position: "absolute",
                    top: "1px",
                    bottom: "1px",
                    left: "20%",
                    right: "-20%",
                    // Was a hardcoded 0.8rem — the one bar whose text did not
                    // scale with the lane, left behind when the others did.
                    fontSize: `${textSize}rem`,
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

    // Guest-name size inside booking bars. Bumped from 0.65 — 10px strained the

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
            // A room can be cleaned and then sit empty — no booking to hang a
            // label on. Clean mode uses this to mark those turnovers, so the
            // calendar agrees with the Plan tab about who worked that morning.
            const emptyContent = renderEmptyCell?.(room, date);
            if (emptyContent)
              return (
                <div key={room.name} className="row-span-1 h-full relative">
                  {emptyContent}
                </div>
              );
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
                      borderTopLeftRadius: prevRoomBlocked ? undefined : R,
                      borderBottomLeftRadius: prevRoomBlocked ? undefined : R,
                      ...hatchPhase(prevRoomBlocked ? -1 : 0.2 * (tileWidth ?? 0)),
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
                    style={{ top: "1px", bottom: "1px", left: "-1px", right: "80%", borderTopRightRadius: R, borderBottomRightRadius: R, ...hatchPhase(-1) }}
                  />
                )}
                {isFutureOrToday && (
                  <div
                    className="react-calendar__opportunity_row absolute"
                    style={{
                      borderRadius: R,
                      top: "1px",
                      bottom: "1px",
                      left: "20%",
                      right: "-20%",
                      // Mid-run, the previous day's box already extends through
                      // this edge, so a left border draws a vertical line across
                      // what should read as one continuous free stretch. Only the
                      // day that STARTS a run closes its left side — the right
                      // border was dropped for the same reason. A week wrap does
                      // start a run visually, so Sunday keeps its edge.
                      ...(prevDayNoPm && !prevRoomBlocked && getDay(date) !== 0
                        ? {
                            borderLeft: "none",
                            borderTopLeftRadius: 0,
                            borderBottomLeftRadius: 0,
                          }
                        : {}),
                    }}
                  />
                )}
                {isFutureOrToday && prevDayNoPm && !prevRoomBlocked && getDay(date) === 0 && (
                  <div
                    className="react-calendar__opportunity_pm absolute"
                    style={{ top: "1px", bottom: "1px", left: "-1px", right: "80%", borderTopRightRadius: R, borderBottomRightRadius: R }}
                  />
                )}
              </div>
            );
          }

          // Grey, not faded: opacity over a coloured bar still reads as that
          // colour, and the point is that these bars stop competing.
          const DIM = "bg-gray-200";
          const amDim = !!amBooking && !!dimBooking?.(amBooking);
          const pmDim = !!pmBooking && !!dimBooking?.(pmBooking);

          const amColor = amDim
            ? DIM
            : amBooking?.room?.name
              ? getRoomColor(amBooking.room.name, amBooking.room.color)
              : "";
          const amIsEnd = amBooking?.endDate
            ? cellKey === addDayKey(dayKey(amBooking.endDate), 1)
            : false;
          const pmIsStart = pmBooking?.startDate ? cellKey === dayKey(pmBooking.startDate) : false;
          const pmColor = pmDim
            ? DIM
            : pmBooking?.room?.name
              ? getRoomColor(pmBooking.room.name, pmBooking.room.color)
              : "";
          const pmTextColor = pmDim
            ? "text-gray-500"
            : pmBooking?.guest?.name === "AirBnB"
              ? "text-white"
              : "text-black font-bold";

          const defaultLabel = pmBooking
            ? pmBooking.guest?.name === "AirBnB" && pmBooking.alias
              ? `${pmBooking.alias} (A)`
              : pmBooking.guest?.name ?? ""
            : "";
          const pmName = pmBooking
            ? (resolveBarLabel ? resolveBarLabel(pmBooking) : defaultLabel)
            : "";

          // How many tiles the guest name may span.
          //
          // The label is drawn ONCE, on the stay first night, as an absolutely
          // positioned span sized to cover the whole stay. So it must be clamped
          // to the nights left in ITS OWN WEEK ROW: a wider span escapes the row
          // and paints over whatever the browser lays out to the right.
          //
          // The old expression compared duration against the weekday index,
          // which is not a quantity of remaining days. It truncated mid-week
          // labels (a Monday 3-night stay got 2 tiles) and, worse, overflowed on
          // Friday and Saturday starts, where duration - dayIndex went negative
          // and fell through to the unclamped full duration.
          //
          // That overflow was invisible at 3+ weeks per page, where it is
          // clipped. At 1-2 weeks the pages sit SIDE BY SIDE in a flex row, so a
          // label running off the right of one page lands on the same row of the
          // NEXT page: Armando starting Sat Aug 8 (last column of page 1, row 2)
          // printed itself onto Aug 16 (first column of page 2, row 2), over the
          // bar of the guest actually staying that night.
          let maxDuration = 1;
          if (pmBooking && pmIsStart) {
            const daysLeftInWeek = 7 - getDay(date);
            maxDuration = Math.max(Math.min(pmBooking.duration, daysLeftInWeek), 1);
            // The month last day may be followed by cells this page does not draw.
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
              {resolveBarIcon?.(pmBooking!)}
              {pmBooking!.numberOfGuests > 1 ? `(${pmBooking!.numberOfGuests})` : ""}{" "}
              {pmName}
            </span>
          ) : null;

          // Resolved once: it both fills the no-PM-booking slot and suppresses
          // the availability bar that would otherwise cover it.
          const cleanSlot = !pmBooking ? renderEmptyCell?.(room, date) : null;

          return (
            <div
              key={room.name}
              className="row-span-1 h-full"
              style={{ position: "relative" }}
            >
              {amBooking && (
                <div
                  className={`${amColor} ${amBooking.reserved && !amDim ? HOLD_EDGE : ""}`}
                  style={{
                    position: "absolute",
                    top: "1px",
                    bottom: "1px",
                    left: "-1px",
                    right: amIsEnd ? "80%" : "-1px",
                    backgroundImage: amBooking.reserved && !amDim ? HOLD_HATCH : undefined,
                    // The checkout-morning cap is the only rounded end of an AM
                    // bar; mid-stay it must stay square so it butts against the
                    // night before without a seam.
                    borderTopRightRadius: amIsEnd ? R : undefined,
                    borderBottomRightRadius: amIsEnd ? R : undefined,
                  }}
                />
              )}
              {/* Checked out this morning and nobody moved in: there is an AM cap
                  but no PM bar, so neither the empty-cell path nor the label on a
                  stay applies. Clean mode fills that slot — it is precisely the
                  "cleaned, then left empty" case. */}
              {cleanSlot}
              {pmBooking ? (
                <div
                  className={`${pmColor} ${pmTextColor} ${
                    pmBooking.reserved && !pmDim ? HOLD_EDGE : ""
                  } flex items-center`}
                  style={{
                    position: "absolute",
                    top: "1px",
                    bottom: "1px",
                    left: pmIsStart ? "20%" : "-1px",
                    right: "-1px",
                    fontSize: `${textSize}rem`,
                    backgroundImage: pmBooking.reserved && !pmDim ? HOLD_HATCH : undefined,
                    borderTopLeftRadius: pmIsStart ? R : undefined,
                    borderBottomLeftRadius: pmIsStart ? R : undefined,
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
                    borderTopLeftRadius: R,
                    borderBottomLeftRadius: R,
                    ...hatchPhase(0.2 * (tileWidth ?? 0)),
                  }}
                />
              ) : !isBefore(date, startOfToday()) && !overrideRooms && !cleanSlot ? (
                // The "available to sell" bar sits in the same slot as the clean
                // label and is drawn after it, so it painted straight over the
                // cleaner. In Clean mode the cleaner owns this space.
                <div
                  className="react-calendar__opportunity_pm"
                  style={{
                    position: "absolute",
                    top: "1px",
                    bottom: "1px",
                    left: "20%",
                    right: "-20%",
                    borderTopLeftRadius: R,
                    borderBottomLeftRadius: R,
                    borderTopRightRadius: R,
                    borderBottomRightRadius: R,
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
                    borderTopRightRadius: R,
                    borderBottomRightRadius: R,
                    ...hatchPhase(-1),
                  }}
                />
              )}
              {!amBooking &&
                !overrideRooms &&
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
                      borderTopRightRadius: R,
                      borderBottomRightRadius: R,
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

  // Drag the grip to size the lanes. Continuous, not four preset steps: the
  // right height depends on the phone, the eyesight and how far away it is
  // being held, and none of that is knowable from here.
  //
  // The handle sits under the LAST lane, so it is dragging the bottom of a
  // stack of `maxRooms` lanes. Dividing the drag by that count is what keeps the
  // handle under the finger: the boundary the host is pulling ends up exactly
  // where they let go, which is the property that makes a drag handle feel like
  // direct manipulation rather than a slider in disguise.
  //
  // Two earlier placements failed. Under the whole calendar it sat where the
  // paging swipe lives. On the FIRST lane's edge the drag could be 1:1, but the
  // handle had to hug the top-left corner to avoid covering bookings — an
  // awkward reach, and still over the busiest row on the calendar. Below the
  // last lane there is a spare grid row that is always empty, so the handle can
  // sit centred, in the open, covering nothing.
  // Where the grip sits, and how fast it responds — from one formula, so the
  // two can never disagree.
  //
  // It hangs under the LAST lane of the LAST week row on the page: the bottom
  // of everything, where no booking can be behind it. Its distance from the top
  // of the page is therefore whole week-rows above it, plus the lanes of its own
  // row.
  //
  // `lanesPerPx` is that distance differentiated with respect to lane height —
  // how far the grip travels when a lane grows by one pixel. Dividing the drag
  // by it is what keeps the grip under the finger: pull down 60px and the
  // boundary lands 60px lower, whatever the room count or page shape. On a
  // phone the week-rows are stacked lanes so they scale too; on desktop the rows
  // stretch to fill the column and only the last row's lanes move.
  const rowsAbove = Math.max(0, numRows - 1);
  // Clear of the grid entirely, in the whitespace under it — not in the last
  // rows spare lane, which still counts as inside the calendar. On a phone the
  // grid ends partway down the page, so there is room below it; on desktop the
  // rows stretch to fill the column, and min() keeps the grip just under the
  // last lane rather than pushing it off the bottom of the container.
  const lastRowSpan = Math.min(rowHeight, (maxRooms + 1) * laneHeight);
  const gripTop = rowsAbove * (rowHeight + rowGap) + lastRowSpan + 4;
  //
  // Bounded, though. Exact tracking is only usable while the number stays small:
  // at four weeks per page the grip is 23 lanes down, so the full 16-48px range
  // would be 736px of drag — more than a screen. Past the cap the grip drifts
  // ahead of the finger, which is the lesser evil: a handle that outruns the
  // thumb still resizes, while one that needs three swipes does not. At one and
  // two weeks — where this is actually used — the cap barely binds.
  const GRIP_DIVISOR_CAP = 8;
  const lanesPerPx = Math.min(
    GRIP_DIVISOR_CAP,
    isNarrow ? numRows * (maxRooms + 1) : maxRooms + 1,
  );

  const resizeRef = useRef<{ y: number; lane: number } | null>(null);
  // Last value pushed upward. A pointermove fires far more often than the lane
  // actually changes — the drag is divided by six here — and every call
  // re-renders the whole calendar, so repeats are dropped rather than sent.
  const lastSentRef = useRef<number | null>(null);
  const [resizing, setResizing] = useState(false);

  const onGripDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    resizeRef.current = { y: e.clientY, lane: laneHeight };
    lastSentRef.current = laneHeight;
    setResizing(true);
  };

  const onGripMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const start = resizeRef.current;
    if (!start || !onRowHeightChange) return;
    // Measured from where the drag STARTED, never accumulated per event, so
    // overshooting a clamp and dragging back returns to where you expect.
    const next = Math.round(start.lane + (e.clientY - start.y) / Math.max(1, lanesPerPx));
    if (next === lastSentRef.current) return;
    lastSentRef.current = next;
    onRowHeightChange(next);
  };

  const endGrip = (e: React.PointerEvent<HTMLDivElement>) => {
    resizeRef.current = null;
    setResizing(false);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  };

  const displayLayouts =
    pageLayouts.length > 0
      ? pageLayouts
      : months.map((m) => ({ month: m, cells: [] as (Date | null)[] }));

  const grid = (
    <div
      ref={scrollContainerRef}
      className={`flex-1 min-h-0 ${horizontalPaging ? "flex overflow-x-scroll overflow-y-hidden snap-x overscroll-contain touch-pan-x" : "overflow-y-scroll snap-y overscroll-y-contain"} snap-mandatory`}
      onScroll={handleScroll}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onWheel={onWheel}
    >
      {displayLayouts.map((layout, index) => {
        const inWindow = Math.abs(index - visibleIndex) <= 1;
        return (
          <div
            key={index}
            // snap-always = scroll-snap-stop: always. The browser refuses to
            // fly past a snap point, so one flick moves one page no matter how
            // hard it is thrown — enforced by the scroller itself, which is the
            // only thing that can do it without fighting the momentum.
            className={`relative snap-always snap-start h-full main-calendar-wrapper ${horizontalPaging ? "w-full shrink-0" : ""}`}
            ref={index === visibleIndex ? calendarWrapperRef : undefined}
          >
            {/* Row-resize handle, hanging under the last lane of the last week
                row — the bottom edge of everything on the page, so nothing the
                host needs to read can ever be behind it. Centred, because a
                corner is an awkward reach on a phone. Only on the visible page,
                and only when a setter was supplied. */}
            {onRowHeightChange && index === visibleIndex && (
              <div
                className="absolute left-1/2 z-30 flex -translate-x-1/2 cursor-ns-resize touch-none select-none items-center gap-1 px-3"
                // 44px of hit area — the platform minimum for a finger, and
                // this one is dragged, not just tapped. The pill inside is
                // smaller; the rest is invisible padding, which costs nothing
                // here because it sits in whitespace below the grid.
                style={{ top: `${gripTop}px`, height: "44px" }}
                onPointerDown={onGripDown}
                onPointerMove={onGripMove}
                onPointerUp={endGrip}
                onPointerCancel={endGrip}
                title="Drag to resize rows"
              >
                {/* Wider than it looks tappable: the padding above extends the
                    hit area into the empty row without enlarging the pill. */}
                <div
                  className={`flex h-6 w-20 items-center justify-center rounded-full bg-white shadow-md ring-1 transition-colors ${
                    resizing ? "ring-gray-500 bg-gray-50" : "ring-gray-300"
                  }`}
                >
                  {/* Two bars, not one: a single line reads as a divider, a
                      stack of two reads as something to grab. */}
                  <div className="flex flex-col gap-1">
                    <div className={`h-0.5 w-8 rounded-full ${resizing ? "bg-gray-600" : "bg-gray-400"}`} />
                    <div className={`h-0.5 w-8 rounded-full ${resizing ? "bg-gray-600" : "bg-gray-400"}`} />
                  </div>
                </div>
                {resizing && (
                  <span className="rounded bg-gray-800 px-1 py-0.5 text-[10px] font-semibold tabular-nums text-white">
                    {laneHeight}px
                  </span>
                )}
              </div>
            )}
            {inWindow && layout.cells.length > 0 && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(7, 1fr)",
                  gridTemplateRows: `repeat(${numRows}, ${rowHeight}px)`,
                  rowGap: `${rowGap}px`,
                  // Narrow: grid is exactly its rows (+ gaps) tall, so it ends
                  // partway down the page with whitespace below (no stretch).
                  height: isNarrow ? `${numRows * rowHeight + (numRows - 1) * rowGap}px` : "100%",
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
                        {
                          "--max-rows": (maxRooms + 1).toString(),
                          "--subrow-h": `${laneHeight}px`,
                        } as React.CSSProperties
                      }
                    >
                      <abbr
                        aria-label={date.toLocaleDateString()}
                        style={{ fontSize: `${dateRemFor(laneHeight)}rem` }}
                      >
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

  return grid;
};

export default CalendarGrid;