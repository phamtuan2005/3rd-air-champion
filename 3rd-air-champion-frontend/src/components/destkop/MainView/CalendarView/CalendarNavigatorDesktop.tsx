import { addDays, compareAsc, isSameDay, isSameMonth } from "date-fns";
import { useContext, useEffect, useState } from "react";
import { dayType } from "../../../../util/types/dayType";
import { roomType } from "../../../../util/types/roomType";
import { toZonedTime } from "date-fns-tz/toZonedTime";
import { FooterContext } from "../../../../context";
import RoomSingleSelect from "./RoomSingleSelect";

interface CalendarNavigatorProps {
  currentMonth: Date;
  currentAirBnBGuest: string | null;
  currentGuest: string | null;
  monthMap: Map<string, dayType>;
  occupancy: {
    totalOccupancy: number;
    airbnbOccupancy: number;
    roomOccupancy: {
      name: string;
      occupancy: number;
    }[];
  };
  paidDates: Date[];
  profit: {
    total: number;
    airbnb: number;
  };
  rooms: roomType[];
  selectedRoomName: string | null;
  getCurrentGuestBill: (guest: string) => number;
  onGoToToday: () => void;
  todayInView?: boolean;
  setPaidDates: React.Dispatch<React.SetStateAction<Date[]>>;
  setSelectedRoomName: React.Dispatch<React.SetStateAction<string | null>>;
  gapsMode: boolean;
  setGapsMode: React.Dispatch<React.SetStateAction<boolean>>;
}

