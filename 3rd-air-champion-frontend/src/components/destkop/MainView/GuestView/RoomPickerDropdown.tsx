import { useState } from "react";
import { createPortal } from "react-dom";
import { roomType } from "../../../../util/types/roomType";
import RoomBadge from "../../../shared/RoomBadge";

interface RoomPickerDropdownProps {
  rooms: roomType[];
  blockedRoomIds: Set<string>;
  value: string;
  onChange: (roomId: string) => void;
}

const RoomPickerDropdown = ({ rooms, blockedRoomIds, value, onChange }: RoomPickerDropdownProps) => {
  const [open, setOpen] = useState(false);


  const selectedRoom = rooms.find((r) => r.id === value) ?? null;

  const handleSelect = (roomId: string) => {
    onChange(roomId);
    setOpen(false);
  };

  const triggerContent = selectedRoom ? (
    <RoomBadge room={selectedRoom} rooms={rooms} />
  ) : (
    <span className="text-gray-400 text-xs">Select room…</span>
  );

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
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-700">Select Room</h3>
              <button
                type="button"
                className="text-gray-400 hover:text-gray-600 text-xl leading-none px-1"
                onClick={() => setOpen(false)}
              >
                &times;
              </button>
            </div>

            <ul className="flex flex-col py-1">
              {rooms.map((room) => {
                const isBlocked = blockedRoomIds.has(room.id);
                const isSelected = room.id === value;
                return (
                  <li
                    key={room.id}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-gray-50 cursor-pointer"
                    onClick={() => handleSelect(room.id)}
                  >
                    <input
                      type="radio"
                      readOnly
                      checked={isSelected}
                      className="pointer-events-none w-4 h-4"
                    />
                    <RoomBadge room={room} rooms={rooms} override={isBlocked ? "bg-gray-300 opacity-50" : undefined} />
                    {isBlocked && <span className="text-xs text-gray-400 italic">(blocked)</span>}
                  </li>
                );
              })}
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
        className="border border-gray-300 rounded px-2 py-1 text-left text-sm flex items-center gap-1"
        onClick={() => setOpen(true)}
      >
        <span>{triggerContent}</span>
        <span className="text-gray-400 text-xs flex-shrink-0">▾</span>
      </button>
      {modal}
    </>
  );
};

export default RoomPickerDropdown;