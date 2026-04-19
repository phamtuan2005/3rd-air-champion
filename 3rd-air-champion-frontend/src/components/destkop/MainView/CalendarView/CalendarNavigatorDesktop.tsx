import { addDays, compareAsc, isSameDay, isSameMonth } from "date-fns";
import { useContext, useEffect, useState } from "react";
import { dayType } from "../../../../util/types/dayType";
import { roomType } from "../../../../util/types/roomType";
import { toZonedTime } from "date-fns-tz/toZonedTime";
import { FooterContext } from "../../../../context";

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
  setPaidDates: React.Dispatch<React.SetStateAction<Date[]>>;
  setSelectedRoomName: React.Dispatch<React.SetStateAction<string | null>>;
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
  setPaidDates,
  setSelectedRoomName,
}: CalendarNavigatorProps) => {
  const { setIsFooterVisible } = useContext(FooterContext)!;
  const [showDetails, setShowDetails] = useState(false);
  const [guestBill, setGuestBill] = useState<number | null>(null);
  const [airBnBGuestBill, setAirBnBGuestBill] = useState<number | null>(null);

  const formattedDate = currentMonth.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
  });
  const isCurrentMonth = isSameMonth(currentMonth, new Date());
  const todayButton = (
    <button
      onClick={onGoToToday}
      disabled={isCurrentMonth}
      className={`text-xs px-2 py-0.5 rounded border transition-colors ${
        isCurrentMonth
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
    <div className="flex flex-col justify-between h-full max-h-[80px] bg-white drop-shadow-sm p-2 sm:max-h-[120px]">
      {/* Date */}
      {!currentGuest && !currentAirBnBGuest ? (
        <>
          <div className="flex h-full w-full items-center text-nowrap gap-2">
            {/* Room filter */}
            <div className="basis-1/4 flex items-center">
              <select
                className="text-xs border border-gray-300 rounded-md p-1 w-full max-w-[130px] bg-white"
                value={selectedRoomName ?? ""}
                onChange={(e) => {
                  const value = e.target.value || null;
                  setSelectedRoomName(value);
                  if (value) {
                    setIsFooterVisible(true);
                  } else if (!currentGuest && !currentAirBnBGuest) {
                    setIsFooterVisible(false);
                  }
                }}
              >
                <option value="">+ All rooms +</option>
                {rooms.filter(r => r.active).map((room) => (
                  <option key={room.id} value={room.name}>{room.name}</option>
                ))}
              </select>
            </div>
            <div className="basis-1/2 flex justify-center items-center w-full gap-2">
              <span className="font-bold text-xl text-gray-800">
                {formattedDate}
              </span>
              {todayButton}
            </div>
            {/* PROFIT */}
            <div className="basis-1/4 flex justify-end w-full text-2xl font-bold text-emerald-600">
              ${profit.total.toFixed(2)}
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
                      (booking) => booking.guest.name === currentGuest,
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
              {todayButton}
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
              {todayButton}
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
          <div className="basis-1/3 flex justify-end w-full font-bold text-nowrap">
            (A) ${profit.airbnb.toFixed(2)}
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
            className="text-xs font-medium sm:text-sm md:text-base"
          >
            {day.substring(0, 3)}
          </abbr>
        ))}
      </div>
    </div>
  );
};

export default CalendarNavigator;
