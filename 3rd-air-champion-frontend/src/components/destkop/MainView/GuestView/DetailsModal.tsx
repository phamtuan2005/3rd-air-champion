import { useState } from "react";
import { bookingType } from "../../../../util/types/bookingType";
import { roomType } from "../../../../util/types/roomType";
import { FaRegEdit } from "react-icons/fa";
import { useForm, Controller, SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format, parseISO } from "date-fns";
import {
  guestUpdateSchema,
  guestUpdateZodObject,
} from "./zodUpdateGuest";
import Pricing from "./Pricing";

interface DetailsModalProps {
  booking: bookingType;
  rooms: roomType[];
  startWithPricingEdit?: boolean;
  airBnBBookingCount: { Alias: string; Room: string; DistinctStartDateCount: number }[];
  guestBookingCount: { GuestId: string; DistinctStartDateCount: number; FirstStayDate: string }[];
  onClose: () => void;
  onUpdateGuests: (data: {
    id: string;
    alias: string;
    numberOfGuests: number;
    notes?: string;
    earlyCheckin?: boolean;
    lateCheckout?: boolean;
  }) => void;
  onAirbnbPriceUpdate?: (bookingId: string, airbnbPrice: number) => void;
  onPricingUpdate: (data: { guest: string; room: string; price: number }[]) => void;
}

