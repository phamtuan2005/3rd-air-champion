import { useState } from "react";
import { guestType } from "../../../util/types/guestType";
import { roomType } from "../../../util/types/roomType";
import GuestInput from "./GuestInput";
import { SubmitHandler, useForm } from "react-hook-form";
import { bookDaySchema, bookDaysZodObject } from "../../../util/zodBookDays";
import { zodResolver } from "@hookform/resolvers/zod";
import { postBooking } from "../../../util/bookingOperations";
import { dayType } from "../../../util/types/dayType";
import { format } from "date-fns";

interface BookingModalProps {
  calendarId: string;
  guests: guestType[];
  rooms: roomType[];
  selectedDate: Date;
  selectedRoom: roomType | undefined;
  showAddPane: "guest" | "room" | null;
  onBooking: (
    roomName: string,
    date: Date,
    duration: number,
    bookedDays: dayType[]
  ) => void;
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
  const [bookingErrorMessage, setBookingErrorMessage] = useState("");

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<bookDaySchema>({
    resolver: zodResolver(bookDaysZodObject),
    defaultValues: {
      numberOfGuests: 1,
      duration: 1,
      room: selectedRoom?.id || "",
    },
  });

  const onSubmit: SubmitHandler<bookDaySchema> = (data) => {
    console.log(data);
    const request = {
      ...data,
      isAirBnB: false,
      date: data.date.toISOString(),
      calendar: calendarId,
    };

    postBooking(request, token as string)
      .then((result) => {
        onBooking(data.room, data.date, data.duration, result);
        setIsModalOpen(false); // On success close
      })
      .catch((err) => {
        setBookingErrorMessage(err);
        console.error("Error booking days:", err);
      });
  };

  return (
    <div
      className="fixed inset-0 bg-gray-800 bg-opacity-50 flex items-center justify-center z-50"
      onClick={() => setIsModalOpen(false)} // Close modal on background click
    >
      <div
        className="bg-white rounded-lg shadow-lg p-4 sm:w-1/3 h-fit transform transition-transform"
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside modal
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
        <h2 className="text-lg font-bold mb-4">Book a Room</h2>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
          {/* Guest Selection */}
          <GuestInput
            guests={guests}
            showAddPane={showAddPane}
            setShowAddPane={setShowAddPane}
            setValue={setValue}
          />
          {errors.guest && (
            <span className="text-red-500">{errors.guest.message}</span>
          )}

          {/* Number of Guests */}
          <div>
            <label
              htmlFor="numberOfGuests"
              className="block text-sm font-medium"
            >
              Number of Guests
            </label>
            <select
              id="numberOfGuests"
              className="border border-gray-300 rounded px-2 py-1 w-full"
              {...register("numberOfGuests", { valueAsNumber: true })}
            >
              <option value={1}>1 Guest</option>
              <option value={2}>2 Guests</option>
              <option value={3}>3 Guests</option>
              <option value={4}>4 Guests</option>
            </select>
            {errors.numberOfGuests && (
              <span className="text-red-500 text-sm">
                {errors.numberOfGuests.message}
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
              {!selectedRoom && <option value="">Select a room</option>}
              {rooms.map((room) => (
                <option key={room.id} value={room.id}>
                  {room.name}
                </option>
              ))}
            </select>
            {errors.room && (
              <span className="text-red-500 text-sm">
                {errors.room.message}
              </span>
            )}
          </div>

          {/* Start Date */}
          <div>
            <label htmlFor="bookingDate" className="block text-sm font-medium">
              Booking Date
            </label>
            <input
              id="bookingDate"
              type="date"
              className="border border-gray-300 rounded px-2 py-1 w-full"
              defaultValue={selectedDate && format(selectedDate, "yyyy-MM-dd")}
              {...register("date", { valueAsDate: true })}
            />
            {errors.date && (
              <span className="text-red-500 text-sm">
                {errors.date.message}
              </span>
            )}
          </div>

          {/* Duration */}
          <div>
            <label htmlFor="duration" className="block text-sm font-medium">
              Duration (Days)
            </label>
            <input
              id="duration"
              type="number"
              step={1}
              min={1}
              className="border border-gray-300 rounded px-2 py-1 w-full"
              {...register("duration", { valueAsNumber: true })}
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
              Book
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

export default BookingModal;
