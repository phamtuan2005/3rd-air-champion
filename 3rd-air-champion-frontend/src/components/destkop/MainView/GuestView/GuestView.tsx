import { format } from "date-fns";
import { bookingType } from "../../../../util/types/bookingType";
import { dayType } from "../../../../util/types/dayType";
import { guestType } from "../../../../util/types/guestType";
import { roomType } from "../../../../util/types/roomType";
import React from "react";
import RoomsToClean from "./RoomsToClean";
import BookingCard from "./BookingCard";
import AvailableRoomsBar from "./AvailableRoomsBar";
import GuestSearch from "./GuestSearch";

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
  guests: guestType[];
  monthMap: Map<string, dayType>;
  rooms: roomType[];
  selectedDate: Date;
  setCurrentMonth: React.Dispatch<React.SetStateAction<Date>>;
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
  onPricingEdit: (booking: bookingType) => void;
}

const GuestView = ({
  children,
  calendarId,
  token,
  currentBookings,
  currentAirBnBGuest,
  currentGuest,
  guests,
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
  setCurrentMonth,
  setSelectedBooking,
  setSelectedModifyBooking,
  setSelectedUnbooking,
  onPricingEdit,
}: GuestViewProps) => {
  // Filter out orphaned bookings with null room to prevent crashes
  currentBookings = currentBookings.filter((b) => b.room != null);

  const sortedBookings = [...currentBookings].sort((a, b) =>
    a.room.name.localeCompare(b.room.name),
  );

  return (
    <div className="flex flex-col h-full overflow-y-scroll">
      <GuestSearch
        guests={guests}
        monthMap={monthMap}
        onSelectGuest={(id, month) => {
          setCurrentGuest(id);
          setCurrentMonth(month);
        }}
        onSelectAirBnBGuest={(alias, month) => {
          setCurrentAirBnBGuest(alias);
          setCurrentMonth(month);
        }}
      />
      <div className="px-2">
      <h2 className="mb-2 mt-2 text-center text-sm font-bold text-gray-900">
        {format(selectedDate, "EEEE, MMM d")}
      </h2>
      {sortedBookings.map((booking, index) => (
        <BookingCard
          key={index}
          booking={booking}
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
          onPricingEdit={onPricingEdit}
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
    </div>
  );
};

export default GuestView;