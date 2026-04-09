import { useState } from "react";
import { bookingType } from "../../../../util/types/bookingType";
import { FaRegEdit } from "react-icons/fa";
import { useForm, Controller, SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  guestUpdateSchema,
  guestUpdateZodObject,
} from "../../../../util/zodUpdateGuest";

interface DetailsModalProps {
  booking: bookingType;
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
}

const DetailsModal = ({
  booking,
  onClose,
  onUpdateGuests,
  onAirbnbPriceUpdate,
}: DetailsModalProps) => {
  const isAirBnB = booking.guest.name === "AirBnB";
  const [isWriting, setIsWriting] = useState(false);
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
      <div className="bg-white rounded-lg p-4 max-w-lg w-full shadow-lg">
        <button
          onClick={onClose}
          className="text-gray-700 font-bold text-[1.5rem]"
        >
          &times;
        </button>
        <div className="space-y-4">
          <div className="flex items-center space-x-4">
            {isWriting ? (
              <Controller
                name="alias"
                control={control}
                render={({ field }) => (
                  <div>
                    <input
                      {...field}
                      type="text"
                      className="border rounded px-2 py-1 w-full"
                      placeholder="Alias"
                    />
                    {errors.alias && (
                      <span className="text-red-500 text-sm">
                        {errors.alias.message}
                      </span>
                    )}
                  </div>
                )}
              />
            ) : (
              <h1 className="text-lg font-bold">
                {booking.alias || booking.guest.name}
              </h1>
            )}
            <button type="button" onClick={() => setIsWriting(!isWriting)}>
              <FaRegEdit />
            </button>
          </div>
          <div>
            <label htmlFor="notes" className="font-semibold">
              Notes:
            </label>
            {isWriting ? (
              <Controller
                name="notes"
                control={control}
                render={({ field }) => (
                  <div>
                    <textarea
                      {...field}
                      className="border rounded px-2 py-1 w-full"
                      placeholder="Notes"
                    />
                    {errors.notes && (
                      <span className="text-red-500 text-sm">
                        {errors.notes.message}
                      </span>
                    )}
                  </div>
                )}
              />
            ) : (
              <p>{booking.notes || "No notes available"}</p>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <label htmlFor="earlyCheckin" className="font-semibold">
              Early Check-in:
            </label>
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
              <span>{booking.earlyCheckin ? "Yes" : "No"}</span>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <label htmlFor="lateCheckout" className="font-semibold">
              Late Checkout:
            </label>
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
              <span>{booking.lateCheckout ? "Yes" : "No"}</span>
            )}
          </div>
          <div>
            <label htmlFor="numberOfGuests" className="font-semibold">
              Number of Guests:
            </label>
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
                          event.target.value === ""
                            ? event.target.value
                            : +event.target.value
                        )
                      }
                      className="border rounded px-2 py-1 w-full"
                      placeholder="Number of Guests"
                    />
                    {errors.numberOfGuests && (
                      <span className="text-red-500 text-sm">
                        {errors.numberOfGuests.message}
                      </span>
                    )}
                  </div>
                )}
              />
            ) : (
              <p>{booking.numberOfGuests}</p>
            )}
          </div>
          {isAirBnB && (
            <div>
              <label htmlFor="airbnbPrice" className="font-semibold">
                Profit:
              </label>
              {isWriting ? (
                <input
                  id="airbnbPrice"
                  type="text"
                  inputMode="decimal"
                  value={profitInput}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (/^\d*\.?\d{0,2}$/.test(val)) {
                      setProfitInput(val);
                    }
                  }}
                  className="border rounded px-2 py-1 w-full"
                  placeholder="0.00"
                />
              ) : (
                <p>${booking.airbnbPrice || 0}</p>
              )}
            </div>
          )}
          {isWriting && (
            <div className="flex justify-end space-x-4 mt-4">
              <button
                onClick={handleSubmit(onSubmit)}
                className="px-4 py-2 bg-green-500 text-white rounded"
              >
                Submit
              </button>
              <button
                onClick={handleCancel}
                className="px-4 py-2 bg-gray-500 text-white rounded"
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
