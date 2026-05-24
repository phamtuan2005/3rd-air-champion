import { useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { roomType } from "../../../../util/types/roomType";
import RoomBadge from "../../../shared/RoomBadge";

interface RoomSingleSelectProps {
  rooms: roomType[];
  value: string | null;
  onChange: (roomName: string | null) => void;
}

const RoomSingleSelect = ({ rooms, value, onChange }: RoomSingleSelectProps) => {
  const [open, setOpen] = useState(false);
  const activeRooms = useMemo(() => rooms.filter((r) => r.active), [rooms]);

  const selectedRoom = activeRooms.find((r) => r.name === value) ?? null;

  const triggerContent = selectedRoom ? (
    <RoomBadge room={selectedRoom} rooms={activeRooms} />
  ) : (
    <span className="italic text-gray-500 text-xs">All rooms</span>
  );

  const handleSelect = (roomName: string | null) => {
    onChange(roomName);
    setOpen(false);
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
              <h3 className="text-sm font-semibold text-gray-700">Filter by Room</h3>
              <button
                type="button"
                className="text-gray-400 hover:text-gray-600 text-xl leading-none px-1"
                onClick={() => setOpen(false)}
              >
                &times;
              </button>
            </div>

            {/* Room list */}
            <ul className="flex flex-col py-1">
              {/* All rooms */}
              <li
                className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 cursor-pointer text-sm"
                onClick={() => handleSelect(null)}
              >
                <input
                  type="radio"
                  readOnly
                  checked={value === null}
                  className="pointer-events-none w-4 h-4"
                />
                <span className="italic text-gray-500">All rooms</span>
              </li>

              <li className="border-t border-gray-100 mx-4" />

              {activeRooms.map((room) => (
                <li
                  key={room.id}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-gray-50 cursor-pointer"
                  onClick={() => handleSelect(room.name)}
                >
                  <input
                    type="radio"
                    readOnly
                    checked={value === room.name}
                    className="pointer-events-none w-4 h-4"
                  />
                  <RoomBadge room={room} rooms={activeRooms} />
                </li>
              ))}
            </ul>
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

export default RoomSingleSelect;