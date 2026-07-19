import { getRoomColor } from "../../../../util/getRoomColor";
import { bookingType } from "../../../../util/types/bookingType";
import { useContext, useState } from "react";
import { format as formatLocal } from "date-fns";
import RebookCount from "./RebookCount";
import { FooterContext } from "../../../../context";
import { getLoyaltyTier } from "../../../tibook/GuestLoyaltyBanner";

interface BookingCardProps {
  booking: bookingType;
  currentGuest: string | null;
  currentAirBnBGuest: string | null;
  airBnBBookingCount: { Alias: string; Room: string; DistinctStartDateCount: number }[];
  guestBookingCount: { GuestId: string; DistinctStartDateCount: number; FirstStayDate: string }[];
  handleBookingConfirmation: (phone: string) => void;
  handleSendCalEvents: (phone: string, email?: string) => void;
  setCurrentGuest: React.Dispatch<React.SetStateAction<string | null>>;
  setCurrentAirBnBGuest: React.Dispatch<React.SetStateAction<string | null>>;
  setSelectedBooking: React.Dispatch<React.SetStateAction<bookingType>>;
  setSelectedModifyBooking: React.Dispatch<React.SetStateAction<bookingType>>;
  setSelectedUnbooking: React.Dispatch<React.SetStateAction<bookingType>>;
  setIsMobileModalOpen?: React.Dispatch<React.SetStateAction<boolean>>;
  onPricingEdit: (booking: bookingType) => void;
}

// Shared pill button styles for the action row
const pillBase = "rounded-lg px-2.5 py-1.5 text-xs font-semibold";
const pillDark = `${pillBase} bg-gray-900 text-white`;
const pillDanger = `${pillBase} border border-red-200 bg-red-50 text-red-600`;
const pillNeutral = `${pillBase} border border-gray-200 bg-white text-gray-700`;
const pillBlue = `${pillBase} bg-blue-600 text-white`;

