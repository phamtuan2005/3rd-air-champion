import { SubmitHandler, useForm } from "react-hook-form";
import { bookingType } from "../../util/types/bookingType";
import {
  modifyBookingObject,
  modifyBookingSchema,
} from "./zodModifyBooking";
import { zodResolver } from "@hookform/resolvers/zod";
import { addDays, differenceInDays, format, isAfter } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { dayType } from "../../util/types/dayType";
import { roomType } from "../../util/types/roomType";
import { postBooking, updateUnbookGuest } from "../../util/bookingOperations";
import { useMemo, useState } from "react";

interface ModifyBookingModalProps {
  calendarId: string;
  monthMap: Map<string, dayType>;
  rooms: roomType[];
  selectedModifyBooking: bookingType;
  onBooking: (
    roomName: string,
    date: Date,
    duration: number,
    bookedDays: dayType[],
  ) => void;
  setSelectedModifyBooking: React.Dispatch<
    React.SetStateAction<bookingType | null>
  >;
}

const ModifyBookingModal = ({
  calendarId,
  monthMap,
  rooms,
  selectedModifyBooking,
  onBooking,
  setSelectedModifyBooking,
}: ModifyBookingModalProps) => {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<modifyBookingSchema>({
    resolver: zodResolver(modifyBookingObject),
    defaultValues: {
      room: selectedModifyBooking.room.id,
      duration: selectedModifyBooking.duration,
    },
  });
  const [bookingErrorMessage, setBookingErrorMessage] = useState("");

  const token = localStorage.getItem("token");

  const watchedStartDate = watch("startDate");
  const watchedDuration = watch("duration");

  const unavailableRoomIds = useMemo(() => {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const start = watchedStartDate
      ? toZonedTime(watchedStartDate, timeZone)
      : toZonedTime(selectedModifyBooking.startDate, timeZone);
    const duration = watchedDuration ?? selectedModifyBooking.duration;
    const blocked = new Set<string>();
    for (let i = 0; i < duration; i++) {
      const dayKey = addDays(start, i).toISOString().split("T")[0];
      const day = monthMap.get(dayKey);
      if (day) {
        day.bookings.forEach((b) => {
          if (b.guest.id !== selectedModifyBooking.guest.id) {
            blocked.add(b.room.id);
          }
        });
      }
    }
    return blocked;
  }, [watchedStartDate, watchedDuration, monthMap, selectedModifyBooking]);

  const onSubmit: SubmitHandler<modifyBookingSchema> = (data) => {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    const bookingIds = new Set<string>();
    const startDate = toZonedTime(selectedModifyBooking.startDate, timeZone);

    for (let i = 0; i < selectedModifyBooking.duration; i++) {
      const currentDay = monthMap.get(
        addDays(startDate, i).toISOString().split("T")[0],
      );

      if (currentDay) {
        currentDay.bookings.forEach((b) => {
          if (
            b.guest.id === selectedModifyBooking.guest.id &&
            b.room.id === selectedModifyBooking.room.id
          ) {
            bookingIds.add(b.id); // Collect the booking ID
          }
        });
      }
    }

    // Create a search map for room bookings
    const searchMap = new Map<string, { guestId: string; bookingId: string }>(); // Map of date to guest ID
    monthMap.forEach((day, date) => {
      day.bookings.forEach((booking) => {
        if (booking.room.id === data.room) {
          searchMap.set(date, {
            guestId: booking.guest.id,
            bookingId: booking.id,
          }); // Map date to guest ID
        }
      });
    });

    // Check for conflicts
    for (let i = 0; i < data.duration; i++) {
      const currentDate = addDays(toZonedTime(data.startDate, timeZone), i)
        .toISOString()
        .split("T")[0];

      const mapEntry = searchMap.get(currentDate);

      if (mapEntry) {
        if (mapEntry.guestId !== selectedModifyBooking.guest.id) {
          // Conflict detected
          setBookingErrorMessage(`Conflict detected on ${currentDate}.`);
          console.error(`Conflict detected on ${currentDate}.`);
          return; // Stop processing if a conflict is found
        } else {
          // Same guest, add booking ID to the set
          bookingIds.add(mapEntry.bookingId);
        }
      }
    }

    // Reset Error
    setBookingErrorMessage("");

    const bookingData: {
      date: Date;
      room: string;
      guest: string;
      isAirBnB: boolean;
      duration: number;
      numberOfGuests: number;
    } = {
      date: data.startDate,
      room: data.room,
      guest: selectedModifyBooking.guest.id,
      isAirBnB: false,
      duration: data.duration,
      numberOfGuests: selectedModifyBooking.numberOfGuests,
    };

    const request = {
      ...bookingData,
      date: bookingData.date.toISOString(),
      calendar: calendarId,
    };

    // Helper function to unbook sequentially
    const unbookSequentially = (ids: Set<string>): Promise<void> => {
      let promiseChain = Promise.resolve();

      ids.forEach((id) => {
        promiseChain = promiseChain
          .then(() => updateUnbookGuest(id, token as string))
          .then((result) => {
            console.log(`Successfully unbooked guest with ID: ${id}`, result);
          })
          .catch((err) => {
            console.error(`Error unbooking guest with ID: ${id}`, err);
            // Continue even if an error occurs
          });
      });

      return promiseChain;
    };

    // Unbook and then book
    unbookSequentially(bookingIds)
      .then(() => {
        return postBooking(request, token as string);
      })
      .then((result) => {
        onBooking(
          bookingData.room,
          bookingData.date,
          bookingData.duration,
          result,
        );
        setSelectedModifyBooking(null);
      })
      .catch((err) => {
        setBookingErrorMessage(err);
        console.error("Error during booking process:", err);
      });
  };

  const getLocalDate = (date: string) => {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const localTime = toZonedTime(date, timeZone);
    return format(localTime, "yyyy-MM-dd");
  };

  // Handle start blur
  const handleDateBlur = () => {
    console.log("ENTER FUNCTION");

    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const startDate = watch("startDate");
    const endDate = watch("endDate");

    // Convert startDate and endDate to zoned times
    const start = toZonedTime(startDate, timeZone);
    const end = toZonedTime(endDate, timeZone);

    // Check if end date is after start date
    if (isAfter(end, start)) {
      // Calculate duration in days
      const newDuration = differenceInDays(end, start) + 1; // Include both start and end days

      // Update the duration value
      setValue("duration", newDuration);
    } else {
      console.warn(
        "End date is not after start date. Duration will not be updated.",
      );
    }
  };

  // Handle duration blur
  const handleDurationBlur = () => {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const startDate = watch("startDate");
    const duration = watch("duration");

    if (startDate && duration) {
      const newEndDate = format(
        addDays(toZonedTime(startDate, timeZone), duration),
        "yyyy-MM-dd",
      );
      setValue("endDate", newEndDate as unknown as Date); // Update the endDate field as a string
    }
  };

  return (
    <div
      className="fixed inset-0 bg-gray-800 bg-opacity-50 flex items-center justify-center z-50"
      onClick={() => setSelectedModifyBooking(null)} // Close modal on background click
    >
      <div
        className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md sm:w-auto sm:max-w-lg"
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside modal
      >
        <div className="flex justify-center mb-1">
          <button
            type="button"
            className="text-gray-500 font-bold text-[1.5rem] leading-none px-6 py-0.5 rounded hover:bg-gray-100"
            onClick={() => setSelectedModifyBooking(null)}
          >
            &times;
          </button>
        </div>
        <h2 className="text-lg font-bold mb-4">
          {selectedModifyBooking?.alias || selectedModifyBooking?.guest.name} (
          {selectedModifyBooking?.room.name})
        </h2>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
          {/* Calendar */}
          <div>
            <div className="flex">
              <label htmlFor="startDate" className="text-sm font-medium">
                Date
              </label>
              <label htmlFor="endDate" className="text-sm font-medium"></label>
            </div>
            <div className="flex space-x-2">
              <input
                id="startDate"
                type="date"
                className="border border-gray-300 rounded px-2 py-1 w-full"
                defaultValue={getLocalDate(selectedModifyBooking.startDate)}
                {...register("startDate", { valueAsDate: true })}
                onBlur={handleDateBlur}
              />
              <span> - </span>
              <input
                id="endDate"
                type="date"
                className="border border-gray-300 rounded px-2 py-1 w-full"
                defaultValue={getLocalDate(selectedModifyBooking.endDate)}
                {...register("endDate", { valueAsDate: true })}
                onBlur={handleDateBlur}
              />
            </div>
            {errors.startDate && (
              <span className="text-red-500 text-sm">
                {errors.startDate.message}
              </span>
            )}
            {errors.endDate && (
              <span className="text-red-500 text-sm">
                {errors.endDate.message}
              </span>
            )}
          </div>

          {/* Room Selection */}
          <div>
            <label htmlFor="room" className="block text-sm font-medium">
              Room
            </label>
            <select
              id="room"
              className="border border-gray-300 rounded px-2 py-1 w-full"
              {...register("room")}
            >
              {rooms.map((room) => (
                <option
                  key={room.id}
                  value={room.id}
                  disabled={unavailableRoomIds.has(room.id)}
                  className={
                    unavailableRoomIds.has(room.id) ? "text-gray-400" : ""
                  }
                >
                  {room.name}
                  {room.id === selectedModifyBooking.room.id
                    ? " (current)"
                    : ""}
                </option>
              ))}
            </select>
            {errors.room && (
              <span className="text-red-500 text-sm">
                {errors.room.message}
              </span>
            )}
          </div>

          {/* Duration */}
          <div>
            <label htmlFor="duration" className="block text-sm font-medium">
              Duration
            </label>
            <input
              id="duration"
              type="number"
              min={1}
              step={1}
              className="border border-gray-300 rounded px-2 py-1 w-full"
              {...register("duration", { valueAsNumber: true })}
              onBlur={handleDurationBlur}
            />
            {errors.duration && (
              <span className="text-red-500 text-sm">
                {errors.duration.message}
              </span>
            )}
          </div>

          {/* Buttons */}
          <div className="flex justify-end">
            <button
              type="submit"
              className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
            >
              Modify
            </button>
          </div>
          {bookingErrorMessage && (
            <span className="text-red-500">{bookingErrorMessage}</span>
          )}
        </form>
      </div>
    </div>
  );
};

export default ModifyBookingModal;
