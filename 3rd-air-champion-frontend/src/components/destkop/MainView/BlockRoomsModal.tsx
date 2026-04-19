import { useState, useMemo } from "react";
import { createPortal } from "react-dom";
import Calendar from "react-calendar";
import { addDays, format, isBefore, startOfToday } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import "../../../styles/calendarStyle.css";
import { dayType } from "../../../util/types/dayType";
import { roomType } from "../../../util/types/roomType";
import { getRoomColor } from "../../../util/getRoomColor";
import { blockRoom, unblockRoom } from "../../../util/dayOperations";

interface BlockRoomsModalProps {
  calendarId: string;
  monthMap: Map<string, dayType>;
  rooms: roomType[];
  token: string;
  onDaysUpdate: (updatedDays: dayType[]) => void;
}

interface BlockedRange {
  roomId: string;
  startDate: string;
  duration: number;
}

function getBlockedRanges(monthMap: Map<string, dayType>): BlockedRange[] {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const today = startOfToday();

  const roomDateMap = new Map<string, string[]>();
  for (const [dateStr, day] of monthMap.entries()) {
    if (isBefore(toZonedTime(dateStr, timeZone), today)) continue;
    for (const room of day.blockedRooms) {
      if (!roomDateMap.has(room.id)) roomDateMap.set(room.id, []);
      roomDateMap.get(room.id)!.push(dateStr);
    }
  }

  const ranges: BlockedRange[] = [];
  for (const [roomId, dates] of roomDateMap.entries()) {
    const sorted = [...dates].sort();
    let i = 0;
    while (i < sorted.length) {
      let j = i;
      while (
        j + 1 < sorted.length &&
        format(addDays(toZonedTime(sorted[j], timeZone), 1), "yyyy-MM-dd") === sorted[j + 1]
      ) {
        j++;
      }
      ranges.push({ roomId, startDate: sorted[i], duration: j - i + 1 });
      i = j + 1;
    }
  }

  return ranges.sort((a, b) => a.startDate.localeCompare(b.startDate));
}

