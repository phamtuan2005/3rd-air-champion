import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import Calendar from "react-calendar";
import { format, isBefore, startOfToday } from "date-fns";
import "../../../styles/calendarStyle.css";
import { roomType } from "../../../util/types/roomType";
import { ANY_ROOM_SENTINEL } from "../../../util/zodBookDays";
import { getAvailableRooms } from "../../../util/bookingOperations";

interface DatePickerModalProps {
  value: Date | null;
  onChange: (date: Date) => void;
  calendarId: string;
  token: string;
  selectedRoomIds: string[];
  activeRooms: roomType[];
  guestName: string;
}

type Availability = "available" | "unavailable";

const TILE_COLOR: Record<Availability, string> = {
  available: "!text-green-600 !font-semibold",
  unavailable: "!text-gray-400 !line-through",
};

const DatePickerModal = ({
  value,
  onChange,
  calendarId,
  token,
  selectedRoomIds,
  activeRooms,
  guestName,
}: DatePickerModalProps) => {
  const [open, setOpen] = useState(false);
  const [activeStartDate, setActiveStartDate] = useState<Date>(
    value ?? startOfToday()
  );
  const [snapshotRoomIds, setSnapshotRoomIds] = useState<string[]>([]);
  const [availabilityMap, setAvailabilityMap] = useState<
    Map<string, Availability>
  >(new Map());
  const [isLoading, setIsLoading] = useState(false);
  // Cache keyed by "year-month-roomIds" so navigating back doesn't refetch
  const cache = useRef<Map<string, Map<string, Availability>>>(new Map());

  const fetchMonthAvailability = async (
    startDate: Date,
    roomIds: string[]
  ) => {
    const year = startDate.getFullYear();
    const month = startDate.getMonth();
    const isAny =
      roomIds.length === 0 ||
      roomIds.every((id) => id === ANY_ROOM_SENTINEL);
    const cacheKey = `${year}-${month}-${roomIds.join(",")}`;

    if (cache.current.has(cacheKey)) {
      setAvailabilityMap(cache.current.get(cacheKey)!);
      return;
    }

    setIsLoading(true);
    const today = startOfToday();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const futureDates = Array.from(
      { length: daysInMonth },
      (_, i) => new Date(year, month, i + 1)
    ).filter((d) => !isBefore(d, today));

    const results = await Promise.all(
      futureDates.map(async (date) => {
        try {
          const available = await getAvailableRooms(
            {
              calendar: calendarId,
              date: format(date, "yyyy-MM-dd'T'HH:mm:ss"),
              duration: 1,
            },
            token
          );
          return { date, available };
        } catch {
          return { date, available: [] };
        }
      })
    );

    const map = new Map<string, Availability>();
    for (const { date, available } of results) {
      const key = date.toISOString().split("T")[0];
      const availableIds = new Set(available.map((r) => r.id));

      if (isAny) {
        map.set(key, available.length > 0 ? "available" : "unavailable");
      } else {
        const specific = roomIds.filter((id) => id !== ANY_ROOM_SENTINEL);
        const availCount = specific.filter((id) =>
          availableIds.has(id)
        ).length;
        if (availCount > 0) map.set(key, "available");
        else map.set(key, "unavailable");
      }
    }

    cache.current.set(cacheKey, map);
    setAvailabilityMap(map);
    setIsLoading(false);
  };

  const handleOpen = () => {
    const start = value ?? startOfToday();
    setActiveStartDate(start);
    setSnapshotRoomIds(selectedRoomIds);
    setOpen(true);
    fetchMonthAvailability(start, selectedRoomIds);
  };

  const handleSelect = (date: Date) => {
    onChange(date);
    setOpen(false);
  };

  const handleMonthChange = ({
    activeStartDate: d,
  }: {
    activeStartDate: Date | null;
  }) => {
    if (!d) return;
    setActiveStartDate(d);
    fetchMonthAvailability(d, snapshotRoomIds);
  };

  const roomLabel =
    snapshotRoomIds.length === 0 ||
    snapshotRoomIds.every((id) => id === ANY_ROOM_SENTINEL)
      ? "any available room"
      : snapshotRoomIds
          .map(
            (id) =>
              activeRooms.find((r) => String(r.id) === String(id))?.name ?? id
          )
          .join(", ");

  const modal = open
    ? createPortal(
        <div
          className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-[300]"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-white rounded-lg shadow-xl p-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-sm font-semibold text-gray-700">
                Select Check-in Date
              </h3>
              <button
                type="button"
                className="text-gray-400 hover:text-gray-600 text-xl leading-none px-1"
                onClick={() => setOpen(false)}
              >
                &times;
              </button>
            </div>
            <p className="text-xs text-gray-400 mb-3">
              Checking: {roomLabel}
              {guestName ? ` for ${guestName}` : ""}
              {isLoading && " — loading…"}
            </p>

            {/* Calendar */}
            <Calendar
              onChange={(date) => handleSelect(date as Date)}
              value={value}
              activeStartDate={activeStartDate}
              onActiveStartDateChange={handleMonthChange}
              calendarType="gregory"
              tileClassName={({ date, view }) => {
                if (view !== "month") return null;
                if (isBefore(date, startOfToday())) return "!text-gray-400 !italic";
                const key = date.toISOString().split("T")[0];
                const avail = availabilityMap.get(key);
                return avail ? TILE_COLOR[avail] : "!text-gray-400";
              }}
            />

            {/* Legend + Today button */}
            <div className="mt-3 flex items-center justify-between">
              <div className="flex items-center gap-3 text-xs">
                <span className="text-green-600 font-semibold">Available</span>
                <span className="text-gray-400 line-through">Full</span>
              </div>
              <button
                type="button"
                className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 px-3 py-1 rounded"
                onClick={() => {
                  const today = startOfToday();
                  setActiveStartDate(today);
                  fetchMonthAvailability(today, snapshotRoomIds);
                }}
              >
                Today
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
        onClick={handleOpen}
      >
        <span>{value ? format(value, "MMM d, yyyy") : "Select date…"}</span>
        <span className="text-gray-400 text-xs flex-shrink-0">📅</span>
      </button>

      {modal}
    </>
  );
};

export default DatePickerModal;