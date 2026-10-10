import CalendarModePicker from "./CalendarModePicker";
import WeeksPerPagePicker from "./WeeksPerPagePicker";
import { addDays, compareAsc, isSameDay, isSameMonth } from "date-fns";
import { useContext } from "react";
import { dayType } from "../../../../util/types/dayType";
import { roomType } from "../../../../util/types/roomType";
import { toZonedTime } from "date-fns-tz/toZonedTime";
import { AddPaneContext } from "../../../../context";
import CalendarFilterPicker from "./CalendarFilterPicker";
import RoomBadge from "../../../shared/RoomBadge";
import { guestType } from "../../../../util/types/guestType";
import type { SearchWorker } from "../../../../util/searchWorkers";

interface CalendarNavigatorProps {
  currentMonth: Date;
  currentAirBnBGuest: string | null;
  currentGuest: string | null;
  // The guest list and the filtered id, for the header's own guest picker —
  // `currentGuest` above is the NAME, which is what the header displays.
  guests: guestType[];
  currentGuestId: string | null;
  onGuestFilter: (guestId: string | null) => void;
  // Filtering to an AirBnB guest by the name AirBnB gave them.
  onAirBnBGuestFilter: (alias: string) => void;
  // The house's staff and cleaners, for the search, and where picking one goes.
  workers: SearchWorker[];
  onWorkerPick: (worker: SearchWorker) => void;
  // Who is signed in, for TT's greeting.
  hostName?: string;
  // The rest of what TT understands: a day to go to, a screen to open, and a
  // question for the assistant. Passed straight through to the box.
  onDateJump: (dateKey: string) => void;
  onMonthJump: (dateKey: string) => void;
  onWeek: (offset: 0 | 1, cleanerId?: string) => void;
  onScreen: (key: string) => void;
  onAsk: (question: string) => void;
  monthMap: Map<string, dayType>;
  occupancy: {
    totalOccupancy: number;
    airbnbOccupancy: number;
    roomOccupancy: {
      name: string;
      occupancy: number;
    }[];
  };
  paidDates: Date[];
  profit: {
    total: number;
    airbnb: number;
  };
  rooms: roomType[];
  selectedRoomName: string | null;
  getCurrentGuestBill: (guest: string) => number;
  onGoToToday: () => void;
  todayInView?: boolean;
  setPaidDates: React.Dispatch<React.SetStateAction<Date[]>>;
  setSelectedRoomName: React.Dispatch<React.SetStateAction<string | null>>;
  gapsMode: boolean;
  reservedMode: boolean;
  setReservedMode: React.Dispatch<React.SetStateAction<boolean>>;
  setGapsMode: React.Dispatch<React.SetStateAction<boolean>>;
  // Clean mode: bars keep their geometry but name the cleaner, not the guest
  cleanMode: boolean;
  setCleanMode: React.Dispatch<React.SetStateAction<boolean>>;
}

