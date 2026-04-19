import { useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { roomType } from "../../../util/types/roomType";
import { ANY_ROOM_SENTINEL } from "../../../util/zodBookDays";
import { getRoomColor } from "../../../util/getRoomColor";

interface RoomMultiSelectProps {
  rooms: roomType[];
  unavailableRoomIds?: Set<string>;
  value: string[];
  onChange: (rooms: string[]) => void;
}

const RoomMultiSelect = ({ rooms, unavailableRoomIds, value, onChange }: RoomMultiSelectProps) => {
  const [open, setOpen] = useState(false);
  const activeRooms = useMemo(() => rooms.filter((r) => r.active), [rooms]);
  const roomBoxWidth = useMemo(() => {
    const maxLen = activeRooms.reduce((max, r) => Math.max(max, r.name.length), 0);
    return `${maxLen * 6.5 + 16}px`;
  }, [activeRooms]);

  const isAny = value.includes(ANY_ROOM_SENTINEL);

  const triggerContent = useMemo(() => {
    if (isAny) return <span className="italic text-gray-500">Any available</span>;
    if (value.length === 0) return <span className="text-gray-400">Select rooms…</span>;
    const selected = value
      .map((id) => activeRooms.find((r) => r.id === id))
      .filter(Boolean) as typeof activeRooms;
    return (
      <span className="flex items-center gap-1 flex-wrap">
        {selected.map((room) => (
          <span
            key={room.id}
            className={`${getRoomColor(room.name, room.color)} text-white text-xs font-medium py-0.5 rounded inline-block text-center whitespace-nowrap`}
            style={{ width: roomBoxWidth }}
          >
            {room.name}
          </span>
        ))}
      </span>
    );
  }, [isAny, value, activeRooms, roomBoxWidth]);

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
              {/* Any available */}
              <li
                className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 cursor-pointer text-sm"
                onClick={handleToggleAny}
              >
                <input
                  type="checkbox"
                  readOnly
                  checked={isAny}
                  className="pointer-events-none w-4 h-4"
                />
                <span className="italic text-gray-500">Any available</span>
              </li>

              <li className="border-t border-gray-100 mx-4" />

              {activeRooms.map((room) => {
                const isUnavailable = unavailableRoomIds?.has(room.id) ?? false;
                const checked = !isAny && value.includes(room.id);
                return (
                  <li
                    key={room.id}
                    className={`flex items-center gap-3 px-4 py-2.5 text-sm ${isUnavailable ? "opacity-50 cursor-not-allowed" : "hover:bg-gray-50 cursor-pointer"}`}
                    onClick={() => !isUnavailable && handleToggleRoom(room.id)}
                  >
                    <input
                      type="checkbox"
                      readOnly
                      checked={checked}
                      disabled={isUnavailable}
                      className="pointer-events-none w-4 h-4"
                    />
                    <span
                      className={`${getRoomColor(room.name, room.color)} text-white text-xs font-medium py-0.5 rounded inline-block text-center whitespace-nowrap`}
                      style={{ width: roomBoxWidth }}
                    >
                      {room.name}
                    </span>
                    {isUnavailable && (
                      <span className="text-xs text-gray-400 italic">(blocked)</span>
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