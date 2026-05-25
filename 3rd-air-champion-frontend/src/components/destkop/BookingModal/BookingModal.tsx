import { useState } from "react";
import { guestType } from "../../../util/types/guestType";
import { roomType } from "../../../util/types/roomType";
import RoomBadge from "../../shared/RoomBadge";
import GuestInput from "./GuestInput";
import RoomMultiSelect from "./RoomMultiSelect";
import DatePickerModal from "./DatePickerModal";
import { SubmitHandler, useForm, useFieldArray, Controller, useWatch } from "react-hook-form";
import { bookDaySchema, bookDaysZodObject } from "./zodBookDays";
import { zodResolver } from "@hookform/resolvers/zod";
import { getAvailableRooms, postBooking } from "../../../util/bookingOperations";
import { dayType } from "../../../util/types/dayType";
import { format, addDays } from "date-fns";
import { ANY_ROOM_SENTINEL } from "./zodBookDays";

interface BookingPrefill {
  guestId: string | null;
  roomId: string;
  date: Date;
  duration: number;
  numberOfGuests: number;
}

interface BookingModalProps {
  calendarId: string;
  guests: guestType[];
  rooms: roomType[];
  selectedDate: Date;
  selectedRoom: roomType | undefined;
  showAddPane: "guest" | "room" | null;
  prefill?: BookingPrefill | null;
  prefills?: BookingPrefill[];
  onBooking: (bookedDays: dayType[]) => void;
  setIsModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setShowAddPane: React.Dispatch<React.SetStateAction<"guest" | "room" | null>>;
}

type FlatBooking = { room: string; date: Date; duration: number };

type BookingResult = {
  label: string;       // "Apr 17, 2026 · 1 day"
  roomName: string;
  roomColor?: string;
  status: "success" | "error";
  message?: string;
  booking?: FlatBooking;
  reserved?: boolean;
};

const extractErrorMessage = (err: unknown): string => {
  if (typeof err === "string") return err;
  if (Array.isArray(err)) {
    const first = err[0];
    if (typeof first === "string") return first;
    if (first && typeof first === "object" && "message" in first)
      return String((first as { message: string }).message);
  }
  if (err && typeof err === "object" && "message" in err)
    return String((err as { message: string }).message);
  return "An unexpected error occurred";
};

const humanizeError = (raw: string): string => {
  if (/the following dates are unavailable/i.test(raw)) return "Already booked";
  if (/no available room/i.test(raw)) return "No rooms available";
  if (/unexpected error/i.test(raw)) return "Something went wrong. Please try again.";
  return raw;
};

