import { isSameMonth } from "date-fns";
import TodayButton from "./TodayButton";
import CalendarViewToggle from "./CalendarViewToggle";
import { useTiBookTheme, useCalendarView } from "../../../contexts/TiBookThemeContext";
import { useTiBookLang } from "../../../contexts/TiBookLanguageContext";

interface CalendarNavigatorProps {
  currentMonth: Date;
  todayInList?: boolean;
  onScrollToToday?: () => void;
  onBookingRequest?: () => void;
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const VI_WEEKDAYS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

const CalendarNavigator = ({
  currentMonth,
  todayInList,
  onScrollToToday,
  onBookingRequest,
}: CalendarNavigatorProps) => {
  const { theme } = useTiBookTheme();
  const { calendarView } = useCalendarView();
  const { t, fmtDate, lang } = useTiBookLang();
  const formattedDate = fmtDate(currentMonth, "MMMM yyyy");
  const isCurrentMonth = isSameMonth(currentMonth, new Date());

  return (
    <div className={`flex flex-col gap-0.5 ${theme.chrome} drop-shadow-sm px-2 pt-1.5 pb-1 shrink-0`}>
      {/* Month title + Today */}
      <div className="flex items-center gap-2">
        <span className={`font-bold text-base sm:text-xl flex-1 ${theme.chromeText}`}>{formattedDate}</span>
        <CalendarViewToggle />
        <TodayButton isCurrentMonth={isCurrentMonth} todayInList={todayInList} onScrollToToday={onScrollToToday} />
      </div>

      {/* Days of the week — 1 letter on mobile, 3 letters on sm+. Not over
          the list, where every row names its own day. */}
      {calendarView === "month" && (
        <div className="grid grid-cols-7 text-center">
          {DAYS.map((day, index) => (
            <abbr
              key={index}
              title={t(day)}
              className={`text-xs sm:text-sm font-medium no-underline ${theme.chromeMuted}`}
            >
              {/* The letter is the first of the day's name in the guest's
                  language (German: S M D M D F S, columns unchanged). The
                  short form is looked up whole: German shortens to two
                  letters, "Mo", where cutting at three gave "Mon". Chinese
                  takes the LAST character: every day begins 星期, so the first
                  would print 星 seven times. Korean needs neither: 일요일,
                  월요일… each start with their own letter. Spanish has two Ms
                  (martes, miércoles) and writes the second as X, as Spanish
                  calendars do — and its names are lowercase, so the letters
                  are listed rather than cut. Vietnamese numbers its days
                  (thứ Hai is "day two"), so every name but Chủ nhật begins
                  "T": its calendars print CN, T2 … T7, which still fit. */}
              <span className="sm:hidden">
                {lang === "zh" ? t(day).slice(-1) : lang === "es" ? "DLMXJVS"[index] : lang === "vi" ? VI_WEEKDAYS[index] : t(day)[0]}
              </span>
              <span className="hidden sm:inline">{t(day.substring(0, 3))}</span>
            </abbr>
          ))}
        </div>
      )}

      <button
        type="button"
        /* The app's primary action, and it was set at text-sm — smaller than the
           month above it and smaller than the bar it leads to. Sized to match
           that bar so the whole booking path reads at one size. */
        className={`w-full ${theme.btn} ${theme.btnHover} ${theme.btnActive} ${theme.glow} ${theme.btnMotion} text-white py-2.5 rounded-xl text-lg font-semibold transition-colors mt-0.5`}
        onClick={onBookingRequest}
      >
        {t("Request a Booking")}
      </button>
    </div>
  );
};

export default CalendarNavigator;