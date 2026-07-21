import { useState } from "react";
import { bookingType, feeType, feesTotal } from "../../../../util/types/bookingType";
import { roomType } from "../../../../util/types/roomType";
import { FaRegEdit } from "react-icons/fa";
import { useForm, Controller, SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { addDays, format, parseISO } from "date-fns";
import {
  guestUpdateSchema,
  guestUpdateZodObject,
} from "./zodUpdateGuest";
import Pricing from "./Pricing";
import { getLoyaltyTier } from "../../../tibook/GuestLoyaltyBanner";

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
  onFeesUpdate?: (bookingId: string, fees: feeType[]) => void;
  onPricingUpdate: (data: { guest: string; room: string; price: number }[]) => void;
}

// Common extra charges offered as one-tap presets; "+ Custom" adds a blank line.
const FEE_PRESETS = ["Parking", "Cleaning", "Cancellation", "Pet", "Late checkout"];

const DetailsModal = ({
  booking,
  rooms,
  startWithPricingEdit,
  airBnBBookingCount,
  guestBookingCount,
  onClose,
  onUpdateGuests,
  onAirbnbPriceUpdate,
  onFeesUpdate,
  onPricingUpdate,
}: DetailsModalProps) => {
  const isAirBnB = booking.guest.name === "AirBnB";
  // Stay summary — shown for every booking (dates + nights); direct guests also
  // get the running total (nights × negotiated rate + fees).
  const parseLocalDate = (s: string) => {
    const [y, m, d] = s.substring(0, 10).split("-").map(Number);
    return new Date(y, m - 1, d);
  };
  const stayCheckIn = parseLocalDate(booking.startDate);
  const stayCheckOut = addDays(stayCheckIn, booking.duration);
  const nightRate = isAirBnB
    ? 0
    : (booking.guest.pricing?.find((p) => p.room === booking.room.id)?.price ?? booking.price);
  const stayTotal = nightRate * booking.duration + feesTotal(booking.fees);
  const [isWriting, setIsWriting] = useState(isAirBnB && !booking.airbnbPrice);
  const [isPricingEditing, setIsPricingEditing] = useState(startWithPricingEdit ?? false);
  const [profitInput, setProfitInput] = useState(String(booking.airbnbPrice || 0));

  // Fees are edited in their own inline section (amounts kept as strings so a
  // partial "-" or "1." is typable; coerced on save). A negative amount is a
  // discount.
  const [isFeesEditing, setIsFeesEditing] = useState(false);
  const [feeDraft, setFeeDraft] = useState<{ label: string; amount: string }[]>(
    (booking.fees ?? []).map((f) => ({ label: f.label, amount: String(f.amount) })),
  );
  const addFeeLine = (label: string) =>
    setFeeDraft((prev) => [...prev, { label, amount: "" }]);
  const setFeeLine = (i: number, patch: Partial<{ label: string; amount: string }>) =>
    setFeeDraft((prev) => prev.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));
  const removeFeeLine = (i: number) =>
    setFeeDraft((prev) => prev.filter((_, idx) => idx !== i));
  const cancelFees = () => {
    setFeeDraft((booking.fees ?? []).map((f) => ({ label: f.label, amount: String(f.amount) })));
    setIsFeesEditing(false);
  };
  const saveFees = () => {
    const cleaned: feeType[] = feeDraft
      .map((f) => ({ label: f.label.trim(), amount: Number(f.amount) || 0 }))
      .filter((f) => f.label !== "" || f.amount !== 0);
    onFeesUpdate?.(booking.id, cleaned);
    setIsFeesEditing(false);
    onClose();
  };
  const draftFeesTotal = feeDraft.reduce((s, f) => s + (Number(f.amount) || 0), 0);
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
              const loyaltyTier = getLoyaltyTier(count);
              return (
                <div className="flex flex-wrap items-center gap-1">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-600 border border-amber-200">
                    ↩ {count} {count === 1 ? "stay" : "stays"}{since ? ` since ${since}` : ""}
                  </span>
                  {loyaltyTier && (
                    <span className={`inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full border ${loyaltyTier.color}`}>
                      {loyaltyTier.label}
                    </span>
                  )}
                </div>
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
          {/* Stay summary — room, dates, nights, and (direct guests) the total */}
          <div className="rounded-lg bg-gray-50 border border-gray-100 px-3 py-2">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-sm font-semibold text-gray-800">
                {booking.room?.name}
                <span className="ml-1 text-xs font-normal text-gray-400">
                  {booking.duration} night{booking.duration !== 1 ? "s" : ""}
                </span>
              </p>
              {!isAirBnB && nightRate > 0 && (
                <span className="shrink-0 text-base font-bold text-emerald-600">
                  ${Math.round(stayTotal).toLocaleString()}
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-gray-500">
              {format(stayCheckIn, "EEE, MMM d")} – {format(stayCheckOut, "EEE, MMM d, yyyy")}
              {!isAirBnB && nightRate > 0 && (
                <span className="text-gray-400">
                  {" · "}${nightRate}/night × {booking.duration}
                  {feesTotal(booking.fees) ? ` + $${feesTotal(booking.fees)} fees` : ""}
                </span>
              )}
            </p>
          </div>

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
                href={`sms:${booking.guest.phone}`}
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

          {/* Additional fees (parking, cleaning, cancellation, …) — direct guests only */}
          {!isAirBnB && (
            <div className="border-t border-gray-100 pt-3">
              <div className="mb-1 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Additional fees
                </p>
                {!isFeesEditing && (
                  <button
                    type="button"
                    onClick={() => setIsFeesEditing(true)}
                    className="text-xs font-semibold text-blue-500 hover:text-blue-700"
                  >
                    {(booking.fees?.length ?? 0) > 0 ? "Edit" : "+ Add"}
                  </button>
                )}
              </div>

              {!isFeesEditing ? (
                (booking.fees?.length ?? 0) === 0 ? (
                  <p className="text-sm italic text-gray-400">No extra fees</p>
                ) : (
                  <div className="space-y-1">
                    {booking.fees!.map((f, i) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <span className="text-gray-700">{f.label || "Fee"}</span>
                        <span
                          className={`font-semibold ${f.amount < 0 ? "text-red-500" : "text-gray-800"}`}
                        >
                          {f.amount < 0 ? "-" : ""}${Math.abs(f.amount).toFixed(2)}
                        </span>
                      </div>
                    ))}
                    <div className="flex items-center justify-between border-t border-gray-100 pt-1 text-sm">
                      <span className="font-semibold text-gray-700">Fees total</span>
                      <span className="font-bold text-emerald-600">
                        ${feesTotal(booking.fees).toFixed(2)}
                      </span>
                    </div>
                  </div>
                )
              ) : (
                <div>
                  {/* One-tap presets + custom */}
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {FEE_PRESETS.map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => addFeeLine(p)}
                        className="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                      >
                        + {p}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => addFeeLine("")}
                      className="rounded-full border border-dashed border-gray-300 px-2.5 py-1 text-xs font-semibold text-gray-500 hover:bg-gray-50"
                    >
                      + Custom
                    </button>
                  </div>

                  {feeDraft.length === 0 ? (
                    <p className="mb-2 text-xs text-gray-400">Tap a preset above to add a fee</p>
                  ) : (
                    <div className="mb-2 space-y-1.5">
                      {feeDraft.map((f, i) => (
                        <div key={i} className="flex items-center gap-1.5">
                          <input
                            className="min-w-0 flex-1 rounded border px-2 py-1 text-sm"
                            placeholder="Fee label"
                            value={f.label}
                            onChange={(e) => setFeeLine(i, { label: e.target.value })}
                          />
                          <span className="text-sm text-gray-500">$</span>
                          <input
                            className="w-20 rounded border px-2 py-1 text-sm"
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            value={f.amount}
                            onChange={(e) => setFeeLine(i, { amount: e.target.value })}
                          />
                          <button
                            type="button"
                            onClick={() => removeFeeLine(i)}
                            aria-label="Remove fee"
                            className="px-1 text-lg leading-none text-gray-400 hover:text-red-500"
                          >
                            &times;
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="font-semibold text-gray-700">Fees total</span>
                    <span className="font-bold text-emerald-600">${draftFeesTotal.toFixed(2)}</span>
                  </div>
                  <p className="mb-2 text-[10px] text-gray-400">
                    Use a negative amount for a discount.
                  </p>

                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={saveFees}
                      className="rounded-md bg-green-500 px-4 py-1.5 text-sm text-white hover:bg-green-600"
                    >
                      Save fees
                    </button>
                    <button
                      type="button"
                      onClick={cancelFees}
                      className="rounded-md bg-gray-200 px-4 py-1.5 text-sm text-gray-700 hover:bg-gray-300"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
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