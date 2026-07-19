import { useEffect, useMemo, useRef, useState } from "react";
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

type TabKey = "reminders" | "cleaning" | "forecast";

const ToDoList = ({ monthMap, doorCode, airbnbName, airbnbAddress, houseRules = "" }: ToDoListProps) => {
  // Reminders / Cleaning = today's actionable tasks; Forecast = planning info.
  const [activeTab, setActiveTab] = useState<TabKey>("reminders");

  const [completedTasks, setCompletedTasks] = useState<
    Record<string, { completed: boolean; date: string | null }>
  >(() => JSON.parse(localStorage.getItem("completedTasks") || "{}"));

  const tomorrowKey = addDays(startOfToday(), 1).toISOString().split("T")[0];

  // Guests checking in tomorrow who get a reminder SMS (AirBnB guests are
  // reminded through the platform instead).
  const reminderBookings = useMemo(() => {
    const day = monthMap.get(tomorrowKey);
    if (!day || day.date.toString().split("T")[0] !== tomorrowKey) return [];
    return day.bookings.filter(
      (booking) =>
        booking.room != null &&
        booking.guest.name !== "AirBnB" &&
        booking.startDate === tomorrowKey,
    );
  }, [monthMap, tomorrowKey]);

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

  // Once data arrives, open on the first tab that has work (Reminders →
  // Cleaning → Upcoming). Runs once; never overrides a tab the user tapped.
  const autoTabDone = useRef(false);
  useEffect(() => {
    if (autoTabDone.current || monthMap.size === 0) return;
    autoTabDone.current = true;
    if (reminderBookings.length === 0) {
      if (cleaningItems.length > 0) setActiveTab("cleaning");
      else if (forecastTotal > 0) setActiveTab("forecast");
    }
  }, [monthMap, reminderBookings, cleaningItems, forecastTotal]);

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

  const tabs: { key: TabKey; label: string; count: number }[] = [
    { key: "reminders", label: "Reminders", count: reminderBookings.length },
    { key: "cleaning", label: "Cleaning", count: cleaningCounts.max },
    { key: "forecast", label: "Upcoming", count: forecastTotal },
  ];

  const emptyState = (message: string) => (
    <div className="flex flex-1 items-center justify-center py-10 text-sm text-gray-400">
      {message}
    </div>
  );

  return (
    <div className="flex h-full flex-col overflow-y-auto px-3 pb-3">
      <div className="pb-2 pt-3 text-center">
        <h1 className="text-lg font-bold tracking-tight text-gray-900">To Do</h1>
        <p className="text-xs text-gray-400">{format(startOfToday(), "EEEE, MMMM d, yyyy")}</p>
      </div>

      <div className="mb-3 grid shrink-0 grid-cols-3 gap-1 rounded-xl bg-gray-100 p-1">
        {tabs.map(({ key, label, count }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold transition-colors ${
              activeTab === key ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
            }`}
          >
            {label}
            {count > 0 && (
              <span
                className={`min-w-[1.25rem] rounded-full px-1 py-0.5 text-center text-[10px] font-bold leading-none ${
                  activeTab === key ? "bg-gray-900 text-white" : "bg-gray-200 text-gray-600"
                }`}
              >
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {activeTab === "reminders" &&
        (reminderBookings.length > 0 ? (
          <>
            <p className="mb-2 text-center text-xs text-gray-400">
              Guests checking in tomorrow ({format(addDays(startOfToday(), 1), "MMM d")})
            </p>
            {reminderBookings.map((booking, index) => {
              const taskId = generateTaskId(
                booking.startDate,
                booking.endDate,
                booking.guest.id,
                booking.room.id,
              );
              const task = completedTasks[taskId] || { completed: false, date: null };
              const isCompleted = task.completed;

              return (
                <div
                  key={`reminder-${index}`}
                  className={`mb-2 flex items-center gap-3 rounded-xl border border-gray-200 p-3 ${
                    isCompleted ? "bg-gray-50" : "bg-white"
                  }`}
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4 shrink-0 accent-black"
                    checked={isCompleted}
                    onChange={() => toggleTaskCompletion(taskId)}
                  />
                  <div className="min-w-0 flex-1">
                    <p
                      className={`truncate text-sm font-semibold ${
                        isCompleted ? "text-gray-400 line-through" : "text-gray-900"
                      }`}
                    >
                      {booking.guest.alias || booking.alias || booking.guest.name}
                    </p>
                    <span
                      className={`${getRoomColor(booking.room.name, booking.room.color)} mt-0.5 inline-block rounded-md px-2 py-0.5 text-xs font-bold text-black`}
                    >
                      {booking.room.name}
                    </span>
                    {isCompleted && (
                      <p className="mt-0.5 text-xs text-gray-400">Sent on {task.date}</p>
                    )}
                  </div>
                  {!booking.description ? (
                    <button
                      className="shrink-0 rounded-lg bg-gray-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"
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
                      className="shrink-0 rounded-lg bg-gray-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"
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
              );
            })}
          </>
        ) : (
          emptyState("No check-ins tomorrow")
        ))}

      {activeTab === "cleaning" &&
        (cleaningItems.length > 0 ? (
          <>
            {cleaningCounts.min !== cleaningCounts.max && (
              <p className="mb-2 text-center text-xs text-gray-400">
                min {cleaningCounts.min} before today&apos;s check-ins · max {cleaningCounts.max} total
              </p>
            )}
            {cleaningItems.map((item, index) => {
              const { booking, nextCheckIn, nextCheckInDate } = item;
              const taskId = cleaningTaskId(booking.endDate, booking.room?.id ?? "");
              const isCompleted = item.isCompleted;

              return (
                <div
                  key={`clean-${index}`}
                  className={`mb-2 flex items-start gap-3 rounded-xl border border-gray-200 p-3 ${
                    isCompleted ? "bg-gray-50" : "bg-white"
                  }`}
                >
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 shrink-0 accent-black"
                    checked={isCompleted}
                    onChange={() => toggleTaskCompletion(taskId)}
                  />
                  <div
                    className={`flex min-w-0 flex-1 flex-col gap-0.5 ${
                      isCompleted ? "text-gray-400 line-through" : ""
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`${getRoomColor(booking.room.name, booking.room.color)} rounded-md px-2 py-0.5 text-xs font-bold ${
                          nextCheckIn?.guest.name === "AirBnB" ? "text-white" : "text-black"
                        }`}
                      >
                        {booking.room.name}
                      </span>
                      {nextCheckIn && (
                        <span className="text-xs text-gray-500">
                          {nextCheckIn.numberOfGuests}{" "}
                          {nextCheckIn.numberOfGuests === 1 ? "person" : "persons"}
                        </span>
                      )}
                    </div>
                    {/* Scenario: turnover this morning vs sitting empty since an earlier checkout */}
                    {item.vacatedToday ? (
                      <p className="text-xs text-gray-500">Checked out this morning</p>
                    ) : (
                      <p className="text-xs font-semibold text-amber-600">
                        Empty since {format(addDays(new Date(item.checkoutKey + "T00:00:00"), 1), "MM/dd")} — not cleaned yet
                      </p>
                    )}
                    {nextCheckIn && nextCheckInDate ? (
                      <p
                        className={`text-xs ${
                          item.mustCleanToday ? "font-semibold text-red-500" : "text-gray-500"
                        }`}
                      >
                        {nextCheckIn.guest.alias || nextCheckIn.alias || nextCheckIn.guest.name}{" "}
                        checking in {item.mustCleanToday ? "TODAY" : `on ${format(new Date(nextCheckInDate + "T00:00:00"), "MM/dd")}`}
                      </p>
                    ) : (
                      <p className="text-xs text-gray-500">No upcoming check-in</p>
                    )}
                    {nextCheckIn?.earlyCheckin && (
                      <p className="text-xs font-semibold text-orange-500">
                        Early Check-in Requested
                      </p>
                    )}
                    {booking.lateCheckout && (
                      <p className="text-xs font-semibold text-blue-500">
                        {booking.guest.name === "AirBnB"
                          ? booking.guest.alias || booking.alias || booking.guest.name
                          : booking.guest.name}{" "}
                        requested late checkout
                      </p>
                    )}
                    {isCompleted && (
                      <p className="text-xs text-gray-400">Cleaned on {item.completedDate}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </>
        ) : (
          emptyState("All rooms clean")
        ))}

      {activeTab === "forecast" &&
        (cleaningForecast.length > 0 ? (
          <>
            <p className="mb-2 text-center text-xs text-gray-400">
              Every checkout counts — empty nights get rebooked ·{" "}
              <span className="font-semibold text-red-500">red ring</span> = same-day check-in
              booked
            </p>
            {cleaningForecast.map((day) => {
              const morning = new Date(day.morningKey + "T00:00:00");
              return (
                <div
                  key={day.morningKey}
                  className="mb-1 flex items-center gap-2.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1"
                >
                  <div className="flex w-16 shrink-0 items-baseline gap-1">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                      {format(morning, "EEE")}
                    </span>
                    <span className="text-xs font-bold text-gray-900">{format(morning, "M/d")}</span>
                  </div>
                  <div className="flex flex-1 flex-wrap gap-1">
                    {day.entries.map((entry, i) => (
                      <span
                        key={i}
                        className={`${getRoomColor(entry.checkoutBooking.room.name, entry.checkoutBooking.room.color)} rounded px-1.5 py-0.5 text-[11px] font-semibold text-black ${
                          entry.sameDayCheckIn ? "ring-2 ring-red-500" : ""
                        }`}
                      >
                        {entry.checkoutBooking.room.name}
                      </span>
                    ))}
                  </div>
                  <span className="shrink-0 text-xs font-bold text-gray-700">
                    {day.entries.length}
                  </span>
                </div>
              );
            })}
          </>
        ) : (
          emptyState("No checkouts in the next 7 days")
        ))}
    </div>
  );
};

export default ToDoList;
