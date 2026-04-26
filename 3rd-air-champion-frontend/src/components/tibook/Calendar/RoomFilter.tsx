import { useMemo } from "react";
import { roomType } from "../../../util/types/roomType";

interface RoomFilterProps {
  rooms: roomType[];
  onChange: (roomName: string | null) => void;
}

const RoomFilter = ({ rooms, onChange }: RoomFilterProps) => {
  const activeRooms = useMemo(() => rooms.filter((r) => r.active), [rooms]);

  return (
    <select
      className="border border-gray-300 rounded px-2 py-1 text-sm"
      defaultValue=""
      onChange={(e) => onChange(e.target.value || null)}
    >
      <option value="">All rooms</option>
      {activeRooms.map((room) => (
        <option key={room.id} value={room.name}>
          {room.name}
        </option>
      ))}
    </select>
  );
};

export default RoomFilter;
