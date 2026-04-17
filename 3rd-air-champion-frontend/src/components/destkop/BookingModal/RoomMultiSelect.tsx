import { useEffect, useRef, useState } from "react";
import { roomType } from "../../../util/types/roomType";
import { ANY_ROOM_SENTINEL } from "../../../util/zodBookDays";

interface RoomMultiSelectProps {
  rooms: roomType[];
  value: string[];
  onChange: (rooms: string[]) => void;
}

const RoomMultiSelect = ({ rooms, value, onChange }: RoomMultiSelectProps) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const isAny = value.includes(ANY_ROOM_SENTINEL);

  const triggerLabel = () => {
    if (isAny) return "Any available";
    if (value.length === 0) return "Select rooms…";
    if (value.length === 1) {
      return rooms.find((r) => r.id === value[0])?.name ?? "1 room";
    }
    if (value.length <= 2) {
      return value
        .map((id) => rooms.find((r) => r.id === id)?.name ?? id)
        .join(", ");
    }
    return `${value.length} rooms`;
  };

  const handleToggleAny = () => {
    if (isAny) {
      // deselect — leave empty (user must pick a room)
      onChange([]);
    } else {
      onChange([ANY_ROOM_SENTINEL]);
    }
  };

  const handleToggleRoom = (id: string) => {
    const withoutAny = value.filter((v) => v !== ANY_ROOM_SENTINEL);
    if (withoutAny.includes(id)) {
      const next = withoutAny.filter((v) => v !== id);
      onChange(next);
    } else {
      onChange([...withoutAny, id]);
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        className="border border-gray-300 rounded px-2 py-1 w-full text-left text-sm flex justify-between items-center gap-1"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="truncate">{triggerLabel()}</span>
        <span className="text-gray-400 text-xs flex-shrink-0">▾</span>
      </button>

      {open && (
        <ul className="absolute z-30 bg-white border border-gray-300 rounded w-full mt-1 max-h-48 overflow-y-auto shadow-md">
          {/* Any available */}
          <li
            className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-100 cursor-pointer text-sm"
            onClick={handleToggleAny}
          >
            <input
              type="checkbox"
              readOnly
              checked={isAny}
              className="pointer-events-none"
            />
            <span className="italic text-gray-500">Any available</span>
          </li>

          <li className="border-t border-gray-100" />

          {rooms.map((room) => {
            const checked = !isAny && value.includes(room.id);
            return (
              <li
                key={room.id}
                className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-100 cursor-pointer text-sm"
                onClick={() => handleToggleRoom(room.id)}
              >
                <input
                  type="checkbox"
                  readOnly
                  checked={checked}
                  className="pointer-events-none"
                />
                <span>{room.name}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default RoomMultiSelect;