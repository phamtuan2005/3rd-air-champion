import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { MutableRefObject } from "react";
import { addDays, format, isSameDay, parseISO, startOfToday } from "date-fns";
import { useTiBookTheme, useRoomChip } from "../../../contexts/TiBookThemeContext";
import { nightKey, nightStatus } from "../../../util/nightStatus";
import { getRoomColor } from "../../../util/getRoomColor";
import { roomType } from "../../../util/types/roomType";
import { dayType } from "../../../util/types/dayType";
import type { GuestCalendarProps } from "./GuestCalendar";
import { MONTHS_FORWARD, appliedMonthTrigger, HOLD_HATCH, HOLD_HATCH_TILE } from "./calendarScroll";
import { dayListMonths } from "../../../util/dayListMonths";

/*
 * The calendar as a list: one row per night, the grid's months top to
 * bottom, opened on tonight, to scroll down.
 *
 * Same props as the month grid and the same answers, because every row asks
 * nightStatus exactly as a grid tile does. What the list adds is room to SAY
 * things a 55px tile cannot: which rooms are free, not only how many, and the
 * name of the stay a night belongs to.
 *
 * A tap does what a tap on that night's tile does — pick it, open the guest's
 * own stay, open the pay reminder for a hold, or wish-list a sold-out night.
 *
 * ── Why only a few months are drawn ─────────────────────────────────────────
 *
 * The first version drew all three years at once: ~1,100 rows, 14,000
 * elements. On a phone the list took seconds to open, and dragging the grip
 * redrew every row on every frame — measured at 4× CPU slowdown, 3.3s to open
 * and 1.3s per frame of drag. content-visibility was tried first; it saves
 * layout but not the building of 14,000 elements, and it made month positions
 * estimates, which parked the first night half under its heading.
 *
 * Now every row and heading has a FIXED height, so where each month sits is
 * arithmetic. Only the month in view and its neighbours get rows; the rest
 * are a heading over an empty block of exactly the height their rows would
 * take, so the scrollbar, the sticky headings and a jump to March all behave
 * as though everything were there. Each month is memoised, so a drag of the
 * grip redraws nothing unless the nights themselves changed.
 */

/*
 * The list's type and heights, in px, from the width it is drawn in.
 *
 * The rows were 60px with 12px chips and 14px words: tiring to read for any
 * length of time on a phone. Matching the grid's day number was tried next,
 * but that grows only as the calendar is dragged open — 13px on an iPhone SE,
 * 21px on a Pixel fully open — so the list was still small print most of the
 * time. The bar it was held to is Airbnb's own calendar list, which the house
 * reads every day: about 22px words on a phone. So `text` is that, steady,
 * and only eased down on a narrow phone so a stay's price still fits beside
 * the stay bar. Weekday and the stay's dates are the quieter `small`; the
 * list's own day number one step larger.
 *
 * The heights still follow from the type and nothing else — see above, the
 * list's arithmetic depends on it. 3.5 lines of text plus padding fits the
 * tallest thing a row holds: a one-night stay's room line, its price, and
 * the Details link wrapped under the price on a narrow phone.
 */
interface ListSize { text: number; date: number; small: number; rowH: number; headH: number }
const listSizeFor = (boxWidth: number): ListSize => {
  // 22px from a 411px phone up; 18px on a 320px one. 0 = not measured yet.
  const text = boxWidth > 0 ? Math.round(Math.min(22, Math.max(18, boxWidth / 18.7))) : 22;
  return {
    text,
    date: Math.round(text * 1.2),
    small: Math.round(text * 0.82),
    rowH: Math.max(60, Math.round(text * 3.5 + 20)),
    headH: Math.max(36, Math.round(text * 2.2)),
  };
};
// Months drawn behind and ahead of the one at the top. More ahead, because
// that is the way a guest reads and the way a fling carries them.
const DRAW_BEHIND = 1;
const DRAW_AHEAD = 2;

// The stay bar's lane, at the RIGHT edge of every row, in px — the dates keep
// the left edge, where the eye starts each row. Every row keeps the lane's room
// whether or not a stay runs through it, so the wish-list stars and the chips
// end in one straight line down the list, clear of the bar.
// A little in from the edge, not flush against it — 8px was tried first and
// asked to come in a bit.
const BAR_RIGHT = 16;
// Was 10px, then 16; asked to be thicker each time.
const BAR_W = 32;

