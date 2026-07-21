import { getRoomColor } from "../../../../util/getRoomColor";
import { bookingType, feesTotal } from "../../../../util/types/bookingType";
import { useContext, useRef, useState } from "react";
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
  onRequestUnbook: (booking: bookingType) => void;
  setIsMobileModalOpen?: React.Dispatch<React.SetStateAction<boolean>>;
  onPricingEdit: (booking: bookingType) => void;
}

// Full-width action rows for the guest action palette (compact — it floats
// over the calendar and must not cover it)
const rowBase =
  "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold";
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
  onRequestUnbook,
  setIsMobileModalOpen,
  onPricingEdit,
}: BookingCardProps) => {
  const { setIsFooterVisible } = useContext(FooterContext)!;
  // All per-booking actions live in a small draggable palette focused on this
  // guest. It must not block the calendar: after toggling the filter the host
  // taps calendar dates to mark which nights are paid.
  const [actionsOpen, setActionsOpen] = useState(false);
  const DEFAULT_PALETTE_WIDTH = 212;
  const [palettePos, setPalettePos] = useState({ x: 16, y: 96 });
  // h === null → size to content; set once the user drags the resize grip
  const [paletteSize, setPaletteSize] = useState<{ w: number; h: number | null }>({
    w: DEFAULT_PALETTE_WIDTH,
    h: null,
  });
  const paletteRef = useRef<HTMLDivElement | null>(null);
  const dragOffset = useRef<{ dx: number; dy: number } | null>(null);
  const resizeStart = useRef<{ x: number; y: number; w: number; h: number } | null>(null);

  const openActions = () => {
    setPalettePos({
      x: Math.max(8, Math.round(window.innerWidth / 2 - DEFAULT_PALETTE_WIDTH / 2)),
      y: 96,
    });
    setPaletteSize({ w: DEFAULT_PALETTE_WIDTH, h: null });
    setActionsOpen(true);
  };

  const onDragStart = (e: React.PointerEvent) => {
    dragOffset.current = { dx: e.clientX - palettePos.x, dy: e.clientY - palettePos.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onDragMove = (e: React.PointerEvent) => {
    if (!dragOffset.current) return;
    setPalettePos({
      x: Math.min(Math.max(4, e.clientX - dragOffset.current.dx), window.innerWidth - paletteSize.w + 40),
      y: Math.min(Math.max(4, e.clientY - dragOffset.current.dy), window.innerHeight - 80),
    });
  };
  const onDragEnd = () => {
    dragOffset.current = null;
  };

  const onResizeStart = (e: React.PointerEvent) => {
    e.stopPropagation();
    resizeStart.current = {
      x: e.clientX,
      y: e.clientY,
      w: paletteSize.w,
      h: paletteRef.current?.offsetHeight ?? 300,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onResizeMove = (e: React.PointerEvent) => {
    if (!resizeStart.current) return;
    setPaletteSize({
      w: Math.min(Math.max(176, resizeStart.current.w + e.clientX - resizeStart.current.x), 400),
      h: Math.min(Math.max(150, resizeStart.current.h + e.clientY - resizeStart.current.y), 640),
    });
  };
  const onResizeEnd = () => {
    resizeStart.current = null;
  };

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
  // Extra fees (parking, cleaning, on-site AirBnB charges, …) fold into the total
  const feeSum = feesTotal(booking.fees);

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
            ? (booking.airbnbPrice || feeSum) && (
                <span
                  className="shrink-0 text-lg font-bold text-emerald-600"
                  title={feeSum ? `AirBnB $${Math.round(booking.airbnbPrice || 0)} + on-site $${feeSum}` : undefined}
                >
                  ${Math.round((booking.airbnbPrice || 0) + feeSum).toLocaleString()}
                </span>
              )
            : guestRate && (
                <span
                  onClick={() => onPricingEdit(booking)}
                  className="shrink-0 text-lg font-bold text-emerald-600 underline decoration-dotted"
                  title={feeSum ? `Nights $${Math.round(guestRate * booking.duration)} + fees $${feeSum}` : undefined}
                >
                  ${Math.round(guestRate * booking.duration + feeSum).toLocaleString()}
                </span>
              )}

          {/* Single entry point for all per-guest actions */}
          <button
            type="button"
            onClick={openActions}
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

      {/* Guest action palette — everything about this guest in one place.
          No backdrop: the calendar stays tappable (paid-date marking) while it
          floats. Draggable via its header, like the hold bar. Portaled to
          <body> so transformed/scrolling panel ancestors can't clip it. */}
      {actionsOpen &&
        createPortal(
          <div
            ref={paletteRef}
            className="fixed z-[100] flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl"
            style={{
              left: palettePos.x,
              top: palettePos.y,
              width: paletteSize.w,
              height: paletteSize.h ?? undefined,
            }}
          >
            <div className={`h-1.5 shrink-0 ${roomColor}`} />
            <div className="flex min-h-0 flex-1 flex-col px-3 pb-2 pt-2">
                <div
                  className="flex cursor-move touch-none items-start justify-between gap-2"
                  onPointerDown={onDragStart}
                  onPointerMove={onDragMove}
                  onPointerUp={onDragEnd}
                >
                  <div className="min-w-0">
                    <p className="flex items-center gap-2">
                      <span className="truncate text-sm font-bold text-gray-900">{guestLabel}</span>
                      {isAirBnB && (
                        <span className="shrink-0 rounded-full bg-[#FF5A5F] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                          Airbnb
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 text-[10px] text-gray-500">
                      {booking.room.name} · {dateRange} · {booking.duration}{" "}
                      {booking.duration > 1 ? "nights" : "night"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActionsOpen(false)}
                    aria-label="Close"
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-lg leading-none text-gray-400"
                  >
                    &times;
                  </button>
                </div>

                <div className="mt-2 flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto">
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
                      <span className="flex-1">Filter on calendar</span>
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
                          {/* Confirmation text is built from the filtered guest's
                              paid dates — only meaningful while the filter is ON */}
                          {isFiltered && (
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
                          )}
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
                        onClick={() => closeThen(() => onRequestUnbook(booking))}
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
            {/* Resize grip */}
            <div
              className="absolute bottom-0 right-0 flex h-10 w-10 cursor-nwse-resize touch-none items-end justify-end rounded-tl-xl pb-1 pr-1.5 text-base leading-none text-gray-400"
              onPointerDown={onResizeStart}
              onPointerMove={onResizeMove}
              onPointerUp={onResizeEnd}
              aria-label="Resize"
            >
              ◢
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
};

export default BookingCard;