const BookingModal = ({
  calendarId,
  guests,
  rooms,
  selectedDate,
  selectedRoom,
  showAddPane,
  prefill,
  prefills,
  onBooking,
  setIsModalOpen,
  setShowAddPane,
}: BookingModalProps) => {
  const token = localStorage.getItem("token");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bookingResults, setBookingResults] = useState<BookingResult[]>([]);
  const [reservedRows, setReservedRows] = useState<Set<number>>(new Set());

  const toggleReservedRow = (index: number) =>
    setReservedRows((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index); else next.add(index);
      return next;
    });

  const activePrefill = prefills && prefills.length > 0 ? prefills[0] : prefill;
  const defaultGuestId = activePrefill?.guestId ?? "";
  const defaultGuest = activePrefill?.guestId
    ? guests.find((g) => g.id === activePrefill.guestId) ?? null
    : null;

  const {
    handleSubmit,
    setValue,
    control,
    getValues,
    register,
    formState: { errors },
  } = useForm<bookDaySchema>({
    resolver: zodResolver(bookDaysZodObject),
    defaultValues: {
      guest: defaultGuestId,
      numberOfGuests: activePrefill?.numberOfGuests ?? 1,
      bookings: prefills && prefills.length > 0
        ? prefills.map((p) => ({ rooms: [p.roomId], date: p.date, duration: p.duration }))
        : [
            {
              rooms: [prefill?.roomId ?? selectedRoom?.id ?? ANY_ROOM_SENTINEL],
              date: prefill?.date ?? selectedDate,
              duration: prefill?.duration ?? 1,
            },
          ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "bookings",
  });

  const watchedBookings = useWatch({ control, name: "bookings" });
  const watchedGuestId = useWatch({ control, name: "guest" });
  const watchedGuestName =
    guests.find((g) => g.id === watchedGuestId)?.name ?? "";

  const processBooking = async (
    flat: FlatBooking,
    guestId: string,
    numberOfGuests: number
  ): Promise<{ result: BookingResult; bookedDays: dayType[] }> => {
    const dateLabel = format(flat.date, "MMM d, yyyy");
    const durationLabel = `${flat.duration} day${flat.duration > 1 ? "s" : ""}`;

    let roomId = flat.room;
    const flatRoom = rooms.find((r) => r.id === flat.room);
    let roomLabel = flatRoom?.name ?? "---";
    let roomColor = flatRoom?.color;

    try {

      if (roomId === ANY_ROOM_SENTINEL) {
        const available = await getAvailableRooms(
          {
            calendar: calendarId,
            date: format(flat.date, "yyyy-MM-dd'T'HH:mm:ss"),
            duration: flat.duration,
          },
          token as string
        );
        if (available.length === 0) {
          return {
            result: {
              label: `${dateLabel} · ${durationLabel}`,
              roomName: roomLabel,
              status: "error",
              message: "No rooms available for these dates",
              booking: flat,
            },
            bookedDays: [],
          };
        }
        roomId = available[0].id;
        roomLabel = available[0].name;
        roomColor = available[0].color;
      }

      const days = await postBooking(
        {
          calendar: calendarId,
          date: format(flat.date, "yyyy-MM-dd'T'HH:mm:ss"),
          guest: guestId,
          isAirBnB: false,
          numberOfGuests,
          room: roomId,
          duration: flat.duration,
        },
        token as string
      );
      return {
        result: {
          label: `${dateLabel} · ${durationLabel}`,
          roomName: roomLabel,
          roomColor,
          status: "success",
        },
        bookedDays: days,
      };
    } catch (err) {
      return {
        result: {
          label: `${dateLabel} · ${durationLabel}`,
          roomName: roomLabel,
          roomColor,
          status: "error",
          message: humanizeError(extractErrorMessage(err)),
          booking: flat,
        },
        bookedDays: [],
      };
    }
  };

  const processReserved = async (
    flat: FlatBooking,
    guestId: string,
    numberOfGuests: number,
  ): Promise<{ result: BookingResult; bookedDays: dayType[] }> => {
    const dateLabel = format(flat.date, "MMM d, yyyy");
    const durationLabel = `${flat.duration} day${flat.duration > 1 ? "s" : ""}`;
    let roomId = flat.room;
    const flatRoom = rooms.find((r) => r.id === flat.room);
    let roomLabel = flatRoom?.name ?? "---";
    let roomColor = flatRoom?.color;
    try {
      if (roomId === ANY_ROOM_SENTINEL) {
        const available = await getAvailableRooms(
          { calendar: calendarId, date: format(flat.date, "yyyy-MM-dd'T'HH:mm:ss"), duration: flat.duration },
          token as string,
        );
        if (available.length === 0) {
          return { result: { label: `${dateLabel} · ${durationLabel}`, roomName: roomLabel, status: "error", message: "No rooms available", reserved: true }, bookedDays: [] };
        }
        roomId = available[0].id; roomLabel = available[0].name; roomColor = available[0].color;
      }
      const days = await postBooking(
        { calendar: calendarId, date: format(flat.date, "yyyy-MM-dd'T'HH:mm:ss"), guest: guestId, isAirBnB: false, numberOfGuests, room: roomId, duration: flat.duration, reserved: true },
        token as string,
      );
      return { result: { label: `${dateLabel} · ${durationLabel}`, roomName: roomLabel, roomColor, status: "success", reserved: true }, bookedDays: days };
    } catch (err) {
      return { result: { label: `${dateLabel} · ${durationLabel}`, roomName: roomLabel, roomColor, status: "error", message: humanizeError(extractErrorMessage(err)), reserved: true }, bookedDays: [] };
    }
  };

  const onSubmit: SubmitHandler<bookDaySchema> = async (data) => {
    setIsSubmitting(true);
    const results: BookingResult[] = [];
    const allBookedDays: dayType[] = [];
    const guest = guests.find((g) => g.id === data.guest);

    for (const [rowIndex, booking] of data.bookings.entries()) {
      const isReserved = reservedRows.has(rowIndex);
      for (const room of booking.rooms) {
        if (isReserved && guest) {
          const { result, bookedDays } = await processReserved(
            { room, date: booking.date, duration: booking.duration },
            data.guest, data.numberOfGuests,
          );
          results.push(result);
          allBookedDays.push(...bookedDays);
        } else {
          const { result, bookedDays } = await processBooking(
            { room, date: booking.date, duration: booking.duration },
            data.guest,
            data.numberOfGuests,
          );
          results.push(result);
          allBookedDays.push(...bookedDays);
        }
      }
    }

    setIsSubmitting(false);
    setBookingResults(results);
    if (allBookedDays.length > 0) onBooking(allBookedDays);
  };

  const handleRetry = async () => {
    setIsSubmitting(true);
    const guestId = getValues("guest");
    const numberOfGuests = getValues("numberOfGuests");
    const newResults = [...bookingResults];
    const allBookedDays: dayType[] = [];

    for (let i = 0; i < newResults.length; i++) {
      if (newResults[i].status === "error" && newResults[i].booking) {
        const { result, bookedDays } = await processBooking(
          newResults[i].booking!,
          guestId,
          numberOfGuests
        );
        newResults[i] = result;
        allBookedDays.push(...bookedDays);
      }
    }

    setIsSubmitting(false);
    setBookingResults([...newResults]);
    if (allBookedDays.length > 0) onBooking(allBookedDays);
  };

  return (
    <div
      className="fixed inset-0 bg-gray-800 bg-opacity-50 flex items-center justify-center z-50"
      onClick={() => setIsModalOpen(false)}
    >
      <div
        className="bg-white rounded-lg shadow-lg w-full sm:max-w-2xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-gray-100 flex-shrink-0">
          <h2 className="text-lg font-bold">Book Rooms</h2>
          <button
            type="button"
            className="text-gray-400 hover:text-gray-600 text-xl leading-none px-2"
            onClick={() => setIsModalOpen(false)}
          >
            &times;
          </button>
        </div>

        <form
          className="flex flex-col flex-1 min-h-0"
          onSubmit={handleSubmit(onSubmit)}
        >
          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-4">
            {/* Guest + Number of Guests row */}
            <div className="flex gap-4 items-start">
              <div className="flex-1">
                <GuestInput
                  guests={guests}
                  showAddPane={showAddPane}
                  setShowAddPane={setShowAddPane}
                  setValue={setValue}
                  defaultGuest={defaultGuest}
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
                  className="block text-sm font-medium mb-1"
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

            {/* Booking cards */}
            <div className="flex flex-col gap-2">
              {fields.map((field, index) => {
                const wb = watchedBookings?.[index];
                const wbDate =
                  wb?.date instanceof Date && !isNaN(wb.date.getTime())
                    ? wb.date
                    : null;
                const wbDur =
                  typeof wb?.duration === "number" && wb.duration >= 1
                    ? wb.duration
                    : null;
                return (
                  <div
                    key={field.id}
                    className="border border-gray-200 rounded-lg p-3 flex flex-col gap-2"
                  >
                    {/* Room selector — full width, unobstructed */}
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">
                        Room
                      </label>
                      <Controller
                        control={control}
                        name={`bookings.${index}.rooms`}
                        render={({ field: f }) => (
                          <RoomMultiSelect
                            rooms={rooms}
                            value={f.value}
                            onChange={f.onChange}
                          />
                        )}
                      />
                      {errors.bookings?.[index]?.rooms && (
                        <span className="text-red-500 text-xs mt-0.5 block">
                          {errors.bookings[index].rooms?.message}
                        </span>
                      )}
                    </div>

                    {/* Reserve checkbox */}
                    <label className="flex items-center gap-2 cursor-pointer select-none w-fit">
                      <input
                        type="checkbox"
                        checked={reservedRows.has(index)}
                        onChange={() => toggleReservedRow(index)}
                        className="w-3.5 h-3.5 accent-amber-500 cursor-pointer"
                      />
                      <span className="text-xs font-medium text-amber-600">Reserve (soft hold)</span>
                    </label>

                    {/* Date + Duration + delete */}
                    <div className="flex gap-3 items-start">
                      <div className="flex-1">
                        <label className="block text-xs font-medium text-gray-500 mb-1">
                          Check-in date
                        </label>
                        <Controller
                          control={control}
                          name={`bookings.${index}.date`}
                          render={({ field: f }) => (
                            <DatePickerModal
                              value={
                                f.value instanceof Date &&
                                !isNaN(f.value.getTime())
                                  ? f.value
                                  : null
                              }
                              onChange={(date) => f.onChange(date)}
                              calendarId={calendarId}
                              token={token ?? ""}
                              selectedRoomIds={watchedBookings?.[index]?.rooms ?? []}
                              activeRooms={rooms.filter((r) => r.active)}
                              guestName={watchedGuestName}
                            />
                          )}
                        />
                        {errors.bookings?.[index]?.date && (
                          <span className="text-red-500 text-xs mt-0.5 block">
                            {errors.bookings[index].date?.message}
                          </span>
                        )}
                      </div>

                      <div className="w-28">
                        <label className="block text-xs font-medium text-gray-500 mb-1">
                          Duration (days)
                        </label>
                        <input
                          type="number"
                          step={1}
                          min={1}
                          className="border border-gray-300 rounded px-2 py-1 w-full text-sm"
                          {...register(`bookings.${index}.duration`, {
                            valueAsNumber: true,
                          })}
                        />
                        {wbDate && wbDur && (
                          <span className="text-gray-400 text-xs block mt-0.5">
                            checkout {format(addDays(wbDate, wbDur), "MMM d")}
                          </span>
                        )}
                        {errors.bookings?.[index]?.duration && (
                          <span className="text-red-500 text-xs mt-0.5 block">
                            {errors.bookings[index].duration?.message}
                          </span>
                        )}
                      </div>

                      {fields.length > 1 && (
                        <button
                          type="button"
                          className="mt-5 text-gray-400 hover:text-red-500 font-bold text-lg leading-none"
                          onClick={() => remove(index)}
                        >
                          &times;
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {errors.bookings && !Array.isArray(errors.bookings) && (
              <span className="text-red-500 text-sm">
                {errors.bookings.message}
              </span>
            )}

            {/* Results summary */}
            {bookingResults.length > 0 && (
              <div className="border-t border-gray-200 pt-3">
                <p className="text-sm font-medium mb-2">Booking Summary</p>
                <ul className="flex flex-col gap-1">
                  {Object.entries(
                    bookingResults.reduce<Record<string, BookingResult[]>>(
                      (acc, r) => { (acc[r.label] ??= []).push(r); return acc; },
                      {}
                    )
                  ).map(([label, group]) => {
                    const failed = group.filter((r) => r.status === "error");
                    const succeeded = group.filter((r) => r.status === "success");
                    const rows = [];

                    if (succeeded.length > 0) {
                      const isRes = succeeded[0].reserved;
                      rows.push(
                        <li key={`${label}-ok`} className="flex items-start gap-2 text-sm">
                          <span className={`font-bold mt-0.5 ${isRes ? "text-amber-500" : "text-green-500"}`}>&#10003;</span>
                          <span className="flex items-center gap-1 flex-wrap">
                            {label} — {isRes ? "Reserved:" : "Booked:"}
                            {succeeded.map((r) => (
                              <RoomBadge key={r.roomName} room={{ name: r.roomName, color: r.roomColor }} />
                            ))}
                          </span>
                        </li>
                      );
                    }

                    if (failed.length > 0) {
                      const msg = failed[0].message;
                      rows.push(
                        <li key={`${label}-err`} className="flex items-start gap-2 text-sm">
                          <span className="text-red-500 font-bold mt-0.5">&#10007;</span>
                          <span className="flex items-center gap-1 flex-wrap">
                            {label} — Not available for:
                            {failed.map((r) => (
                              <RoomBadge key={r.roomName} room={{ name: r.roomName, color: r.roomColor }} />
                            ))}
                            {msg && <span className="text-red-500 ml-1">({msg})</span>}
                          </span>
                        </li>
                      );
                    }

                    return rows;
                  })}
                </ul>
              </div>
            )}
          </div>

          {/* Sticky footer */}
          <div className="flex-shrink-0 border-t border-gray-100 px-4 py-3">
            {bookingResults.length === 0 ? (
              <div className="flex justify-between items-center">
                <button
                  type="button"
                  className="border border-dashed border-blue-400 text-blue-500 rounded px-3 py-1 text-sm hover:bg-blue-50"
                  onClick={() =>
                    append({
                      rooms: [ANY_ROOM_SENTINEL],
                      date: new Date(),
                      duration: 1,
                    })
                  }
                >
                  + Add Row
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 disabled:opacity-50"
                >
                  {isSubmitting ? "Booking..." : "Book All"}
                </button>
              </div>
            ) : (
              <div className="flex justify-end gap-2">
                {bookingResults.some(
                  (r) => r.status === "error" && r.booking
                ) && (
                  <button
                    type="button"
                    disabled={isSubmitting}
                    className="bg-yellow-500 text-white px-4 py-2 rounded hover:bg-yellow-600 disabled:opacity-50"
                    onClick={handleRetry}
                  >
                    {isSubmitting ? "Retrying..." : "Retry Failed"}
                  </button>
                )}
                <button
                  type="button"
                  className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
                  onClick={() => setIsModalOpen(false)}
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

export default BookingModal;