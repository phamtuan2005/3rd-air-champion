import { useMemo, useState } from "react";
import { format } from "date-fns";
import { getCleaningEntriesFor } from "../../../../util/cleaningTasks";
import { bookingType } from "../../../../util/types/bookingType";
import { dayType } from "../../../../util/types/dayType";
import { guestType } from "../../../../util/types/guestType";
import { roomType } from "../../../../util/types/roomType";
import React from "react";
import RoomsToClean from "./RoomsToClean";
import DayProfit from "./DayProfit";
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
  hostId?: string;
  senderName?: string; // who's logged in — signs the cleaner text
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
  onRequestUnbook: (booking: bookingType) => void;
  onPricingEdit: (booking: bookingType) => void;
}

const GuestView = ({
  children,
  calendarId,
  token,
  hostId,
  senderName,
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
  onRequestUnbook,
  onPricingEdit,
}: GuestViewProps) => {
  // Guests = bookings + booking actions; Cleaning = turnover rooms for this
  // date; Profit = that date's money, in and out.
  const [activeTab, setActiveTab] = useState<"guests" | "cleaning" | "profit">("guests");

  // Filter out orphaned bookings with null room to prevent crashes
  currentBookings = currentBookings.filter((b) => b.room != null);

  const sortedBookings = [...currentBookings].sort((a, b) =>
    a.room.name.localeCompare(b.room.name),
  );

  // Same determination as RoomsToClean and the Cleaners modal's Plan tab —
  // called, not re-derived, so the badge cannot disagree with the tab content.
  const cleaningCount = useMemo(
    () => getCleaningEntriesFor(monthMap, format(selectedDate, "yyyy-MM-dd")).length,
    [monthMap, selectedDate],
  );

  // Profit carries no count — a badge there would read as a quantity of things
  // to do. 0 hides it, same as an empty Cleaning day.
  const tabs: { key: "guests" | "cleaning" | "profit"; label: string; count: number }[] = [
    { key: "guests", label: "Guests", count: sortedBookings.length },
    { key: "cleaning", label: "Cleaning", count: cleaningCount },
    { key: "profit", label: "Profit", count: 0 },
  ];

  return (
    <div className="flex flex-col h-full overflow-y-scroll">
      <div className="px-2">
      <div className="mb-3 mt-2 grid grid-cols-3 gap-1 rounded-xl bg-gray-100 p-1">
        {tabs.map(({ key, label, count }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold transition-colors ${
              activeTab === key ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
            }`}
          >
            {label}
            {count > 0 && (
              <span
                className={`min-w-[1.25rem] rounded-full px-1 py-0.5 text-center text-[10px] font-bold leading-none ${
                  activeTab === key ? "bg-gray-900 text-white" : "bg-gray-200 text-gray-600"
                }`}
              >
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {activeTab === "guests" && (
        <>
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
      {sortedBookings.length === 0 && (
        <p className="py-6 text-center text-sm text-gray-400">No bookings on this date</p>
      )}
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
          onRequestUnbook={onRequestUnbook}
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
        </>
      )}

      {activeTab === "cleaning" &&
        (cleaningCount > 0 ? (
          <RoomsToClean
            selectedDate={selectedDate}
            monthMap={monthMap}
            hostId={hostId}
            token={token}
            senderName={senderName}
          />
        ) : (
          <p className="py-6 text-center text-sm text-gray-400">
            No rooms to clean on this date
          </p>
        ))}

      {activeTab === "profit" && (
        <DayProfit
          selectedDate={selectedDate}
          monthMap={monthMap}
          rooms={rooms}
          hostId={hostId}
          token={token}
        />
      )}
      </div>
    </div>
  );
};

export default GuestView;