const BookingCard = ({
  booking,
  currentGuest,
  currentAirBnBGuest,
  airBnBBookingCount,
  guestBookingCount,
  handleBookingConfirmation,
  handleSendCalEvents,
  setCurrentGuest,
  setCurrentAirBnBGuest,
  setSelectedBooking,
  setSelectedModifyBooking,
  setSelectedUnbooking,
  setIsMobileModalOpen,
  onPricingEdit,
}: BookingCardProps) => {
  const { setIsFooterVisible } = useContext(FooterContext)!;
  // Actions are hidden until the ⋯ button is tapped — a wall of buttons on
  // every card read as confusing clutter.
  const [actionsOpen, setActionsOpen] = useState(false);

  const parseLocalDate = (s: string) => {
    const [y, m, d] = s.substring(0, 10).split("-").map(Number);
    return new Date(y, m - 1, d);
  };

  const isReserved = booking.reserved === true;
  const isAirBnB = booking.guest.name === "AirBnB";
  const guestLabel = booking.guest.alias || booking.alias || booking.guest.name;

  const dateRange =
    booking.duration === 1
      ? formatLocal(parseLocalDate(booking.startDate), "MMM d")
      : `${formatLocal(parseLocalDate(booking.startDate), "MMM d")} – ${formatLocal(parseLocalDate(booking.endDate), "MMM d")}`;

  return (
    <div
      className={`relative mb-2 overflow-hidden rounded-xl border ${
        isReserved ? "border-amber-300 bg-amber-50" : "border-gray-200 bg-white"
      }`}
    >
      {/* Room identity as a color accent, not a button-look chip */}
      <div
        className={`absolute inset-y-0 left-0 w-1.5 ${getRoomColor(booking.room.name, booking.room.color)}`}
      />

      <div className="p-3 pl-4">
        <div className="flex items-start gap-2">
          {/* Tap the info area to open booking details (disabled for soft holds) */}
          <button
            type="button"
            onClick={() => !isReserved && setSelectedBooking(booking)}
            className="min-w-0 flex-1 text-left"
          >
            <p className="flex items-center gap-2">
              <span className="truncate text-sm font-semibold text-gray-900">
                {booking.numberOfGuests > 1 && `(${booking.numberOfGuests}) `}
                {guestLabel}
              </span>
              {isReserved && (
                <span className="shrink-0 rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700">
                  Reserved
                </span>
              )}
            </p>
            <p className="mt-0.5 text-xs text-gray-500">
              {booking.room.name} · {dateRange}
              <span className="text-gray-400">
                {" "}
                · {booking.duration} {booking.duration > 1 ? "nights" : "night"}
              </span>
            </p>
          </button>

          {isAirBnB
            ? booking.airbnbPrice && (
                <span className="shrink-0 text-sm font-bold text-gray-900">
                  ${booking.airbnbPrice.toFixed(2)}
                </span>
              )
            : (() => {
                const guestRate =
                  booking.guest.pricing?.find((p) => p.room === booking.room.id)?.price ??
                  booking.price;
                return guestRate ? (
                  <span
                    onClick={() => onPricingEdit(booking)}
                    className="shrink-0 text-sm font-bold text-gray-900 underline decoration-dotted"
                  >
                    ${(guestRate * booking.duration).toFixed(2)}
                  </span>
                ) : null;
              })()}

          {/* Single entry point for all per-booking actions */}
          <button
            type="button"
            onClick={() => setActionsOpen((open) => !open)}
            aria-label="Booking actions"
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border text-sm font-bold leading-none ${
              actionsOpen
                ? "border-gray-900 bg-gray-900 text-white"
                : "border-gray-200 bg-white text-gray-500"
            }`}
          >
            ⋯
          </button>
        </div>

        {/* Return-guest history / loyalty */}
        <div className="mt-1.5">
          {isAirBnB ? (
            <RebookCount booking={booking} airBnBBookingCount={airBnBBookingCount} />
          ) : (
            (() => {
              const entry = guestBookingCount.find((g) => g.GuestId === booking.guest.id);
              const count = entry?.DistinctStartDateCount ?? 0;
              const since = entry?.FirstStayDate
                ? formatLocal(parseLocalDate(entry.FirstStayDate), "MMM yyyy")
                : null;
              const loyaltyTier = getLoyaltyTier(count);
              return (
                <div className="flex flex-wrap items-center gap-1">
                  <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-600">
                    ↩ {count} {count === 1 ? "stay" : "stays"}
                    {since ? ` since ${since}` : ""}
                  </span>
                  {loyaltyTier && (
                    <span
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${loyaltyTier.color}`}
                    >
                      {loyaltyTier.label}
                    </span>
                  )}
                </div>
              );
            })()
          )}
        </div>

        {/* Notes */}
        {(booking.guest.notes || booking.notes) && (
          <p className="mt-1 text-xs italic text-gray-500">
            {booking.guest.notes || booking.notes}
          </p>
        )}

        {/* Action row — only when opened via ⋯ */}
        {actionsOpen && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-gray-100 pt-2">
            {!isAirBnB ? (
              <>
                <input
                  type="checkbox"
                  value={booking.guest.id}
                  onChange={(event) => {
                    if (currentGuest == event.target.value) {
                      setCurrentGuest(null);
                    } else {
                      setCurrentGuest(event.target.value);
                      setIsFooterVisible(true);
                    }
                  }}
                  checked={currentGuest === booking.guest.id}
                  className="mr-0.5 h-4 w-4 accent-black"
                />
                <button
                  type="button"
                  className={pillDark}
                  onClick={() => {
                    setSelectedModifyBooking(booking);
                    if (typeof setIsMobileModalOpen !== "undefined") setIsMobileModalOpen(false);
                  }}
                >
                  Modify
                </button>
                <button
                  type="button"
                  className={pillDanger}
                  onClick={() => setSelectedUnbooking(booking)}
                >
                  Unbook
                </button>
                {booking.guest.phone && (
                  <button
                    type="button"
                    className={pillNeutral}
                    onClick={() => {
                      window.location.href = `sms:${booking.guest.phone}`;
                    }}
                  >
                    Message
                  </button>
                )}
                {currentGuest && (
                  <>
                    <button
                      type="button"
                      className={pillDark}
                      onClick={() => handleBookingConfirmation(booking.guest.phone)}
                    >
                      Confirm
                    </button>
                    <button
                      type="button"
                      className={pillBlue}
                      onClick={() => handleSendCalEvents(booking.guest.phone, booking.guest.email)}
                    >
                      Cal Events
                    </button>
                  </>
                )}
              </>
            ) : (
              <>
                {booking.alias !== "" && (
                  <input
                    type="checkbox"
                    value={booking.alias}
                    onChange={(event) => {
                      if (currentAirBnBGuest == event.target.value) {
                        setCurrentAirBnBGuest(null);
                      } else {
                        setCurrentAirBnBGuest(event.target.value);
                        setIsFooterVisible(true);
                      }
                    }}
                    checked={currentAirBnBGuest === booking.alias}
                    className="mr-0.5 h-4 w-4 accent-black"
                  />
                )}
                <button
                  type="button"
                  className={pillDark}
                  onClick={() => {
                    const url = booking.description.match(
                      /https:\/\/www\.airbnb\.com\/hosting\/reservations\/details\/\S+/,
                    )?.[0];
                    if (url) {
                      window.open(url, "_blank", "noopener,noreferrer");
                    } else {
                      alert("No valid URL found in the description.");
                    }
                  }}
                >
                  Booking Details
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default BookingCard;
