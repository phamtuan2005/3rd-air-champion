import { getRoomColor } from "../../../../util/getRoomColor";
import CleanerAvatar from "../../../shared/CleanerAvatar";
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

// Full-width action rows for the guest action palette. It floats over the
// calendar so it stays narrow, but each row is still a full-size target — the
// host is tapping these one-handed.
const rowBase =
  "flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-semibold";
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
  // Wide enough that "Filter on calendar" and its ON/OFF fit on one line at the
  // panel's type size — still narrow enough to leave the calendar visible.
  const DEFAULT_PALETTE_WIDTH = 300;
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

  const guestRate = isAirBnB ? null : (booking.price ?? 0);
  // A last-minute AirBnB stay is typed in by hand and never appears in the feed,
  // so it carries no "Reservation URL" description. Feed bookings are owned by
  // the sync and deliberately not deletable here; a hand-entered one has no such
  // owner, so it must be removable — and "Open on Airbnb" is meaningless for it.
  const isManualAirBnB =
    isAirBnB && !String(booking.description || "").startsWith("Reservation URL");
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
      className={`relative mb-3 overflow-hidden rounded-2xl border ${
        isReserved ? "border-amber-300 bg-amber-50" : "border-gray-200 bg-white"
      }`}
    >
      {/* Room identity as a color accent, not a button-look chip */}
      <div className={`absolute inset-y-0 left-0 w-3 ${roomColor}`} />

      <div className="p-4 pl-6">
        <div className="flex items-start gap-2">
          {/* Seeded from the displayed label, so AirBnB stays show the real
              guest's initials from their alias. Drawn avatars only exist for
              returning guests; everyone else falls back to initials, so the
              column stays even. */}
          <CleanerAvatar
            name={guestLabel}
            character={booking.guest.character}
            sizeClass="h-9 w-9"
          />
          {/* Tap the info area to open booking details (disabled for soft holds) */}
          <button
            type="button"
            onClick={() => !isReserved && setSelectedBooking(booking)}
            className="min-w-0 flex-1 text-left"
          >
            {/* The name wraps rather than truncates — a guest cut off mid-word
                is the density habit this layout is moving away from. */}
            <p className="flex flex-wrap items-center gap-2">
              <span className="text-lg font-bold leading-tight text-gray-900">
                {booking.numberOfGuests > 1 && `(${booking.numberOfGuests}) `}
                {guestLabel}
              </span>
              {/* Booking source must be readable at first glance; direct guests
                  are already identified by their loyalty badges instead */}
              {isAirBnB && (
                <span className="shrink-0 rounded-full bg-[#FF5A5F] px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-white">
                  Airbnb
                </span>
              )}
              {isReserved && (
                <span className="shrink-0 rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-amber-700">
                  Reserved
                </span>
              )}
            </p>
            <p className="mt-1 text-sm text-gray-500">
              {booking.room.name} · {dateRange}
              <span className="text-gray-400">
                {" "}
                · {booking.duration} {booking.duration > 1 ? "nights" : "night"}
              </span>
            </p>
          </button>

          {/* Single entry point for all per-guest actions */}
          <button
            type="button"
            onClick={openActions}
            aria-label="Guest actions"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white text-xl font-bold leading-none text-gray-600"
          >
            ⋯
          </button>
        </div>

        {/* Money and loyalty share their own line. The price used to sit in the
            header row, where it and the guest's name fought over the same
            width and one of them always lost — the name to a truncation, the
            price to a smaller size. On its own line it can be the biggest
            thing on the card, which is what it deserves to be. */}
        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          {/* Profit is the reward — big, green, whole dollars */}
          {isAirBnB
            ? (booking.airbnbPrice || feeSum) && (
                <span
                  className="text-2xl font-bold leading-none text-emerald-600"
                  title={feeSum ? `AirBnB $${Math.round(booking.airbnbPrice || 0)} + on-site $${feeSum}` : undefined}
                >
                  ${Math.round((booking.airbnbPrice || 0) + feeSum).toLocaleString()}
                </span>
              )
            : guestRate && (
                /* Editable, but not underlined. A dotted underline under a
                   number reads as a flag on the number itself — money marked
                   as provisional or disputed — which is the opposite of what
                   this is: the guest's own agreed rate. The pencil chip says
                   "you can change this" without saying anything about the
                   figure, and a real button gets keyboard focus for free. */
                <button
                  type="button"
                  onClick={() => onPricingEdit(booking)}
                  aria-label="Edit pricing"
                  className="group -ml-1.5 inline-flex items-center gap-1.5 rounded-lg px-1.5 py-0.5 transition-colors hover:bg-emerald-50"
                  title={feeSum ? `Nights $${Math.round(guestRate * booking.duration)} + fees $${feeSum}` : undefined}
                >
                  <span className="text-2xl font-bold leading-none text-emerald-600">
                    ${Math.round(guestRate * booking.duration + feeSum).toLocaleString()}
                  </span>
                  <span className="text-xs leading-none text-emerald-300 transition-colors group-hover:text-emerald-500">
                    ✎
                  </span>
                </button>
              )}

          {/* Return-guest history / loyalty */}
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
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-sm font-semibold text-amber-600">
                    ↩ {count} {count === 1 ? "stay" : "stays"}
                    {since ? ` since ${since}` : ""}
                  </span>
                  {loyaltyTier && (
                    <span
                      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${loyaltyTier.color}`}
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
          <p className="mt-2 text-sm italic text-gray-500">
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
            className="modal-type fixed z-[100] flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl"
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
                      <span className="truncate text-base font-bold text-gray-900">{guestLabel}</span>
                      {isAirBnB && (
                        <span className="shrink-0 rounded-full bg-[#FF5A5F] px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-white">
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

                <div className="mt-2 flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
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
                      <FaFilter size={16} className="shrink-0" />
                      <span className="flex-1">Filter on calendar</span>
                      <span className="text-sm font-bold">{isFiltered ? "ON" : "OFF"}</span>
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
                        <FaRegCalendarAlt size={16} className="shrink-0" />
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
                              <FaRegCheckCircle size={16} className="shrink-0" />
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
                            <FaRegCalendarPlus size={16} className="shrink-0" />
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
                            <FaRegCommentDots size={16} className="shrink-0" />
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
                          <FaDollarSign size={16} className="shrink-0" />
                          Edit Pricing
                        </button>
                      )}
                      <button
                        type="button"
                        className={rowDanger}
                        onClick={() => closeThen(() => onRequestUnbook(booking))}
                      >
                        <FaRegTrashAlt size={16} className="shrink-0" />
                        Unbook
                      </button>
                    </>
                  ) : isManualAirBnB ? (
                    <button
                      type="button"
                      className={rowDanger}
                      onClick={() => closeThen(() => onRequestUnbook(booking))}
                    >
                      <FaRegTrashAlt size={16} className="shrink-0" />
                      Unbook
                    </button>
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
                      <FaAirbnb size={18} className="shrink-0" />
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
