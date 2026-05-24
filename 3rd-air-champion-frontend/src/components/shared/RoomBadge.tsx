import { useMemo } from "react";
import { getRoomColor } from "../../util/getRoomColor";

interface RoomBadgeProps {
  room: { name: string; color?: string };
  rooms?: { name: string }[];
  override?: string;
  className?: string;
}

const RoomBadge = ({ room, rooms, override, className = "" }: RoomBadgeProps) => {
  const width = useMemo(() => {
    if (!rooms || rooms.length === 0) return undefined;
    const maxLen = rooms.reduce((max, r) => Math.max(max, r.name.length), 0);
    return `${maxLen * 6.5 + 16}px`;
  }, [rooms]);

  return (
    <span
      className={`${override ?? getRoomColor(room.name, room.color)} text-white text-xs font-medium py-0.5 rounded inline-block text-center whitespace-nowrap ${width ? "" : "px-2"} ${className}`}
      style={width ? { width } : undefined}
    >
      {room.name}
    </span>
  );
};

export default RoomBadge;