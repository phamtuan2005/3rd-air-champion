import { format, isSameMonth } from "date-fns";
import TodayButton from "./TodayButton";
import { useTiBookTheme } from "../../../contexts/TiBookThemeContext";

interface CalendarNavigatorProps {
  currentMonth: Date;
  onScrollToToday?: () => void;
  onBookingRequest?: () => void;
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const CalendarNavigator = ({
  currentMonth,
  onScrollToToday,
  onBookingRequest,
}: CalendarNavigatorProps) => {
  const { theme } = useTiBookTheme();
  const formattedDate = format(currentMonth, "MMMM yyyy");
  const isCurrentMonth = isSameMonth(currentMonth, new Date());

  return (
    <div className="flex flex-col gap-0.5 bg-white drop-shadow-sm px-2 pt-1.5 pb-1 shrink-0">
      {/* Month title + Today */}
      <div className="flex items-center gap-2">
        <span className="font-bold text-base sm:text-xl text-gray-800 flex-1">{formattedDate}</span>
        <TodayButton isCurrentMonth={isCurrentMonth} onScrollToToday={onScrollToToday} />
      </div>

      {/* Days of the week — 1 letter on mobile, 3 letters on sm+ */}
      <div className="grid grid-cols-7 text-center">
        {DAYS.map((day, index) => (
          <abbr
            key={index}
            title={day}
            className="text-xs sm:text-sm font-medium text-gray-500 no-underline"
          >
            <span className="sm:hidden">{day[0]}</span>
            <span className="hidden sm:inline">{day.substring(0, 3)}</span>
          </abbr>
        ))}
      </div>

      <button
        type="button"
        className={`w-full ${theme.btn} ${theme.btnHover} ${theme.btnActive} text-white py-2 rounded-xl text-sm font-semibold transition-colors mt-0.5`}
        onClick={onBookingRequest}
      >
        Request a Booking
      </button>
    </div>
  );
};

export default CalendarNavigator;