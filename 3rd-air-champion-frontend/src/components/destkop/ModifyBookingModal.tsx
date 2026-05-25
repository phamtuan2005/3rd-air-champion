import { SubmitHandler, useForm, Controller } from "react-hook-form";
import { bookingType } from "../../util/types/bookingType";
import { modifyBookingObject, modifyBookingSchema } from "./zodModifyBooking";
import { zodResolver } from "@hookform/resolvers/zod";
import { addDays, format } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { dayType } from "../../util/types/dayType";
import { roomType } from "../../util/types/roomType";
import { postBooking, updateUnbookGuest } from "../../util/bookingOperations";
import { useMemo, useState } from "react";
import RoomPickerDropdown from "./MainView/GuestView/RoomPickerDropdown";

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
    watch,
    control,
    formState: { errors },
  } = useForm<modifyBookingSchema>({
    resolver: zodResolver(modifyBookingObject),
    defaultValues: {
      room: selectedModifyBooking.room.id,
      duration: selectedModifyBooking.duration,
    },
  });

  const wasReserved = selectedModifyBooking.reserved === true;
  const [isReserved, setIsReserved] = useState(wasReserved);
  const [bookingErrorMessage, setBookingErrorMessage] = useState("");
  const token = localStorage.getItem("token");

  const watchedStartDate = watch("startDate");
  const watchedDuration = watch("duration");

  const getLocalDate = (date: string) => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return format(toZonedTime(date, tz), "yyyy-MM-dd");
  };

  const effectiveStart: Date = watchedStartDate
    ? new Date(watchedStartDate.getTime() + watchedStartDate.getTimezoneOffset() * 60000)
    : (() => { const tz = Intl.DateTimeFormat().resolvedOptions().timeZone; return toZonedTime(selectedModifyBooking.startDate, tz); })();

  const effectiveDuration = (watchedDuration && watchedDuration >= 1) ? watchedDuration : selectedModifyBooking.duration;

  const checkoutDate = addDays(effectiveStart, effectiveDuration);

  const unavailableRoomIds = useMemo(() => {
    const blocked = new Set<string>();
    for (let i = 0; i < effectiveDuration; i++) {
      const dayKey = addDays(effectiveStart, i).toISOString().split("T")[0];
      const day = monthMap.get(dayKey);
      if (day) {
        day.bookings.forEach((b) => {
          if (b.guest.id !== selectedModifyBooking.guest.id) blocked.add(b.room.id);
        });
      }
    }
    return blocked;
  }, [effectiveStart, effectiveDuration, monthMap, selectedModifyBooking]);

  const onSubmit: SubmitHandler<modifyBookingSchema> = async (data) => {
    const duration = data.duration;

    // Collect IDs of all Day bookings for this guest+room to unbook
    const bookingIds = new Set<string>();
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const origStart = toZonedTime(selectedModifyBooking.startDate, tz);
    for (let i = 0; i < selectedModifyBooking.duration; i++) {
      const day = monthMap.get(addDays(origStart, i).toISOString().split("T")[0]);
      if (day) {
        day.bookings.forEach((b) => {
          if (b.guest.id === selectedModifyBooking.guest.id && b.room.id === selectedModifyBooking.room.id)
            bookingIds.add(b.id);
        });
      }
    }

    // Conflict check
    const searchMap = new Map<string, { guestId: string; bookingId: string }>();
    monthMap.forEach((day, date) => {
      day.bookings.forEach((b) => {
        if (b.room.id === data.room) searchMap.set(date, { guestId: b.guest.id, bookingId: b.id });
      });
    });

    for (let i = 0; i < duration; i++) {
      const dateKey = addDays(effectiveStart, i).toISOString().split("T")[0];
      const entry = searchMap.get(dateKey);
      if (entry && entry.guestId !== selectedModifyBooking.guest.id) {
        setBookingErrorMessage(`Conflict on ${dateKey}.`);
        return;
      }
    }

    setBookingErrorMessage("");

    const unbookSequentially = (ids: Set<string>): Promise<void> =>
      [...ids].reduce(
        (chain, id) => chain.then(() => updateUnbookGuest(id, token as string)).catch(() => {}),
        Promise.resolve() as Promise<void>,
      );

    const reqStartIso = effectiveStart.toISOString();

    try {
      await unbookSequentially(bookingIds);
      const result = await postBooking(
        {
          date: reqStartIso,
          room: data.room,
          guest: selectedModifyBooking.guest.id,
          isAirBnB: false,
          duration,
          numberOfGuests: selectedModifyBooking.numberOfGuests,
          calendar: calendarId,
          ...(isReserved ? { reserved: true } : {}),
        },
        token as string,
      );
      onBooking(data.room, effectiveStart, duration, result);
      setSelectedModifyBooking(null);
    } catch (err) {
      setBookingErrorMessage(String(err));
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={() => setSelectedModifyBooking(null)}
    >
      <div
        className="bg-white rounded-xl shadow-xl p-5 w-full max-w-sm mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-base font-bold text-gray-800">
              {selectedModifyBooking.alias || selectedModifyBooking.guest.name}
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">{selectedModifyBooking.room.name}</p>
          </div>
          <button
            type="button"
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
            onClick={() => setSelectedModifyBooking(null)}
          >
            &times;
          </button>
        </div>

        <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
          {/* Reserved toggle */}
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={isReserved}
              onChange={(e) => setIsReserved(e.target.checked)}
              className="w-4 h-4 accent-amber-500"
            />
            <span className="text-sm font-medium text-amber-700">Reserved (payment pending)</span>
          </label>

          {/* Dates + Duration */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">Check-in</p>
              <input
                type="date"
                className="border border-gray-200 rounded-lg px-2 py-1.5 w-full text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                defaultValue={getLocalDate(selectedModifyBooking.startDate)}
                {...register("startDate", { valueAsDate: true })}
              />
              {errors.startDate && (
                <p className="text-red-500 text-xs mt-0.5">{errors.startDate.message}</p>
              )}
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">Duration (nights)</p>
              <input
                type="number"
                min={1}
                step={1}
                className="border border-gray-200 rounded-lg px-2 py-1.5 w-full text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                {...register("duration", { valueAsNumber: true })}
              />
              <span className="text-gray-400 text-xs block mt-0.5">
                checkout {format(checkoutDate, "MMM d")}
              </span>
              {errors.duration && (
                <p className="text-red-500 text-xs mt-0.5">{errors.duration.message}</p>
              )}
            </div>
          </div>

          {/* Room */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">Room</p>
            <Controller
              name="room"
              control={control}
              render={({ field }) => (
                <RoomPickerDropdown
                  rooms={rooms.filter((r) => r.active)}
                  blockedRoomIds={unavailableRoomIds}
                  value={field.value}
                  onChange={field.onChange}
                />
              )}
            />
            {errors.room && (
              <p className="text-red-500 text-xs mt-0.5">{errors.room.message}</p>
            )}
          </div>

          {bookingErrorMessage && (
            <p className="text-red-500 text-sm">{bookingErrorMessage}</p>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-1 border-t border-gray-100">
            <button
              type="button"
              onClick={() => setSelectedModifyBooking(null)}
              className="px-4 py-1.5 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-md"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 text-sm text-white bg-green-500 hover:bg-green-600 rounded-md"
            >
              Modify
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ModifyBookingModal;