const CalendarNavigator = ({
  currentMonth,
  currentAirBnBGuest,
  currentGuest,
  guests,
  currentGuestId,
  onGuestFilter,
  onAirBnBGuestFilter,
  workers,
  onWorkerPick,
  hostName,
  onDateJump,
  onMonthJump,
  onWeek,
  onScreen,
  onAsk,
  monthMap,
  occupancy,
  profit,
  paidDates,
  rooms,
  selectedRoomName,
  getCurrentGuestBill,
  onGoToToday,
  todayInView,
  setPaidDates,
  setSelectedRoomName,
  gapsMode,
  reservedMode,
  setReservedMode,
  setGapsMode,
  cleanMode,
  setCleanMode,
}: CalendarNavigatorProps) => {
  const { rowsPerPage, setRowsPerPage } = useContext(AddPaneContext) as {
    rowsPerPage: number;
    setRowsPerPage: React.Dispatch<React.SetStateAction<number>>;
  };

  // "Aug 2026", not "August 2026". The header also carries the room filter, the
  // view picker, Today and the weeks control; September through December cost
  // enough width to squeeze them on a phone, and nobody reads the month name to
  // find out which month it is — they already know.
  const formattedDate = currentMonth.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
  });
  // Disable only when today is actually on screen. A month can span several pages, so
  // being in the current month no longer means today is visible — fall back to month
  // match only if the grid hasn't reported visibility yet.
  const isCurrentMonth = isSameMonth(currentMonth, new Date());
  const disableToday = todayInView ?? isCurrentMonth;
  const todayButton = (
    <button
      onClick={onGoToToday}
      disabled={disableToday}
      className={`text-xs px-2 py-0.5 rounded border transition-colors ${
        disableToday
          ? "text-gray-300 border-gray-200 cursor-default"
          : "text-blue-500 border-blue-300 hover:bg-blue-50 cursor-pointer"
      }`}
    >
      Today
    </button>
  );

  // Both totals are DERIVED, not stored.
  //
  // They used to live in state, written by an effect that read monthMap while
  // depending on [guest, currentMonth] only. So the figure changed when the
  // host switched guest or month, and not when the days themselves changed —
  // and every write that goes through onDaysUpdate changes the days without
  // touching either. Confirming a held stay repainted the header from a stale
  // closure, which made a guest's loyalty discount look like it had been lost
  // at the moment she paid.
  //
  // Derived during render, there is no dependency array to get wrong and no
  // window where the number disagrees with the calendar under it. Both are a
  // single pass over one month of days, which is cheaper than the re-render
  // the effect caused.
  const guestBill = currentGuest ? getCurrentGuestBill(currentGuest) : null;

  // Every AirBnB stay hangs off one shared "AirBnB" guest, so filtering to it
  // shows all of them — what the strip's Airbnb tap does (host, 2026-10-10).
  // That filter keeps the strip, so All is there to tap back.
  const airbnbGuestId = guests.find((g) => g.name === "AirBnB")?.id ?? null;
  const airbnbOn = !!airbnbGuestId && currentGuestId === airbnbGuestId;
  const showStrip = (!currentGuest && !currentAirBnBGuest) || airbnbOn;

  const airBnBGuestBill = (() => {
    if (!currentAirBnBGuest) return null;
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    let total = 0;
    monthMap.forEach((dayEntry, dateStr) => {
      const localDate = toZonedTime(dateStr, timeZone);
      if (isSameMonth(localDate, currentMonth)) {
        dayEntry.bookings.forEach((booking) => {
          // Counted on the stay's START night only — an AirBnB payout is for
          // the whole stay though the booking sits on every night of it.
          if (booking.alias === currentAirBnBGuest && booking.startDate === dateStr) {
            total += booking.airbnbPrice ?? 0;
          }
        });
      }
    });
    return total;
  })();

  return (
    <div className="flex flex-col justify-between h-full max-h-[100px] bg-white drop-shadow-sm p-2 pb-1 sm:max-h-[140px] sm:pb-2">
      {/* Date */}
      {!currentGuest && !currentAirBnBGuest ? (
        <>
          <div className="flex h-full w-full items-center text-nowrap gap-2">
            {/* Room filter + view picker — the two controls that decide what the
                calendar shows, side by side rather than at opposite ends. */}
            <div className="flex shrink-0 items-center gap-1.5">
              {/* Room and guest in ONE list. They answer the same question —
                  narrow this calendar down — and two triggers side by side put
                  two dropdowns into a header already carrying the month, the
                  lens and the page size.
                  Clearing a room filter no longer hides the contact sheet: it
                  is on by default now, so hiding it here would take away
                  something the host never asked this control to touch. */}
              <CalendarFilterPicker
                rooms={rooms}
                roomValue={selectedRoomName}
                onRoomChange={setSelectedRoomName}
                guests={guests}
                monthMap={monthMap}
                guestValue={currentGuestId}
                onGuestChange={onGuestFilter}
                airbnbValue={currentAirBnBGuest}
                onAirBnBChange={onAirBnBGuestFilter}
                workers={workers}
                onWorkerPick={onWorkerPick}
                hostName={hostName}
                onDateJump={onDateJump}
                onMonthJump={onMonthJump}
                onWeek={onWeek}
                onScreen={onScreen}
                onAsk={onAsk}
              />
              {/* One view mode, not two independent flags. Gaps and Cleaners
                  each re-read the same calendar, so they were never meaningfully
                  combinable — a single picker says which lens is on. */}
              {/* Finding a guest is a decision about what the calendar shows,
                  same as the room and the lens — so it sits with them. */}
              <CalendarModePicker
                mode={
                  cleanMode ? "clean" : gapsMode ? "gaps" : reservedMode ? "reserved" : "book"
                }
                onChange={(v) => {
                  // Every lens is set on every change, so switching away from one
                  // cannot leave it quietly on underneath the new one.
                  setGapsMode(v === "gaps");
                  setCleanMode(v === "clean");
                  setReservedMode(v === "reserved");
                }}
              />
            </div>
            <div className="basis-1/2 flex justify-center items-center w-full gap-1 sm:gap-2">
              <span className="font-bold text-base sm:text-xl text-gray-800">
                {formattedDate}
              </span>
              {todayButton}
              {/* Weeks on screen. Lives here rather than in the menu because it
                  changes what you are looking at — you want to see the calendar
                  reflow as you pick. */}
              <WeeksPerPagePicker
                value={rowsPerPage}
                onChange={(v) => setRowsPerPage(v)}
              />
            </div>
            {/* Total profit moved to the stats line below, where it sits beside
                the AirBnB figures it should be read against. */}
            <div className="basis-1/4" />
          </div>
        </>
      ) : currentGuest ? (
        <>
          <div className="flex h-full w-full justify-between items-center">
            {/* The name is the control: switching guest or going back to
                everyone is a tap on the thing already saying who is filtered,
                rather than a trip back to a booking card to press Filter off. */}
            <div className="min-w-0">
              <CalendarFilterPicker
                rooms={rooms}
                roomValue={selectedRoomName}
                onRoomChange={setSelectedRoomName}
                guests={guests}
                monthMap={monthMap}
                guestValue={currentGuestId}
                onGuestChange={onGuestFilter}
                airbnbValue={currentAirBnBGuest}
                onAirBnBChange={onAirBnBGuestFilter}
                workers={workers}
                onWorkerPick={onWorkerPick}
                hostName={hostName}
                onDateJump={onDateJump}
                onMonthJump={onMonthJump}
                onWeek={onWeek}
                onScreen={onScreen}
                onAsk={onAsk}
              />
            </div>
            <div className="flex items-center gap-2">
              <div
                className="font-bold text-xl text-gray-800"
                onDoubleClick={() => {
                  const timeZone =
                    Intl.DateTimeFormat().resolvedOptions().timeZone;

                  const paidDatesSet = new Set<string>(
                    paidDates.map(
                      (paidDate) => paidDate.toISOString().split("T")[0],
                    ),
                  );

                  monthMap.forEach((day, dateKey) => {
                    const booking = day.bookings.find(
                      (booking) => booking.guest.id == currentGuest,
                    );

                    if (booking) {
                      const localDate = toZonedTime(dateKey, timeZone);
                      const localStartDate = toZonedTime(
                        booking.startDate,
                        timeZone,
                      );
                      if (
                        isSameDay(localDate, localStartDate) &&
                        isSameMonth(localStartDate, currentMonth)
                      ) {
                        for (let i = 0; i < booking.duration; i += 1) {
                          paidDatesSet.add(
                            toZonedTime(addDays(localStartDate, i), timeZone)
                              .toISOString()
                              .split("T")[0],
                          );
                        }
                      }
                    }
                  });

                  const updatedPaidDates = Array.from(paidDatesSet, (date) =>
                    toZonedTime(date, timeZone),
                  ).sort((a, b) => {
                    return compareAsc(a, b);
                  });

                  setPaidDates(updatedPaidDates);
                }}
              >
                {formattedDate}
              </div>
            </div>
            {/* PROFIT */}
            <div className="text-xl font-bold">${guestBill?.toFixed(2)}</div>
          </div>
        </>
      ) : (
        <>
          <div className="flex h-full w-full items-center">
            {/* The name is the control here too. This was plain text, "Kyle
                (A)", with no way to switch guest or go back to everyone short
                of finding the booking card that set the filter and pressing
                it off. The same picker as the house-guest header above. */}
            <div className="min-w-0">
              <CalendarFilterPicker
                rooms={rooms}
                roomValue={selectedRoomName}
                onRoomChange={setSelectedRoomName}
                guests={guests}
                monthMap={monthMap}
                guestValue={currentGuestId}
                onGuestChange={onGuestFilter}
                airbnbValue={currentAirBnBGuest}
                onAirBnBChange={onAirBnBGuestFilter}
                workers={workers}
                onWorkerPick={onWorkerPick}
                hostName={hostName}
                onDateJump={onDateJump}
                onMonthJump={onMonthJump}
                onWeek={onWeek}
                onScreen={onScreen}
                onAsk={onAsk}
              />
            </div>
            <div className="flex items-center gap-2 mx-auto">
              <span className="font-bold text-xl text-gray-800">{formattedDate}</span>
            </div>
            {/* PROFIT */}
            <div className="text-xl font-bold">${airBnBGuestBill?.toFixed(2)}</div>
          </div>
        </>
      )}

      <div className="flex h-full w-full">
        {showStrip && (
          // ONE strip, always shown: the house's totals, then each room,
          // fullest first. It used to be two views a tap apart — "79% Occ.
          // 26% (A)booking", or the rooms — and the host asked to lump them
          // together (2026-10-10). It takes what the profit leaves and SCROLLS
          // sideways (swipe on a phone) rather than push the profit, the figure
          // that matters, off the right. No scrollbar drawn; the cut-off item
          // says there is more. Everything as a badge and a percentage.
          <div className="flex h-full min-w-0 flex-1 items-center gap-3 overflow-x-auto overscroll-x-contain whitespace-nowrap text-[0.85rem] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {[
              // The house as a whole, in grey as on Guest reviews' House; AirBnB
              // in its coral, as on the booking card's tag.
              { key: "all", label: "All", badge: "bg-gray-700", pct: occupancy.totalOccupancy },
              { key: "airbnb", label: "Airbnb", badge: "bg-[#FF5A5F]", pct: occupancy.airbnbOccupancy },
              ...occupancy.roomOccupancy
                .filter((room) => room.name !== "Master") // Exclude "Master"
                // Fullest first: what shows without a swipe should be the rooms
                // doing best (host, 2026-10-10).
                .sort((a, b) => b.occupancy - a.occupancy)
                .map((room) => ({ key: room.name, label: room.name, badge: undefined as string | undefined, pct: room.occupancy })),
            ].map((item) => {
              // A room filters the calendar to itself, the same filter Ask TT
              // sets; Airbnb filters it to the AirBnB stays; a second tap, or
              // All, shows everything again (host, 2026-10-10). What is
              // filtered on wears a ring.
              const isRoom = item.key !== "all" && item.key !== "airbnb";
              const on = isRoom ? selectedRoomName === item.label : item.key === "airbnb" ? airbnbOn : !selectedRoomName && !airbnbOn;
              const pick =
                item.key === "airbnb"
                  ? airbnbGuestId
                    ? () => onGuestFilter(airbnbOn ? null : airbnbGuestId)
                    : undefined
                  : item.key === "all"
                    ? () => {
                        setSelectedRoomName(null);
                        if (airbnbOn) onGuestFilter(null);
                      }
                    : () => setSelectedRoomName(selectedRoomName !== item.label ? item.label : null);
              return (
                <button
                  key={item.key}
                  type="button"
                  disabled={!pick}
                  onClick={pick}
                  aria-pressed={pick ? on : undefined}
                  title={isRoom ? (on ? "Show every room" : `Show only ${item.label}`) : item.key === "all" ? "Show everything" : on ? "Show every guest" : "Show only AirBnB stays"}
                  className={`flex shrink-0 items-center gap-1 rounded-md px-1 py-0.5 disabled:cursor-default ${
                    // The one in force wears the ring — All too, when nothing is
                    // filtered (host, 2026-10-10).
                    on ? "ring-2 ring-gray-900" : ""
                  } ${pick ? "hover:bg-gray-100" : ""}`}
                >
                  <RoomBadge
                    room={{ name: item.label, color: rooms.find((r) => r.name === item.label)?.color }}
                    override={item.badge}
                    className="text-xs font-semibold"
                  />
                  <span
                    className={`font-semibold ${
                      item.pct < 33.33 ? "text-red-500" : item.pct < 66.67 ? "text-yellow-500" : "text-green-500"
                    }`}
                  >
                    {Math.round(item.pct)}%
                  </span>
                </button>
              );
            })}
          </div>
        )}
        {/* PROFIT — total and the AirBnB share as one group, so the smaller
            figure is read as a part of the larger rather than as a rival to it.
            Total keeps its 2xl size; leading-none stops it growing the row. */}
        {showStrip && (
          <div className="ml-3 flex shrink-0 items-baseline justify-end gap-1.5 font-bold text-nowrap">
            <span className="text-2xl leading-none text-emerald-600">
              ${Math.round(profit.total).toLocaleString()}
            </span>
            <span className="font-normal text-gray-300">·</span>
            <span>${Math.round(profit.airbnb).toLocaleString()} (A)</span>
          </div>
        )}
      </div>

      {/* Bottom Section: Days of the Week */}
      <div className="grid grid-cols-7 text-center">
        {[
          "Sunday",
          "Monday",
          "Tuesday",
          "Wednesday",
          "Thursday",
          "Friday",
          "Saturday",
        ].map((day, index) => (
          // no-underline is doing real work: every browser draws abbr[title]
          // with a dotted underline, which showed up under each day as a broken
          // line nobody chose. The title is kept — hovering still spells out
          // "Wednesday" — but the decoration goes.
          //
          // Uppercase, tracked and muted so the row reads as a column heading
          // rather than as content competing with the bookings below it.
          <abbr
            key={index}
            title={day}
            className="text-xs font-bold uppercase tracking-wider text-gray-500 no-underline sm:text-sm"
          >
            {day.substring(0, 3)}
          </abbr>
        ))}
      </div>
    </div>
  );
};

export default CalendarNavigator;
