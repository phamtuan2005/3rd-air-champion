import { format, parseISO } from "date-fns";
import { useTiBookTheme } from "../../../contexts/TiBookThemeContext";
import { holidayLabel, usHolidaysInMonth } from "../../../util/usHolidays";

/*
 * The US federal holidays in the month on screen, named in one line under the
 * calendar. Shared by the month grid and the day list. The list used to go
 * without it, on the reasoning that it names a holiday on the holiday's own
 * row, but that row is weeks down the list. Opened mid-October, the next one
 * (Veterans Day) was 25 rows below the fold, so a guest in the list never saw
 * a holiday at all (Anh-Tri, 2026-10-16).
 */
const MonthHolidayLine = ({ month, bottom = "0px" }: { month?: Date; bottom?: string }) => {
  const { theme } = useTiBookTheme();
  const monthHolidays = month ? usHolidaysInMonth(month.getFullYear(), month.getMonth()) : [];
  // No line at all for a month without a holiday. It used to print "No US
  // federal holidays in August", a whole row spent saying nothing; the
  // calendar takes the room instead.
  if (monthHolidays.length === 0) return null;
  return (
    // Sticky to the bottom of the SCREEN, not just of the calendar. Since
    // both layouts scroll as a page, the calendar is a whole screen tall and
    // its bottom edge sits below the fold until the guest expands it — so the
    // holidays were only ever seen expanded (Anh-Tri, 2026-10-16). Pinned,
    // the line rides just above the bottom bar at every stage, over the last
    // rows while they are off screen anyway, and settles back into place
    // under the calendar once it is fully open. Opaque, or the dates
    // scrolling under it would show through.
    <div
      className={`sticky z-20 flex h-6 shrink-0 items-center gap-1.5 overflow-x-auto overflow-y-hidden whitespace-nowrap border-t px-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden text-[12px] leading-none ${theme.gridLine} ${theme.surface} ${theme.surfaceMuted}`}
      style={{ bottom }}
    >
      {/* The line swipes sideways instead of clipping at "…". A month with
          three holidays is longer than a phone is wide, and the ones past the
          edge were unreadable — only the first could be seen.
          Every holiday opens with its own bullet, in the same text as the
          line. A drawn dot before the first and a typed "•" between the rest
          came out two sizes, so one bullet does both jobs now. */}
      <span className={`shrink-0 whitespace-pre font-semibold ${theme.alertText}`}>
        {monthHolidays
          .map(({ key, holiday }) => `• ${format(parseISO(key), "EEE MMM d")} – ${holidayLabel(holiday)}`)
          .join("  ")}
      </span>
    </div>
  );
};

export default MonthHolidayLine;
