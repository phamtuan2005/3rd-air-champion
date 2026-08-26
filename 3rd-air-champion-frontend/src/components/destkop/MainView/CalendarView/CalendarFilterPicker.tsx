import { useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { FaUser } from "react-icons/fa";
import { format, startOfToday } from "date-fns";
import { roomType } from "../../../../util/types/roomType";
import { guestType } from "../../../../util/types/guestType";
import { dayType } from "../../../../util/types/dayType";
import RoomBadge from "../../../shared/RoomBadge";

interface CalendarFilterPickerProps {
  rooms: roomType[];
  roomValue: string | null;
  onRoomChange: (roomName: string | null) => void;
  guests: guestType[];
  monthMap: Map<string, dayType>;
  guestValue: string | null;
  onGuestChange: (guestId: string | null) => void;
}

// The one control that decides WHO and WHAT the calendar shows.
//
// Room and guest began as two separate triggers side by side, which put two
// dropdowns in a header already carrying the month, the view lens and the page
// size. They answer the same question — narrow this calendar down — so they are
// one list with two sections rather than two controls competing for the same
// corner.
//
// They stay INDEPENDENT underneath: filtering to King and to Eddie at once is a
// reasonable thing to want, and each section has its own way back to everything.
const CalendarFilterPicker = ({
  rooms,
  roomValue,
  onRoomChange,
  guests,
  monthMap,
  guestValue,
  onGuestChange,
}: CalendarFilterPickerProps) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const activeRooms = useMemo(() => rooms.filter((r) => r.active), [rooms]);
  const selectedRoom = activeRooms.find((r) => r.name === roomValue) ?? null;
  const selectedGuest = guests.find((g) => g.id === guestValue) ?? null;

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

  const close = () => {
    setOpen(false);
    setQuery("");
  };

  // The trigger says what is ON. A guest narrows the calendar further than a
  // room does, so it leads when both are set.
  const triggerContent = selectedGuest ? (
    <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
      <FaUser size={10} className="shrink-0" />
      <span className="truncate">{selectedGuest.alias || selectedGuest.name}</span>
      {selectedRoom && <RoomBadge room={selectedRoom} rooms={activeRooms} />}
    </span>
  ) : selectedRoom ? (
    <RoomBadge room={selectedRoom} rooms={activeRooms} />
  ) : (
    // "Filter" on the trigger names the control; the rows inside name what
    // choosing them does.
    <span className="italic text-gray-500 text-xs">Filter</span>
  );

  const modal = open
    ? createPortal(
        <div
          className="modal-type fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-[300]"
          onClick={close}
        >
          <div
            className="bg-white rounded-lg shadow-xl w-80 max-h-[80vh] flex flex-col"
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

              {shownGuests.length > 0 && (
                <>
                  <p className="border-t border-gray-100 px-4 pb-1 pt-3 text-[11px] font-bold uppercase tracking-wide text-gray-400">
                    Guest
                  </p>
                  {!q && (
                    <li
                      className="flex list-none items-center gap-3 px-4 py-2.5 text-sm hover:bg-gray-50 cursor-pointer"
                      onClick={() => {
                        onGuestChange(null);
                        close();
                      }}
                    >
                      <input
                        type="radio"
                        readOnly
                        checked={guestValue === null}
                        className="pointer-events-none h-4 w-4"
                      />
                      <span className="italic text-gray-500">Everyone</span>
                    </li>
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

              {shownRooms.length === 0 && shownGuests.length === 0 && (
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
      <button
        type="button"
        className="flex w-full items-center justify-between gap-1 rounded border border-gray-300 px-2 py-1 text-left text-sm"
        onClick={() => setOpen(true)}
      >
        <span className="min-w-0 flex-1">{triggerContent}</span>
        <span className="flex-shrink-0 text-xs text-gray-400">▾</span>
      </button>

      {modal}
    </>
  );
};

export default CalendarFilterPicker;
