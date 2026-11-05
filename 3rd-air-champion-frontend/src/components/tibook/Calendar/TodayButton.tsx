import { useTiBookTheme, useCalendarView } from "../../../contexts/TiBookThemeContext";
import { useTiBookLang } from "../../../contexts/TiBookLanguageContext";

interface TodayButtonProps {
  isCurrentMonth: boolean;
  // Whether tonight's row is on screen in the list (GuestDayList reports it).
  todayInList?: boolean;
  onScrollToToday?: () => void;
}

const TodayButton = ({ isCurrentMonth, todayInList, onScrollToToday }: TodayButtonProps) => {
  const { theme } = useTiBookTheme();
  const { calendarView } = useCalendarView();
  const { t } = useTiBookLang();
  // Off only when there is nowhere to go. In the grid that is this month: the
  // whole month is on screen, tonight with it. In the list it is tonight's ROW
  // — the list scrolls within a month, and keyed on the month the button sat
  // greyed out while the guest was weeks past tonight, with no way back.
  const atToday = calendarView === "list" ? (todayInList ?? isCurrentMonth) : isCurrentMonth;
  return (
    <button
      onClick={() => onScrollToToday?.()}
      disabled={atToday}
      /* The live state was a hardcoded blue — the one accent on this bar that
         ignored the guest's palette, and once the bar can go dark, blue-500 on
         near-black is the hardest thing here to read. Both states come off the
         chrome now, so it stays legible on white and on black. */
      className={`text-xs px-2 py-0.5 rounded border transition-colors ${
        atToday
          ? `${theme.chromeMuted} ${theme.chromeBorder} cursor-default opacity-50`
          : `${theme.chromeAccent} ${theme.chromeBorder} ${theme.chromeHover} cursor-pointer`
      }`}
    >
      {t("Today")}
    </button>
  );
};

export default TodayButton;
