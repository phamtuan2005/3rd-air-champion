import { useEffect, useMemo, useRef } from "react";
import { roomType } from "../../util/types/roomType";
import { dayType } from "../../util/types/dayType";
import { getRoomPhotos } from "../../util/roomFacts";
import { useTiBookTheme, useRoomChip } from "../../contexts/TiBookThemeContext";
import { AppearanceMenu } from "./NavBarDesktop";
import GuestCalendar, { MyStay } from "./Calendar/GuestCalendar";

const BACKEND = import.meta.env.VITE_BACKEND_ENDPOINT || "";
const resolveUrl = (url: string) => (url.startsWith("/") ? `${BACKEND}${url}` : url);

/*
 * The Hero layout.
 *
 * The rooms take the top two fifths of everything above the bottom bar and the
 * month takes the lower three — the proportion the mockup was settled at, kept
 * here as a flex-basis rather than pixels so it holds on a short phone as well
 * as a tall one.
 *
 * What this component does NOT do is decide anything. Swiping a card sets
 * selectedRoomIds, which is the same filter the room strip has always driven,
 * so the month answers "is this room free" through the one availability rule
 * there has ever been. No dates, no rates, no holds are computed here; they
 * arrive as props already worked out by TiBook.tsx. A layout that started
 * answering those questions itself would be a second TiBook, and the two would
 * eventually disagree in front of a guest (TIBOOK.md rule 1).
 */

// "Any room" is a card in the deck rather than a setting elsewhere: a guest who
// does not mind which room should be able to say so in the place they are
// already looking. null selection is what the rest of TiBook already means by
// "no room filter", so picking it is the same state the app starts in.
const ANY = "__any__";

interface HeroShellProps {
  host: { name: string; airbnbName?: string };
  rooms: roomType[];
  monthMap: Map<string, dayType>;
  selectedRoomIds: Set<string> | null;
  onSelectRoom: (id: string | null) => void;
  myRates?: Map<string, number>;
  cartDates: Map<string, string | null>;
  wishListDates: Set<string>;
  newWishListDates: Set<string>;
  myBookingDates: Set<string>;
  myStays: MyStay[];
  reservedStays: MyStay[];
  reservedMap: Map<string, Set<string>>;
  currentMonth: Date;
  onMonthChange: (m: Date) => void;
  onDateClick: (d: Date) => void;
  onWishListClick: (d: Date) => void;
  onMyStayClick: (id: string) => void;
  onReservedClick: () => void;
  scrollToTodayTrigger: number;
  scrollToMonthTrigger?: { month: Date; seq: number };
  onOpenPhotos: (room: roomType) => void;
  onMyBookings: () => void;
  onRequest: () => void;
  guestName?: string;
  actionLabel: string;
  hasSelection: boolean;
}

