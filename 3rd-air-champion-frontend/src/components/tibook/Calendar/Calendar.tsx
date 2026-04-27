import { dayType } from "../../../util/types/dayType";
import { bookingType } from "../../../util/types/bookingType";
import { roomType } from "../../../util/types/roomType";
import CalendarGrid from "../../shared/CalendarGrid";

interface CalendarProps {
  currentMonth: Date;
  monthMap: Map<string, dayType>;
  rooms: roomType[];
  selectedRoomName?: string | null;
  scrollToTodayTrigger?: number;
  onMonthChange?: (month: Date) => void;
  onDateClick?: (date: Date) => void;
}

const resolveBarLabel = (booking: bookingType) => booking.room?.name ?? "";

const Calendar = ({
  currentMonth,
  monthMap,
  rooms,
  selectedRoomName = null,
  scrollToTodayTrigger = 0,
  onMonthChange,
  onDateClick,
}: CalendarProps) => (
  <CalendarGrid
    currentMonth={currentMonth}
    monthMap={monthMap}
    rooms={rooms}
    selectedRoomName={selectedRoomName}
    scrollToTodayTrigger={scrollToTodayTrigger}
    monthsBack={0}
    onMonthChange={onMonthChange ?? (() => {})}
    onDateClick={onDateClick}
    resolveBarLabel={resolveBarLabel}
  />
);

export default Calendar;