const DetailsModal = ({
  booking,
  rooms,
  startWithPricingEdit,
  airBnBBookingCount,
  guestBookingCount,
  onClose,
  onUpdateGuests,
  onAirbnbPriceUpdate,
  onPricingUpdate,
}: DetailsModalProps) => {
  const isAirBnB = booking.guest.name === "AirBnB";
  const [isWriting, setIsWriting] = useState(isAirBnB && !booking.airbnbPrice);
  const [isPricingEditing, setIsPricingEditing] = useState(startWithPricingEdit ?? false);
  const [profitInput, setProfitInput] = useState(String(booking.airbnbPrice || 0));
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<guestUpdateSchema>({
    resolver: zodResolver(guestUpdateZodObject),
    defaultValues: {
      alias: booking.alias || booking.guest.name,
      notes: booking.notes || "",
      earlyCheckin: booking.earlyCheckin || false,
      lateCheckout: booking.lateCheckout || false,
      numberOfGuests: booking.numberOfGuests || 1,
    },
  });

  const onSubmit: SubmitHandler<guestUpdateSchema> = (data) => {
    const processedData = { ...data, id: booking.id };
    setIsWriting(false);
    onClose();
    onUpdateGuests(processedData);
    if (isAirBnB && onAirbnbPriceUpdate) {
      const parsed = parseFloat(profitInput);
      onAirbnbPriceUpdate(booking.id, isNaN(parsed) ? 0 : parsed);
    }
  };

  const handleCancel = () => {
    reset();
    setProfitInput(String(booking.airbnbPrice || 0));
    setIsWriting(false);
  };

  return (
    <div className="fixed bottom-0 left-0 w-full h-full bg-black bg-opacity-50 flex justify-center items-center z-50">
      <div className="bg-white rounded-xl p-5 max-w-lg w-full shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex flex-col items-start gap-1">
            <div className="flex items-center gap-2">
              {isWriting ? (
                <Controller
                  name="alias"
                  control={control}
                  render={({ field }) => (
                    <div>
                      <input
                        {...field}
                        type="text"
                        className="border rounded px-2 py-1 text-lg font-bold w-full"
                        placeholder="Alias"
                      />
                      {errors.alias && (
                        <span className="text-red-500 text-sm">{errors.alias.message}</span>
                      )}
                    </div>
                  )}
                />
              ) : (
                <h1 className="text-lg font-bold text-gray-800">
                  {booking.alias || booking.guest.name}
                </h1>
              )}
              <button
                type="button"
                onClick={() => setIsWriting(!isWriting)}
                className="text-gray-400 hover:text-gray-600"
              >
                <FaRegEdit size={14} />
              </button>
            </div>
            {!isWriting && (() => {
              if (isAirBnB) {
                const total = airBnBBookingCount
                  .filter((g) => g.Alias === booking.alias)
                  .reduce((acc, b) => acc + b.DistinctStartDateCount, 0);
                if (airBnBBookingCount.length === 0) return null;
                return total === 0 ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-400">
                    First stay
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-600 border border-amber-200">
                    ↩ {total} {total === 1 ? "stay" : "stays"}
                  </span>
                );
              }
              const entry = guestBookingCount.find((g) => g.GuestId === booking.guest.id);
              const count = entry?.DistinctStartDateCount ?? 0;
              const since = entry?.FirstStayDate ? format(parseISO(entry.FirstStayDate), "MMM yyyy") : null;
              return (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-600 border border-amber-200">
                  ↩ {count} {count === 1 ? "stay" : "stays"}{since ? ` since ${since}` : ""}
                </span>
              );
            })()}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none px-2"
          >
            &times;
          </button>
        </div>

        <div className="space-y-4">
          {/* Notes */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">Notes</p>
            {isWriting ? (
              <Controller
                name="notes"
                control={control}
                render={({ field }) => (
                  <div>
                    <textarea
                      {...field}
                      className="border rounded px-2 py-1 w-full text-sm"
                      placeholder="Notes"
                    />
                    {errors.notes && (
                      <span className="text-red-500 text-sm">{errors.notes.message}</span>
                    )}
                  </div>
                )}
              />
            ) : (
              <p className={`text-sm px-3 py-2 rounded-md bg-gray-50 border border-gray-100 ${!booking.notes ? "italic text-gray-400" : "text-gray-700"}`}>
                {booking.notes || "No notes"}
              </p>
            )}
          </div>

          {/* Phone */}
          {!isAirBnB && booking.guest.phone && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">Phone</p>
              <a
                href={`tel:${booking.guest.phone}`}
                className="text-sm text-blue-500 hover:text-blue-700"
              >
                {booking.guest.phone}
              </a>
            </div>
          )}

          {/* Early Check-in + Late Checkout + Guests row */}
          <div className="flex items-center gap-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">Early Check-in</p>
              {isWriting ? (
                <Controller
                  name="earlyCheckin"
                  control={control}
                  render={({ field }) => (
                    <input
                      id="earlyCheckin"
                      type="checkbox"
                      checked={field.value ?? false}
                      onChange={(e) => field.onChange(e.target.checked)}
                      className="w-4 h-4"
                    />
                  )}
                />
              ) : (
                <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${booking.earlyCheckin ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                  {booking.earlyCheckin ? "Yes" : "No"}
                </span>
              )}
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">Late Checkout</p>
              {isWriting ? (
                <Controller
                  name="lateCheckout"
                  control={control}
                  render={({ field }) => (
                    <input
                      id="lateCheckout"
                      type="checkbox"
                      checked={field.value ?? false}
                      onChange={(e) => field.onChange(e.target.checked)}
                      className="w-4 h-4"
                    />
                  )}
                />
              ) : (
                <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${booking.lateCheckout ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                  {booking.lateCheckout ? "Yes" : "No"}
                </span>
              )}
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">Guests</p>
              {isWriting ? (
                <Controller
                  name="numberOfGuests"
                  control={control}
                  render={({ field }) => (
                    <div>
                      <input
                        {...field}
                        type="number"
                        onChange={(event) =>
                          field.onChange(
                            event.target.value === "" ? event.target.value : +event.target.value
                          )
                        }
                        className="border rounded px-2 py-1 w-20 text-sm"
                        placeholder="1"
                      />
                      {errors.numberOfGuests && (
                        <span className="text-red-500 text-sm">{errors.numberOfGuests.message}</span>
                      )}
                    </div>
                  )}
                />
              ) : (
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-600">
                  {booking.numberOfGuests ?? 1}
                </span>
              )}
            </div>
          </div>

          {/* Pricing */}
          {!isAirBnB && (
            <div className="border-t border-gray-100 pt-3">
              <Pricing
                booking={booking}
                rooms={rooms.filter((r) => r.active)}
                isEditing={isPricingEditing}
                onPricingUpdate={(data) => {
                  onPricingUpdate(data);
                  setIsPricingEditing(false);
                }}
                setIsEditing={setIsPricingEditing}
              />
            </div>
          )}

          {/* AirBnB Profit */}
          {isAirBnB && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1 flex items-center gap-1.5">
                Profit
                {!booking.airbnbPrice && (
                  <span className="bg-orange-400 text-white rounded-full px-1.5 py-px text-[9px] font-bold leading-none">
                    missing
                  </span>
                )}
              </p>
              {isWriting ? (
                <input
                  id="airbnbPrice"
                  type="text"
                  inputMode="decimal"
                  value={profitInput}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (/^\d*\.?\d{0,2}$/.test(val)) setProfitInput(val);
                  }}
                  className={`border rounded px-2 py-1 w-full text-sm ${!booking.airbnbPrice ? "border-orange-400 ring-1 ring-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-400" : ""}`}
                  placeholder="0.00"
                  autoFocus={!booking.airbnbPrice}
                />
              ) : (
                <span className="text-sm font-semibold text-gray-800">${booking.airbnbPrice || 0}</span>
              )}
            </div>
          )}

          {/* Edit actions */}
          {isWriting && (
            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
              <button
                onClick={handleSubmit(onSubmit)}
                className="px-4 py-1.5 bg-green-500 hover:bg-green-600 text-white text-sm rounded-md"
              >
                Save
              </button>
              <button
                onClick={handleCancel}
                className="px-4 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm rounded-md"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DetailsModal;