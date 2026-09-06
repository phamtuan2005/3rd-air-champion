import { useEffect, useMemo, useRef } from "react";
import { isSameMonth } from "date-fns";
import { roomType } from "../../util/types/roomType";
import { dayType } from "../../util/types/dayType";
import { getRoomPhotos } from "../../util/roomFacts";
import { useTiBookTheme, useRoomChip } from "../../contexts/TiBookThemeContext";
import { AppearanceMenu } from "./NavBarDesktop";
import GuestCalendar, { MyStay } from "./Calendar/GuestCalendar";
import TodayButton from "./Calendar/TodayButton";

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
  onScrollToToday: () => void;
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
  scrollToMonthTrigger, onOpenPhotos, onScrollToToday, onMyBookings, onRequest, guestName,
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

  /*
   * A tap means two different things depending on which card it lands on, and
   * that is the ordinary behaviour of a deck: the first tap brings a card to
   * the front, a second tap on the card you are already looking at opens it.
   *
   * Before this, every tap only selected — so tapping the room you were already
   * on did nothing at all, and the photographs looked like buttons that were
   * broken. The stacked layout has always opened the gallery from the picture;
   * this is the same promise kept in a deck.
   */
  const tapCard = (id: string, room: roomType | null, photos: number) => {
    if (id !== activeId) { pick(id); return; }
    if (room && photos > 0) onOpenPhotos(room);
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

  /*
   * A room's list price is not a price anyone pays. What a guest pays is
   * agreed with the host, which is why the gallery says so and why the room
   * cards have never quoted r.price to a stranger.
   *
   * Hero was quoting it — myRates.get(id) ?? r.price — so a first-time guest
   * saw "$75 / night" for a number nobody had agreed with them. Only a rate
   * THIS guest already has is a price, and that one is worth showing: it is
   * the outcome of the conversation, and it is the one thing on this screen a
   * returning guest cannot get anywhere else.
   */
  const myRate = (r: roomType) => myRates?.get(r.id);

  return (
    <div className="flex min-h-0 flex-1 flex-col">

      {/* The header used to ride ON the photo, with a scrim across the top of
          the card, to buy the picture another 46px. It bought the wrong thing:
          a title, a subtitle and two controls sat over the part of a room
          photo you actually look at, and a scrim dark enough to keep them
          readable is a scrim dark enough to spoil the picture underneath.
          Its own row costs 46px of card and gives back a clean photograph. */}
      <div className={`flex shrink-0 items-center gap-2 px-3 py-2 ${theme.chrome}`}>
        {/* TiBook's own icon, not TiMag's logo: this is the guest's app, and
            the one place in Hero where it can say so — the stacked layout says
            it in a nav bar Hero does not have. */}
        <img
          src="/tibook-icon-192.png"
          alt="TiBook"
          className="h-7 w-7 shrink-0 rounded-lg"
        />
        <div className="min-w-0 flex-1">
          <div className={`truncate text-sm font-extrabold leading-tight ${theme.chromeText}`}>
            {host.airbnbName || host.name}
          </div>
          <div className={`truncate text-[11px] leading-tight ${theme.chromeMuted}`}>
            {activeRoom
              ? `${activeRooms.findIndex((r) => r.id === activeId) + 1} of ${activeRooms.length} · swipe`
              : "All rooms · swipe to pick one"}
          </div>
        </div>
        <button
          type="button"
          onClick={onMyBookings}
          className={`shrink-0 rounded-full border px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap ${theme.chromeBorder} ${theme.chromeHover} ${guestName?.trim() ? theme.chromeAccent : theme.chromeMuted}`}
        >
          {guestName?.trim().split(" ")[0] || "Your bookings"}
        </button>
        <AppearanceMenu />
      </div>

      {/* ── The rooms: half of what is under the header ──────────────────── */}
      <div className="relative min-h-0 flex-1">
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
                onClick={() => tapCard(id, room, count)}
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
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/85 via-black/45 to-transparent" />
                    {/* Only on the card in front: on the others the tap
                        selects, and offering "details" for something a tap
                        will not open is worse than offering nothing. */}
                    {on && count > 0 && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onOpenPhotos(room); }}
                        className="absolute bottom-3 right-3 flex items-center gap-1 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-semibold text-white"
                      >
                        {count > 1 ? `${count} photos` : "Details"} ›
                      </button>
                    )}
                    <div className="absolute inset-x-3 bottom-3 flex flex-col items-start gap-1.5">
                      <span className={`rounded-lg px-3 py-1 text-sm font-bold text-white ${roomChip(room)}`}>
                        {room.name}
                      </span>
                      <span className="flex items-baseline gap-1.5">
                        {/* A guest on a deliberate $0 rate is family. Saying
                            "$0" reads as a bug, so it says what it means. */}
                        {myRate(room) === 0 ? (
                          <span className={`text-lg font-bold ${theme.textPrimary}`}>Family — no charge</span>
                        ) : myRate(room) != null ? (
                          <>
                            <span className={`text-2xl font-extrabold tracking-tight ${theme.textPrimary}`}>${myRate(room)}</span>
                            <span className="text-xs text-white/80">/ night · your rate</span>
                          </>
                        ) : (
                          /* Says what will happen rather than showing a number
                             that is not theirs. */
                          <span className="text-xs text-white/85">Your price is agreed with {hostFirstName}</span>
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
                      {/* Both facts in one sentence: the two lines each named
                          the host and read as a form letter. */}
                      <span className={`text-xs leading-snug ${theme.surfaceMuted}`}>
                        {hostFirstName} picks the room and agrees your price. Same
                        house, same bathrooms.
                      </span>
                    </div>
                  </>
                )}
              </div>
            );
          })}
          <div className="w-3 shrink-0" />
        </div>

      </div>

      {/* ── The month: the other half ────────────────────────────────────── */}
      <div className={`flex min-h-0 flex-1 flex-col border-t ${theme.line} ${theme.surface}`}>
        <div className="flex shrink-0 items-center gap-2 px-4 pb-1 pt-1.5">
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
          <span className={`min-w-0 flex-1 truncate text-[13px] ${theme.surfaceMuted}`}>
            · {activeRoom ? `${activeRoom.name} is free ${freeNights} night${freeNights === 1 ? "" : "s"}` : `${freeNights} night${freeNights === 1 ? "" : "s"} open`}
          </span>
          {/* The same way back to now the stacked layout has always had, and
              the same component, so it disables itself on the current month
              rather than pretending to be a button that does nothing. */}
          <TodayButton isCurrentMonth={isSameMonth(currentMonth, new Date())} onScrollToToday={onScrollToToday} />
        </div>

        {/* The weekday header. GuestCalendar draws only the grid — in the
            stacked layout these letters come from CalendarNavigator, which
            Hero does not use, so the month was running without them. */}
        <div className={`grid shrink-0 grid-cols-7 pb-1 text-center text-[11px] font-medium ${theme.surfaceMuted}`}>
          <span>S</span><span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span>
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

      {/* ── The bottom bar, so nothing important sits in a top corner ──────
          The action is a ROW ITEM, not an absolutely-centred one. Floated, it
          sat on top of Dates and You and ate both tap targets — and the label
          grows ("2 dates · ★ 1 wish list"), so no fixed width would have held.
          In the row it takes the space it needs and the other two keep theirs;
          the lift is cosmetic and cannot overlap anything. */}
      <div className={`flex h-[4.6rem] shrink-0 items-center gap-2 border-t px-3 ${theme.surfaceBorder} ${theme.chrome}`}>
        <button type="button" onClick={onScrollToToday} className={`flex w-14 shrink-0 flex-col items-center gap-1 ${theme.chromeAccent}`}>
          <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <rect x="3" y="5" width="18" height="16" rx="2" /><path strokeLinecap="round" d="M8 3v4M16 3v4M3 11h18" />
          </svg>
          <span className="text-[11px] font-bold">Dates</span>
        </button>

        <button
          type="button"
          onClick={onRequest}
          /* Centre of the bar, lifted clear of it: on a 6-inch phone this is
             the one spot a thumb reaches without regripping. */
          className={`flex h-[3.25rem] min-w-0 flex-1 -translate-y-2 items-center justify-center gap-1.5 rounded-full px-3 text-sm font-bold text-white ${theme.btn} ${theme.btnHover} ${theme.btnMotion} ${theme.glow} shadow-lg`}
        >
          <span className="min-w-0 truncate">{hasSelection ? actionLabel : "Request a Booking"}</span>
          <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2.6} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14m-6-6 6 6-6 6" />
          </svg>
        </button>

        <button type="button" onClick={onMyBookings} className={`flex w-14 shrink-0 flex-col items-center gap-1 ${theme.chromeMuted}`}>
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
