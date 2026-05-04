import { useContext, useEffect, useMemo, useRef, useState } from "react";
import CalendarNavigator from "./CalendarView/CalendarNavigatorDesktop";
import CustomCalendar from "./CalendarView/CustomCalendarDesktop";
import { dayType } from "../../../util/types/dayType";
import BookingModal from "../BookingModal/BookingModal";
import { bookingType } from "../../../util/types/bookingType";
import { addDays, isWithinInterval, startOfToday } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { roomType } from "../../../util/types/roomType";
import { createRoom, deleteRoom, fetchRooms, updateRoom } from "../../../util/roomOperations";
import { guestType } from "../../../util/types/guestType";
import { createGuest, deleteGuest, updateGuest, updateGuestPricing } from "../../../util/guestOperations";
import GuestView from "./GuestView/GuestView";
import BookButton from "../BookButton";
import { AddPaneContext, GuestModeContext, isSyncModalOpenContext } from "../../../context";
import DetailsModal from "./GuestView/DetailsModal";
import { updateBookingGuest, updateBookingAirbnbPrice, updateUnbookGuest } from "../../../util/bookingOperations";
import UnbookingConfirmation from "./GuestView/UnbookingConfirmation";
import ToDoList from "./ToDoList";
import AvailabilitiesModal from "./AvailabilitiesModal";
import BlockAirBnBModal from "./BlockAirBnBModal";
import BlockRoomsModal from "./BlockRoomsModal";
import ModifyBookingModal from "../ModifyBookingModal";
import BookingRequestManagerModal from "../BookingRequestManagerModal";
import GuestAddPane from "../BookingModal/GuestAddPane";
import EditRoomModal from "../NavBar/DropDown/EditRoomModal";
import ManageGuestModal from "../NavBar/DropDown/ManageGuestModal";
import { fetchBookingRequestsByHost, updateBookingRequestStatus } from "../../../util/bookingRequestOperations";
import { getHostWishLists } from "../../../util/wishListOperations";
import { useCalendarData } from "./hooks/useCalendarData";
import { useCalendarStats } from "./hooks/useCalendarStats";
import { useMessaging } from "./hooks/useMessaging";
import MobilePanel from "./MobilePanel";
import MissingProfitModal from "./MissingProfitModal";
import IcsModal from "./IcsModal";
import { FaChevronLeft, FaChevronRight } from "react-icons/fa";

interface MainViewProps {
  calendarId: string;
  hostId: string;
  airbnbsync: { room: string; link: string }[] | undefined;
  doorCode: string;
  airbnbName: string;
  airbnbAddress: string;
  isTodoModalOpen: boolean;
  setIsTodoModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isModalOpen: boolean;
  setIsModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isAvailabilitiesModalOpen: boolean;
  setIsAvailabilitiesModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isBlockAirBnBModalOpen: boolean;
  setIsBlockAirBnBModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isBlockRoomsModalOpen: boolean;
  setIsBlockRoomsModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setAirbnbPendingCount: React.Dispatch<React.SetStateAction<number>>;
  setAvailableNightsCount: React.Dispatch<React.SetStateAction<number>>;
  setTodoCleanCount: React.Dispatch<React.SetStateAction<number>>;
  isRequestManagerOpen: boolean;
  setIsRequestManagerOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setBookingRequestPendingCount: React.Dispatch<React.SetStateAction<number>>;
  setWishListAvailableCount: React.Dispatch<React.SetStateAction<number>>;
}

