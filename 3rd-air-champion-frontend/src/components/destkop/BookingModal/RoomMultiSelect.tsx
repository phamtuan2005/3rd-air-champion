import { useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { roomType } from "../../../util/types/roomType";
import { ANY_ROOM_SENTINEL } from "./zodBookDays";
import RoomBadge from "../../shared/RoomBadge";

interface RoomMultiSelectProps {
  rooms: roomType[];
  value: string[];
  onChange: (rooms: string[]) => void;
  showAny?: boolean;
  showAll?: boolean;
  // Rooms already taken for the row's chosen nights — muted and unselectable.
  unavailableRoomIds?: Set<string>;
}

const RoomMultiSelect = ({ rooms, value, onChange, showAny = true, showAll = false, unavailableRoomIds }: RoomMultiSelectProps) => {
  const [open, setOpen] = useState(false);
  const activeRooms = useMemo(() => rooms.filter((r) => r.active), [rooms]);

  const isAny = value.includes(ANY_ROOM_SENTINEL);
  const isAll = showAll && activeRooms.length > 0 && activeRooms.every((r) => value.includes(r.id));

  const handleToggleAll = () => {
    if (isAll) {
      onChange([]);
    } else {
      onChange(activeRooms.map((r) => r.id));
    }
  };

  const triggerContent = useMemo(() => {
    if (isAny) return <span className="italic text-gray-500">Any available</span>;
    if (isAll) return <span className="italic text-gray-500">All rooms</span>;
    if (value.length === 0) return <span className="text-gray-400">Select rooms…</span>;
    const selected = value
      .map((id) => activeRooms.find((r) => r.id === id))
      .filter(Boolean) as typeof activeRooms;
    return (
      <span className="flex items-center gap-1 flex-wrap">
        {selected.map((room) => (
          <RoomBadge key={room.id} room={room} rooms={activeRooms} />
        ))}
      </span>
    );
  }, [isAny, value, activeRooms]);

  const handleToggleAny = () => {
    if (isAny) {
      onChange([]);
    } else {
      onChange([ANY_ROOM_SENTINEL]);
    }
  };

  const handleToggleRoom = (id: string) => {
    const withoutAny = value.filter((v) => v !== ANY_ROOM_SENTINEL);
    if (withoutAny.includes(id)) {
      onChange(withoutAny.filter((v) => v !== id));
    } else {
      onChange([...withoutAny, id]);
    }
  };

  const modal = open
    ? createPortal(
        <div
          className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-[300]"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-white rounded-lg shadow-xl w-80 flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-700">
                Select Rooms
                {unavailableRoomIds && (
                  <span className="ml-2 text-[11px] font-medium text-green-600">
                    {activeRooms.filter((r) => !unavailableRoomIds.has(r.id)).length} available
                  </span>
                )}
              </h3>
              <button
                type="button"
                className="text-gray-400 hover:text-gray-600 text-xl leading-none px-1"
                onClick={() => setOpen(false)}
              >
                &times;
              </button>
            </div>

            {/* Room list — no height cap, shows all rooms */}
            <ul className="flex flex-col py-1">
              {showAny && (
                <>
                  <li
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 cursor-pointer text-sm"
                    onClick={handleToggleAny}
                  >
                    <input type="checkbox" readOnly checked={isAny} className="pointer-events-none w-4 h-4" />
                    <span className="italic text-gray-500">Any available</span>
                  </li>
                  <li className="border-t border-gray-100 mx-4" />
                </>
              )}
              {showAll && (
                <>
                  <li
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 cursor-pointer text-sm"
                    onClick={handleToggleAll}
                  >
                    <input type="checkbox" readOnly checked={isAll} className="pointer-events-none w-4 h-4" />
                    <span className="italic text-gray-500">All rooms</span>
                  </li>
                  <li className="border-t border-gray-100 mx-4" />
                </>
              )}

              {activeRooms.map((room) => {
                const checked = !isAny && value.includes(room.id);
                // A selected room that turned unavailable (date changed after picking)
                // stays clickable so it can be deselected.
                const unavailable = (unavailableRoomIds?.has(room.id) ?? false) && !checked;
                return (
                  <li
                    key={room.id}
                    className={`flex items-center gap-3 px-4 py-2.5 text-sm ${
                      unavailable ? "opacity-45 cursor-not-allowed" : "hover:bg-gray-50 cursor-pointer"
                    }`}
                    onClick={() => { if (!unavailable) handleToggleRoom(room.id); }}
                  >
                    <input
                      type="checkbox"
                      readOnly
                      checked={checked}
                      disabled={unavailable}
                      className="pointer-events-none w-4 h-4"
                    />
                    <span className={unavailable ? "line-through" : ""}>
                      <RoomBadge room={room} rooms={activeRooms} />
                    </span>
                    {unavailable && (
                      <span className="ml-auto text-[10px] text-gray-400 font-medium">booked</span>
                    )}
                  </li>
                );
              })}
            </ul>

            {/* Footer */}
            <div className="px-4 py-3 border-t border-gray-100 flex justify-end">
              <button
                type="button"
                className="bg-blue-500 text-white text-sm px-4 py-1.5 rounded hover:bg-blue-600"
                onClick={() => setOpen(false)}
              >
                Done
              </button>
            </div>
          </div>
        </div>,
        document.body
      )
    : null;

  return (
    <>
      <button
        type="button"
        className="border border-gray-300 rounded px-2 py-1 w-full text-left text-sm flex justify-between items-center gap-1"
        onClick={() => setOpen(true)}
      >
        <span className="flex-1 min-w-0">{triggerContent}</span>
        <span className="text-gray-400 text-xs flex-shrink-0">▾</span>
      </button>

      {modal}
    </>
  );
};

export default RoomMultiSelect;