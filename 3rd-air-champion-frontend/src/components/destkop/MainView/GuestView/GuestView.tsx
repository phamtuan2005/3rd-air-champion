import { getRoomColor } from "../../../../util/getRoomColor";
import RoomPickerDropdown from "./RoomPickerDropdown";
import { bookingType } from "../../../../util/types/bookingType";
import { dayType } from "../../../../util/types/dayType";
import { roomType } from "../../../../util/types/roomType";
import { FaMinus, FaRegEdit } from "react-icons/fa";
import { CiCalendar } from "react-icons/ci";
import React, { useContext, useState } from "react";
import { format, parseISO } from "date-fns";
import { blockRoom, unblockRoom } from "../../../../util/dayOperations";
import RebookCount from "./RebookCount";
import RoomsToClean from "./RoomsToClean";
import { FooterContext } from "../../../../context";

interface GuestViewProps {
  airBnBBookingCount: {
    Alias: string;
    Room: string;
    DistinctStartDateCount: number;
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
  const { setIsFooterVisible } = useContext(FooterContext)!;
  const [selectedAvailableRoom, setSelectedAvailableRoom] = React.useState<string>("");
  const [blockingRoomId, setBlockingRoomId] = useState<string | null>(null);

  const getBookingLabel = (booking: bookingType) => {
    const guestPart = `${booking.numberOfGuests > 1 ? `(${booking.numberOfGuests}) ` : ""}${booking.guest.alias || booking.alias || booking.guest.name} (${booking.room.name})`;
    const pricePart = booking.guest.name === "AirBnB"
      ? booking.airbnbPrice ? `, $${booking.airbnbPrice.toFixed(2)}` : ""
      : (() => {
          const guestRate = booking.guest.pricing?.find(p => p.room === booking.room.id)?.price ?? booking.price;
          return guestRate ? `, $${(guestRate * booking.duration).toFixed(2)}` : "";
        })();
    return guestPart + pricePart;
  };

  const maxLabelLen = currentBookings.length > 0
    ? Math.max(...currentBookings.map(b => getBookingLabel(b).length))
    : 0;

  return (
    <div className={`flex flex-col h-full px-2 overflow-y-scroll`}>
      {currentBookings.map((booking, index) => {
        return (
          <div key={index} className="border-b border-solid w-full py-1" style={{ display: 'grid', gridTemplateColumns: `min(${maxLabelLen}ch, 50vw) 1fr`, gap: '0 0.75rem' }}>
            {/* Row 1, Col 1: Color box */}
            <div
              className={`${getRoomColor(booking.room.name, booking.room.color)} ${booking.guest.name === "AirBnB" ? "text-white" : "text-black"} px-2 py-1 rounded-md font-bold text-lg mb-1`}
            >
              {booking.numberOfGuests > 1 &&
                `(${booking.numberOfGuests}) `}
              {booking.guest.alias ||
                booking.alias ||
                booking.guest.name}{" "}
              ({booking.room.name})
              {booking.guest.name === "AirBnB"
                ? booking.airbnbPrice ? `, $${booking.airbnbPrice.toFixed(2)}` : ""
                : (() => {
                    const guestRate = booking.guest.pricing?.find(p => p.room === booking.room.id)?.price ?? booking.price;
                    return guestRate ? `, $${(guestRate * booking.duration).toFixed(2)}` : "";
                  })()}
            </div>

            {/* Row 1, Col 2: Quick change buttons */}
            <div className="flex items-center gap-4 mb-1">
              <button
                type="button"
                onClick={() => setSelectedBooking(booking)}
                className="flex justify-center w-[24px] h-[24px] items-center rounded-full shadow-md bg-orange-400 hover:bg-orange-500 text-white font-semibold"
              >
                <FaRegEdit size={14} />
              </button>
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
              <div className="text-gray-600 mb-1" style={{ gridColumn: '1 / -1' }}>
                {booking.guest.notes || booking.notes}
              </div>
            )}

            {/* Row 2, Col 1: Room information */}
            <div className="flex flex-col mb-2">
              <p className="text-sm text-gray-700">
                {booking.duration === 1
                  ? format(parseISO(booking.startDate), "MMM d")
                  : `${format(parseISO(booking.startDate), "MMM d")} – ${format(parseISO(booking.endDate), "MMM d")}`}
                <span className="ml-2 text-xs text-gray-400 font-medium">
                  · {booking.duration} {booking.duration > 1 ? "nights" : "night"}
                </span>
              </p>
              {booking.guest.name === "AirBnB" && (
                <RebookCount
                  booking={booking}
                  airBnBBookingCount={airBnBBookingCount}
                />
              )}
            </div>

            {/* Row 2, Col 2: Action — aligns with edit button above */}
            <div className={`flex items-center gap-2 mb-2`}>
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
                          onClick={() =>
                            handleBookingConfirmation(booking.guest.phone)
                          }
                        >
                          Confirm Booking
                        </button>
                        <button
                          className="rounded-full shadow-md bg-blue-600 hover:bg-blue-700 text-white font-semibold h-[44px] w-[44px] text-[0.55rem]"
                          onClick={() =>
                            handleSendCalEvents(booking.guest.phone, booking.guest.email)
                          }
                        >
                          Cal Events
                        </button>
                      </>
                    )}
                    <button
                      className="rounded-full shadow-md bg-black text-white font-semibold h-[44px] w-[44px] text-[0.55rem]"
                      onClick={() => {
                        const phone = booking.guest.phone;
                        window.location.href = `sms:${phone}`;
                      }}
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
      })}

      {/* Remaining rooms to book */}
      {(() => {
        const dateKey = format(selectedDate, "yyyy-MM-dd");
        const dayEntry = monthMap.get(dateKey);
        const blockedRoomIds = new Set((dayEntry?.blockedRooms ?? []).map((r) => r.id));

        const unbookedRooms = rooms.filter((room) =>
          room.active && currentBookings.every((booking) => room.name !== booking.room.name),
        );
        if (unbookedRooms.length === 0) return null;

        const allInactiveOrBlocked = unbookedRooms.every((r) => blockedRoomIds.has(r.id));

        const activeRoom =
          unbookedRooms.find((r) => r.id === selectedAvailableRoom) ||
          unbookedRooms.find((r) => !blockedRoomIds.has(r.id)) ||
          unbookedRooms[0];

        const bookChild = React.Children.toArray(children).find(
          React.isValidElement,
        ) as React.ReactElement<{ room?: roomType }> | undefined;

        const canBook = activeRoom.active && !blockedRoomIds.has(activeRoom.id);

        return (
          <div className="flex items-center justify-center border-b border-solid w-full py-2 gap-2">
            {allInactiveOrBlocked && (
              <span className="font-bold text-green-600 text-sm">Sold Out!</span>
            )}
            <RoomPickerDropdown
              rooms={unbookedRooms}
              blockedRoomIds={blockedRoomIds}
              value={activeRoom.id}
              onChange={setSelectedAvailableRoom}
            />
            <button
              type="button"
              disabled={blockingRoomId === activeRoom.id}
              className="flex justify-center w-[32px] h-[32px] items-center rounded-full shadow-md bg-gray-700 hover:bg-gray-800 text-white text-base disabled:opacity-50"
              onClick={async () => {
                const isBlocked = blockedRoomIds.has(activeRoom.id);
                setBlockingRoomId(activeRoom.id);
                try {
                  const dateKey = format(selectedDate, "yyyy-MM-dd");
                  const updated = isBlocked
                    ? await unblockRoom(calendarId, activeRoom.id, dateKey, 1, token)
                    : await blockRoom(calendarId, activeRoom.id, dateKey, 1, token);
                  onDaysUpdate(updated);
                } finally {
                  setBlockingRoomId(null);
                }
              }}
            >
              {blockingRoomId === activeRoom.id ? "…" : blockedRoomIds.has(activeRoom.id) ? "🔓" : "🔒"}
            </button>
            {bookChild && canBook &&
              React.cloneElement(bookChild, { room: activeRoom })}
          </div>
        );
      })()}

      <RoomsToClean selectedDate={selectedDate} monthMap={monthMap} />
    </div>
  );
};

export default GuestView;