interface StayNight { id: string; roomName: string; roomColor?: string; isStart: boolean; nights: number; index: number; paid?: number }
interface Checkout { roomName: string; roomColor?: string }

// A night the guest holds a stay or a hold on, keyed by yyyy-MM-dd. Only the
// nights SLEPT count: the checkout morning is free again for somebody else,
// and the grid treats it the same way. The checkout mornings are kept apart,
// because the stay's bar still reaches into them — half a row, as the grid's
// ribbon reaches into the checkout day's AM half.
const nightsOf = (stays: GuestCalendarProps["myStays"]) => {
  const nights = new Map<string, StayNight>();
  const checkouts = new Map<string, Checkout>();
  (stays ?? []).forEach((s) => {
    if (!s.nights || s.nights < 1) return;
    const start = parseISO(s.startKey);
    for (let i = 0; i < s.nights; i++) {
      nights.set(nightKey(addDays(start, i)), { id: s.id, roomName: s.roomName, roomColor: s.roomColor, isStart: i === 0, nights: s.nights, index: i, paid: s.paid });
    }
    checkouts.set(nightKey(addDays(start, s.nights)), { roomName: s.roomName, roomColor: s.roomColor });
  });
  return { nights, checkouts };
};

// Everything a row reads, in one object that only changes when a night's
// answer could — so the memoised months below can tell a real change from
// the parent merely re-rendering.
interface NightData {
  scopedRooms: roomType[];
  nameRooms: boolean;
  monthMap: Map<string, dayType>;
  reservedMap?: Map<string, Set<string>>;
  cartDates: Map<string, string | null>;
  wishListDates?: Set<string>;
  newWishListDates?: Set<string>;
  stayNights: Map<string, StayNight>;
  holdNights: Map<string, StayNight>;
  stayCheckouts: Map<string, Checkout>;
  holdCheckouts: Map<string, Checkout>;
  canWishList: boolean;
  myRates?: Map<string, number>;
}

/*
 * The guest's own nightly rate for a room, as the list prints it — or nothing.
 *
 * Only a rate Anh-Tuan has agreed with THIS guest is a price; a room's list
 * price is not something anyone pays, and TiBook never quotes it (the room
 * cards and Hero hold the same line). A $0 rate is family, and "$0" reads like
 * a bug, so it says what it means instead — same as the room cards.
 */
const rateText = (rate: number | undefined): string | undefined =>
  rate == null ? undefined : rate === 0 ? "no charge" : `$${rate}`;

type Handlers = Pick<GuestCalendarProps, "onDateClick" | "onWishListClick" | "onMyStayClick" | "onMyStayDetails" | "onReservedClick">;

interface MonthSectionProps {
  month: Date;
  days: Date[];
  // Where the month starts in the list, px — so a held stay's stripes can be
  // phased to the list as a whole and run on unbroken from row to row.
  top: number;
  drawn: boolean;
  data: NightData;
  size: ListSize;
  // Read at tap time, not render time: the parent passes fresh arrow
  // functions every render, and as props they would defeat the memo.
  handlers: MutableRefObject<Handlers>;
}

