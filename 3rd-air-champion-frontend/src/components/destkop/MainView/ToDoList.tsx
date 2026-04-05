import { useEffect, useState } from "react";
import { dayType } from "../../../util/types/dayType";
import { bookingType } from "../../../util/types/bookingType";
import { addDays, startOfToday, format } from "date-fns";

interface ToDoListProps {
  monthMap: Map<string, dayType>;
}

const ToDoList = ({ monthMap }: ToDoListProps) => {
  const [upcomingDays, setUpcomingDays] = useState<dayType[]>([]);
  const [checkoutBookings, setCheckoutBookings] = useState<bookingType[]>([]);

  const [completedTasks, setCompletedTasks] = useState<
    Record<string, { completed: boolean; date: string | null }>
  >(() => JSON.parse(localStorage.getItem("completedTasks") || "{}"));

  useEffect(() => {
    const dates = [1, 2].map((days) => {
      const dateKey = addDays(startOfToday(), days).toISOString().split("T")[0];
      return monthMap.get(dateKey);
    });
    setUpcomingDays(dates.filter((day) => day !== undefined) as dayType[]);

    const yesterdayKey = addDays(startOfToday(), -1).toISOString().split("T")[0];
    const yesterdayDay = monthMap.get(yesterdayKey);
    setCheckoutBookings(
      yesterdayDay?.bookings.filter(
        (booking) => booking.endDate.split("T")[0] === yesterdayKey
      ) ?? []
    );
  }, [monthMap]);

  useEffect(() => {
    localStorage.setItem("completedTasks", JSON.stringify(completedTasks));
  }, [completedTasks]);

  const toggleTaskCompletion = (taskId: string) => {
    const currentDate = format(startOfToday(), "MM/dd/yyyy");
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
    roomId: string
  ) => `${startDate}-${endDate}-${guestId}-${roomId}`;

  const generateCleaningTaskId = (endDate: string, roomId: string) =>
    `clean-${endDate}-${roomId}`;

  const upcomingDates = [1, 2].map(
    (days) => addDays(startOfToday(), days).toISOString().split("T")[0]
  );

  const hasAnything = upcomingDays.length > 0 || checkoutBookings.length > 0;

  return hasAnything ? (
    <div className="flex flex-col h-full px-2 overflow-y-scroll">
      <h1 className="font-bold self-center text-lg">
        To Do for Today ({format(startOfToday(), "MM/dd/yyyy")})
      </h1>

      {upcomingDays.flatMap((day, dayIndex) =>
        day.bookings.map((booking, index) => {
          const taskId = generateTaskId(
            booking.startDate,
            booking.endDate,
            booking.guest.id,
            booking.room.id
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
                  <p className="text-sm text-gray-600">In 24-hour</p>
                  {isCompleted && (
                    <p className="text-sm">Sent on {task.date}</p>
                  )}
                </div>
              </div>
              <div className="basis-1/5">
                {booking.description === "" ? (
                  <button
                    className="rounded-full shadow-md bg-black text-white font-semibold h-[64px] w-[64px] text-[0.6rem]"
                    onClick={() => {
                      const roomCodes = new Map([
                        ["chill", "(0205#)"],
                        ["cozy", "(0106#)"],
                        ["cute", "(2005#)"],
                        ["master", "(0209#)"],
                      ]);
                      const phone = booking.guest.phone;

                      // Regular message
                      // const messageBody = encodeURIComponent(
                      //   `Hello ${
                      //     booking.guest.name
                      //   }, I would like to remind you that you will stay at TT house AirBnB for ${
                      //     booking.duration > 1
                      //       ? `${booking.duration} nights, starting ${
                      //           reminderType === "48-hour"
                      //             ? "in 2 days"
                      //             : "tomorrow"
                      //         }.`
                      //       : reminderType === "48-hour"
                      //       ? "the day after tomorrow."
                      //       : "tomorrow night."
                      //   } Your room is ${booking.room.name} ${
                      //     roomCodes.get(booking.room.name.toLowerCase()) ||
                      //     "Code"
                      //   }. The main entrance door code is 1268=. I wish you a pleasant stay. Thanks!`
                      // );

                      // Construction message
                      const constructionMessage = encodeURIComponent(
                        `Hello ${
                          booking.guest.name
                        }, I would like to remind you that you will stay at TT house AirBnB for ${
                          booking.duration > 1
                            ? `${booking.duration} nights, starting tomorrow`
                            : "tomorrow night"
                        }. Your room is ${booking.room.name} ${
                          roomCodes.get(booking.room.name.toLowerCase()) ||
                          "Code"
                        }. During the construction, please use the garage door to enter the house. The garage door opener code is 1268Enter. Please note that the last character is Enter. Please enter the code slowly and firmly to the key pad. Many thanks for staying at TT House. I wish you a pleasant stay!`
                      );

                      window.location.href = `sms:${phone}?&body=${constructionMessage}`;
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
                        /https:\/\/www\.airbnb\.com\/hosting\/reservations\/details\/\S+/
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
        })
      )}

      {checkoutBookings.length > 0 && (
        <>
          <h2 className="font-bold self-center text-md mt-4 mb-1">
            Rooms to Clean
          </h2>
          {checkoutBookings
            .map((booking) => {
              let nextCheckIn: bookingType | null = null;
              let nextCheckInDate: string | null = null;
              for (let i = 0; i <= 30; i++) {
                const dateKey = addDays(startOfToday(), i).toISOString().split("T")[0];
                const day = monthMap.get(dateKey);
                if (day) {
                  const found = day.bookings.find(
                    (b) => b.startDate.split("T")[0] === dateKey && b.room.id === booking.room.id
                  );
                  if (found) {
                    nextCheckIn = found;
                    nextCheckInDate = dateKey;
                    break;
                  }
                }
              }
              return { booking, nextCheckIn, nextCheckInDate };
            })
            .sort((a, b) => {
              const priorityOf = (item: typeof a) => {
                if (item.nextCheckIn?.earlyCheckin) return 0;
                if (item.booking.lateCheckout) return 2;
                return 1;
              };
              return priorityOf(a) - priorityOf(b);
            })
            .map(({ booking, nextCheckIn, nextCheckInDate }, index) => {
            const cleaningTaskId = generateCleaningTaskId(
              booking.endDate,
              booking.room.id
            );
            const task = completedTasks[cleaningTaskId] || {
              completed: false,
              date: null,
            };
            const isCompleted = task.completed;

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
                    className="mr-2"
                    checked={isCompleted}
                    onChange={() => toggleTaskCompletion(cleaningTaskId)}
                  />
                  <div className="flex flex-col">
                    {booking.room.name}
                    {nextCheckIn && nextCheckInDate ? (
                      <p className="text-sm text-gray-600">
                        {nextCheckIn.guest.alias || nextCheckIn.alias || nextCheckIn.guest.name}{" "}
                        checking in on {format(new Date(nextCheckInDate + "T00:00:00"), "MM/dd")}{" "}
                        &mdash;{" "}
                        <span className="font-bold text-black">
                          {nextCheckIn.numberOfGuests}{" "}
                          {nextCheckIn.numberOfGuests === 1 ? "person" : "persons"}
                        </span>
                      </p>
                    ) : (
                      <p className="text-sm text-gray-600">No upcoming check-in</p>
                    )}
                    {nextCheckIn?.earlyCheckin && (
                      <p className="text-sm font-semibold text-orange-500">Early Check-in Requested</p>
                    )}
                    {booking.lateCheckout && (
                      <p className="text-sm font-semibold text-blue-500">Late Checkout Requested</p>
                    )}
                    {isCompleted && (
                      <p className="text-sm">Cleaned on {task.date}</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </>
      )}
    </div>
  ) : (
    <div className="flex items-center justify-center h-full w-full">
      Nothing to Do
    </div>
  );
};

export default ToDoList;