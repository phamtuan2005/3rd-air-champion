import { useEffect, useState } from "react";
import { dayType } from "../../../util/types/dayType";
import { addDays, startOfToday, format } from "date-fns";

interface ToDoListProps {
  monthMap: Map<string, dayType>;
}

const ToDoList = ({ monthMap }: ToDoListProps) => {
  const [upcomingDays, setUpcomingDays] = useState<dayType[]>([]);

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

  const upcomingDates = [1, 2].map(
    (days) => addDays(startOfToday(), days).toISOString().split("T")[0]
  );

  return upcomingDays.length > 0 ? (
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

          const isUpcomingForAirBnB =
            isAirBnB &&
            (booking.startDate === upcomingDates[0] ||
              booking.startDate === upcomingDates[1]) &&
            day.date.toString() === booking.startDate;

          const isUpcomingForNonAirBnB =
            !isAirBnB &&
            booking.startDate === upcomingDates[0] &&
            day.date.toString() === upcomingDates[0];

          const shouldShowReminder =
            isUpcomingForAirBnB || isUpcomingForNonAirBnB;

          if (!shouldShowReminder) return null;

          const reminderType =
            booking.startDate === upcomingDates[1] ? "48-hour" : "24-hour";

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
                  <p className="text-sm text-gray-600">In {reminderType}</p>
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
                        ["king", "(1224#)"],
                        ["queen", "(1225#)"]
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
                            ? `${booking.duration} nights, starting ${
                                reminderType === "48-hour"
                                  ? "in 2 days"
                                  : "tomorrow"
                              }.`
                            : reminderType === "48-hour"
                            ? "the day after tomorrow."
                            : "tomorrow night."
                        } Your room is ${booking.room.name} ${
                          roomCodes.get(booking.room.name.toLowerCase()) ||
                          "Code"
                        }. The main entrance door code is 1268=. Many thanks for staying at TT House. I wish you a pleasant stay!`
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
    </div>
  ) : (
    <div className="flex items-center justify-center h-full w-full">
      Nothing to Do
    </div>
  );
};

export default ToDoList;