const MonthSection = memo(({ month, days, top, drawn, data, size, handlers }: MonthSectionProps) => {
  const { theme } = useTiBookTheme();
  const roomChip = useRoomChip();
  const { rowH: ROW_H, headH: HEAD_H } = size;
  const fs = (px: number): React.CSSProperties => ({ fontSize: px });
  // Was w-12 (48px), sized for "TODAY" at 12px; it widens with the weekday.
  const dateColW = Math.max(48, Math.round(size.small * 3.4));

  /*
   * One row's piece of a stay's bar.
   *
   * A stay is drawn as ONE upright bar in its room's colour, running down
   * every night it covers — the month grid's ribbon, turned on its side. The
   * rows are a fixed height, so each row drawing its own piece lines them up
   * into a single bar with no seams. Same geometry as the grid, too: the bar
   * starts halfway down the check-in row (a guest arrives in the afternoon)
   * and ends halfway down the checkout row (and leaves in the morning), so
   * two stays back to back meet in the middle of the changeover day.
   *
   * top/bottom of -1 reach over the row's own 1px border, which would
   * otherwise show as a hairline gap between one night and the next.
   *
   * Offsets are in px from the TOP of the element, not percentages: a stay's
   * nights are one merged cell several rows tall, and "halfway down" has to
   * mean halfway down its first night, not halfway down the whole stay.
   */
  const barPiece = (
    part: "start" | "night" | "checkout",
    room: Checkout,
    held: boolean,
    rowTop: number,
    key: string,
  ) => {
    const radius = BAR_W / 2;
    const style: React.CSSProperties = {
      position: "absolute",
      right: BAR_RIGHT,
      width: BAR_W,
      top: part === "start" ? ROW_H / 2 : -1,
      ...(part === "checkout" ? { height: ROW_H / 2 + 1 } : { bottom: -1 }),
      borderTopLeftRadius: part === "start" ? radius : undefined,
      borderTopRightRadius: part === "start" ? radius : undefined,
      borderBottomLeftRadius: part === "checkout" ? radius : undefined,
      borderBottomRightRadius: part === "checkout" ? radius : undefined,
    };
    if (held) {
      // Phased to the list, not the piece: each piece would otherwise start
      // the stripes afresh at its own top edge and the hatch would break at
      // every row. Same fix, for the same reason, as the grid's hatchPhase.
      const pieceTop = rowTop + (part === "start" ? ROW_H / 2 : -1);
      Object.assign(style, {
        backgroundImage: HOLD_HATCH,
        backgroundSize: `${HOLD_HATCH_TILE}px ${HOLD_HATCH_TILE}px`,
        // Every piece sits at the same x, so only y needs phasing.
        backgroundPosition: `0px ${-pieceTop}px`,
      });
    }
    return (
      <span
        key={key}
        aria-hidden
        className={`pointer-events-none z-10 ${
          held
            ? `${getRoomColor(room.roomName, room.roomColor)} border-x-2 border-dashed border-amber-500`
            : roomChip({ name: room.roomName, color: room.roomColor }, "vbar")
        }`}
        style={style}
      />
    );
  };

  const renderRow = (date: Date, i: number) => {
    const rowTop = top + HEAD_H + i * ROW_H;
    const key = nightKey(date);
    const { status, roomsLeft, freeRooms } = nightStatus(date, data.scopedRooms, data.monthMap, data.reservedMap);
    const isOpen = status === "available" || status === "partial";
    const inCart = data.cartDates.has(key);
    const isWishlisted = data.wishListDates?.has(key) ?? false;
    const isNewWishList = data.newWishListDates?.has(key) ?? false;
    const canWishList = data.canWishList && (status === "full" || status === "blocked");
    const isToday = isSameDay(date, startOfToday());
    const isWeekend = date.getDay() === 0 || date.getDay() === 6;
    const gone = status === "past";

    const h = handlers.current;
    const onClick =
      isOpen || inCart ? () => h.onDateClick?.(date) :
      canWishList ? () => h.onWishListClick?.(date) :
      undefined;

    const rowClass = [
      // pr-16 (64px) = the bar's inset + its width + a gap, so nothing in the
      // row runs under it.
      `flex w-full items-center gap-3 border-b ${theme.line} pl-3 pr-16 text-left relative`,
      inCart ? "" :
      isNewWishList ? theme.tileWishBg :
      isWeekend ? theme.surfaceSubtle : "",
      onClick
        ? `cursor-pointer transition-colors ${isOpen ? `${theme.tileHover} ${theme.tileActive}` : canWishList ? theme.tileWishHover : ""}`
        : "cursor-default",
    ].join(" ");

    // The line beside the date. Said as what the guest can do with the night.
    // (The guest's own nights never come here — see renderStay.)
    let detail: React.ReactNode;
    if (isOpen) {
      detail = (
        // One line, whatever the width: the row's height is fixed (see top of
        // file), so chips that wrapped would spill into the next night. On a
        // 320px phone five rooms with prices do not fit, and clipping lost the
        // last one — Queen's "no charge", which is exactly what a family guest
        // is looking for. So the chips slide sideways instead, the same hidden-
        // scrollbar strip the room filter uses.
        <span className="flex min-w-0 items-center gap-1 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {data.nameRooms ? (
            <>
              <span className={`mr-0.5 shrink-0 font-semibold ${inCart ? "text-white" : theme.surfaceText2}`} style={fs(size.text)}>
                {roomsLeft} free
              </span>
              {freeRooms.map((r) => {
                // The price sits UNDER the name, inside the chip. Beside it,
                // five rooms with prices ran past a phone's width and the last
                // ones were cut off; stacked, a chip is only as wide as its
                // longer line, and two lines still fit the fixed row height.
                const price = rateText(data.myRates?.get(r.id));
                return (
                  <span
                    key={r.id}
                    className={`${roomChip(r)} flex shrink-0 flex-col items-center font-semibold leading-tight text-black ${
                      price ? "rounded-lg px-1.5 py-0.5" : "rounded-full px-2 py-px"
                    }`}
                    style={fs(size.text)}
                  >
                    <span>{r.name}</span>
                    {price && <span className="font-bold">{price}</span>}
                  </span>
                );
              })}
            </>
          ) : (
            <span className={`font-semibold ${inCart ? "text-white" : theme.surfaceText2}`} style={fs(size.text)}>
              Free
              {/* One room in scope: room for the words the chips have to leave out. */}
              {(() => {
                const rate = data.myRates?.get(freeRooms[0]?.id ?? "");
                if (rate == null) return null;
                return (
                  <span className="font-normal">
                    {" · "}
                    {rate === 0 ? "family, no charge" : <><span className="font-bold">${rate}</span> a night, your price</>}
                  </span>
                );
              })()}
            </span>
          )}
        </span>
      );
    } else if (gone) {
      // A night already slept has nothing to offer and nothing to press. The
      // dimmed date is the whole row, as a past tile in the grid is only its
      // dimmed number — "Sold out" would be untrue of it, and the wish-list
      // star never comes here because nightStatus does not call it full.
      detail = null;
    } else {
      detail = (
        // Two lines, not one cut short: at the list's larger type a phone
        // clipped this to "tap to wish…", hiding what the tap does. The row
        // is tall enough for two (see listSizeFor).
        <span className={`line-clamp-2 leading-tight ${theme.surfaceMuted}`} style={fs(size.text)}>
          {/* A non-breaking hyphen (U+2011): at the list's type the line wraps,
              and it broke "wish-" from "list". */}
          {isWishlisted ? "Sold out · on your wish list" : canWishList ? "Sold out · tap to wish‑list" : "Sold out"}
        </span>
      );
    }

    return (
      <button
        key={key}
        type="button"
        className={rowClass}
        style={{ height: ROW_H }}
        disabled={!onClick}
        onClick={onClick}
      >
        {inCart && <div className={`absolute inset-0.5 rounded-lg ${theme.btn} pointer-events-none`} />}
        {/* The end of a stay's bar, on its checkout morning. Picked for a new
            stay, the cap drops, as in the grid: the pick is the news there. */}
        {!inCart && data.stayCheckouts.has(key) && barPiece("checkout", data.stayCheckouts.get(key)!, false, rowTop, "stay-out")}
        {!inCart && data.holdCheckouts.has(key) && barPiece("checkout", data.holdCheckouts.get(key)!, true, rowTop, "hold-out")}
        {/* The date column is fixed-width, so the nights line up down the list
            and the eye can run down it the way it runs down a grid column. */}
        <span className="relative z-10 flex shrink-0 flex-col items-center leading-none" style={{ width: dateColW }}>
          <span className={`font-medium uppercase ${inCart ? "text-white" : isToday ? theme.textPrimary : gone ? theme.dim : theme.surfaceMuted}`} style={fs(size.small)}>
            {isToday ? "Today" : format(date, "EEE")}
          </span>
          <span
            style={fs(size.date)}
            className={`mt-0.5 font-bold ${
              inCart ? "text-white" :
              isOpen ? theme.surfaceText :
              // Gone is dim, not struck through: struck through is "sold out",
              // a night somebody else has — the same split the grid makes.
              gone ? theme.dim :
              `line-through ${theme.surfaceMuted2}`
            }`}
          >
            {date.getDate()}
          </span>
        </span>
        <span className="relative z-10 min-w-0 flex-1">{detail}</span>
        <span className="relative z-10 shrink-0 leading-none" style={fs(size.date)}>
          {inCart ? <span className="text-white">✓</span> :
           canWishList ? (
             <span className={isWishlisted ? theme.warmText2 : theme.surfaceMuted2}>{isWishlisted ? "★" : "☆"}</span>
           ) : null}
        </span>
      </button>
    );
  };

  /*
   * The guest's own stay — or a hold — as ONE cell spanning all its nights.
   *
   * It used to be a row a night, each repeating "King · Your stay · night 2
   * of 4". Merged, the stay reads as the one thing it is: a cell exactly as
   * tall as its nights, dates at its top and bottom, the room and the dates
   * said once, and the bar running down its side. Exactly nights × ROW_H, so
   * every month still sits where the list's arithmetic says it does.
   *
   * A stay that crosses into the next month is one cell per month — the
   * heading sits between them, and the bar runs on through it — and the
   * second says it is the same stay, continued.
   */
  const renderStay = (run: Date[], i: number, first: StayNight, held: boolean) => {
    const rowTop = top + HEAD_H + i * ROW_H;
    const firstKey = nightKey(run[0]);
    const last = run[run.length - 1];
    const checkIn = addDays(run[0], -first.index);
    const checkOut = addDays(checkIn, first.nights);
    const nightsText = `${first.nights} night${first.nights === 1 ? "" : "s"}`;
    /*
     * What the guest paid for the WHOLE stay — every night at the price it was
     * booked at, fees once — worked out by the backend from the booking
     * itself, never from today's rate. Said on each part of a stay that crosses
     * a month, since the dates beside it are the whole stay's too.
     *
     * Only a confirmed stay has been paid; a hold has not, and says so. A $0
     * stay is family and says what it means, as the room cards do. Unknown
     * (a backend that does not send it yet) says nothing rather than guess.
     */
    const paidText =
      held || first.paid == null ? undefined :
      first.paid === 0 ? "Family — no charge" :
      `Paid $${first.paid.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
    const h = handlers.current;
    const onClick = held ? () => h.onReservedClick?.() : () => h.onMyStayClick?.(first.id);
    const today = startOfToday();

    const dateStack = (d: Date, first: boolean) => (
      <span className="flex flex-col items-center leading-none">
        <span className={`font-medium uppercase ${first && isSameDay(d, today) ? theme.textPrimary : theme.surfaceMuted}`} style={fs(size.small)}>
          {first && isSameDay(d, today) ? "Today" : format(d, "EEE")}
        </span>
        <span className={`mt-0.5 font-bold ${theme.surfaceText}`} style={fs(size.date)}>{d.getDate()}</span>
      </span>
    );

    // A div acting as the button, not a <button>: the Details link inside it
    // is a button of its own, and a button cannot hold another.
    return (
      <div
        key={firstKey}
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); }
        }}
        className={`relative flex w-full items-stretch gap-3 border-b ${theme.line} pl-3 pr-16 text-left cursor-pointer transition-colors ${theme.surfaceHover2}`}
        style={{ height: run.length * ROW_H }}
      >
        {/* A stay ending the morning this one starts: its bar's end, at the
            top of this cell, meeting this bar in the middle of the night. */}
        {data.stayCheckouts.has(firstKey) && barPiece("checkout", data.stayCheckouts.get(firstKey)!, false, rowTop, "stay-out")}
        {data.holdCheckouts.has(firstKey) && barPiece("checkout", data.holdCheckouts.get(firstKey)!, true, rowTop, "hold-out")}
        {barPiece(first.isStart ? "start" : "night", first, held, rowTop, "bar")}

        {/* First night at the top, last at the bottom, a line between: the
            same date column as every row, stretched over the stay. */}
        <span className="relative z-10 flex shrink-0 flex-col items-center justify-between" style={{ paddingBlock: 10, width: dateColW }}>
          {dateStack(run[0], true)}
          {run.length > 1 && (
            <>
              <span className={`my-1 w-px flex-1 ${theme.handle}`} />
              {dateStack(last, false)}
            </>
          )}
        </span>

        <span className="relative z-10 flex min-w-0 flex-1 flex-col justify-center gap-1 leading-tight">
          <span className="flex min-w-0 items-center gap-1.5">
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 font-bold text-black ${
                held
                  ? `${getRoomColor(first.roomName, first.roomColor)} border border-dashed border-amber-500`
                  : roomChip({ name: first.roomName, color: first.roomColor })
              }`}
              // The label line is the quieter size: at the full size, chip and
              // "Your stay · 1 night" ran past a phone and cut to "1 ni…".
              style={fs(size.small)}
            >
              {first.roomName}
            </span>
            <span className={`truncate font-semibold ${held ? theme.warmText2 : theme.surfaceText}`} style={fs(size.small)}>
              {held ? "⏳ Held for you" : first.index === 0 ? `Your stay · ${nightsText}` : "Your stay, continued"}
            </span>
          </span>
          {/* Left out of a confirmed one-night cell, whose date column already
              says the night: that cell has room for three lines, and the price
              with its link may need two. A hold keeps it — it has no price. */}
          {(held || run.length > 1) && (
            <span className={`truncate ${theme.surfaceMuted}`} style={fs(size.small)}>
              {format(checkIn, "EEE d MMM")} – {format(checkOut, "EEE d MMM")}
              {held ? ` · ${nightsText}` : ""}
            </span>
          )}
          {/* The price, and beside it the way to the booking itself. The
              price is never cut short — "Family — …" hid the one word that
              says why it is $0. When both do not fit a phone's width, the
              link drops under the price instead. */}
          {!held && (
            <span className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
              {paidText && (
                <span className={`whitespace-nowrap font-semibold ${theme.surfaceText}`} style={fs(size.text)}>{paidText}</span>
              )}
              {h.onMyStayDetails && (
                <button
                  type="button"
                  aria-label={`Booking details, ${first.roomName}, ${format(checkIn, "d MMM")}`}
                  // The cell's own tap opens the stay card; this goes past it,
                  // to the booking in Your bookings.
                  onClick={(e) => { e.stopPropagation(); h.onMyStayDetails?.(first.id); }}
                  onKeyDown={(e) => e.stopPropagation()}
                  className={`shrink-0 whitespace-nowrap font-semibold underline underline-offset-2 ${theme.textPrimary}`}
                  style={fs(size.text)}
                >
                  Details ›
                </button>
              )}
            </span>
          )}
          {held && <span className={`truncate font-semibold ${theme.warmText2}`} style={fs(size.small)}>Tap to pay</span>}
        </span>
      </div>
    );
  };

  // Every night of the month, with each run of the guest's own nights folded
  // into one cell. A run is one stay (or one hold): two stays back to back are
  // two cells, even in the same room, because they are two bookings.
  const renderDays = () => {
    const out: React.ReactNode[] = [];
    for (let i = 0; i < days.length;) {
      const stay = data.stayNights.get(nightKey(days[i]));
      const occ = stay ?? data.holdNights.get(nightKey(days[i]));
      if (!occ) {
        out.push(renderRow(days[i], i));
        i++;
        continue;
      }
      const held = !stay;
      let j = i + 1;
      while (j < days.length) {
        const k = nightKey(days[j]);
        const next = held ? (data.stayNights.has(k) ? undefined : data.holdNights.get(k)) : data.stayNights.get(k);
        if (next?.id !== occ.id) break;
        j++;
      }
      out.push(renderStay(days.slice(i, j), i, occ, held));
      i = j;
    }
    return out;
  };

  // A stay that runs over the end of the month carries its bar straight
  // through this heading, so it reads as one stay and not two. The night
  // before the 1st being a stay night is enough: the bar always reaches at
  // least the next morning.
  const beforeFirst = nightKey(addDays(days[0], -1));
  const stayThrough = data.stayNights.get(beforeFirst);
  const holdThrough = stayThrough ? undefined : data.holdNights.get(beforeFirst);

  return (
    <section>
      {/* Not sticky. It was, and then a stay crossing into a new month had to
          stop at the heading — a stuck heading carrying a piece of bar would
          sit over nights that are not in the stay. The month title above the
          list already follows the scroll, so sticking only repeated it. */}
      <h3
        className={`relative flex items-center border-b ${theme.line} ${theme.surface} pl-3 pr-16 font-bold ${theme.surfaceText}`}
        style={{ height: HEAD_H, fontSize: size.text }}
      >
        {stayThrough && barPiece("night", stayThrough, false, top, "stay")}
        {holdThrough && barPiece("night", holdThrough, true, top, "hold")}
        <span className="flex-1">{format(month, "MMMM yyyy")}</span>
        {/* Says once a month what the "$65" on a chip is: this guest's own
            rate, per night — not a total, not a list price. */}
        {data.nameRooms && (data.myRates?.size ?? 0) > 0 && (
          <span className={`font-normal ${theme.surfaceMuted}`} style={fs(size.small)}>Prices are yours, a night</span>
        )}
      </h3>
      {drawn ? renderDays() : <div style={{ height: days.length * ROW_H }} />}
    </section>
  );
});