const HeroShell = ({
  host, rooms, monthMap, selectedRoomIds, onSelectRoom, myRates,
  cartDates, wishListDates, newWishListDates, myBookingDates, myStays,
  reservedStays, reservedMap, currentMonth, onMonthChange, onDateClick,
  onWishListClick, onMyStayClick, onReservedClick, scrollToTodayTrigger,
  scrollToMonthTrigger, onOpenPhotos, onMyBookings, onRequest, guestName,
  actionLabel, hasSelection,
}: HeroShellProps) => {
  const { theme } = useTiBookTheme();
  const roomChip = useRoomChip();
  const activeRooms = useMemo(
    () => rooms.filter((r) => r.active).sort((a, b) => b.price - a.price),
    [rooms],
  );

  // One id, not a Set: the deck shows one card at a time, and a card is either
  // a room or "any". The Set lives upstream because the rest of TiBook filters
  // by many rooms; here it is only ever none or one.
  const activeId =
    selectedRoomIds && selectedRoomIds.size === 1
      ? [...selectedRoomIds][0]
      : ANY;

  const cards = useMemo(
    () => [{ id: ANY, room: null as roomType | null }, ...activeRooms.map((r) => ({ id: r.id, room: r }))],
    [activeRooms],
  );

  const trackRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  // Set while a tap is scrolling the deck, so the scroll handler does not fight
  // the animation it triggered and snap the guest back.
  const scrollingTo = useRef<string | null>(null);

  // Which card the deck has settled on. Read from scroll rather than from a tap
  // so a SWIPE selects too — the swipe is the point of the layout, and a deck
  // that only responded to taps would be a row of buttons wearing a photo.
  const onScroll = () => {
    const el = trackRef.current;
    if (!el) return;
    let best: string | null = null;
    let bestDist = Infinity;
    cardRefs.current.forEach((node, id) => {
      const d = Math.abs(node.offsetLeft - el.scrollLeft);
      if (d < bestDist) { bestDist = d; best = id; }
    });
    if (!best) return;
    if (scrollingTo.current && scrollingTo.current !== best) return;
    scrollingTo.current = null;
    if (best !== activeId) onSelectRoom(best === ANY ? null : best);
  };

  // Bring a tapped card to the front of the deck.
  const pick = (id: string) => {
    scrollingTo.current = id;
    onSelectRoom(id === ANY ? null : id);
    cardRefs.current.get(id)?.scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" });
  };

  // A room chosen from somewhere else (a room picker, a stay) should bring its
  // card into view rather than leaving the deck showing something the month is
  // no longer about.
  useEffect(() => {
    const node = cardRefs.current.get(activeId);
    if (!node || !trackRef.current) return;
    if (Math.abs(node.offsetLeft - trackRef.current.scrollLeft) < 8) return;
    scrollingTo.current = activeId;
    node.scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" });
  }, [activeId]);

  const activeRoom = activeRooms.find((r) => r.id === activeId) ?? null;
  // The HOST is the person, not the listing. airbnbName is the title of the
  // place ("TT House in Silicon Valley"), so taking a first name off it gave a
  // card that said "TT picks the room".
  const hostFirstName = (host.name || "").split(" ")[0] || "the host";

  // What the month is showing, said in words above it. The count comes from the
  // same monthMap the grid reads, so the sentence and the grid cannot disagree.
  const freeNights = useMemo(() => {
    let n = 0;
    monthMap.forEach((day, key) => {
      const d = new Date(key + "T00:00:00");
      if (d.getMonth() !== currentMonth.getMonth() || d.getFullYear() !== currentMonth.getFullYear()) return;
      if (day.isBlocked) return;
      const taken = new Set<string>(day.bookings?.map((b) => b.room?.id).filter(Boolean) as string[] ?? []);
      reservedMap.get(key)?.forEach((id) => taken.add(id));
      day.blockedRooms?.forEach((r) => { if (r?.id) taken.add(r.id); });
      const scope = activeRoom ? [activeRoom] : activeRooms;
      if (scope.some((r) => !taken.has(r.id))) n += 1;
    });
    return n;
  }, [monthMap, currentMonth, activeRoom, activeRooms, reservedMap]);

  const rateOf = (r: roomType) => myRates?.get(r.id) ?? r.price;
  const prices = activeRooms.map(rateOf);
  const lo = prices.length ? Math.min(...prices) : 0;
  const hi = prices.length ? Math.max(...prices) : 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col">

      {/* ── The rooms: 2 of the 5 parts above the bottom bar ─────────────── */}
      <div className="relative min-h-0 flex-[2]">
        <div
          ref={trackRef}
          onScroll={onScroll}
          className="absolute inset-0 flex snap-x snap-mandatory gap-2 overflow-x-auto pl-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {cards.map(({ id, room }) => {
            const on = id === activeId;
            const photo = room ? getRoomPhotos(room).map(resolveUrl)[0] : undefined;
            const count = room ? getRoomPhotos(room).length : 0;
            return (
              <div
                key={id}
                ref={(n) => { if (n) cardRefs.current.set(id, n); else cardRefs.current.delete(id); }}
                onClick={() => pick(id)}
                className={`relative w-[17rem] shrink-0 snap-start cursor-pointer overflow-hidden rounded-3xl border transition-all ${
                  on ? theme.selectedBorder : theme.surfaceBorder
                } ${on ? theme.glow : "opacity-70"}`}
              >
                {room ? (
                  <>
                    {photo ? (
                      <img src={photo} alt={room.name} className="absolute inset-0 h-full w-full object-cover" draggable={false} />
                    ) : (
                      <div className={`absolute inset-0 ${theme.surfaceInset}`} />
                    )}
                    {/* The foot of the card is where the name and price live,
                        because the head is where the bar is. */}
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/90 to-transparent" />
                    {count > 1 && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onOpenPhotos(room); }}
                        className="absolute bottom-3 right-3 flex items-center gap-1 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-semibold text-white"
                      >
                        {count} photos
                      </button>
                    )}
                    <div className="absolute inset-x-3 bottom-3 flex flex-col items-start gap-1.5">
                      <span className={`rounded-lg px-3 py-1 text-sm font-bold text-white ${roomChip(room)}`}>
                        {room.name}
                      </span>
                      <span className="flex items-baseline gap-1.5">
                        {/* A guest on a deliberate $0 rate is family. Saying
                            "$0" reads as a bug, so it says what it means. */}
                        {rateOf(room) === 0 ? (
                          <span className={`text-lg font-bold ${theme.textPrimary}`}>Family — no charge</span>
                        ) : (
                          <>
                            <span className={`text-2xl font-extrabold tracking-tight ${theme.textPrimary}`}>${rateOf(room)}</span>
                            <span className="text-xs text-white/80">/ night{myRates?.get(room.id) != null ? " · your rate" : ""}</span>
                          </>
                        )}
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className={`absolute inset-0 ${theme.surface}`} />
                    <div className={`absolute inset-0 bg-gradient-to-br ${theme.vibe === "vivid" ? "from-emerald-400/20 to-cyan-500/10" : "from-gray-100 to-white"}`} />
                    <div className="absolute inset-x-4 top-1/4 flex gap-1.5">
                      {activeRooms.map((r) => (
                        <span key={r.id} className={`h-6 w-6 rounded-lg ${roomChip(r)}`} />
                      ))}
                    </div>
                    <div className="absolute inset-x-4 bottom-3 flex flex-col gap-1">
                      <span className={`text-xl font-extrabold tracking-tight ${theme.surfaceText}`}>Any room is fine</span>
                      <span className={`text-xs leading-snug ${theme.surfaceMuted}`}>
                        {hostFirstName} picks the room. Same house, same bathrooms.
                      </span>
                      <span className="mt-0.5 flex items-baseline gap-1.5">
                        <span className={`text-xl font-extrabold tracking-tight ${theme.textPrimary}`}>
                          {lo === hi ? `$${lo}` : `$${lo}–${hi}`}
                        </span>
                        <span className={`text-xs ${theme.surfaceMuted}`}>/ night · by room</span>
                      </span>
                    </div>
                  </>
                )}
              </div>
            );
          })}
          <div className="w-3 shrink-0" />
        </div>

        {/* The bar rides ON the photo, so the whole two fifths belongs to the
            picture instead of a strip of it going to a title. */}
        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start gap-2 bg-gradient-to-b from-black/85 via-black/45 to-transparent px-4 pb-6 pt-3">
          <div className="min-w-0 flex-1">
            <div className="truncate text-base font-extrabold leading-tight text-white">
              {host.airbnbName || host.name}
            </div>
            <div className="truncate text-[11px] text-white/70">
              {activeRoom ? `${activeRooms.findIndex((r) => r.id === activeId) + 1} of ${activeRooms.length} · swipe` : "All rooms · swipe to pick one"}
            </div>
          </div>
          <div className="pointer-events-auto flex items-center gap-2">
            <button
              type="button"
              onClick={onMyBookings}
              className="rounded-full border border-white/30 bg-black/40 px-3 py-1.5 text-xs font-semibold text-white"
            >
              {guestName?.trim().split(" ")[0] || "Your bookings"}
            </button>
            <AppearanceMenu />
          </div>
        </div>
      </div>

      {/* ── The month: 3 of the 5 parts ──────────────────────────────────── */}
      <div className={`flex min-h-0 flex-[3] flex-col border-t ${theme.line} ${theme.surface}`}>
        <div className="flex shrink-0 items-center gap-2 px-4 pb-1.5 pt-2">
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={activeRoom
              ? { boxShadow: "0 0 9px 0 currentColor" }
              : undefined}
          >
            <span className={`block h-full w-full rounded-full ${activeRoom ? roomChip(activeRoom) : theme.btn}`} />
          </span>
          <span className={`text-sm font-bold ${theme.surfaceText}`}>
            {currentMonth.toLocaleString("en-US", { month: "long" })}
          </span>
          <span className={`truncate text-[13px] ${theme.surfaceMuted}`}>
            · {activeRoom ? `${activeRoom.name} is free ${freeNights} night${freeNights === 1 ? "" : "s"}` : `${freeNights} night${freeNights === 1 ? "" : "s"} open`}
          </span>
        </div>

        {reservedStays.length > 0 && (
          <button
            type="button"
            onClick={onReservedClick}
            className={`flex shrink-0 items-center justify-center gap-1.5 border-y px-4 py-1.5 text-xs font-semibold ${theme.warmBorder} ${theme.warmFill} ${theme.warmText2}`}
          >
            ⏳ {reservedStays.length} booking{reservedStays.length === 1 ? "" : "s"} held for you — tap to review &amp; pay
          </button>
        )}

        {/* The same calendar the stacked layout uses, scoped by the same
            selectedRoomIds. Nothing about availability is re-decided here. */}
        <div className="flex min-h-0 flex-1 flex-col">
          <GuestCalendar
            currentMonth={currentMonth}
            monthMap={monthMap}
            rooms={rooms}
            selectedRoomIds={selectedRoomIds}
            cartDates={cartDates}
            wishListDates={wishListDates}
            newWishListDates={newWishListDates}
            myBookingDates={myBookingDates}
            myStays={myStays}
            reservedStays={reservedStays}
            reservedMap={reservedMap}
            scrollToTodayTrigger={scrollToTodayTrigger}
            scrollToMonthTrigger={scrollToMonthTrigger}
            onMonthChange={onMonthChange}
            onDateClick={onDateClick}
            onWishListClick={onWishListClick}
            onMyStayClick={onMyStayClick}
            onReservedClick={onReservedClick}
          />
        </div>
      </div>

      {/* ── The bottom bar, so nothing important sits in a top corner ────── */}
      <div className={`relative flex h-[4.6rem] shrink-0 items-center justify-around border-t ${theme.surfaceBorder} ${theme.chrome}`}>
        <button type="button" onClick={() => onMonthChange(new Date())} className={`flex flex-col items-center gap-1 ${theme.chromeAccent}`}>
          <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <rect x="3" y="5" width="18" height="16" rx="2" /><path strokeLinecap="round" d="M8 3v4M16 3v4M3 11h18" />
          </svg>
          <span className="text-[11px] font-bold">Dates</span>
        </button>

        <button
          type="button"
          onClick={onRequest}
          /* The one action, floated over the bar and centred: on a 6-inch phone
             this is the only spot a thumb reaches without regripping. */
          className={`absolute left-1/2 top-[-1.4rem] flex h-[3.25rem] -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full px-6 text-sm font-bold text-white ${theme.btn} ${theme.btnHover} ${theme.btnMotion} ${theme.glow} shadow-lg`}
        >
          {hasSelection ? actionLabel : "Request a Booking"}
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.6} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14m-6-6 6 6-6 6" />
          </svg>
        </button>

        <button type="button" onClick={onMyBookings} className={`flex flex-col items-center gap-1 ${theme.chromeMuted}`}>
          <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <circle cx="12" cy="8" r="4" /><path strokeLinecap="round" d="M4 21c0-4 3.6-6 8-6s8 2 8 6" />
          </svg>
          <span className="text-[11px] font-semibold">You</span>
        </button>
      </div>
    </div>
  );
};

export default HeroShell;
