import { useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { FaUser } from "react-icons/fa";
import { format, startOfToday } from "date-fns";
import { roomType } from "../../../../util/types/roomType";
import { guestType } from "../../../../util/types/guestType";
import { dayType } from "../../../../util/types/dayType";
import RoomBadge from "../../../shared/RoomBadge";
import { airbnbGuestList } from "../../../../util/airbnbGuestList";

interface CalendarFilterPickerProps {
  rooms: roomType[];
  roomValue: string | null;
  onRoomChange: (roomName: string | null) => void;
  guests: guestType[];
  monthMap: Map<string, dayType>;
  guestValue: string | null;
  // null = everyone: the host clears an AirBnB filter with it too.
  onGuestChange: (guestId: string | null) => void;
  // The AirBnB guest filtered on, by the name AirBnB gave them (the alias).
  airbnbValue: string | null;
  onAirBnBChange: (alias: string) => void;
}

// With no search typed, the AirBnB section lists only who is here or coming.
// The calendar holds several hundred AirBnB names going back years; the rest
// are a search away.
const AIRBNB_SEARCH_LIMIT = 40;

// The one control that decides WHO and WHAT the calendar shows.
//
// Room and guest began as two separate triggers side by side, which put two
// dropdowns in a header already carrying the month, the view lens and the page
// size. They answer the same question — narrow this calendar down — so they are
// one list with sections rather than controls competing for the same corner.
//
// Room stays INDEPENDENT of who: filtering to King and to Eddie at once is a
// reasonable thing to want, and each has its own way back to everything.
//
// A third section, AirBnB guests, came later (2026-10-02). The list had rooms
// and the house's own guests only, because every AirBnB stay hangs off one
// placeholder guest record and so there was nobody to list — but half the
// house's guests arrive through AirBnB, and the only way to filter one was to
// find their booking card first. They are listed by the name AirBnB gives
// them; see util/airbnbGuestList. A house guest and an AirBnB guest are one
// choice, not two: picking either clears the other.
const CalendarFilterPicker = ({
  rooms,
  roomValue,
  onRoomChange,
  guests,
  monthMap,
  guestValue,
  onGuestChange,
  airbnbValue,
  onAirBnBChange,
}: CalendarFilterPickerProps) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const activeRooms = useMemo(() => rooms.filter((r) => r.active), [rooms]);
  const selectedRoom = activeRooms.find((r) => r.name === roomValue) ?? null;
  const selectedGuest = guests.find((g) => g.id === guestValue) ?? null;
  const airbnbRows = useMemo(
    () => airbnbGuestList(monthMap, format(startOfToday(), "yyyy-MM-dd")),
    [monthMap],
  );

  // Each guest's next night from today, and the most recent one before it.
  // Ordering on this is what makes eighty names usable: the guest a host is
  // looking for is nearly always one who is here soon.
  const ordered = useMemo(() => {
    const todayKey = format(startOfToday(), "yyyy-MM-dd");
    const next = new Map<string, string>();
    const last = new Map<string, string>();
    monthMap.forEach((day, dateKey) => {
      day.bookings.forEach((b) => {
        const id = b.guest?.id;
        if (!id || !b.room) return;
        if (dateKey >= todayKey) {
          const seen = next.get(id);
          if (!seen || dateKey < seen) next.set(id, dateKey);
        } else {
          const seen = last.get(id);
          if (!seen || dateKey > seen) last.set(id, dateKey);
        }
      });
    });
    // AirBnB is one shared placeholder record, not a person — it has its own
    // filter and does not belong in a list of guests.
    return guests
      .filter((g) => g.name !== "AirBnB")
      .map((g) => ({ g, next: next.get(g.id), last: last.get(g.id) }))
      .sort((a, b) => {
        if (a.next && b.next) return a.next < b.next ? -1 : 1;
        if (a.next) return -1;
        if (b.next) return 1;
        if (a.last && b.last) return a.last > b.last ? -1 : 1;
        if (a.last) return -1;
        if (b.last) return 1;
        return a.g.name.localeCompare(b.g.name);
      });
  }, [guests, monthMap]);

  const q = query.trim().toLowerCase();
  const shownGuests = q
    ? ordered.filter(({ g }) => (g.alias || g.name).toLowerCase().includes(q))
    : ordered;
  const shownRooms = q
    ? activeRooms.filter((r) => r.name.toLowerCase().includes(q))
    : activeRooms;
  // Typed: every AirBnB guest the calendar has ever held, best first, capped.
  // Not typed: who is here tonight or still to come.
  const airbnbMatches = q
    ? airbnbRows.filter((r) => r.alias.toLowerCase().includes(q))
    : airbnbRows.filter((r) => r.next);
  const shownAirbnb = q ? airbnbMatches.slice(0, AIRBNB_SEARCH_LIMIT) : airbnbMatches;
  // Which list of names is showing. Opens on AirBnB when an AirBnB guest is
  // the one filtered, so the radio that is on is on screen; otherwise it stays
  // where the host last left it.
  const [who, setWho] = useState<"house" | "airbnb">(airbnbValue ? "airbnb" : "house");

  const close = () => {
    setOpen(false);
    setQuery("");
  };

  // The trigger says what is ON. A guest narrows the calendar further than a
  // room does, so it leads when both are set.
  // Sized for a SCREENSHOT, not just for this screen. Anh-Tuan photographs the
  // filtered calendar and sends it to the guest, who looks first for their own
  // name — at 12px it arrived as small grey text above a wall of bars. A picked
  // guest is the largest thing in this control.
  // An AirBnB guest reads the same way as a house guest, with "(A)" after the
  // name — the mark the header has always used for an AirBnB filter.
  const filteredName = selectedGuest ? selectedGuest.alias || selectedGuest.name : airbnbValue;
  const triggerContent = filteredName ? (
    // Guest and room STACK when both are on. Side by side they shared one line's
    // width, so each had to shrink to fit the other — and the name is the half
    // that must not. On two lines each gets its own full width at full size.
    <span className="flex min-w-0 flex-col items-start gap-0.5 leading-tight">
      <span className="flex w-full min-w-0 items-center gap-2 text-2xl font-bold text-emerald-700">
        <FaUser size={17} className="shrink-0" />
        <span className="truncate">{filteredName}</span>
        {!selectedGuest && <span className="shrink-0 text-base font-semibold text-gray-400">(A)</span>}
      </span>
      {selectedRoom && (
        <span className="text-lg">
          <RoomBadge room={selectedRoom} rooms={activeRooms} />
        </span>
      )}
    </span>
  ) : selectedRoom ? (
    <span className="text-lg">
      <RoomBadge room={selectedRoom} rooms={activeRooms} />
    </span>
  ) : (
    // "Filter" on the trigger names the control; the rows inside name what
    // choosing them does.
    <span className="italic text-gray-500 text-sm">Filter</span>
  );

  const modal = open
    ? createPortal(
        <div
          // Anchored to the TOP, not centred.
          //
          // The panel's height changes as the list filters, and centred that
          // moved the TOP edge down to keep the middle still — carrying the
          // search box and the first rows down behind a phone's keyboard, which
          // is open the moment this appears because the box autofocuses.
          // Pinned at the top, the height only ever changes at the bottom.
          //
          // dvh, never vh: on a phone vh is the tallest the viewport can be, so
          // the panel would be sized for a window the browser toolbar is
          // covering ([[project-mobile-dvh-calendar]]).
          className="modal-type fixed inset-0 z-[300] flex items-start justify-center bg-black bg-opacity-40 pt-[8dvh]"
          onClick={close}
        >
          <div
            className="flex max-h-[78dvh] w-80 flex-col rounded-lg bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-700">Filter the calendar</h3>
              <button
                type="button"
                className="text-gray-400 hover:text-gray-600 text-xl leading-none px-1"
                onClick={close}
              >
                &times;
              </button>
            </div>

            {/* One box over both sections — a host typing "King" wants the room
                and one typing "Eddie" wants the guest, and which of the two it
                is does not need asking. */}
            <div className="px-4 pt-3">
              <input
                autoFocus
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Room or guest…"
                className="w-full rounded border border-gray-300 px-2.5 py-1.5 text-sm focus:border-gray-400 focus:outline-none"
              />
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto py-1">
              {shownRooms.length > 0 && (
                <>
                  <p className="px-4 pb-1 pt-2 text-[11px] font-bold uppercase tracking-wide text-gray-400">
                    Room
                  </p>
                  {!q && (
                    <li
                      className="flex list-none items-center gap-3 px-4 py-2.5 text-sm hover:bg-gray-50 cursor-pointer"
                      onClick={() => {
                        onRoomChange(null);
                        close();
                      }}
                    >
                      <input
                        type="radio"
                        readOnly
                        checked={roomValue === null}
                        className="pointer-events-none h-4 w-4"
                      />
                      <span className="italic text-gray-500">All rooms</span>
                    </li>
                  )}
                  {shownRooms.map((room) => (
                    <li
                      key={room.id}
                      className="flex list-none items-center gap-3 px-4 py-2.5 text-sm hover:bg-gray-50 cursor-pointer"
                      onClick={() => {
                        onRoomChange(room.name);
                        close();
                      }}
                    >
                      <input
                        type="radio"
                        readOnly
                        checked={roomValue === room.name}
                        className="pointer-events-none h-4 w-4"
                      />
                      <RoomBadge room={room} rooms={activeRooms} />
                    </li>
                  ))}
                </>
              )}

              {/* Who: the house's own guests, or AirBnB's — a switch, so either
                  list starts at the top. One under the other was tried first
                  and measured against the live calendar: 45 house guests above
                  38 AirBnB arrivals put half the house's guests a long scroll
                  down. Searching looks through both and needs no switch. */}
              {!q && (
                <>
                  <div className="border-t border-gray-100 px-4 pb-1 pt-3">
                    <div className="flex gap-1 rounded-xl bg-gray-100 p-1">
                      {(["house", "airbnb"] as const).map((k) => (
                        <button
                          key={k}
                          type="button"
                          onClick={() => setWho(k)}
                          aria-pressed={who === k}
                          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-semibold transition-colors ${
                            who === k ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
                          }`}
                        >
                          {k === "house" ? "House guests" : "AirBnB"}
                          <span className="text-[11px] font-bold text-gray-400">
                            {k === "house" ? ordered.length : airbnbMatches.length}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <li
                    className="flex list-none items-center gap-3 px-4 py-2.5 text-sm hover:bg-gray-50 cursor-pointer"
                    onClick={() => {
                      onGuestChange(null);
                      close();
                    }}
                  >
                    {/* Everyone means nobody is filtered: no house guest and
                        no AirBnB guest. */}
                    <input
                      type="radio"
                      readOnly
                      checked={guestValue === null && airbnbValue === null}
                      className="pointer-events-none h-4 w-4"
                    />
                    <span className="italic text-gray-500">Everyone</span>
                  </li>
                </>
              )}

              {(q || who === "house") && shownGuests.length > 0 && (
                <>
                  {q && (
                    <p className="border-t border-gray-100 px-4 pb-1 pt-3 text-[11px] font-bold uppercase tracking-wide text-gray-400">
                      Guest
                    </p>
                  )}
                  {shownGuests.map(({ g, next, last }) => (
                    <li
                      key={g.id}
                      className="flex list-none items-center gap-3 px-4 py-2 text-sm hover:bg-gray-50 cursor-pointer"
                      onClick={() => {
                        onGuestChange(g.id);
                        close();
                      }}
                    >
                      <input
                        type="radio"
                        readOnly
                        checked={guestValue === g.id}
                        className="pointer-events-none h-4 w-4 shrink-0"
                      />
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-gray-800">
                          {g.alias || g.name}
                        </span>
                        {/* When they are next in, which is how a host recognises
                            somebody far faster than by surname. */}
                        <span className="block text-[11px] text-gray-400">
                          {next
                            ? `Next stay ${format(new Date(next + "T00:00:00"), "EEE MMM d")}`
                            : last
                              ? `Last stayed ${format(new Date(last + "T00:00:00"), "MMM d, yyyy")}`
                              : "No stays on the calendar"}
                        </span>
                      </span>
                    </li>
                  ))}
                </>
              )}

              {!q && who === "airbnb" && shownAirbnb.length === 0 && (
                <p className="px-4 py-3 text-sm text-gray-400">
                  No AirBnB guest is here or arriving. Type a name to find an earlier one.
                </p>
              )}

              {(q || who === "airbnb") && shownAirbnb.length > 0 && (
                <>
                  {q && (
                    <p className="border-t border-gray-100 px-4 pb-1 pt-3 text-[11px] font-bold uppercase tracking-wide text-gray-400">
                      AirBnB guest
                    </p>
                  )}
                  {shownAirbnb.map((r) => (
                    <li
                      key={r.alias}
                      className="flex list-none items-center gap-3 px-4 py-2 text-sm hover:bg-gray-50 cursor-pointer"
                      onClick={() => {
                        onAirBnBChange(r.alias);
                        close();
                      }}
                    >
                      <input
                        type="radio"
                        readOnly
                        checked={airbnbValue === r.alias}
                        className="pointer-events-none h-4 w-4 shrink-0"
                      />
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-gray-800">{r.alias}</span>
                        {/* When, and which room: an AirBnB name is a first
                            name, and the room is what tells two Dannys apart. */}
                        <span className="block text-[11px] text-gray-400">
                          {r.inHouse
                            ? "Here now"
                            : r.next
                              ? `Arrives ${format(new Date(r.next + "T00:00:00"), "EEE MMM d")}`
                              : `Last stayed ${format(new Date((r.last ?? "") + "T00:00:00"), "MMM d, yyyy")}`}
                          {r.room ? ` · ${r.room}` : ""}
                          {r.stays > 1 ? ` · ${r.stays} stays` : ""}
                        </span>
                      </span>
                    </li>
                  ))}
                  {/* Says where the rest are, rather than letting a short list
                      read as "these are all of them". */}
                  {(!q || airbnbMatches.length > shownAirbnb.length) && (
                    <p className="px-4 pb-2 pt-1 text-[11px] text-gray-400">
                      {q
                        ? `Showing ${shownAirbnb.length} of ${airbnbMatches.length}. Type more of the name to narrow it.`
                        : "Here now or arriving. Type a name to find an earlier AirBnB guest."}
                    </p>
                  )}
                </>
              )}

              {shownRooms.length === 0 && shownGuests.length === 0 && shownAirbnb.length === 0 && (
                <p className="px-4 py-6 text-center text-sm text-gray-400">
                  Nothing matches “{query}”.
                </p>
              )}
            </div>
          </div>
        </div>,
        document.body,
      )
    : null;

  return (
    <>
      {/* Hugs its content rather than filling its container — the old fixed
          width left "Filter" floating in a box four times its length. Capped so
          a long name cannot push the month off the header instead; past the cap
          the name truncates. */}
      <button
        type="button"
        className="inline-flex max-w-[17rem] items-center gap-1.5 rounded border border-gray-300 px-2.5 py-1 text-left"
        onClick={() => setOpen(true)}
      >
        <span className="min-w-0">{triggerContent}</span>
        <span className="flex-shrink-0 text-xs text-gray-400">▾</span>
      </button>

      {modal}
    </>
  );
};

export default CalendarFilterPicker;
