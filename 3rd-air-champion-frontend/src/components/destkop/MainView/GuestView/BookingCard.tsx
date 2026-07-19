import { getRoomColor } from "../../../../util/getRoomColor";
import { bookingType } from "../../../../util/types/bookingType";
import { useContext, useState } from "react";
import { createPortal } from "react-dom";
import {
  FaAirbnb,
  FaDollarSign,
  FaFilter,
  FaRegCalendarAlt,
  FaRegCalendarPlus,
  FaRegCheckCircle,
  FaRegCommentDots,
  FaRegTrashAlt,
} from "react-icons/fa";
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

// Full-width action rows for the guest action modal
const rowBase =
  "flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-semibold";
const rowPrimary = `${rowBase} bg-gray-900 text-white`;
const rowNeutral = `${rowBase} border border-gray-200 bg-white text-gray-700`;
const rowDanger = `${rowBase} border border-red-200 bg-red-50 text-red-600`;

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
  // All per-booking actions live in a centered modal focused on this guest —
  // an inline row of small buttons on every card read as clutter.
  const [actionsOpen, setActionsOpen] = useState(false);

  const parseLocalDate = (s: string) => {
    const [y, m, d] = s.substring(0, 10).split("-").map(Number);
    return new Date(y, m - 1, d);
  };

  const isReserved = booking.reserved === true;
  const isAirBnB = booking.guest.name === "AirBnB";
  const guestLabel = booking.guest.alias || booking.alias || booking.guest.name;
  const roomColor = getRoomColor(booking.room.name, booking.room.color);

  const guestRate = isAirBnB
    ? null
    : (booking.guest.pricing?.find((p) => p.room === booking.room.id)?.price ?? booking.price);

  const dateRange =
    booking.duration === 1
      ? formatLocal(parseLocalDate(booking.startDate), "MMM d")
      : `${formatLocal(parseLocalDate(booking.startDate), "MMM d")} – ${formatLocal(parseLocalDate(booking.endDate), "MMM d")}`;

  // The calendar-highlight filter (previously a bare checkbox on each card)
  const isFiltered = isAirBnB
    ? currentAirBnBGuest === booking.alias
    : currentGuest === booking.guest.id;

  const toggleFilter = () => {
    if (isAirBnB) {
      if (currentAirBnBGuest === booking.alias) {
        setCurrentAirBnBGuest(null);
      } else {
        setCurrentAirBnBGuest(booking.alias);
        setIsFooterVisible(true);
      }
    } else {
      if (currentGuest === booking.guest.id) {
        setCurrentGuest(null);
      } else {
        setCurrentGuest(booking.guest.id);
        setIsFooterVisible(true);
      }
    }
  };

  const closeThen = (action: () => void) => {
    setActionsOpen(false);
    action();
  };

  return (
    <div
      className={`relative mb-2 overflow-hidden rounded-xl border ${
        isReserved ? "border-amber-300 bg-amber-50" : "border-gray-200 bg-white"
      }`}
    >
      {/* Room identity as a color accent, not a button-look chip */}
      <div className={`absolute inset-y-0 left-0 w-3 ${roomColor}`} />

      <div className="p-3 pl-5">
        <div className="flex items-start gap-2">
          {/* Tap the info area to open booking details (disabled for soft holds) */}
          <button
            type="button"
            onClick={() => !isReserved && setSelectedBooking(booking)}
            className="min-w-0 flex-1 text-left"
          >
            <p className="flex items-center gap-2">
              <span className="truncate text-base font-bold text-gray-900">
                {booking.numberOfGuests > 1 && `(${booking.numberOfGuests}) `}
                {guestLabel}
              </span>
              {/* Booking source must be readable at first glance; direct guests
                  are already identified by their loyalty badges instead */}
              {isAirBnB && (
                <span className="shrink-0 rounded-full bg-[#FF5A5F] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                  Airbnb
                </span>
              )}
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

          {/* Profit is the reward — big, green, whole dollars */}
          {isAirBnB
            ? booking.airbnbPrice && (
                <span className="shrink-0 text-lg font-bold text-emerald-600">
                  ${Math.round(booking.airbnbPrice).toLocaleString()}
                </span>
              )
            : guestRate && (
                <span
                  onClick={() => onPricingEdit(booking)}
                  className="shrink-0 text-lg font-bold text-emerald-600 underline decoration-dotted"
                >
                  ${Math.round(guestRate * booking.duration).toLocaleString()}
                </span>
              )}

          {/* Single entry point for all per-guest actions */}
          <button
            type="button"
            onClick={() => setActionsOpen(true)}
            aria-label="Guest actions"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white text-lg font-bold leading-none text-gray-600"
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
      </div>

      {/* Guest action modal — everything about this guest in one place.
          Portaled to <body> so transformed/scrolling panel ancestors can't clip it. */}
      {actionsOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 p-4 sm:items-center"
            onClick={() => setActionsOpen(false)}
          >
            <div
              className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className={`h-2 ${roomColor}`} />
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2">
                      <span className="truncate text-lg font-bold text-gray-900">{guestLabel}</span>
                      {isAirBnB && (
                        <span className="shrink-0 rounded-full bg-[#FF5A5F] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                          Airbnb
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-500">
                      {booking.room.name} · {dateRange} · {booking.duration}{" "}
                      {booking.duration > 1 ? "nights" : "night"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActionsOpen(false)}
                    aria-label="Close"
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xl leading-none text-gray-400"
                  >
                    &times;
                  </button>
                </div>

                <div className="mt-4 flex flex-col gap-2">
                  {/* Calendar filter — replaces the old per-card checkbox
                      (AirBnB stays are only filterable when they have an alias) */}
                  {(!isAirBnB || booking.alias !== "") && (
                    <button
                      type="button"
                      onClick={toggleFilter}
                      className={`${rowBase} flex items-center justify-between border ${
                        isFiltered
                          ? "border-gray-900 bg-gray-900 text-white"
                          : "border-gray-200 bg-white text-gray-700"
                      }`}
                    >
                      <FaFilter size={14} className="shrink-0" />
                      <span className="flex-1">Filter stays on calendar</span>
                      <span className="text-xs font-bold">{isFiltered ? "ON" : "OFF"}</span>
                    </button>
                  )}

                  {!isAirBnB ? (
                    <>
                      <button
                        type="button"
                        className={rowPrimary}
                        onClick={() =>
                          closeThen(() => {
                            setSelectedModifyBooking(booking);
                            if (typeof setIsMobileModalOpen !== "undefined")
                              setIsMobileModalOpen(false);
                          })
                        }
                      >
                        <FaRegCalendarAlt size={14} className="shrink-0" />
                        Modify Booking
                      </button>
                      {booking.guest.phone && (
                        <>
                          <button
                            type="button"
                            className={rowNeutral}
                            onClick={() =>
                              closeThen(() => handleBookingConfirmation(booking.guest.phone))
                            }
                          >
                            <FaRegCheckCircle size={14} className="shrink-0" />
                            Send Confirmation
                          </button>
                          <button
                            type="button"
                            className={rowNeutral}
                            onClick={() =>
                              closeThen(() =>
                                handleSendCalEvents(booking.guest.phone, booking.guest.email),
                              )
                            }
                          >
                            <FaRegCalendarPlus size={14} className="shrink-0" />
                            Send Calendar Events
                          </button>
                          <button
                            type="button"
                            className={rowNeutral}
                            onClick={() =>
                              closeThen(() => {
                                window.location.href = `sms:${booking.guest.phone}`;
                              })
                            }
                          >
                            <FaRegCommentDots size={14} className="shrink-0" />
                            Message Guest
                          </button>
                        </>
                      )}
                      {guestRate != null && guestRate > 0 && (
                        <button
                          type="button"
                          className={rowNeutral}
                          onClick={() => closeThen(() => onPricingEdit(booking))}
                        >
                          <FaDollarSign size={14} className="shrink-0" />
                          Edit Pricing
                        </button>
                      )}
                      <button
                        type="button"
                        className={rowDanger}
                        onClick={() => closeThen(() => setSelectedUnbooking(booking))}
                      >
                        <FaRegTrashAlt size={14} className="shrink-0" />
                        Unbook
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className={rowPrimary}
                      onClick={() =>
                        closeThen(() => {
                          const url = booking.description.match(
                            /https:\/\/www\.airbnb\.com\/hosting\/reservations\/details\/\S+/,
                          )?.[0];
                          if (url) {
                            window.open(url, "_blank", "noopener,noreferrer");
                          } else {
                            alert("No valid URL found in the description.");
                          }
                        })
                      }
                    >
                      <FaAirbnb size={16} className="shrink-0" />
                      Open on Airbnb
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
};

export default BookingCard;
