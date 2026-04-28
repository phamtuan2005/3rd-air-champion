import React, { useState } from "react";
import { format } from "date-fns";
import { roomType } from "../../../../util/types/roomType";
import { dayType } from "../../../../util/types/dayType";
import { bookingType } from "../../../../util/types/bookingType";
import { blockRoom, unblockRoom } from "../../../../util/dayOperations";
import RoomPickerDropdown from "./RoomPickerDropdown";

interface AvailableRoomsBarProps {
  calendarId: string;
  token: string;
  selectedDate: Date;
  monthMap: Map<string, dayType>;
  rooms: roomType[];
  currentBookings: bookingType[];
  children: React.ReactNode;
  onDaysUpdate: (updatedDays: dayType[]) => void;
}

const AvailableRoomsBar = ({
  calendarId,
  token,
  selectedDate,
  monthMap,
  rooms,
  currentBookings,
  children,
  onDaysUpdate,
}: AvailableRoomsBarProps) => {
  const [selectedAvailableRoom, setSelectedAvailableRoom] = React.useState<string>("");
  const [blockingRoomId, setBlockingRoomId] = useState<string | null>(null);

  const dateKey = format(selectedDate, "yyyy-MM-dd");
  const dayEntry = monthMap.get(dateKey);
  const blockedRoomIds = new Set((dayEntry?.blockedRooms ?? []).map((r) => r.id));

  const unbookedRooms = rooms.filter(
    (room) => room.active && currentBookings.every((booking) => !booking.room || room.name !== booking.room.name),
  );

  if (unbookedRooms.length === 0) return null;

  const allInactiveOrBlocked = unbookedRooms.every((r) => blockedRoomIds.has(r.id));

  const activeRoom =
    unbookedRooms.find((r) => r.id === selectedAvailableRoom) ||
    unbookedRooms.find((r) => !blockedRoomIds.has(r.id)) ||
    unbookedRooms[0];

  const bookChild = React.Children.toArray(children).find(
    React.isValidElement,
  ) as React.ReactElement<{ room?: roomType }> | undefined;

  const canBook = activeRoom.active && !blockedRoomIds.has(activeRoom.id);

  return (
    <div className="flex items-center justify-center border-b border-solid w-full py-2 gap-2">
      {allInactiveOrBlocked && (
        <span className="font-bold text-green-600 text-sm">Sold Out!</span>
      )}
      <RoomPickerDropdown
        rooms={unbookedRooms}
        blockedRoomIds={blockedRoomIds}
        value={activeRoom.id}
        onChange={setSelectedAvailableRoom}
      />
      <button
        type="button"
        disabled={blockingRoomId === activeRoom.id}
        className="flex justify-center w-[32px] h-[32px] items-center rounded-full shadow-md bg-gray-700 hover:bg-gray-800 text-white text-base disabled:opacity-50"
        onClick={async () => {
          const isBlocked = blockedRoomIds.has(activeRoom.id);
          setBlockingRoomId(activeRoom.id);
          try {
            const updated = isBlocked
              ? await unblockRoom(calendarId, activeRoom.id, dateKey, 1, token)
              : await blockRoom(calendarId, activeRoom.id, dateKey, 1, token);
            onDaysUpdate(updated);
          } finally {
            setBlockingRoomId(null);
          }
        }}
      >
        {blockingRoomId === activeRoom.id ? "…" : blockedRoomIds.has(activeRoom.id) ? "🔓" : "🔒"}
      </button>
      {bookChild && canBook && React.cloneElement(bookChild, { room: activeRoom })}
    </div>
  );
};

export default AvailableRoomsBar;