const MainView = ({
  calendarId,
  hostId,
  airbnbsync,
  doorCode,
  airbnbName,
  airbnbAddress,
  isTodoModalOpen,
  setIsTodoModalOpen,
  isModalOpen,
  setIsModalOpen,
  isAvailabilitiesModalOpen,
  setIsAvailabilitiesModalOpen,
  isBlockAirBnBModalOpen,
  setIsBlockAirBnBModalOpen,
  isBlockRoomsModalOpen,
  setIsBlockRoomsModalOpen,
  setAirbnbPendingCount,
  setAvailableNightsCount,
  setTodoCleanCount,
  isRequestManagerOpen,
  setIsRequestManagerOpen,
  setBookingRequestPendingCount,
  setWishListAvailableCount,
}: MainViewProps) => {
  const token = localStorage.getItem("token");

  const context = useContext(isSyncModalOpenContext) as {
    shouldCallOnSync: boolean;
    setShouldCallOnSync: React.Dispatch<React.SetStateAction<boolean>>;
  };
  const { shouldCallOnSync, setShouldCallOnSync } = context;

  const addPaneContext = useContext(AddPaneContext) as {
    showAddPane: "guest" | "room" | null;
    setShowAddPane: React.Dispatch<React.SetStateAction<"guest" | "room" | null>>;
    guestErrorMessage: string;
    setGuestErrorMessage: React.Dispatch<React.SetStateAction<string>>;
    roomErrorMessage: string;
    setRoomErrorMessage: React.Dispatch<React.SetStateAction<string>>;
    isEditRoomOpen: boolean;
    setIsEditRoomOpen: React.Dispatch<React.SetStateAction<boolean>>;
    isManageGuestOpen: boolean;
    setIsManageGuestOpen: React.Dispatch<React.SetStateAction<boolean>>;
  };
  const {
    showAddPane,
    setShowAddPane,
    guestErrorMessage,
    setGuestErrorMessage,
    isEditRoomOpen,
    setIsEditRoomOpen,
    isManageGuestOpen,
    setIsManageGuestOpen,
  } = addPaneContext;

  const { currentGuest, setCurrentGuest, currentAirBnBGuest, setCurrentAirBnBGuest } =
    useContext(GuestModeContext)!;

  // ── Local UI state ────────────────────────────────────────────────────────
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [currentBookings, setCurrentBookings] = useState<bookingType[] | null>();
  const [selectedRoomName, setSelectedRoomName] = useState<string | null>(null);
  const [gapsMode, setGapsMode] = useState(false);
  const [editingRoomId, setEditingRoomId] = useState<string>("");
  const [isMobileModalOpen, setIsMobileModalOpen] = useState(false);
  const [scrollToTodayTrigger, setScrollToTodayTrigger] = useState(0);
  const [pendingAcceptRequestIds, setPendingAcceptRequestIds] = useState<string[]>([]);
  const [acceptCompletedTick, setAcceptCompletedTick] = useState(0);
  const [bookingPrefills, setBookingPrefills] = useState<Array<{
    guestId: string | null;
    roomId: string;
    date: Date;
    duration: number;
    numberOfGuests: number;
  }> | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(startOfToday());
  const [selectedRoom, setSelectedRoom] = useState<roomType>();
  const [selectedBooking, setSelectedBooking] = useState<bookingType | null>(null);
  const [selectedUnbooking, setSelectedUnbooking] = useState<bookingType | null>(null);
  const [selectedModifyBooking, setSelectedModifyBooking] = useState<bookingType | null>(null);
  const [paidDates, setPaidDates] = useState<Date[]>([]);

  // ── Data & sync hook ──────────────────────────────────────────────────────
  const {
    days,
    setDays,
    rooms,
    setRooms,
    guests,
    setGuests,
    isCalendarLoading,
    setIsCalendarLoading,
    calendarErrorMessage,
    monthMap,
    blockedAirBnBDates,
    onAirbnbPriceUpdate,
    airBnBBookingCount,
    guestBookingCount,
  } = useCalendarData({
    calendarId,
    hostId,
    token: token as string,
    airbnbsync,
    shouldCallOnSync,
    setShouldCallOnSync,
  });

  // ── Stats hook ────────────────────────────────────────────────────────────
  const { occupancy, profit } = useCalendarStats({
    monthMap,
    days,
    rooms,
    currentMonth,
    selectedRoomName,
    blockedAirBnBDates,
    setAirbnbPendingCount,
    setAvailableNightsCount,
    setTodoCleanCount,
  });

  // ── Messaging hook ────────────────────────────────────────────────────────
  const {
    icsModal,
    setIcsModal,
    getCurrentGuestBill,
    handleBookingConfirmation,
    handleSendCalEvents,
  } = useMessaging({
    monthMap,
    currentMonth,
    currentGuest,
    paidDates,
    airbnbName,
    airbnbAddress,
  });

  const [pricingEditOnOpen, setPricingEditOnOpen] = useState(false);

  const onPricingEdit = (booking: bookingType) => {
    setPricingEditOnOpen(true);
    setSelectedBooking(booking);
  };

  const shiftDate = (delta: number) => {
    const newDate = addDays(selectedDate, delta);
    setSelectedDate(newDate);
    setCurrentBookings(monthMap.get(newDate.toISOString().split("T")[0])?.bookings ?? null);
  };

  // ── Booking request count + alert sound ────────────────────────────────
  const prevPendingCountRef = useRef<number | null>(null);
  const playAlert = () => {
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.3);
      gain.gain.setValueAtTime(0.4, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.4);
    } catch { /* AudioContext not available */ }
  };
  useEffect(() => {
    if (!token) return;
    const fetchCount = () =>
      fetchBookingRequestsByHost(hostId, token)
        .then((reqs: { status: string }[]) => {
          const count = (reqs ?? []).filter((r) => r.status === "pending").length;
          if (prevPendingCountRef.current !== null && count > prevPendingCountRef.current) {
            playAlert();
          }
          prevPendingCountRef.current = count;
          setBookingRequestPendingCount(count);
        })
        .catch(() => setBookingRequestPendingCount(0));
    fetchCount();
    const interval = setInterval(fetchCount, 30_000);
    return () => clearInterval(interval);
  }, [hostId, token, isRequestManagerOpen, acceptCompletedTick, setBookingRequestPendingCount]);

  useEffect(() => {
    if (!token) return;
    getHostWishLists(hostId, token)
      .then((entries) => setWishListAvailableCount(entries.filter((e) => e.dates.length > 0).length))
      .catch(() => setWishListAvailableCount(0));
  }, [hostId, token, setWishListAvailableCount]);

  useEffect(() => {
    if (isTodoModalOpen) {
      setCurrentMonth(new Date());
      setScrollToTodayTrigger((t) => t + 1);
    }
  }, [isTodoModalOpen]);

  // ── CRUD handlers ─────────────────────────────────────────────────────────
  const onAddGuest = (guestObject: { name: string; phone: string }) => {
    createGuest(guestObject, token as string)
      .then((result) => {
        setGuests([...guests, result]);
        setShowAddPane(null);
      })
      .catch((err) => {
        setGuestErrorMessage(err);
        console.error("Error creating guest:", err);
      });
  };

  const onAddRoomFromModal = (
    roomObject: { name: string; price: number; roomCode?: string; color?: string },
    onError: (msg: string) => void,
  ) => {
    createRoom(roomObject, token as string)
      .then((result) => {
        setRooms((prev) => [...prev, result]);
        setIsEditRoomOpen(false);
      })
      .catch((err) => {
        onError(typeof err === "string" ? err : "Failed to create room. Please try again.");
      });
  };

  const onSaveRoom = (room: roomType, onError: (msg: string) => void) => {
    updateRoom(room, token as string)
      .then(() => {
        setRooms((prev) => prev.map((r) => (r.id === room.id ? room : r)));
        setEditingRoomId(room.id);
        setIsEditRoomOpen(false);
        fetchRooms(hostId, token as string)
          .then(setRooms)
          .catch((err) => console.error("Error refreshing rooms after save:", err));
      })
      .catch((err) => {
        onError(typeof err === "string" ? err : "Failed to update room. Please try again.");
      });
  };

  const onDeleteRoom = (roomId: string, onError: (msg: string) => void) => {
    deleteRoom(roomId, token as string)
      .then(() => {
        setRooms((prev) => prev.filter((r) => r.id !== roomId));
        setIsEditRoomOpen(false);
      })
      .catch((err) => {
        onError(typeof err === "string" ? err : "Failed to delete room. Please try again.");
      });
  };

  const onAddGuestFromModal = (
    guestObject: { name: string; phone: string; email?: string; notes?: string; returning: boolean },
    onError: (msg: string) => void,
  ) => {
    createGuest(guestObject, token as string)
      .then((result) => {
        setGuests((prev) => [...prev, result]);
        setIsManageGuestOpen(false);
      })
      .catch((err) => {
        onError(typeof err === "string" ? err : "Failed to create guest. Please try again.");
      });
  };

  const onUpdateGuestFromModal = (guest: guestType, onError: (msg: string) => void) => {
    updateGuest(
      { id: guest.id, name: guest.name, phone: guest.phone, email: guest.email, notes: guest.notes, returning: guest.returning },
      token as string,
    )
      .then((result) => {
        setGuests((prev) => prev.map((g) => (g.id === guest.id ? { ...g, ...result } : g)));
        setIsManageGuestOpen(false);
      })
      .catch((err) => {
        onError(typeof err === "string" ? err : "Failed to update guest. Please try again.");
      });
  };

  const onDeleteGuestFromModal = (guestId: string, onError: (msg: string) => void) => {
    deleteGuest(guestId, token as string)
      .then(() => {
        setGuests((prev) => prev.filter((g) => g.id !== guestId));
        setIsManageGuestOpen(false);
      })
      .catch((err) => {
        onError(typeof err === "string" ? err : "Failed to delete guest. Please try again.");
      });
  };

  const onBookingComplete = (bookedDays: dayType[]) => {
    setDays((prev) => [...prev, ...bookedDays]);
    setIsCalendarLoading(true);
    if (pendingAcceptRequestIds.length > 0) {
      pendingAcceptRequestIds.forEach((id) =>
        updateBookingRequestStatus(id, "confirmed", token as string).catch(() => {}),
      );
      setPendingAcceptRequestIds([]);
      setBookingPrefills(null);
      setAcceptCompletedTick((n) => n + 1);
    }
  };

  const onBooking = (roomName: string, date: Date, duration: number, bookedDays: dayType[]) => {
    if (blockedAirBnBDates && roomName in blockedAirBnBDates) {
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const dateRanges = blockedAirBnBDates[
        roomName as keyof typeof blockedAirBnBDates
      ].map((dateRange: { start: string; duration: number }) => {
        const start = toZonedTime(dateRange.start, timeZone);
        const end = addDays(start, dateRange.duration - 1);
        return { start, end };
      });

      const bookingStart = toZonedTime(date.toISOString().split("T")[0], timeZone);
      const bookingEnd = addDays(bookingStart, duration - 1);

      const isBlocked = dateRanges.some(({ start, end }) => {
        if (isWithinInterval(bookingEnd, { start, end }) || isWithinInterval(bookingStart, { start, end })) {
          console.log(
            `${bookingStart.toISOString().split("T")[0]} to ${bookingEnd.toISOString().split("T")[0]} is within ${start.toISOString().split("T")[0]} to ${end.toISOString().split("T")[0]}`,
          );
          return true;
        }
      });

      if (isBlocked) console.log("Dates are blocked on AirBnB Calendar");

      const room = rooms.find((room) => room.id === roomName);
      if (!isBlocked) {
        alert(
          `Please block ${date.toISOString().split("T")[0]} to ${bookingEnd.toISOString().split("T")[0]} for Room: ${room?.name}`,
        );
      }
    }

    setDays([...days, ...bookedDays]);
    setIsCalendarLoading(true);
  };

  const onUpdateGuest = (data: {
    id: string;
    alias: string;
    numberOfGuests: number;
    notes?: string;
    earlyCheckin?: boolean;
    lateCheckout?: boolean;
  }) => {
    updateBookingGuest(data, token as string)
      .then((result) => {
        console.log(result);
        setCurrentBookings(null);
        setIsMobileModalOpen(false);
        setIsCalendarLoading(true);
      })
      .catch((err) => console.error("Error updating booked guest:", err));
  };

  const onUnbook = (ids: string[]) => {
    setSelectedUnbooking(null);

    const unbookSequentially = (index: number) => {
      if (index >= ids.length) {
        setCurrentBookings(null);
        setIsMobileModalOpen(false);
        setIsCalendarLoading(true);
        return;
      }

      const id = ids[index];
      updateUnbookGuest(id, token as string)
        .then((result) => {
          console.log(`Successfully unbooked guest with ID: ${id}`, result);
          unbookSequentially(index + 1);
        })
        .catch((err) => {
          console.error(`Error unbooking guest with ID: ${id}`, err);
          unbookSequentially(index + 1);
        });
    };

    unbookSequentially(0);
  };

  const onPricingUpdate = (data: { guest: string; room: string; price: number }[]) => {
    Promise.all(data.map((priceUpdate) => updateGuestPricing(priceUpdate, token as string)))
      .then((results) => {
        console.log("All updates completed:", results);
        setCurrentBookings(null);
        setIsMobileModalOpen(false);
        setIsCalendarLoading(true);
      })
      .catch((err) => console.error("Error updating guest pricing:", err));
  };

  const onDaysUpdate = (updated: dayType[]) =>
    setDays((prev) => {
      const ids = new Set(updated.map((d) => d.id));
      return [...prev.filter((d) => !ids.has(d.id)), ...updated];
    });

  const missingProfitBookings = useMemo(() => {
    const seen = new Set<string>();
    const result: { id: string; alias: string; roomName: string; roomColor?: string; startDate: string; duration: number; description: string; numberOfGuests: number }[] = [];
    for (const day of monthMap.values()) {
      for (const booking of day.bookings) {
        if (booking.guest?.name === "AirBnB" && !booking.airbnbPrice && !booking.airbnbBlocked && booking.startDate) {
          const start = new Date(booking.startDate);
          if (
            start.getFullYear() === currentMonth.getFullYear() &&
            start.getMonth() === currentMonth.getMonth()
          ) {
            const key = `${booking.startDate}_${booking.room?.id}`;
            if (!seen.has(key)) {
              seen.add(key);
              result.push({ id: booking.id, alias: booking.alias, roomName: booking.room?.name ?? "", roomColor: booking.room?.color, startDate: booking.startDate, duration: booking.duration, description: booking.description ?? "", numberOfGuests: booking.numberOfGuests ?? 1 });
            }
          }
        }
      }
    }
    return result;
  }, [monthMap, currentMonth]);

  const [isMissingProfitModalOpen, setIsMissingProfitModalOpen] = useState(false);

  useEffect(() => {
    if (missingProfitBookings.length > 0) setIsMissingProfitModalOpen(true);
    else setIsMissingProfitModalOpen(false);
  }, [currentMonth, missingProfitBookings.length]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      <div className="col-span-5 bg-gray-100 overflow-hidden sm:col-span-4 flex flex-col">
        {isCalendarLoading ? (
          <div className="flex items-center justify-center h-full">Loading...</div>
        ) : calendarErrorMessage ? (
          <div className="flex items-center justify-center h-full text-red-500">
            {calendarErrorMessage}
          </div>
        ) : (
          <>
            <CalendarNavigator
              currentGuest={
                currentGuest
                  ? (guests.find((guest) => guest.id === currentGuest)?.name as string)
                  : null
              }
              currentAirBnBGuest={currentAirBnBGuest}
              monthMap={monthMap}
              occupancy={occupancy}
              currentMonth={currentMonth}
              paidDates={paidDates}
              profit={profit}
              rooms={rooms}
              selectedRoomName={selectedRoomName}
              getCurrentGuestBill={getCurrentGuestBill}
              onGoToToday={() => {
                setCurrentMonth(new Date());
                setScrollToTodayTrigger((t) => t + 1);
              }}
              setPaidDates={setPaidDates}
              setSelectedRoomName={setSelectedRoomName}
              gapsMode={gapsMode}
              setGapsMode={setGapsMode}
            />
            <CustomCalendar
              currentGuest={currentGuest}
              currentAirBnBGuest={currentAirBnBGuest}
              currentMonth={currentMonth}
              monthMap={monthMap}
              paidDates={paidDates}
              rooms={rooms}
              selectedRoomName={selectedRoomName}
              setCurrentBookings={setCurrentBookings}
              setCurrentMonth={setCurrentMonth}
              setIsMobileModalOpen={setIsMobileModalOpen}
              setPaidDates={setPaidDates}
              setSelectedDate={setSelectedDate}
              scrollToTodayTrigger={scrollToTodayTrigger}
              gapsMode={gapsMode}
            />
            {showAddPane === "guest" && (
              <div
                className="fixed inset-0 bg-gray-800 bg-opacity-50 flex items-center justify-center z-50"
                onClick={() => setShowAddPane(null)}
              >
                <div
                  className="w-full max-w-md bg-white p-4 rounded-lg shadow-lg"
                  onClick={(e) => e.stopPropagation()}
                >
                  <GuestAddPane
                    guestErrorMessage={guestErrorMessage}
                    onAddGuest={(guestData) => {
                      onAddGuest(guestData);
                      setShowAddPane(null);
                    }}
                  />
                </div>
              </div>
            )}
            {selectedModifyBooking && (
              <ModifyBookingModal
                calendarId={calendarId}
                monthMap={monthMap}
                onBooking={onBooking}
                rooms={rooms}
                selectedModifyBooking={selectedModifyBooking}
                setSelectedModifyBooking={setSelectedModifyBooking}
              />
            )}
          </>
        )}
        {isModalOpen && (
          <BookingModal
            calendarId={calendarId}
            guests={guests}
            rooms={rooms}
            selectedDate={selectedDate}
            selectedRoom={selectedRoom}
            showAddPane={showAddPane}
            prefills={bookingPrefills ?? undefined}
            onBooking={onBookingComplete}
            setIsModalOpen={setIsModalOpen}
            setShowAddPane={setShowAddPane}
          />
        )}
      </div>

      {/* Desktop side panel */}
      <div className="hidden bg-white border-l sm:flex sm:flex-col min-h-0">
        {isBlockRoomsModalOpen ? (
          <BlockRoomsModal
            calendarId={calendarId}
            monthMap={monthMap}
            rooms={rooms}
            token={token as string}
            onDaysUpdate={onDaysUpdate}
          />
        ) : isBlockAirBnBModalOpen ? (
          <BlockAirBnBModal
            monthMap={monthMap}
            rooms={rooms}
            blockedAirBnBDates={
              blockedAirBnBDates as
                | Record<string, { start: string; duration: number }[]>
                | undefined
            }
            token={token as string}
            onDaysUpdate={onDaysUpdate}
          />
        ) : isAvailabilitiesModalOpen ? (
          <AvailabilitiesModal
            monthMap={monthMap}
            rooms={rooms}
            currentMonth={currentMonth}
            airbnbName={airbnbName}
          />
        ) : isTodoModalOpen ? (
          <ToDoList
            monthMap={monthMap}
            doorCode={doorCode}
            airbnbName={airbnbName}
            airbnbAddress={airbnbAddress}
          />
        ) : isRequestManagerOpen ? (
          <BookingRequestManagerModal
            hostId={hostId}
            token={token as string}
            rooms={rooms}
            guests={guests}
            monthMap={monthMap}
            onClose={() => setIsRequestManagerOpen(false)}
            onAccept={(items) => {
              setPendingAcceptRequestIds(items.map((i) => i.requestId));
              setBookingPrefills(items.map((i) => i.prefill));
              const first = items[0];
              setSelectedDate(first.prefill.date);
              const room = rooms.find((r) => r.id === first.prefill.roomId);
              if (room) setSelectedRoom(room);
              setIsRequestManagerOpen(false);
              setIsModalOpen(true);
            }}
            onAddGuest={(guest) =>
              createGuest(guest, token as string)
                .then((result) => setGuests((prev) => [...prev, result]))
                .catch((err) => console.error("Error adding guest:", err))
            }
          />
        ) : (
          <>
            <div className="flex items-center justify-center gap-2 px-2 py-1 border-b border-gray-200">
              <button onClick={() => shiftDate(-1)} className="p-1 rounded hover:bg-gray-100 text-gray-500">
                <FaChevronLeft size={12} />
              </button>
              <h2 className="text-base font-bold text-gray-700">
                {selectedDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
              </h2>
              <button onClick={() => shiftDate(1)} className="p-1 rounded hover:bg-gray-100 text-gray-500">
                <FaChevronRight size={12} />
              </button>
            </div>
            <GuestView
              airBnBBookingCount={airBnBBookingCount}
              guestBookingCount={guestBookingCount}
              calendarId={calendarId}
              token={token as string}
              currentBookings={currentBookings || []}
              currentAirBnBGuest={currentAirBnBGuest}
              currentGuest={currentGuest}
              monthMap={monthMap}
              rooms={rooms}
              selectedDate={selectedDate}
              handleBookingConfirmation={handleBookingConfirmation}
              handleSendCalEvents={handleSendCalEvents}
              onAirbnbPriceUpdate={onAirbnbPriceUpdate}
              onDaysUpdate={onDaysUpdate}
              setCurrentGuest={setCurrentGuest}
              setCurrentAirBnBGuest={setCurrentAirBnBGuest}
              setSelectedBooking={setSelectedBooking as React.Dispatch<React.SetStateAction<bookingType>>}
              setSelectedModifyBooking={setSelectedModifyBooking as React.Dispatch<React.SetStateAction<bookingType>>}
              setSelectedUnbooking={setSelectedUnbooking as React.Dispatch<React.SetStateAction<bookingType>>}
              onPricingEdit={onPricingEdit}
            >
              <BookButton setIsModalOpen={setIsModalOpen} setSelectedRoom={setSelectedRoom} />
            </GuestView>
          </>
        )}
      </div>

      {/* Mobile slide-up panels */}
      <div
        className={`fixed bottom-0 left-0 w-full bg-white border-t border-gray-300 z-50 flex flex-col sm:hidden transition-transform duration-300 ${
          isMobileModalOpen ? "translate-y-0" : "translate-y-full"
        }`}
        style={{ height: "calc(100% - 15rem)" }}
      >
        <div className="flex items-center justify-center gap-2 px-2 py-1 border-b border-gray-200">
          <button onClick={() => shiftDate(-1)} className="p-1 rounded hover:bg-gray-100 text-gray-500">
            <FaChevronLeft size={12} />
          </button>
          <h2 className="text-base font-bold text-gray-700">
            {selectedDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
          </h2>
          <button onClick={() => shiftDate(1)} className="p-1 rounded hover:bg-gray-100 text-gray-500">
            <FaChevronRight size={12} />
          </button>
          <button
            className="text-gray-500 font-bold text-[1.5rem] leading-none px-4 py-0.5 rounded hover:bg-gray-100"
            onClick={() => {
              setCurrentBookings(null);
              setIsMobileModalOpen(false);
            }}
          >
            &times;
          </button>
        </div>
        <GuestView
          airBnBBookingCount={airBnBBookingCount}
          guestBookingCount={guestBookingCount}
          calendarId={calendarId}
          token={token as string}
          currentBookings={currentBookings || []}
          currentAirBnBGuest={currentAirBnBGuest}
          currentGuest={currentGuest}
          monthMap={monthMap}
          rooms={rooms}
          selectedDate={selectedDate}
          handleBookingConfirmation={handleBookingConfirmation}
          handleSendCalEvents={handleSendCalEvents}
          onAirbnbPriceUpdate={onAirbnbPriceUpdate}
          onDaysUpdate={onDaysUpdate}
          setCurrentAirBnBGuest={setCurrentAirBnBGuest}
          setCurrentGuest={setCurrentGuest}
          setIsMobileModalOpen={setIsMobileModalOpen}
          setSelectedBooking={setSelectedBooking as React.Dispatch<React.SetStateAction<bookingType>>}
          setSelectedModifyBooking={setSelectedModifyBooking as React.Dispatch<React.SetStateAction<bookingType>>}
          setSelectedUnbooking={setSelectedUnbooking as React.Dispatch<React.SetStateAction<bookingType>>}
          onPricingEdit={onPricingEdit}
        >
          <BookButton
            setIsModalOpen={setIsModalOpen}
            setIsMobileModalOpen={setIsMobileModalOpen}
            setSelectedRoom={setSelectedRoom}
          />
        </GuestView>
      </div>

      <MobilePanel isOpen={isTodoModalOpen} onClose={() => setIsTodoModalOpen(false)}>
        <ToDoList
          monthMap={monthMap}
          doorCode={doorCode}
          airbnbName={airbnbName}
          airbnbAddress={airbnbAddress}
        />
      </MobilePanel>

      <MobilePanel
        isOpen={isAvailabilitiesModalOpen}
        onClose={() => setIsAvailabilitiesModalOpen(false)}
      >
        <AvailabilitiesModal
          monthMap={monthMap}
          rooms={rooms}
          currentMonth={currentMonth}
          airbnbName={airbnbName}
        />
      </MobilePanel>

      <MobilePanel
        isOpen={isBlockAirBnBModalOpen}
        onClose={() => setIsBlockAirBnBModalOpen(false)}
      >
        <BlockAirBnBModal
          monthMap={monthMap}
          rooms={rooms}
          blockedAirBnBDates={
            blockedAirBnBDates as
              | Record<string, { start: string; duration: number }[]>
              | undefined
          }
          token={token as string}
          onDaysUpdate={onDaysUpdate}
        />
      </MobilePanel>

      <MobilePanel
        isOpen={isBlockRoomsModalOpen}
        onClose={() => setIsBlockRoomsModalOpen(false)}
      >
        <BlockRoomsModal
          calendarId={calendarId}
          monthMap={monthMap}
          rooms={rooms}
          token={token as string}
          onDaysUpdate={onDaysUpdate}
        />
      </MobilePanel>

      <MobilePanel
        isOpen={isRequestManagerOpen}
        onClose={() => setIsRequestManagerOpen(false)}
      >
        {isRequestManagerOpen && token && (
          <BookingRequestManagerModal
            hostId={hostId}
            token={token}
            rooms={rooms}
            guests={guests}
            monthMap={monthMap}
            onClose={() => setIsRequestManagerOpen(false)}
            onAccept={(items) => {
              setPendingAcceptRequestIds(items.map((i) => i.requestId));
              setBookingPrefills(items.map((i) => i.prefill));
              const first = items[0];
              setSelectedDate(first.prefill.date);
              const room = rooms.find((r) => r.id === first.prefill.roomId);
              if (room) setSelectedRoom(room);
              setIsRequestManagerOpen(false);
              setIsModalOpen(true);
            }}
            onAddGuest={(guest) =>
              createGuest(guest, token as string)
                .then((result) => setGuests((prev) => [...prev, result]))
                .catch((err) => console.error("Error adding guest:", err))
            }
          />
        )}
      </MobilePanel>

      {/* Overlay modals */}
      {selectedBooking && (
        <DetailsModal
          booking={selectedBooking}
          rooms={rooms}
          startWithPricingEdit={pricingEditOnOpen}
          airBnBBookingCount={airBnBBookingCount}
          guestBookingCount={guestBookingCount}
          onClose={() => { setSelectedBooking(null); setPricingEditOnOpen(false); }}
          onUpdateGuests={onUpdateGuest}
          onAirbnbPriceUpdate={onAirbnbPriceUpdate}
          onPricingUpdate={onPricingUpdate}
        />
      )}
      {selectedUnbooking && (
        <UnbookingConfirmation
          monthMap={monthMap}
          booking={selectedUnbooking}
          onClose={() => setSelectedUnbooking(null)}
          onUnbook={onUnbook}
        />
      )}
      {isEditRoomOpen && rooms.length > 0 && (
        <EditRoomModal
          rooms={rooms}
          defaultRoomId={editingRoomId}
          onClose={() => setIsEditRoomOpen(false)}
          onSave={onSaveRoom}
          onAdd={onAddRoomFromModal}
          onDelete={onDeleteRoom}
          airbnbsync={airbnbsync}
          hostId={hostId}
          token={token as string}
        />
      )}
      {isManageGuestOpen && guests.length > 0 && (
        <ManageGuestModal
          guests={guests}
          onClose={() => setIsManageGuestOpen(false)}
          onSave={onUpdateGuestFromModal}
          onAdd={onAddGuestFromModal}
          onDelete={onDeleteGuestFromModal}
        />
      )}

      <IcsModal icsModal={icsModal} setIcsModal={setIcsModal} airbnbName={airbnbName} />

      {isMissingProfitModalOpen && (
        <MissingProfitModal
          bookings={missingProfitBookings}
          onClose={() => setIsMissingProfitModalOpen(false)}
          onSave={({ bookingId, alias, numberOfGuests, profit }) => {
            Promise.all([
              updateBookingAirbnbPrice({ id: bookingId, airbnbPrice: profit }, token as string),
              updateBookingGuest({ id: bookingId, alias, numberOfGuests }, token as string),
            ])
              .then(() => setIsCalendarLoading(true))
              .catch((err) => console.error("Error saving missing profit booking:", err));
          }}
        />
      )}
    </>
  );
};

export default MainView;
