import { useState } from "react";
import { roomType } from "../../../../util/types/roomType";
import { pricingType } from "../../../../util/types/pricingType";
import RoomBadge from "../../../shared/RoomBadge";

interface PricingDropdownProps {
  fields: pricingType[];
  rooms: roomType[];
}

const PricingDropdown = ({ fields, rooms }: PricingDropdownProps) => {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        className="border border-gray-300 rounded px-2 py-1 text-sm flex items-center gap-1"
        onClick={() => setOpen((prev) => !prev)}
      >
        <span>Room Prices</span>
        <span className="text-gray-400 text-xs">{open ? "▴" : "▾"}</span>
      </button>

      {open && (
        <div className="absolute right-0 mt-1 bg-white border border-gray-200 rounded shadow-lg z-10 py-1 min-w-max">
          {rooms.map((room) => (
            <div key={room.id} className="flex items-center gap-2 px-3 py-1.5">
              <RoomBadge room={room} rooms={rooms} />
              <span className="text-sm">
                ${fields.find((field) => field.room === room.id)?.price || 0}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PricingDropdown;