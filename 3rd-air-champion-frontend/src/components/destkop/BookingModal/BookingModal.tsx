import { useState } from "react";
import { guestType } from "../../../util/types/guestType";
import { roomType } from "../../../util/types/roomType";
import GuestInput from "./GuestInput";
import { SubmitHandler, useForm, useFieldArray, Controller } from "react-hook-form";
import { bookDaySchema, bookDaysZodObject } from "../../../util/zodBookDays";
import { zodResolver } from "@hookform/resolvers/zod";
import { getAvailableRooms, postBooking } from "../../../util/bookingOperations";
import { dayType } from "../../../util/types/dayType";
import { format } from "date-fns";
import { ANY_ROOM_SENTINEL } from "../../../util/zodBookDays";

interface BookingModalProps {
  calendarId: string;
  guests: guestType[];
  rooms: roomType[];
  selectedDate: Date;
  selectedRoom: roomType | undefined;
  showAddPane: "guest" | "room" | null;
  onBooking: (bookedDays: dayType[]) => void;
  setIsModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setShowAddPane: React.Dispatch<React.SetStateAction<"guest" | "room" | null>>;
}

const BookingModal = ({
  calendarId,
  guests,
  rooms,
  selectedDate,
  selectedRoom,
  showAddPane,
  onBooking,
  setIsModalOpen,
  setShowAddPane,
}: BookingModalProps) => {
  const token = localStorage.getItem("token");
  type BookingResult = {
    label: string;
    status: "success" | "error";
    message?: string;
  };

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bookingResults, setBookingResults] = useState<BookingResult[]>([]);

  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { errors },
  } = useForm<bookDaySchema>({
    resolver: zodResolver(bookDaysZodObject),
    defaultValues: {
      guest: "",
      numberOfGuests: 1,
      bookings: [
        {
          room: selectedRoom?.id || ANY_ROOM_SENTINEL,
          date: selectedDate,
          duration: 1,
        },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "bookings",
  });

  const onSubmit: SubmitHandler<bookDaySchema> = async (data) => {
    setIsSubmitting(true);

    const results: BookingResult[] = [];
    const allBookedDays: dayType[] = [];

    for (const booking of data.bookings) {
      const dateLabel = format(booking.date, "MMM d, yyyy");
      const durationLabel = `${booking.duration} day${booking.duration > 1 ? "s" : ""}`;

      try {
        let roomId = booking.room;
        let roomLabel =
          rooms.find((r) => r.id === booking.room)?.name ?? "---";

        if (roomId === ANY_ROOM_SENTINEL) {
          const available = await getAvailableRooms(
            {
              calendar: calendarId,
              date: booking.date.toISOString(),
              duration: booking.duration,
            },
            token as string
          );
          if (available.length === 0) {
            results.push({
              label: `${dateLabel} · ${durationLabel}`,
              status: "error",
              message: "No available room",
            });
            continue;
          }
          roomId = available[0].id;
          roomLabel = available[0].name;
        }

        const result = await postBooking(
          {
            calendar: calendarId,
            date: booking.date.toISOString(),
            guest: data.guest,
            isAirBnB: false,
            numberOfGuests: data.numberOfGuests,
            room: roomId,
            duration: booking.duration,
          },
          token as string
        );
        allBookedDays.push(...result);
        results.push({
          label: `${roomLabel} · ${dateLabel} · ${durationLabel}`,
          status: "success",
        });
      } catch (err) {
        const dateLabel = format(booking.date, "MMM d, yyyy");
        const durationLabel = `${booking.duration} day${booking.duration > 1 ? "s" : ""}`;
        results.push({
          label: `${dateLabel} · ${durationLabel}`,
          status: "error",
          message: "unavailable",
        });
      }
    }

    setIsSubmitting(false);
    setBookingResults(results);

    if (allBookedDays.length > 0) {
      onBooking(allBookedDays);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-gray-800 bg-opacity-50 flex items-center justify-center z-50"
      onClick={() => setIsModalOpen(false)}
    >
      <div
        className="bg-white rounded-lg shadow-lg p-4 w-full sm:max-w-2xl h-fit transform transition-transform"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center mb-1">
          <button
            type="button"
            className="text-gray-500 font-bold text-[1.5rem] leading-none px-6 py-0.5 rounded hover:bg-gray-100"
            onClick={() => setIsModalOpen(false)}
          >
            &times;
          </button>
        </div>
        <h2 className="text-lg font-bold mb-4">Book Rooms</h2>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
          {/* Guest + Number of Guests row */}
          <div className="flex gap-4 items-start">
            <div className="flex-1">
              <GuestInput
                guests={guests}
                showAddPane={showAddPane}
                setShowAddPane={setShowAddPane}
                setValue={setValue}
              />
              {errors.guest && (
                <span className="text-red-500 text-sm">
                  {errors.guest.message}
                </span>
              )}
            </div>
            <div className="w-36">
              <label
                htmlFor="numberOfGuests"
                className="block text-sm font-medium"
              >
                # of Guests
              </label>
              <select
                id="numberOfGuests"
                className="border border-gray-300 rounded px-2 py-1 w-full"
                {...register("numberOfGuests", { valueAsNumber: true })}
              >
                <option value={1}>1</option>
                <option value={2}>2</option>
                <option value={3}>3</option>
                <option value={4}>4</option>
              </select>
              {errors.numberOfGuests && (
                <span className="text-red-500 text-sm">
                  {errors.numberOfGuests.message}
                </span>
              )}
            </div>
          </div>

          {/* Bookings table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left font-medium pb-2 pr-2">Room</th>
                  <th className="text-left font-medium pb-2 pr-2">Date</th>
                  <th className="text-left font-medium pb-2 pr-2 w-28">
                    Duration (Days)
                  </th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {fields.map((field, index) => (
                  <tr key={field.id} className="border-b border-gray-100">
                    <td className="py-2 pr-2">
                      <select
                        className="border border-gray-300 rounded px-2 py-1 w-full"
                        {...register(`bookings.${index}.room`)}
                      >
                        <option value={ANY_ROOM_SENTINEL}>---</option>
                        {rooms.map((room) => (
                          <option key={room.id} value={room.id}>
                            {room.name}
                          </option>
                        ))}
                      </select>
                      {errors.bookings?.[index]?.room && (
                        <span className="text-red-500 text-xs block">
                          {errors.bookings[index].room?.message}
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-2">
                      <Controller
                        control={control}
                        name={`bookings.${index}.date`}
                        render={({ field }) => (
                          <input
                            type="date"
                            className="border border-gray-300 rounded px-2 py-1 w-full"
                            value={
                              field.value instanceof Date && !isNaN(field.value.getTime())
                                ? format(field.value, "yyyy-MM-dd")
                                : ""
                            }
                            onChange={(e) =>
                              field.onChange(
                                e.target.value ? new Date(e.target.value + "T00:00:00") : null
                              )
                            }
                          />
                        )}
                      />
                      {errors.bookings?.[index]?.date && (
                        <span className="text-red-500 text-xs block">
                          {errors.bookings[index].date?.message}
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-2">
                      <input
                        type="number"
                        step={1}
                        min={1}
                        className="border border-gray-300 rounded px-2 py-1 w-full"
                        {...register(`bookings.${index}.duration`, {
                          valueAsNumber: true,
                        })}
                      />
                      {errors.bookings?.[index]?.duration && (
                        <span className="text-red-500 text-xs block">
                          {errors.bookings[index].duration?.message}
                        </span>
                      )}
                    </td>
                    <td className="py-2 text-center">
                      {fields.length > 1 && (
                        <button
                          type="button"
                          className="text-gray-400 hover:text-red-500 font-bold leading-none"
                          onClick={() => remove(index)}
                        >
                          &times;
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {errors.bookings && !Array.isArray(errors.bookings) && (
            <span className="text-red-500 text-sm">
              {errors.bookings.message}
            </span>
          )}

          {bookingResults.length === 0 && (
            <>
              {/* Add row */}
              <button
                type="button"
                className="self-start border border-dashed border-blue-400 text-blue-500 rounded px-3 py-1 text-sm hover:bg-blue-50"
                onClick={() =>
                  append({
                    room: ANY_ROOM_SENTINEL,
                    date: new Date(),
                    duration: 1,
                  })
                }
              >
                + Add Row
              </button>

              {/* Submit */}
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 disabled:opacity-50"
                >
                  {isSubmitting ? "Booking..." : "Book All"}
                </button>
              </div>
            </>
          )}

          {/* Results summary */}
          {bookingResults.length > 0 && (
            <>
              <div className="border-t border-gray-200 pt-3">
                <p className="text-sm font-medium mb-2">Booking Summary</p>
                <ul className="flex flex-col gap-1">
                  {bookingResults.map((r, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      {r.status === "success" ? (
                        <span className="text-green-500 font-bold mt-0.5">&#10003;</span>
                      ) : (
                        <span className="text-red-500 font-bold mt-0.5">&#10007;</span>
                      )}
                      <span>
                        {r.label}
                        {r.message && (
                          <span className="text-red-500 ml-1">— {r.message}</span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
                  onClick={() => setIsModalOpen(false)}
                >
                  Close
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
};

export default BookingModal;