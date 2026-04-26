import { isSameMonth } from "date-fns";
import { formatDateToMonthYear } from "../../../util/formatDate";
import TodayButton from "./TodayButton";
import HostFilter from "./HostFilter";
import RoomFilter from "./RoomFilter";
import host from "../../../util/types/TiBook/host.type";
import { hostType } from "../../../util/types/hostType";
import { roomType } from "../../../util/types/roomType";
import { dayType } from "../../../util/types/dayType";

interface CalendarNavigatorProps {
  currentMonth: Date;
  hosts: host[];
  rooms: roomType[];
  setSelectedRoomName: React.Dispatch<React.SetStateAction<string | null>>;
  setCurrentHost: React.Dispatch<React.SetStateAction<hostType | null>>;
  setDays: React.Dispatch<React.SetStateAction<dayType[]>>;
  setRooms: React.Dispatch<React.SetStateAction<roomType[]>>;
  onScrollToToday?: () => void;
  onBookingRequest?: () => void;
}

const CalendarNavigator = ({
  currentMonth,
  hosts,
  rooms,
  setSelectedRoomName,
  setCurrentHost,
  setDays,
  setRooms,
  onScrollToToday,
  onBookingRequest,
}: CalendarNavigatorProps) => {
  const formattedDate = formatDateToMonthYear(
    currentMonth.toISOString().split("T")[0],
  );
  const isCurrentMonth = isSameMonth(currentMonth, new Date());
  const todayButton = (
    <TodayButton isCurrentMonth={isCurrentMonth} onScrollToToday={onScrollToToday} />
  );

  return (
    <div className="flex flex-col justify-between gap-2 h-full max-h-[100px] bg-white drop-shadow-sm p-2 pb-1 sm:max-h-[140px] sm:pb-2">
      {/* Top Section: Filters + Month and Year */}
      <div className="flex justify-between items-center">
        {/* Filters */}
        <div className="flex flex-col gap-2">
          <HostFilter
            hosts={hosts}
            setCurrentHost={setCurrentHost}
            setDays={setDays}
            setRooms={setRooms}
          />
          <RoomFilter
            rooms={rooms}
            onChange={setSelectedRoomName}
          />
        </div>
        {/* Book + Month and Year */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="bg-green-500 text-white px-3 py-1 rounded text-sm font-medium hover:bg-green-600"
            onClick={onBookingRequest}
          >
            Book
          </button>
          <span className="font-bold text-xl text-gray-800">
            {formattedDate}
          </span>
          {todayButton}
        </div>
      </div>

      {/* Bottom Section: Days of the Week */}
      <div className="grid grid-cols-7 text-center">
        {[
          "Sunday",
          "Monday",
          "Tuesday",
          "Wednesday",
          "Thursday",
          "Friday",
          "Saturday",
        ].map((day, index) => (
          <abbr
            key={index}
            title={day}
            className="text-base font-medium sm:text-lg md:text-xl"
          >
            {day.substring(0, 3)}
          </abbr>
        ))}
      </div>
    </div>
  );
};

export default CalendarNavigator;
