import { bookingType } from "../../../../util/types/bookingType";
import { dayType } from "../../../../util/types/dayType";
import { roomType } from "../../../../util/types/roomType";
import React from "react";
import RoomsToClean from "./RoomsToClean";
import BookingCard from "./BookingCard";
import AvailableRoomsBar from "./AvailableRoomsBar";

interface GuestViewProps {
  airBnBBookingCount: {
    Alias: string;
    Room: string;
    DistinctStartDateCount: number;
  }[];
  guestBookingCount: {
    GuestId: string;
    DistinctStartDateCount: number;
    FirstStayDate: string;
  }[];
  calendarId: string;
  token: string;
  children: React.ReactNode;
  currentBookings: bookingType[];
  currentAirBnBGuest: string | null;
  currentGuest: string | null;
  monthMap: Map<string, dayType>;
  rooms: roomType[];
  selectedDate: Date;
  handleBookingConfirmation: (phone: string) => void;
  handleSendCalEvents: (phone: string, email?: string) => void;
  onAirbnbPriceUpdate: (bookingId: string, airbnbPrice: number) => void;
  onDaysUpdate: (updatedDays: dayType[]) => void;
  setCurrentAirBnBGuest: React.Dispatch<React.SetStateAction<string | null>>;
  setCurrentGuest: React.Dispatch<React.SetStateAction<string | null>>;
  setIsMobileModalOpen?: React.Dispatch<React.SetStateAction<boolean>>;
  setSelectedBooking: React.Dispatch<React.SetStateAction<bookingType>>;
  setSelectedModifyBooking: React.Dispatch<React.SetStateAction<bookingType>>;
  setSelectedUnbooking: React.Dispatch<React.SetStateAction<bookingType>>;
}

const GuestView = ({
  children,
  calendarId,
  token,
  currentBookings,
  currentAirBnBGuest,
  currentGuest,
  monthMap,
  rooms,
  selectedDate,
  airBnBBookingCount,
  guestBookingCount,
  handleBookingConfirmation,
  handleSendCalEvents,
  onDaysUpdate,
  setIsMobileModalOpen,
  setCurrentAirBnBGuest,
  setCurrentGuest,
  setSelectedBooking,
  setSelectedModifyBooking,
  setSelectedUnbooking,
}: GuestViewProps) => {
  const getBookingLabel = (booking: bookingType) => {
    const guestPart = `${booking.numberOfGuests > 1 ? `(${booking.numberOfGuests}) ` : ""}${booking.guest.alias || booking.alias || booking.guest.name} (${booking.room.name})`;
    const pricePart =
      booking.guest.name === "AirBnB"
        ? booking.airbnbPrice ? `, $${booking.airbnbPrice.toFixed(2)}` : ""
        : (() => {
            const guestRate = booking.guest.pricing?.find(p => p.room === booking.room.id)?.price ?? booking.price;
            return guestRate ? `, $${(guestRate * booking.duration).toFixed(2)}` : "";
          })();
    return guestPart + pricePart;
  };

  const maxLabelLen =
    currentBookings.length > 0
      ? Math.max(...currentBookings.map(b => getBookingLabel(b).length))
      : 0;

  const sortedBookings = [...currentBookings].sort((a, b) =>
    a.room.name.localeCompare(b.room.name),
  );

  return (
    <div className="flex flex-col h-full px-2 overflow-y-scroll">
      {sortedBookings.map((booking, index) => (
        <BookingCard
          key={index}
          booking={booking}
          maxLabelLen={maxLabelLen}
          currentGuest={currentGuest}
          currentAirBnBGuest={currentAirBnBGuest}
          airBnBBookingCount={airBnBBookingCount}
          guestBookingCount={guestBookingCount}
          handleBookingConfirmation={handleBookingConfirmation}
          handleSendCalEvents={handleSendCalEvents}
          setCurrentGuest={setCurrentGuest}
          setCurrentAirBnBGuest={setCurrentAirBnBGuest}
          setSelectedBooking={setSelectedBooking}
          setSelectedModifyBooking={setSelectedModifyBooking}
          setSelectedUnbooking={setSelectedUnbooking}
          setIsMobileModalOpen={setIsMobileModalOpen}
        />
      ))}

      <AvailableRoomsBar
        calendarId={calendarId}
        token={token}
        selectedDate={selectedDate}
        monthMap={monthMap}
        rooms={rooms}
        currentBookings={currentBookings}
        onDaysUpdate={onDaysUpdate}
      >
        {children}
      </AvailableRoomsBar>

      <RoomsToClean selectedDate={selectedDate} monthMap={monthMap} />
    </div>
  );
};

export default GuestView;