const BlockRoomsModal = ({
  calendarId,
  monthMap,
  rooms,
  token,
  onDaysUpdate,
}: BlockRoomsModalProps) => {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const today = startOfToday();


  const [selectedRoom, setSelectedRoom] = useState<string>("");
  const [startDate, setStartDate] = useState<Date>(today);
  const [duration, setDuration] = useState<number>(1);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isBlocking, setIsBlocking] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [unblockingKey, setUnblockingKey] = useState<string | null>(null);

  const activeRooms = rooms.filter((r) => r.active);
  const blockedRanges = getBlockedRanges(monthMap);
  const selectedRoomObj = activeRooms.find((r) => r.id === selectedRoom);

  // Build a set of unavailable date strings for the selected room
  const unavailableDates = useMemo<Set<string>>(() => {
    const s = new Set<string>();
    if (!selectedRoom) return s;
    for (const [dateStr, day] of monthMap.entries()) {
      const isRoomBooked = day.bookings.some((b) => b.room.id === selectedRoom);
      const isRoomBlocked = day.blockedRooms.some((r) => r.id === selectedRoom);
      if (day.isBlocked || isRoomBooked || isRoomBlocked) {
        s.add(dateStr);
      }
    }
    return s;
  }, [selectedRoom, monthMap]);

  const handleBlock = () => {
    if (!selectedRoom || duration < 1) return;
    setIsBlocking(true);
    setErrorMsg("");
    blockRoom(calendarId, selectedRoom, format(startDate, "yyyy-MM-dd"), duration, token)
      .then((updatedDays: dayType[]) => {
        onDaysUpdate(updatedDays);
        setDuration(1);
      })
      .catch((err: unknown) => {
        setErrorMsg(typeof err === "string" ? err : "Failed to block. Please try again.");
      })
      .finally(() => setIsBlocking(false));
  };

  const handleUnblock = (range: BlockedRange) => {
    const key = `${range.roomId}|${range.startDate}|${range.duration}`;
    setUnblockingKey(key);
    unblockRoom(calendarId, range.roomId, range.startDate, range.duration, token)
      .then((updatedDays: dayType[]) => {
        onDaysUpdate(updatedDays);
      })
      .catch((err: unknown) => {
        setErrorMsg(typeof err === "string" ? err : "Failed to unblock. Please try again.");
      })
      .finally(() => setUnblockingKey(null));
  };

  const formatDateRange = (startDateStr: string, dur: number): string => {
    const start = toZonedTime(startDateStr, timeZone);
    if (dur === 1) return format(start, "MMM d");
    const end = addDays(start, dur - 1);
    return format(start, "MMM") === format(end, "MMM")
      ? `${format(start, "MMM d")} – ${format(end, "d")}`
      : `${format(start, "MMM d")} – ${format(end, "MMM d")}`;
  };

  const getTileClassName = ({ date, view }: { date: Date; view: string }) => {
    if (view !== "month") return null;
    if (isBefore(date, today)) return "!text-gray-300 !italic";
    const key = format(date, "yyyy-MM-dd");
    if (!selectedRoom) return "!text-gray-400";
    if (unavailableDates.has(key)) return "!text-gray-400 !line-through";
    return "!text-green-600 !font-semibold";
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100">
        <h2 className="text-sm font-bold text-gray-800">Block Rooms</h2>
        <p className="text-[11px] text-gray-400 mt-0.5">
          Reserve a room for a period — no new bookings can be made during this time.
        </p>
      </div>

      <div className="flex flex-col gap-5 p-4">
        {/* Room picker */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
            Room
          </label>
          <div className="flex flex-wrap gap-2">
            {activeRooms.map((room) => {
              const isSelected = selectedRoom === room.id;
              return (
                <button
                  key={room.id}
                  type="button"
                  onClick={() => {
                    setSelectedRoom(isSelected ? "" : room.id);
                    setErrorMsg("");
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border-2 ${
                    isSelected
                      ? `${getRoomColor(room.name, room.color)} text-white border-transparent shadow-md scale-105`
                      : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
                  }`}
                >
                  {room.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Start date picker */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
            Start date
          </label>
          <button
            type="button"
            className={`border rounded-lg px-3 py-2 text-sm text-left flex justify-between items-center transition-colors ${
              selectedRoom
                ? "border-gray-200 hover:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-300"
                : "border-gray-100 text-gray-400 cursor-not-allowed bg-gray-50"
            }`}
            disabled={!selectedRoom}
            onClick={() => selectedRoom && setIsCalendarOpen(true)}
          >
            <span className={selectedRoom ? "text-gray-800" : "text-gray-400"}>
              {format(startDate, "MMM d, yyyy")}
            </span>
            <span className="text-gray-400 text-base">📅</span>
          </button>
          {!selectedRoom && (
            <p className="text-[11px] text-gray-400">Select a room first to see availability.</p>
          )}
        </div>

        {/* Duration */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
            Nights
          </label>
          <input
            type="number"
            min={1}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 w-24 focus:outline-none focus:ring-2 focus:ring-rose-300"
            value={duration}
            onChange={(e) => setDuration(Math.max(1, parseInt(e.target.value) || 1))}
          />
        </div>

        {errorMsg && (
          <p className="text-xs text-rose-500 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
            {errorMsg}
          </p>
        )}

        <button
          type="button"
          disabled={isBlocking || !selectedRoom}
          className="w-full py-2 rounded-lg text-sm font-semibold text-white bg-rose-500 hover:bg-rose-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm"
          onClick={handleBlock}
        >
          {isBlocking ? "Blocking…" : "Block"}
        </button>

        {/* Currently blocked */}
        {blockedRanges.length > 0 && (
          <div className="flex flex-col gap-2">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Currently blocked
            </h3>
            <div className="flex flex-col gap-2">
              {blockedRanges.map((range) => {
                const room = rooms.find((r) => r.id === range.roomId);
                if (!room) return null;
                const key = `${range.roomId}|${range.startDate}|${range.duration}`;
                const isUnblocking = unblockingKey === key;
                return (
                  <div
                    key={key}
                    className="flex items-center justify-between gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`${getRoomColor(room.name, room.color)} text-white text-[10px] font-semibold px-2 py-0.5 rounded whitespace-nowrap`}
                      >
                        {room.name}
                      </span>
                      <span className="text-xs text-gray-700 truncate">
                        {formatDateRange(range.startDate, range.duration)}
                      </span>
                      <span className="text-[10px] text-gray-400 whitespace-nowrap">
                        {range.duration}n
                      </span>
                    </div>
                    <button
                      type="button"
                      disabled={isUnblocking}
                      className="text-[11px] font-medium px-2.5 py-1 rounded-md text-gray-600 border border-gray-300 hover:bg-white hover:border-gray-400 disabled:opacity-50 whitespace-nowrap transition-colors"
                      onClick={() => handleUnblock(range)}
                    >
                      {isUnblocking ? "…" : "Unblock"}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {blockedRanges.length === 0 && (
          <p className="text-xs text-emerald-600 font-medium text-center py-2">
            No rooms currently blocked.
          </p>
        )}
      </div>

      {/* Calendar picker modal */}
      {isCalendarOpen && createPortal(
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-[400]"
          onClick={() => setIsCalendarOpen(false)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-1">
              <div>
                <h3 className="text-sm font-semibold text-gray-800">Select Start Date</h3>
                {selectedRoomObj && (
                  <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1.5">
                    Availability for{" "}
                    <span
                      className={`${getRoomColor(selectedRoomObj.name, selectedRoomObj.color)} text-white text-[10px] font-semibold px-2 py-0.5 rounded`}
                    >
                      {selectedRoomObj.name}
                    </span>
                  </p>
                )}
              </div>
              <button
                type="button"
                className="text-gray-400 hover:text-gray-600 text-xl leading-none px-1 ml-4"
                onClick={() => setIsCalendarOpen(false)}
              >
                &times;
              </button>
            </div>

            <Calendar
              onChange={(date) => {
                setStartDate(date as Date);
                setIsCalendarOpen(false);
              }}
              value={startDate}
              minDate={today}
              calendarType="gregory"
              tileClassName={getTileClassName}
            />

            <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1">
                  <span className="text-green-600 font-semibold">Available</span>
                </span>
                <span className="flex items-center gap-1">
                  <span className="text-gray-400 line-through">Booked / Blocked</span>
                </span>
              </div>
              <button
                type="button"
                className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 px-3 py-1 rounded"
                onClick={() => setStartDate(today)}
              >
                Today
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default BlockRoomsModal;