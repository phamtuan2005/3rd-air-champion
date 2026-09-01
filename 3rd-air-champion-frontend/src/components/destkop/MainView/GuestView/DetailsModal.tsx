import { useEffect, useRef, useState } from "react";
import { bookingType, feeType, feesTotal } from "../../../../util/types/bookingType";
import { roomType } from "../../../../util/types/roomType";
import { getRoomColor } from "../../../../util/getRoomColor";
import { FaRegEdit } from "react-icons/fa";
import { useForm, Controller, SubmitHandler } from "react-hook-form";
import { parseReservation } from "../../../../util/airbnbReservation";
import { zodResolver } from "@hookform/resolvers/zod";
import { addDays, format, parseISO } from "date-fns";

// Mirrors the backend default in graphql/resolvers/day.ts — a room here sleeps
// two, so from the third guest the sofa bed is in use.
const SOFA_BED_FROM_GUESTS = 3;
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
    sofaBed?: boolean;
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
  const nightRate = isAirBnB ? 0 : (booking.price ?? 0);
  const feeSum = feesTotal(booking.fees);
  // Grand total: direct = nights × rate + fees; AirBnB = payout + on-site fees.
  const stayTotal = isAirBnB
    ? (booking.airbnbPrice || 0) + feeSum
    : nightRate * booking.duration + feeSum;
  const [isWriting, setIsWriting] = useState(isAirBnB && !booking.airbnbPrice);
  const [isPricingEditing, setIsPricingEditing] = useState(startWithPricingEdit ?? false);
  const [profitInput, setProfitInput] = useState(String(booking.airbnbPrice || 0));
  // What a pasted reservation page turned out to say. Reported back rather than
  // three fields changing under the host's hands.
  const [pasteNote, setPasteNote] = useState<string | null>(null);

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
    watch,
    setValue,
    formState: { errors },
  } = useForm<guestUpdateSchema>({
    resolver: zodResolver(guestUpdateZodObject),
    defaultValues: {
      alias: booking.alias || booking.guest.name,
      notes: booking.notes || "",
      earlyCheckin: booking.earlyCheckin || false,
      lateCheckout: booking.lateCheckout || false,
      sofaBed: booking.sofaBed || false,
      numberOfGuests: booking.numberOfGuests || 1,
    },
  });

  // Raise the guest count to three and the sofa bed request turns itself on —
  // a room here sleeps two, so the third guest is sleeping on it and the
  // cleaner has a bed to make up.
  //
  // Only ever turns it ON, and only as the count crosses the line. Lowering the
  // count again leaves it alone, and unticking it stays unticked: it is a
  // default being offered, not a rule being enforced, and it is offered in the
  // same open form where it can be undone in one tap.
  const watchedGuests = watch("numberOfGuests");
  const watchedSofaBed = watch("sofaBed");
  const crossedRef = useRef(false);
  useEffect(() => {
    const guests = Number(watchedGuests) || 0;
    if (guests >= SOFA_BED_FROM_GUESTS) {
      if (!crossedRef.current && !watchedSofaBed) {
        setValue("sofaBed", true, { shouldDirty: true });
      }
      crossedRef.current = true;
    } else {
      crossedRef.current = false;
    }
  }, [watchedGuests, watchedSofaBed, setValue]);

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
    <div className="modal-type fixed bottom-0 left-0 w-full h-full bg-black bg-opacity-50 flex justify-center items-center z-50">
      {/* Bounded and scrollable. Centred in the viewport with no ceiling, a
          tall booking overflowed at BOTH ends at once — the close button above
          the top of the screen and Save below the bottom, with no way to reach
          either. */}
      <div className="bg-white rounded-xl max-w-lg w-full shadow-xl flex flex-col max-h-[88svh] overflow-hidden">
        {/* Header — stays put, so the way out is always in reach */}
        <div className="flex items-center justify-between shrink-0 px-5 pt-5 pb-4">
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

        <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-5 space-y-4">
          {/* Stay summary — colored room chip, AirBnB tag, dates, nights, total */}
          <div className="rounded-lg bg-gray-50 border border-gray-100 px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className={`${getRoomColor(booking.room.name, booking.room.color)} shrink-0 rounded px-2 py-0.5 text-sm font-semibold text-black`}
                >
                  {booking.room?.name}
                </span>
                {isAirBnB && (
                  <span className="shrink-0 rounded-full bg-[#FF5A5F] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                    Airbnb
                  </span>
                )}
                <span className="shrink-0 text-xs text-gray-400">
                  {booking.duration} night{booking.duration !== 1 ? "s" : ""}
                </span>
              </div>
              {stayTotal > 0 && (
                <span className="shrink-0 text-base font-bold text-emerald-600">
                  ${Math.round(stayTotal).toLocaleString()}
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-gray-500">
              {format(stayCheckIn, "EEE, MMM d")} – {format(stayCheckOut, "EEE, MMM d, yyyy")}
              {!isAirBnB && nightRate > 0 && (
                <span className="text-gray-400">
                  {" · "}${nightRate}/night × {booking.duration}
                  {feeSum ? ` + $${feeSum} fees` : ""}
                </span>
              )}
              {isAirBnB && (booking.airbnbPrice > 0 || feeSum !== 0) && (
                <span className="text-gray-400">
                  {" · "}AirBnB ${booking.airbnbPrice || 0}
                  {feeSum ? ` + $${feeSum} on-site` : ""}
                </span>
              )}
            </p>
          </div>

          {/* Paste the AirBnB page instead of retyping what it already says.
              AirBnB stays only: a direct booking has no such page.

              Above the fields it fills, because reading it after they are typed
              is reading it too late. The name, the guest count and the payout
              are exactly the three this modal edits, and the guest count is the
              one that comes out wrong — the attention is on the name and the
              money.

              The page cannot be fetched from its link (host login, no CORS,
              DataDome), so copying it is the one gesture available on a page
              the host already has open. */}
          {isAirBnB && (
            <div className="rounded-lg border border-rose-200 bg-rose-50/60 px-2.5 py-2">
              <label htmlFor="details-airbnb-paste" className="text-xs font-semibold text-rose-900">
                Paste from AirBnB
              </label>
              <textarea
                id="details-airbnb-paste"
                rows={2}
                placeholder="Open the reservation, select all, paste here"
                onPaste={(e) => {
                  const text = e.clipboardData.getData("text");
                  const r = parseReservation(text);
                  if (!r || !r.alias) return;
                  e.preventDefault();
                  // Swallowed once read: a chute, not a field. A page of text
                  // left sitting in it invites the host to wonder if it saved.
                  (e.target as HTMLTextAreaElement).value = "";
                  const took: string[] = [];
                  setValue("alias", r.alias, { shouldDirty: true });
                  took.push(r.alias);
                  if (r.guests) {
                    setValue("numberOfGuests", Math.min(Math.max(r.guests, 1), 4), {
                      shouldDirty: true,
                    });
                    took.push(`${r.guests} guest${r.guests === 1 ? "" : "s"}`);
                  }
                  if (r.payout != null) {
                    // To the cent — the cents ARE the payout.
                    setProfitInput(String(r.payout));
                    setIsWriting(true);
                    took.push(`$${r.payout.toFixed(2)}`);
                  }
                  setPasteNote(took.length ? `Read ${took.join(" · ")} — press Save` : null);
                }}
                className="mt-1 w-full resize-none rounded border border-rose-200 px-2 py-1 text-xs focus:border-rose-400 focus:outline-none"
              />
              {pasteNote && (
                <p className="mt-1 text-[11px] font-semibold text-emerald-700">{pasteNote}</p>
              )}
            </div>
          )}

          {/* Additional fees (parking, cleaning, cancellation, …) — right under
              the summary. Shown for AirBnB too: some guests pay these on-site
              directly to the host, outside the AirBnB payout. */}
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
                    <span className="font-bold text-emerald-600">${feeSum.toFixed(2)}</span>
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

          {/* Early Check-in + Late Checkout + Sofa Bed + Guests row */}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
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
              {/* The one special request that makes WORK for somebody else. The
                  other two move a time; this one is a bed to make up, and the
                  cleaner has to be told — see TiWork's rota. */}
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">Sofa Bed</p>
              {isWriting ? (
                <Controller
                  name="sofaBed"
                  control={control}
                  render={({ field }) => (
                    <input
                      id="sofaBed"
                      type="checkbox"
                      checked={field.value ?? false}
                      onChange={(e) => field.onChange(e.target.checked)}
                      className="w-4 h-4"
                    />
                  )}
                />
              ) : (
                <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${booking.sofaBed ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                  {booking.sofaBed ? "Yes" : "No"}
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

        </div>

        {/* Edit actions — a FOOTER of the panel, not a sticky bar inside the
            scroll.
            Sticky, it floated over whatever happened to be under it: on an
            AirBnB stay that was the Profit field, so the one number the host had
            opened the modal to change was hidden behind the button that saves
            it. Out here it has its own row and the body scrolls above it, which
            is the layout the header already uses at the other end. */}
        {isWriting && (
          <div className="flex shrink-0 justify-end gap-2 border-t border-gray-100 bg-white px-5 py-3">
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
  );
};

export default DetailsModal;