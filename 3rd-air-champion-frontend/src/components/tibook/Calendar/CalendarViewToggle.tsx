import type { ReactNode } from "react";
import { useTiBookTheme, useCalendarView, type CalendarViewName } from "../../../contexts/TiBookThemeContext";

// Month grid or day-by-day list. Sits beside Today in both layouts, and is
// drawn off the same chrome tokens as Today so the two read as one set of
// controls in either skin.
const VIEWS: { view: CalendarViewName; label: string; icon: ReactNode }[] = [
  {
    view: "month",
    label: "Month",
    icon: (
      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
        <rect x="3" y="4" width="18" height="17" rx="2" /><path d="M3 10h18M9 10v11M15 10v11" />
      </svg>
    ),
  },
  {
    view: "list",
    label: "List",
    icon: (
      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" viewBox="0 0 24 24" aria-hidden>
        <path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" />
      </svg>
    ),
  },
];

const CalendarViewToggle = () => {
  const { theme } = useTiBookTheme();
  const { calendarView, setCalendarView } = useCalendarView();
  return (
    <div role="group" aria-label="Show the calendar as" className={`flex shrink-0 overflow-hidden rounded border ${theme.chromeBorder}`}>
      {VIEWS.map(({ view, label, icon }) => {
        const on = calendarView === view;
        return (
          <button
            key={view}
            type="button"
            aria-pressed={on}
            aria-label={`Show the calendar as a ${view === "month" ? "month" : "list of days"}`}
            title={label}
            onClick={() => setCalendarView(view)}
            className={`flex items-center gap-1 px-2 py-1 text-xs transition-colors ${
              on ? `${theme.btn} font-semibold text-white` : `${theme.chromeMuted} ${theme.chromeHover}`
            }`}
          >
            {icon}
            {/* Icons alone on a phone: in Hero this shares a row with the
                month and "N nights open", and with words it cut that to "op…". */}
            <span className="hidden sm:inline">{label}</span>
          </button>
        );
      })}
    </div>
  );
};

export default CalendarViewToggle;