const GuestDayList = ({
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
  myRates,
  scrollToTodayTrigger = 0,
  scrollToMonthTrigger,
  onMonthChange,
  onDateClick,
  onWishListClick,
  onMyStayClick,
  onMyStayDetails,
  onReservedClick,
}: GuestCalendarProps) => {
  const { theme } = useTiBookTheme();
  const scrollRef = useRef<HTMLDivElement>(null);

  const handlers = useRef<Handlers>({});
  handlers.current = { onDateClick, onWishListClick, onMyStayClick, onMyStayDetails, onReservedClick };

  // The list's width decides its type. See listSizeFor.
  const [boxWidth, setBoxWidth] = useState(0);
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const obs = new ResizeObserver(([entry]) => setBoxWidth(entry.contentRect.width));
    obs.observe(el);
    setBoxWidth(el.clientWidth);
    return () => obs.disconnect();
  }, []);
  const textPx = listSizeFor(boxWidth).text;
  // Keyed on the one number everything follows from, so a resize that does
  // not change the type does not re-lay the list or redraw its months.
  const size = useMemo(() => listSizeFor(boxWidth), [textPx]); // eslint-disable-line react-hooks/exhaustive-deps

  const scopedRooms = useMemo(
    () => rooms.filter((r) => r.active && (selectedRoomIds === null || selectedRoomIds.has(r.id))),
    [rooms, selectedRoomIds],
  );
  const stays = useMemo(() => nightsOf(myStays), [myStays]);
  const holds = useMemo(() => nightsOf(reservedStays), [reservedStays]);
  const canWishList = !!onWishListClick;

  const data = useMemo<NightData>(() => ({
    scopedRooms,
    // Naming the one room in scope on every row says nothing the room strip
    // does not already — same reason the grid drops "1 left".
    nameRooms: scopedRooms.length > 1,
    monthMap, reservedMap, cartDates, wishListDates, newWishListDates,
    stayNights: stays.nights, holdNights: holds.nights,
    stayCheckouts: stays.checkouts, holdCheckouts: holds.checkouts,
    canWishList, myRates,
  }), [scopedRooms, monthMap, reservedMap, cartDates, wishListDates, newWishListDates, stays, holds, canWishList, myRates]);

  // Every night from the 1st of this month — the grid's days — with tonight's
  // row as the place the list opens. It began at tonight once; dayListMonths
  // says what that cost. `top` is where each month starts, in px — exact,
  // because every height in the list is fixed.
  const { sections, todayTop } = useMemo(
    () => dayListMonths(startOfToday(), MONTHS_FORWARD, size.headH, size.rowH),
    [size],
  );

  /*
   * When the type changes size, every month moves — so keep the same NIGHT at
   * the top, not the same pixel. Without this, turning the phone sideways
   * mid-list would slide the guest weeks away from the night they were
   * reading. (It also lands the first draw, made before the width is known.)
   * Worked out from the old layout's arithmetic, which is exact.
   */
  const laidOut = useRef({ sections, size });
  useLayoutEffect(() => {
    const prev = laidOut.current;
    laidOut.current = { sections, size };
    const el = scrollRef.current;
    if (!el || prev.size === size) return;
    const y = el.scrollTop;
    let idx = 0;
    while (idx + 1 < prev.sections.length && prev.sections[idx + 1].top <= y) idx++;
    const into = y - prev.sections[idx].top;
    el.scrollTop = sections[idx].top + (
      into < prev.size.headH
        ? (into / prev.size.headH) * size.headH
        : size.headH + ((into - prev.size.headH) / prev.size.rowH) * size.rowH
    );
  }, [sections, size]);

  const indexOfMonth = (m: Date) => {
    const today = new Date();
    return Math.max(0, Math.min(sections.length - 1,
      (m.getFullYear() - today.getFullYear()) * 12 + (m.getMonth() - today.getMonth())));
  };

  // The month at the top of the list. Starts where the guest was, so the
  // first draw is already the right months and not tonight's.
  const [shownIdx, setShownIdx] = useState(() => indexOfMonth(currentMonth));
  const shownIdxRef = useRef(shownIdx);

  // Where a jump to a month lands: its heading — or, for this month, tonight's
  // row. The nights before it are drawn, for the guest mid-stay who scrolls up
  // to the start of their stay, but nobody asked to land on them: the first
  // thing the guest sees is still tonight, as when the list began there.
  const landingTop = (idx: number) => (idx === 0 ? todayTop : sections[idx].top);

  const scrollToIndex = (idx: number) => {
    const el = scrollRef.current;
    if (!el) return;
    // Draw the destination before landing on it, rather than land on a blank.
    shownIdxRef.current = idx;
    setShownIdx(idx);
    el.scrollTop = landingTop(idx);
  };

  // Open where the guest was. Switching from the grid in March lands on March,
  // not back on tonight — the switch changes how the month is drawn, not where
  // the guest is in it.
  useEffect(() => {
    scrollToIndex(indexOfMonth(currentMonth));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (scrollToTodayTrigger > 0) {
      scrollToIndex(0);
      onMonthChange?.(sections[0].month);
    }
  }, [scrollToTodayTrigger]); // eslint-disable-line react-hooks/exhaustive-deps

  // Once per visit, shared with the grid (see calendarScroll), so switching
  // views cannot yank the guest back to a month they have scrolled away from.
  useEffect(() => {
    if (!scrollToMonthTrigger || scrollToMonthTrigger.seq === appliedMonthTrigger.seq) return;
    appliedMonthTrigger.seq = scrollToMonthTrigger.seq;
    const idx = indexOfMonth(scrollToMonthTrigger.month);
    scrollToIndex(idx);
    onMonthChange?.(sections[idx].month);
  }, [scrollToMonthTrigger]); // eslint-disable-line react-hooks/exhaustive-deps

  // The month title above the calendar follows the month at the top of the
  // list, the same way it follows the page the grid is snapped to. Only a
  // change of month re-renders; scrolling within one costs nothing.
  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const top = el.scrollTop + 1;
    let idx = 0;
    while (idx + 1 < sections.length && sections[idx + 1].top <= top) idx++;
    if (idx !== shownIdxRef.current) {
      shownIdxRef.current = idx;
      setShownIdx(idx);
      onMonthChange?.(sections[idx].month);
    }
  };

  return (
    <div
      ref={scrollRef}
      // overscroll-contain for the same reason as the grid: reaching the end
      // of the list must not start dragging the page around it.
      className={`flex-1 min-h-0 overflow-y-auto overscroll-contain border-t ${theme.gridLine}`}
      onScroll={handleScroll}
    >
      {/* The last rows scroll up clear of the floating chat button, which
          otherwise sits over their wish-list star. */}
      <div className="pb-20">
        {sections.map(({ month, days, top }, i) => (
          <MonthSection
            key={i}
            month={month}
            days={days}
            top={top}
            drawn={i >= shownIdx - DRAW_BEHIND && i <= shownIdx + DRAW_AHEAD}
            data={data}
            size={size}
            handlers={handlers}
          />
        ))}
      </div>
    </div>
  );
};

export default GuestDayList;
