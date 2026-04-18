import { useEffect, useState } from "react";
import { dayType } from "../../../../util/types/dayType";
import { bookingType } from "../../../../util/types/bookingType";
import { addDays, format } from "date-fns";
import { getRoomColor } from "../../../../util/getRoomColor";

interface RoomsToCleanProps {
  selectedDate: Date;
  monthMap: Map<string, dayType>;
}

const RoomsToClean = ({ selectedDate, monthMap }: RoomsToCleanProps) => {
  const [checkoutBookings, setCheckoutBookings] = useState<bookingType[]>([]);

  const [completedTasks, setCompletedTasks] = useState<
    Record<string, { completed: boolean; date: string | null }>
  >(() => JSON.parse(localStorage.getItem("completedTasks") || "{}"));

  useEffect(() => {
    const yesterdayKey = addDays(selectedDate, -1).toISOString().split("T")[0];
    const yesterdayDay = monthMap.get(yesterdayKey);
    setCheckoutBookings(
      yesterdayDay?.bookings.filter(
        (booking) => booking.endDate.split("T")[0] === yesterdayKey,
      ) ?? [],
    );
  }, [monthMap, selectedDate]);

  useEffect(() => {
    localStorage.setItem("completedTasks", JSON.stringify(completedTasks));
  }, [completedTasks]);

  const toggleTaskCompletion = (taskId: string) => {
    const currentDate = format(selectedDate, "MM/dd/yyyy");
    setCompletedTasks((prev) => ({
      ...prev,
      [taskId]: {
        completed: !prev[taskId]?.completed,
        date: !prev[taskId]?.completed ? currentDate : null,
      },
    }));
  };

  const generateCleaningTaskId = (endDate: string, roomId: string) =>
    `clean-${endDate}-${roomId}`;

  if (checkoutBookings.length === 0) return null;

  const items = checkoutBookings
    .map((booking) => {
      let nextCheckIn: bookingType | null = null;
      let nextCheckInDate: string | null = null;
      for (let i = 0; i <= 30; i++) {
        const dateKey = addDays(selectedDate, i).toISOString().split("T")[0];
        const day = monthMap.get(dateKey);
        if (day) {
          const found = day.bookings.find(
            (b) =>
              b.startDate.split("T")[0] === dateKey &&
              b.room.id === booking.room.id,
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
    });

  const maxLabelLen = Math.max(
    ...items.map(({ booking: b, nextCheckIn: n }) => {
      const label = `${b.room.name}${n ? `, ${n.numberOfGuests} ${n.numberOfGuests === 1 ? "person" : "persons"}` : ""}`;
      return label.length;
    }),
  );

  return (
    <div className="flex flex-col px-2">
      <h2 className="font-bold self-center text-md mt-4 mb-1">
        {checkoutBookings.length} Rooms to Clean
      </h2>
      {items.map(({ booking, nextCheckIn, nextCheckInDate }, index) => {
        const cleaningTaskId = generateCleaningTaskId(
          booking.endDate,
          booking.room.id,
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
                className="mr-2 shrink-0"
                checked={isCompleted}
                onChange={() => toggleTaskCompletion(cleaningTaskId)}
              />
              <div className="flex flex-col">
                <div
                  className={`${getRoomColor(booking.room.name, booking.room.color)} ${nextCheckIn?.guest.name === "AirBnB" ? "text-white" : "text-black"} p-1 rounded-md`}
                  style={{ width: `${maxLabelLen}ch`, maxWidth: '50vw' }}
                >
                  {booking.room.name}
                  {nextCheckIn && `, ${nextCheckIn.numberOfGuests} ${nextCheckIn.numberOfGuests === 1 ? "person" : "persons"}`}
                </div>
                {nextCheckIn && nextCheckInDate ? (
                  <p className="text-sm text-gray-600">
                    {nextCheckIn.guest.alias ||
                      nextCheckIn.alias ||
                      nextCheckIn.guest.name}{" "}
                    checking in on{" "}
                    {format(new Date(nextCheckInDate + "T00:00:00"), "MM/dd")}
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
                  <p className="text-sm">Cleaned on {task.date}</p>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default RoomsToClean;