const CalendarNavigator = ({
  currentMonth,
  currentAirBnBGuest,
  currentGuest,
  monthMap,
  occupancy,
  profit,
  paidDates,
  rooms,
  selectedRoomName,
  getCurrentGuestBill,
  onGoToToday,
  todayInView,
  setPaidDates,
  setSelectedRoomName,
  gapsMode,
  setGapsMode,
}: CalendarNavigatorProps) => {
  const { setIsFooterVisible } = useContext(FooterContext)!;
  const [showDetails, setShowDetails] = useState(false);
  const [guestBill, setGuestBill] = useState<number | null>(null);
  const [airBnBGuestBill, setAirBnBGuestBill] = useState<number | null>(null);

  const formattedDate = currentMonth.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
  });
  // Disable only when today is actually on screen. A month can span several pages, so
  // being in the current month no longer means today is visible — fall back to month
  // match only if the grid hasn't reported visibility yet.
  const isCurrentMonth = isSameMonth(currentMonth, new Date());
  const disableToday = todayInView ?? isCurrentMonth;
  const todayButton = (
    <button
      onClick={onGoToToday}
      disabled={disableToday}
      className={`text-xs px-2 py-0.5 rounded border transition-colors ${
        disableToday
          ? "text-gray-300 border-gray-200 cursor-default"
          : "text-blue-500 border-blue-300 hover:bg-blue-50 cursor-pointer"
      }`}
    >
      Today
    </button>
  );

  useEffect(() => {
    if (currentGuest) {
      const totalBill = getCurrentGuestBill(currentGuest);
      setGuestBill(totalBill);
    } else {
      setGuestBill(null);
    }
  }, [currentGuest, currentMonth]);

  useEffect(() => {
    if (currentAirBnBGuest) {
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      let total = 0;
      monthMap.forEach((dayEntry, dateStr) => {
        const localDate = toZonedTime(dateStr, timeZone);
        if (isSameMonth(localDate, currentMonth)) {
          dayEntry.bookings.forEach((booking) => {
            if (booking.alias === currentAirBnBGuest && booking.startDate === dateStr) {
              total += booking.airbnbPrice ?? 0;
            }
          });
        }
      });
      setAirBnBGuestBill(total);
    } else {
      setAirBnBGuestBill(null);
    }
  }, [currentAirBnBGuest, currentMonth]);

  return (
    <div className="flex flex-col justify-between h-full max-h-[100px] bg-white drop-shadow-sm p-2 pb-1 sm:max-h-[140px] sm:pb-2">
      {/* Date */}
      {!currentGuest && !currentAirBnBGuest ? (
        <>
          <div className="flex h-full w-full items-center text-nowrap gap-2">
            {/* Room filter */}
            <div className="basis-1/4 flex items-center">
              <RoomSingleSelect
                rooms={rooms}
                value={selectedRoomName}
                onChange={(roomName) => {
                  setSelectedRoomName(roomName);
                  if (roomName) {
                    setIsFooterVisible(true);
                  } else if (!currentGuest && !currentAirBnBGuest) {
                    setIsFooterVisible(false);
                  }
                }}
              />
            </div>
            <div className="basis-1/2 flex justify-center items-center w-full gap-1 sm:gap-2">
              <span className="font-bold text-base sm:text-xl text-gray-800">
                {formattedDate}
              </span>
              {todayButton}
              <button
                type="button"
                onClick={() => setGapsMode((v) => !v)}
                className={`text-xs px-2 py-0.5 rounded border transition-colors ${
                  gapsMode
                    ? "bg-green-500 border-green-500 text-white"
                    : "border-gray-300 text-gray-400 hover:text-gray-600"
                }`}
              >
                Gaps
              </button>
            </div>
            {/* PROFIT */}
            <div className="basis-1/4 flex justify-end w-full text-2xl font-bold text-emerald-600 text-right leading-tight">
              ${Math.round(profit.total).toLocaleString()}
            </div>
          </div>
        </>
      ) : currentGuest ? (
        <>
          <div className="flex h-full w-full justify-between items-center">
            {/* Guest */}
            <span className="text-xl text-gray-800">{currentGuest}</span>
            <div className="flex items-center gap-2">
              <div
                className="font-bold text-xl text-gray-800"
                onDoubleClick={() => {
                  const timeZone =
                    Intl.DateTimeFormat().resolvedOptions().timeZone;

                  const paidDatesSet = new Set<string>(
                    paidDates.map(
                      (paidDate) => paidDate.toISOString().split("T")[0],
                    ),
                  );

                  monthMap.forEach((day, dateKey) => {
                    const booking = day.bookings.find(
                      (booking) => booking.guest.id == currentGuest,
                    );

                    if (booking) {
                      const localDate = toZonedTime(dateKey, timeZone);
                      const localStartDate = toZonedTime(
                        booking.startDate,
                        timeZone,
                      );
                      if (
                        isSameDay(localDate, localStartDate) &&
                        isSameMonth(localStartDate, currentMonth)
                      ) {
                        for (let i = 0; i < booking.duration; i += 1) {
                          paidDatesSet.add(
                            toZonedTime(addDays(localStartDate, i), timeZone)
                              .toISOString()
                              .split("T")[0],
                          );
                        }
                      }
                    }
                  });

                  const updatedPaidDates = Array.from(paidDatesSet, (date) =>
                    toZonedTime(date, timeZone),
                  ).sort((a, b) => {
                    return compareAsc(a, b);
                  });

                  setPaidDates(updatedPaidDates);
                }}
              >
                {formattedDate}
              </div>
            </div>
            {/* PROFIT */}
            <div className="text-xl font-bold">${guestBill?.toFixed(2)}</div>
          </div>
        </>
      ) : (
        <>
          <div className="flex h-full w-full items-center">
            <span className="text-xl text-gray-800">
              {currentAirBnBGuest} (A)
            </span>
            <div className="flex items-center gap-2 mx-auto">
              <span className="font-bold text-xl text-gray-800">{formattedDate}</span>
            </div>
            {/* PROFIT */}
            <div className="text-xl font-bold">${airBnBGuestBill?.toFixed(2)}</div>
          </div>
        </>
      )}

      <div className="flex h-full w-full">
        {!currentGuest &&
          !currentAirBnBGuest &&
          (showDetails ? (
            <div
              onClick={() => setShowDetails(false)}
              className="basis-2/3 flex h-full w-full justify-end items-center cursor-pointer space-x-2 text-[0.85rem] text-nowrap"
            >
              {occupancy.roomOccupancy
                .filter((room) => room.name !== "Master") // Exclude "Master"
                .map((object, index) => {
                  // Determine the color class based on occupancy
                  const occupancyColor =
                    object.occupancy < 33.33
                      ? "text-red-500"
                      : object.occupancy < 66.67
                        ? "text-yellow-500"
                        : "text-green-500";
                  return (
                    <div key={index} className="space-x-1">
                      <span className="font-medium">{object.name}: </span>
                      <span className={occupancyColor}>
                        {Math.round(object.occupancy)}%
                      </span>
                    </div>
                  );
                })}
            </div>
          ) : (
            <div
              className="basis-2/3 flex h-full w-full justify-end items-center cursor-pointer space-x-2 text-[0.85rem] text-nowrap"
              onClick={() => setShowDetails(true)}
            >
              <span
                className={`cursor-pointer flex underline ${
                  occupancy.totalOccupancy < 33.33
                    ? "text-red-500"
                    : occupancy.totalOccupancy < 66.67
                      ? "text-yellow-500"
                      : "text-green-500"
                }`}
              >
                {Math.round(occupancy.totalOccupancy)}% occupancy
              </span>
              <span
                className={`underline ${
                  occupancy.airbnbOccupancy < 33.33
                    ? "text-red-500"
                    : occupancy.airbnbOccupancy < 66.67
                      ? "text-yellow-500"
                      : "text-green-500"
                }`}
              >
                {Math.round(occupancy.airbnbOccupancy)}% (A)booking
              </span>
            </div>
          ))}
        {/* PROFIT */}
        {!currentGuest && !currentAirBnBGuest && (
          <div className="basis-1/3 flex justify-end items-center gap-1.5 w-full font-bold text-nowrap">
            (A) ${Math.round(profit.airbnb).toLocaleString()}
          </div>
        )}
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
