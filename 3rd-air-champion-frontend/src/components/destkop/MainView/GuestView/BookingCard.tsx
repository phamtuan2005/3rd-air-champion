import { getRoomColor } from "../../../../util/getRoomColor";
import { bookingType } from "../../../../util/types/bookingType";
import { FaMinus } from "react-icons/fa";
import { CiCalendar } from "react-icons/ci";
import { useContext } from "react";
import { format, parseISO } from "date-fns";
import RebookCount from "./RebookCount";
import { FooterContext } from "../../../../context";

interface BookingCardProps {
  booking: bookingType;
  maxLabelLen: number;
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

const BookingCard = ({
  booking,
  maxLabelLen,
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

  return (
    <div
      className="border-b border-solid w-full py-1"
      style={{ display: "grid", gridTemplateColumns: `min(${maxLabelLen}ch, 50vw) 1fr`, gap: "0 0.75rem" }}
    >
      {/* Row 1, Col 1: Color box (tappable) */}
      <button
        type="button"
        onClick={() => setSelectedBooking(booking)}
        className={`${getRoomColor(booking.room.name, booking.room.color)} ${booking.guest.name === "AirBnB" ? "text-white" : "text-black"} px-2 py-1 rounded-md font-bold text-lg mb-1 text-left`}
      >
        {booking.numberOfGuests > 1 && `(${booking.numberOfGuests}) `}
        {booking.guest.alias || booking.alias || booking.guest.name}{" "}
        ({booking.room.name})
        {booking.guest.name === "AirBnB"
          ? booking.airbnbPrice ? `, $${booking.airbnbPrice.toFixed(2)}` : ""
          : (() => {
              const guestRate = booking.guest.pricing?.find(p => p.room === booking.room.id)?.price ?? booking.price;
              return guestRate ? (
                <span
                  onClick={(e) => { e.stopPropagation(); onPricingEdit(booking); }}
                  className="underline decoration-dotted"
                >
                  {`, $${(guestRate * booking.duration).toFixed(2)}`}
                </span>
              ) : "";
            })()}
      </button>

      {/* Row 1, Col 2: Quick change buttons */}
      <div className="flex items-center gap-4 mb-1">
        {booking.guest.name !== "AirBnB" && (
          <button
            type="button"
            onClick={() => {
              setSelectedModifyBooking(booking);
              if (typeof setIsMobileModalOpen !== "undefined")
                setIsMobileModalOpen(false);
            }}
            className="flex justify-center w-[24px] h-[24px] items-center rounded-full shadow-md bg-green-500 hover:bg-green-600 text-white font-semibold"
          >
            <CiCalendar size={14} />
          </button>
        )}
        {booking.guest.name !== "AirBnB" && (
          <button
            type="button"
            onClick={() => setSelectedUnbooking(booking)}
            className="flex justify-center w-[24px] h-[24px] items-center rounded-full shadow-md bg-red-500 hover:bg-red-600 text-white font-semibold"
          >
            <FaMinus size={14} />
          </button>
        )}
      </div>

      {/* Notes — spans both columns */}
      {(booking.guest.notes || booking.notes) && (
        <div className="text-gray-600 mb-1" style={{ gridColumn: "1 / -1" }}>
          {booking.guest.notes || booking.notes}
        </div>
      )}

      {/* Row 2, Col 1: Date range + rebook count */}
      <div className="flex flex-col mb-2">
        <p className="text-sm text-gray-700">
          {booking.duration === 1
            ? format(parseISO(booking.startDate), "MMM d")
            : `${format(parseISO(booking.startDate), "MMM d")} – ${format(parseISO(booking.endDate), "MMM d")}`}
          <span className="ml-2 text-xs text-gray-400 font-medium">
            · {booking.duration} {booking.duration > 1 ? "nights" : "night"}
          </span>
        </p>
        {booking.guest.name === "AirBnB" ? (
          <RebookCount booking={booking} airBnBBookingCount={airBnBBookingCount} />
        ) : (() => {
          const entry = guestBookingCount.find(g => g.GuestId === booking.guest.id);
          const count = entry?.DistinctStartDateCount ?? 0;
          const since = entry?.FirstStayDate ? format(parseISO(entry.FirstStayDate), "MMM yyyy") : null;
          return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-600 border border-amber-200">
              ↩ {count} {count === 1 ? "stay" : "stays"}{since ? ` since ${since}` : ""}
            </span>
          );
        })()}
      </div>

      {/* Row 2, Col 2: Action buttons */}
      <div className="flex items-center gap-2 mb-2">
        {booking.description === "" ? (
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
              className="w-4 h-4"
            />
            {currentGuest && (
              <>
                <button
                  className="rounded-full shadow-md bg-black text-white font-semibold h-[44px] w-[44px] text-[0.55rem]"
                  onClick={() => handleBookingConfirmation(booking.guest.phone)}
                >
                  Confirm Booking
                </button>
                <button
                  className="rounded-full shadow-md bg-blue-600 hover:bg-blue-700 text-white font-semibold h-[44px] w-[44px] text-[0.55rem]"
                  onClick={() => handleSendCalEvents(booking.guest.phone, booking.guest.email)}
                >
                  Cal Events
                </button>
              </>
            )}
            <button
              className="rounded-full shadow-md bg-black text-white font-semibold h-[44px] w-[44px] text-[0.55rem]"
              onClick={() => { window.location.href = `sms:${booking.guest.phone}`; }}
            >
              Message
            </button>
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
                className="w-4 h-4"
              />
            )}
            <button
              className="rounded-full shadow-md bg-black text-white font-semibold h-[44px] w-[44px] text-[0.55rem]"
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
    </div>
  );
};

export default BookingCard;