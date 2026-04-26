import { useEffect, useState } from "react";
import { useForm, SubmitHandler } from "react-hook-form";
import { roomType } from "../../util/types/roomType";
import { createBookingRequest } from "../../util/bookingRequestOperations";
import { getAvailableRooms } from "../../util/bookingOperations";
import { format, addDays } from "date-fns";
import { toZonedTime } from "date-fns-tz";

const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

interface BookingRequestModalProps {
  hostId: string;
  calendarId: string;
  token: string;
  rooms: roomType[];
  selectedDate: Date | null;
  onClose: () => void;
}

interface FormData {
  guestName: string;
  guestPhone: string;
  date: string;
  room: string;
  duration: number;
  numberOfGuests: number;
}

const BookingRequestModal = ({
  hostId,
  calendarId,
  token,
  rooms,
  selectedDate,
  onClose,
}: BookingRequestModalProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<{
    status: "success" | "error";
    message: string;
  } | null>(null);

  const [availableRooms, setAvailableRooms] = useState<
    { id: string; name: string; price: number; roomCode: string }[]
  >([]);
  const [isLoadingRooms, setIsLoadingRooms] = useState(false);
  const [hasFetchedRooms, setHasFetchedRooms] = useState(false);

  const activeRooms = rooms
    .filter((r) => r.active)
    .sort((a, b) => a.name.localeCompare(b.name));

  const defaultDate = selectedDate
    ? format(selectedDate, "yyyy-MM-dd")
    : format(new Date(), "yyyy-MM-dd");

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    defaultValues: {
      guestName: "",
      guestPhone: "",
      date: defaultDate,
      room: activeRooms[0]?.id ?? "",
      duration: 1,
      numberOfGuests: 1,
    },
  });

  const watchedDate = watch("date");
  const watchedDuration = watch("duration");
  const watchedRoom = watch("room");

  useEffect(() => {
    if (!watchedDate || !watchedDuration) return;

    const dateStr = toZonedTime(new Date(watchedDate), timeZone)
      .toISOString()
      .split("T")[0];

    setIsLoadingRooms(true);
    getAvailableRooms(
      { calendar: calendarId, date: dateStr, duration: watchedDuration },
      token,
    )
      .then((result) => {
        setAvailableRooms(result);
        setHasFetchedRooms(true);
        if (result.length > 0) {
          const currentStillAvailable = result.find(
            (r) => r.id === watchedRoom,
          );
          if (!currentStillAvailable) {
            setValue("room", result[0].id);
          }
        } else {
          setValue("room", "");
        }
      })
      .catch(() => {
        setAvailableRooms([]);
        setHasFetchedRooms(true);
      })
      .finally(() => setIsLoadingRooms(false));
  }, [watchedDate, watchedDuration]); // eslint-disable-line react-hooks/exhaustive-deps

  const displayRooms = hasFetchedRooms ? availableRooms : activeRooms;

  const checkoutDate =
    watchedDate && watchedDuration
      ? format(addDays(new Date(watchedDate), watchedDuration), "MMM d, yyyy")
      : null;

  const onSubmit: SubmitHandler<FormData> = async (data) => {
    setIsSubmitting(true);
    setSubmitResult(null);
    try {
      await createBookingRequest({
        host: hostId,
        guestName: data.guestName,
        guestPhone: data.guestPhone,
        date: data.date.split("T")[0],
        room: data.room,
        duration: data.duration,
        numberOfGuests: data.numberOfGuests,
      });
      setSubmitResult({
        status: "success",
        message: "Booking request submitted!",
      });
    } catch {
      setSubmitResult({
        status: "error",
        message: "Failed to submit request. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-lg w-full max-w-md max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-gray-100">
          <h2 className="text-lg font-bold">Request a Booking</h2>
          <button
            type="button"
            className="text-gray-400 hover:text-gray-600 text-xl leading-none px-2"
            onClick={onClose}
          >
            &times;
          </button>
        </div>

        {submitResult?.status === "success" ? (
          <div className="flex flex-col items-center gap-4 p-6">
            <span className="text-green-500 text-4xl">&#10003;</span>
            <p className="text-center font-medium">{submitResult.message}</p>
            <button
              type="button"
              className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        ) : (
          <form
            className="flex flex-col flex-1 min-h-0"
            onSubmit={handleSubmit(onSubmit)}
          >
            <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3">
              {/* Guest Name */}
              <div>
                <label className="block text-sm font-medium mb-1">
                  Guest Name
                </label>
                <input
                  type="text"
                  className="border border-gray-300 rounded px-2 py-1.5 w-full text-sm"
                  placeholder="Full name"
                  {...register("guestName", { required: "Name is required" })}
                />
                {errors.guestName && (
                  <span className="text-red-500 text-xs">
                    {errors.guestName.message}
                  </span>
                )}
              </div>

              {/* Guest Phone */}
              <div>
                <label className="block text-sm font-medium mb-1">
                  Phone Number
                </label>
                <input
                  type="tel"
                  className="border border-gray-300 rounded px-2 py-1.5 w-full text-sm"
                  placeholder="Phone number"
                  {...register("guestPhone", {
                    required: "Phone is required",
                  })}
                />
                {errors.guestPhone && (
                  <span className="text-red-500 text-xs">
                    {errors.guestPhone.message}
                  </span>
                )}
              </div>

              {/* Room */}
              <div>
                <label className="block text-sm font-medium mb-1">Room</label>
                {isLoadingRooms ? (
                  <p className="text-sm text-gray-400">
                    Checking availability...
                  </p>
                ) : displayRooms.length === 0 ? (
                  <p className="text-sm text-red-500">
                    No rooms available for these dates
                  </p>
                ) : (
                  <select
                    className="border border-gray-300 rounded px-2 py-1.5 w-full text-sm"
                    {...register("room", { required: "Room is required" })}
                  >
                    {displayRooms.map((room) => (
                      <option key={room.id} value={room.id}>
                        {room.name} — ${room.price}/night
                      </option>
                    ))}
                  </select>
                )}
                {errors.room && (
                  <span className="text-red-500 text-xs">
                    {errors.room.message}
                  </span>
                )}
              </div>

              {/* Date + Duration */}
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-sm font-medium mb-1">
                    Check-in Date
                  </label>
                  <input
                    type="date"
                    className="border border-gray-300 rounded px-2 py-1.5 w-full text-sm"
                    {...register("date", { required: "Date is required" })}
                  />
                  {errors.date && (
                    <span className="text-red-500 text-xs">
                      {errors.date.message}
                    </span>
                  )}
                </div>
                <div className="w-28">
                  <label className="block text-sm font-medium mb-1">
                    Duration
                  </label>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    className="border border-gray-300 rounded px-2 py-1.5 w-full text-sm"
                    {...register("duration", {
                      valueAsNumber: true,
                      required: "Required",
                      min: { value: 1, message: "Min 1" },
                    })}
                  />
                  {checkoutDate && (
                    <span className="text-gray-400 text-xs block mt-0.5">
                      checkout {checkoutDate}
                    </span>
                  )}
                  {errors.duration && (
                    <span className="text-red-500 text-xs">
                      {errors.duration.message}
                    </span>
                  )}
                </div>
              </div>

              {/* Number of Guests */}
              <div className="w-36">
                <label className="block text-sm font-medium mb-1">
                  # of Guests
                </label>
                <select
                  className="border border-gray-300 rounded px-2 py-1.5 w-full text-sm"
                  {...register("numberOfGuests", { valueAsNumber: true })}
                >
                  {[1, 2, 3, 4].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>

              {submitResult?.status === "error" && (
                <p className="text-red-500 text-sm">{submitResult.message}</p>
              )}
            </div>

            {/* Footer */}
            <div className="flex-shrink-0 border-t border-gray-100 px-4 py-3 flex justify-end">
              <button
                type="submit"
                disabled={isSubmitting || displayRooms.length === 0}
                className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 disabled:opacity-50"
              >
                {isSubmitting ? "Submitting..." : "Submit Request"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default BookingRequestModal;
