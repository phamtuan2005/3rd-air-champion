import { useEffect, useMemo, useState } from "react";
import { dayType } from "../../../util/types/dayType";
import { addDays, startOfToday, format } from "date-fns";
import { getRoomColor } from "../../../util/getRoomColor";
import { DEFAULT_TEMPLATE, TEMPLATE_KEY, resolveTemplate } from "../../../util/reminderTemplate";
import { cleaningTaskId, getCleaningCounts, getCleaningForecast, getCleaningItems } from "../../../util/cleaningTasks";

interface ToDoListProps {
  monthMap: Map<string, dayType>;
  doorCode: string;
  airbnbName: string;
  airbnbAddress: string;
  houseRules?: string;
}

const ToDoList = ({ monthMap, doorCode, airbnbName, airbnbAddress, houseRules = "" }: ToDoListProps) => {
  const [upcomingDays, setUpcomingDays] = useState<dayType[]>([]);
  // Today = actionable tasks; Forecast = planning info. Split into tabs so the
  // forecast never crowds today's list.
  const [activeTab, setActiveTab] = useState<"today" | "forecast">("today");

  const [completedTasks, setCompletedTasks] = useState<
    Record<string, { completed: boolean; date: string | null }>
  >(() => JSON.parse(localStorage.getItem("completedTasks") || "{}"));

  useEffect(() => {
    const dates = [1, 2].map((days) => {
      const dateKey = addDays(startOfToday(), days).toISOString().split("T")[0];
      return monthMap.get(dateKey);
    });
    setUpcomingDays(dates.filter((day) => day !== undefined) as dayType[]);
  }, [monthMap]);

  // All rooms needing cleaning: today's checkouts + rooms vacated earlier that were
  // never marked cleaned (the old logic assumed an empty room was never occupied).
  const cleaningItems = useMemo(
    () => getCleaningItems(monthMap, completedTasks),
    [monthMap, completedTasks],
  );
  const cleaningCounts = getCleaningCounts(cleaningItems);

  // Next 7 mornings of expected cleanings — every checkout counts (at ~100%
  // occupancy, empty nights after a checkout get rebooked last-minute), so the
  // cleaner schedule can be planned before the bookings materialize.
  const cleaningForecast = useMemo(() => getCleaningForecast(monthMap), [monthMap]);
  const forecastTotal = cleaningForecast.reduce((sum, d) => sum + d.entries.length, 0);

  useEffect(() => {
    localStorage.setItem("completedTasks", JSON.stringify(completedTasks));
  }, [completedTasks]);

  const toggleTaskCompletion = (taskId: string) => {
    const currentDate = format(startOfToday(), "MMM d, yyyy");
    setCompletedTasks((prev) => ({
      ...prev,
      [taskId]: {
        completed: !prev[taskId]?.completed,
        date: !prev[taskId]?.completed ? currentDate : null,
      },
    }));
  };

  const generateTaskId = (
    startDate: string,
    endDate: string,
    guestId: string,
    roomId: string,
  ) => `${startDate}-${endDate}-${guestId}-${roomId}`;

  const upcomingDates = [1, 2].map(
    (days) => addDays(startOfToday(), days).toISOString().split("T")[0],
  );

  const hasAnything =
    upcomingDays.length > 0 || cleaningItems.length > 0 || cleaningForecast.length > 0;

  return hasAnything ? (
    <div className="flex flex-col h-full px-2 overflow-y-scroll">
      <h1 className="font-bold self-center text-lg">
        To Do for Today ({format(startOfToday(), "MMM d, yyyy")})
      </h1>

      <div className="flex self-center gap-1 mt-1 mb-2 bg-gray-100 rounded-full p-0.5">
        {(["today", "forecast"] as const).map((tab) => (
          <button
            key={tab}
            className={`px-4 py-1 rounded-full text-sm font-semibold ${
              activeTab === tab ? "bg-white shadow" : "text-gray-500"
            }`}
            onClick={() => setActiveTab(tab)}
          >
            {tab === "today" ? "Today" : `Forecast · ${forecastTotal}`}
          </button>
        ))}
      </div>

      {activeTab === "today" && (
        <>
      {upcomingDays.flatMap((day, dayIndex) =>
        day.bookings.map((booking, index) => {
          if (!booking.room) return null;
          const taskId = generateTaskId(
            booking.startDate,
            booking.endDate,
            booking.guest.id,
            booking.room.id,
          );

          const task = completedTasks[taskId] || {
            completed: false,
            date: null,
          };
          const isCompleted = task.completed;

          const isAirBnB = booking.guest.name === "AirBnB";

          const shouldShowReminder =
            !isAirBnB &&
            booking.startDate === upcomingDates[0] &&
            day.date.toString().split("T")[0] === upcomingDates[0];

          if (!shouldShowReminder) return null;

          return (
            <div
              key={`${dayIndex}-${index}`}
              className={`h-full w-full border-b border-solid flex justify-center items-center ${
                isCompleted ? "bg-gray-200" : ""
              }`}
            >
              <div
                className={`basis-4/5 font-bold text-lg flex ${
                  isCompleted ? "line-through text-gray-500" : ""
                }`}
              >
                <input
                  type="checkbox"
                  className="mr-2"
                  checked={isCompleted}
                  onChange={() => toggleTaskCompletion(taskId)}
                />
                <div className="flex flex-col">
                  {booking.guest.alias || booking.alias || booking.guest.name} (
                  {booking.room.name})
                  {isCompleted && (
                    <p className="text-sm">Sent on {task.date}</p>
                  )}
                </div>
              </div>
              <div className="basis-1/5">
                {!booking.description ? (
                  <button
                    className="rounded-full shadow-md bg-black text-white font-semibold h-[64px] w-[64px] text-[0.6rem]"
                    onClick={() => {
                      const phone = booking.guest.phone;
                      const startDate = format(addDays(startOfToday(), 1), "MMMM do");
                      const currentTemplate = localStorage.getItem(TEMPLATE_KEY) || DEFAULT_TEMPLATE;
                      const message = resolveTemplate(currentTemplate, booking, startDate, doorCode, airbnbName, airbnbAddress, houseRules);
                      window.location.href = `sms:${phone}?&body=${encodeURIComponent(message)}`;
                      toggleTaskCompletion(taskId);
                    }}
                    disabled={isCompleted}
                  >
                    Send Reminder
                  </button>
                ) : (
                  <button
                    className="rounded-full shadow-md bg-black text-white font-semibold h-[64px] w-[64px] text-[0.6rem]"
                    onClick={() => {
                      const url = booking.description.match(
                        /https:\/\/www\.airbnb\.com\/hosting\/reservations\/details\/\S+/,
                      )?.[0];
                      if (url) {
                        window.open(url, "_blank", "noopener,noreferrer");
                      } else {
                        alert("No valid URL found in the description.");
                      }
                    }}
                    disabled={isCompleted}
                  >
                    Booking Details
                  </button>
                )}
              </div>
            </div>
          );
        }),
      )}

      {cleaningItems.length > 0 && (
        <>
          <h2 className="font-bold self-center text-md mt-4 mb-0.5">
            Rooms to Clean: {cleaningCounts.min === cleaningCounts.max
              ? cleaningCounts.max
              : `${cleaningCounts.min}–${cleaningCounts.max}`}
          </h2>
          {cleaningCounts.min !== cleaningCounts.max && (
            <p className="self-center text-xs text-gray-400 mb-1">
              min {cleaningCounts.min} before today&apos;s check-ins · max {cleaningCounts.max} total
            </p>
          )}
          {(() => {
            const maxLabelLen = Math.max(
              ...cleaningItems.map(({ booking: b, nextCheckIn: n }) => {
                const label = `${b.room.name}${n ? `, ${n.numberOfGuests} ${n.numberOfGuests === 1 ? "person" : "persons"}` : ""}`;
                return label.length;
              }),
            );

            return cleaningItems.map((item, index) => {
              const { booking, nextCheckIn, nextCheckInDate } = item;
              const taskId = cleaningTaskId(booking.endDate, booking.room?.id ?? "");
              const isCompleted = item.isCompleted;

              return (
                <div
                  key={`clean-${index}`}
                  className={`h-full w-full border-b border-solid flex justify-center items-center ${
                    isCompleted ? "bg-gray-200" : ""
                  }`}
                >
                  <div
                    className={`basis-full font-bold text-lg flex ${
                      isCompleted ? "line-through text-gray-500" : ""
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="mr-2 shrink-0"
                      checked={isCompleted}
                      onChange={() => toggleTaskCompletion(taskId)}
                    />
                    <div className="flex flex-col">
                      <div className={`${getRoomColor(booking.room.name, booking.room.color)} ${nextCheckIn?.guest.name === "AirBnB" ? "text-white" : "text-black"} p-1 rounded-md`} style={{ width: `${maxLabelLen}ch`, maxWidth: '50vw' }}>
                        {booking.room.name}
                        {nextCheckIn && `, ${nextCheckIn.numberOfGuests} ${nextCheckIn.numberOfGuests === 1 ? "person" : "persons"}`}
                      </div>
                      {/* Scenario: turnover this morning vs sitting empty since an earlier checkout */}
                      {item.vacatedToday ? (
                        <p className="text-sm text-gray-600">Checked out this morning</p>
                      ) : (
                        <p className="text-sm font-semibold text-amber-600">
                          Empty since {format(addDays(new Date(item.checkoutKey + "T00:00:00"), 1), "MM/dd")} — not cleaned yet
                        </p>
                      )}
                      {nextCheckIn && nextCheckInDate ? (
                        <p className={`text-sm ${item.mustCleanToday ? "font-semibold text-red-500" : "text-gray-600"}`}>
                          {nextCheckIn.guest.alias ||
                            nextCheckIn.alias ||
                            nextCheckIn.guest.name}{" "}
                          checking in {item.mustCleanToday ? "TODAY" : `on ${format(new Date(nextCheckInDate + "T00:00:00"), "MM/dd")}`}
                        </p>
                      ) : (
                        <p className="text-sm text-gray-600">
                          No upcoming check-in
                        </p>
                      )}
                      {nextCheckIn?.earlyCheckin && (
                        <p className="text-sm font-semibold text-orange-500">
                          Early Check-in Requested
                        </p>
                      )}
                      {booking.lateCheckout && (
                        <p className="text-sm font-semibold text-blue-500">
                          {booking.guest.name === "AirBnB"
                            ? booking.guest.alias ||
                              booking.alias ||
                              booking.guest.name
                            : booking.guest.name}{" "}
                          requested late checkout
                        </p>
                      )}
                      {isCompleted && (
                        <p className="text-sm">Cleaned on {item.completedDate}</p>
                      )}
                    </div>
                  </div>
                </div>
              );
            });
          })()}
        </>
      )}

      {upcomingDays.length === 0 && cleaningItems.length === 0 && (
        <div className="flex flex-1 items-center justify-center text-gray-400">
          Nothing to do today
        </div>
      )}
        </>
      )}

      {activeTab === "forecast" &&
        (cleaningForecast.length > 0 ? (
        <>
          <p className="self-center text-xs text-gray-400 mb-1">
            every checkout counts — empty nights get rebooked · red ring = same-day check-in booked
          </p>
          {cleaningForecast.map((day) => (
            <div
              key={day.morningKey}
              className="w-full border-b border-solid flex items-center gap-2 py-1"
            >
              <span className="font-semibold text-sm w-16 shrink-0">
                {format(new Date(day.morningKey + "T00:00:00"), "EEE M/d")}
              </span>
              <span className="font-bold text-sm w-4 shrink-0 text-center">
                {day.entries.length}
              </span>
              <div className="flex flex-wrap gap-1">
                {day.entries.map((entry, i) => (
                  <span
                    key={i}
                    className={`${getRoomColor(entry.checkoutBooking.room.name, entry.checkoutBooking.room.color)} text-black text-xs font-semibold px-1.5 py-0.5 rounded-md ${
                      entry.sameDayCheckIn ? "ring-2 ring-red-500" : ""
                    }`}
                  >
                    {entry.checkoutBooking.room.name}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </>
      ) : (
        <div className="flex flex-1 items-center justify-center text-gray-400">
          No checkouts in the next 7 days
        </div>
      ))}
    </div>
  ) : (
    <div className="flex items-center justify-center h-full w-full">
      Nothing to Do
    </div>
  );
};

export default ToDoList;
