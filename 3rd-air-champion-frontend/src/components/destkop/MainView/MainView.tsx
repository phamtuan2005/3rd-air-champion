import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import CalendarNavigator from "./CalendarView/CalendarNavigatorDesktop";
import CustomCalendar from "./CalendarView/CustomCalendarDesktop";
import { dayType } from "../../../util/types/dayType";
import {
  fetchAirBnBBookingCount,
  fetchGuestBookingCount,
  fetchDays,
} from "../../../util/dayOperations";
import BookingModal from "../BookingModal/BookingModal";
import { bookingType } from "../../../util/types/bookingType";
import {
  addDays,
  compareAsc,
  eachDayOfInterval,
  endOfMonth,
  format,
  getDaysInMonth,
  isAfter,
  isBefore,
  isSameDay,
  isSameMonth,
  isWithinInterval,
  startOfMonth,
  startOfToday,
} from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { roomType } from "../../../util/types/roomType";
import { createRoom, deleteRoom, fetchRooms } from "../../../util/roomOperations";
import { guestType } from "../../../util/types/guestType";
import {
  createGuest,
  fetchGuests,
  updateGuestPricing,
} from "../../../util/guestOperations";
import { syncCalendars } from "../../../util/syncOperations";
import GuestView from "./GuestView/GuestView";
import BookButton from "../BookButton";
import { AddPaneContext, GuestModeContext, isSyncModalOpenContext } from "../../../context";
import DetailsModal from "./GuestView/DetailsModal";
import {
  updateBookingAirbnbPrice,
  updateBookingGuest,
  updateUnbookGuest,
} from "../../../util/bookingOperations";
import UnbookingConfirmation from "./GuestView/UnbookingConfirmation";
import ToDoList from "./ToDoList";
import AvailabilitiesModal from "./AvailabilitiesModal";
import BlockAirBnBModal from "./BlockAirBnBModal";
import BlockRoomsModal from "./BlockRoomsModal";
import ModifyBookingModal from "../ModifyBookingModal";
import GuestAddPane from "../BookingModal/GuestAddPane";
import EditRoomModal from "../NavBar/DropDown/EditRoomModal";
import ManageGuestModal from "../NavBar/DropDown/ManageGuestModal";
import { updateRoom } from "../../../util/roomOperations";
import { updateGuest, deleteGuest } from "../../../util/guestOperations";

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
}

const MainView = ({ calendarId, hostId, airbnbsync, doorCode, airbnbName, airbnbAddress, isTodoModalOpen, setIsTodoModalOpen, isModalOpen, setIsModalOpen, isAvailabilitiesModalOpen, setIsAvailabilitiesModalOpen, isBlockAirBnBModalOpen, setIsBlockAirBnBModalOpen, isBlockRoomsModalOpen, setIsBlockRoomsModalOpen, setAirbnbPendingCount, setAvailableNightsCount, setTodoCleanCount }: MainViewProps) => {
  const token = localStorage.getItem("token");
  const airbnbsyncRef = useRef(airbnbsync);
  // Set by the isCalendarLoading effect after fetching; cleared by useEffect([days])
  // after monthMap is built. Ensures the calendar is never shown with an empty monthMap.
  const pendingLoadingClearRef = useRef(false);

  const context = useContext(isSyncModalOpenContext) as {
    shouldCallOnSync: boolean;
    setShouldCallOnSync: React.Dispatch<React.SetStateAction<boolean>>;
  };

  const addPaneContext = useContext(AddPaneContext) as {
    showAddPane: "guest" | "room" | null;
    setShowAddPane: React.Dispatch<
      React.SetStateAction<"guest" | "room" | null>
    >;
    guestErrorMessage: string;
    setGuestErrorMessage: React.Dispatch<React.SetStateAction<string>>;
    roomErrorMessage: string;
    setRoomErrorMessage: React.Dispatch<React.SetStateAction<string>>;
    isEditRoomOpen: boolean;
    setIsEditRoomOpen: React.Dispatch<React.SetStateAction<boolean>>;
    isManageGuestOpen: boolean;
    setIsManageGuestOpen: React.Dispatch<React.SetStateAction<boolean>>;
  };

  const { shouldCallOnSync, setShouldCallOnSync } = context;
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
  const [initialSync, setIsInitialSync] = useState(true);

  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [currentBookings, setCurrentBookings] = useState<
    bookingType[] | null
  >();
  const [days, setDays] = useState<dayType[]>([]);
  const [guests, setGuests] = useState<guestType[]>([]);
  const [rooms, setRooms] = useState<roomType[]>([]);
  const [selectedRoomName, setSelectedRoomName] = useState<string | null>(null);
  const [editingRoomId, setEditingRoomId] = useState<string>("");
  const [airBnBBookingCount, setAirBnBBookingCount] = useState<
    { Alias: string; Room: string; DistinctStartDateCount: number }[]
  >([]);
  const [guestBookingCount, setGuestBookingCount] = useState<
    { GuestId: string; DistinctStartDateCount: number; FirstStayDate: string }[]
  >([]);

  const [isCalendarLoading, setIsCalendarLoading] = useState(true); // Track loading state
  const [calendarErrorMessage, setCalendarErrorMessage] = useState<string>(""); // Track errors

  const [monthMap, setMonthMap] = useState<Map<string, dayType>>(new Map());

  const [isMobileModalOpen, setIsMobileModalOpen] = useState(false);
  const [icsModal, setIcsModal] = useState<{ icsContent: string; phone: string; email?: string; guestName: string; guestDisplayName: string; checkinDate: string; checkoutDate: string; fileName: string } | null>(null);
  const [scrollToTodayTrigger, setScrollToTodayTrigger] = useState(0);

  const [blockedAirBnBDates, setIsBlockedAirBnBDates] = useState<{
    room: { duration: number; start: string }[];
  }>();

  const airbnbPendingCount = useMemo(() => {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const today = startOfToday();
    const blockedTyped = blockedAirBnBDates as Record<string, { start: string; duration: number }[]> | undefined;

    const uniqueById = new Map<string, bookingType>();
    for (const day of monthMap.values()) {
      for (const booking of day.bookings) {
        if (booking.guest.name !== "AirBnB" && !uniqueById.has(booking.id))
          uniqueById.set(booking.id, booking);
      }
    }
    const seenRanges = new Map<string, bookingType>();
    for (const booking of uniqueById.values()) {
      const key = `${booking.room.id}|${booking.startDate}|${booking.endDate}`;
      if (!seenRanges.has(key)) seenRanges.set(key, booking);
    }
    const actionableBookings = [...seenRanges.values()].filter((b) => {
      const end = toZonedTime(b.endDate, timeZone);
      if (!(isAfter(end, today) || end.toDateString() === today.toDateString())) return false;
      if (b.airbnbBlocked) return false;
      const blocked = blockedTyped?.[b.room.id];
      if (!blocked?.length) return true;
      const bStart = toZonedTime(b.startDate, timeZone);
      const bEnd = toZonedTime(b.endDate, timeZone);
      return !blocked.some(({ start, duration }) => {
        const blockStart = toZonedTime(start, timeZone);
        const blockEnd = addDays(blockStart, duration);
        return isBefore(bStart, blockEnd) && isAfter(bEnd, blockStart);
      });
    });

    const roomDateMap = new Map<string, string[]>();
    for (const [dateStr, day] of monthMap.entries()) {
      const localDate = toZonedTime(dateStr, timeZone);
      if (isBefore(localDate, today) && localDate.toDateString() !== today.toDateString()) continue;
      for (const room of day.blockedRooms) {
        if (!roomDateMap.has(room.id)) roomDateMap.set(room.id, []);
        roomDateMap.get(room.id)!.push(dateStr);
      }
    }
    let blockRangeCount = 0;
    for (const [, dates] of roomDateMap.entries()) {
      const sorted = [...dates].sort();
      let i = 0;
      while (i < sorted.length) {
        let j = i;
        while (
          j + 1 < sorted.length &&
          format(addDays(toZonedTime(sorted[j], timeZone), 1), "yyyy-MM-dd") === sorted[j + 1]
        ) j++;
        blockRangeCount++;
        i = j + 1;
      }
    }

    return actionableBookings.length + blockRangeCount;
  }, [monthMap, blockedAirBnBDates]);

  useEffect(() => {
    setAirbnbPendingCount(airbnbPendingCount);
  }, [airbnbPendingCount, setAirbnbPendingCount]);

  const availableNightsCount = useMemo(() => {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const today = startOfToday();
    const eligibleDateKeys = eachDayOfInterval({
      start: startOfMonth(currentMonth),
      end: endOfMonth(currentMonth),
    })
      .map((d) => format(d, "yyyy-MM-dd"))
      .filter((dateKey) => {
        const date = toZonedTime(dateKey, timeZone);
        return isAfter(date, today) || date.toDateString() === today.toDateString();
      });
    return rooms.filter((r) => r.active).reduce((total, room) => {
      for (const dateKey of eligibleDateKeys) {
        const day = monthMap.get(dateKey);
        const isBooked = day ? day.bookings.some((b) => b.room.id === room.id) : false;
        const isBlocked = day ? (day.isBlocked || day.blockedRooms.some((r) => r.id === room.id)) : false;
        if (!isBooked && !isBlocked) total++;
      }
      return total;
    }, 0);
  }, [monthMap, rooms, currentMonth]);

  useEffect(() => {
    setAvailableNightsCount(availableNightsCount);
  }, [availableNightsCount, setAvailableNightsCount]);

  const todoCleanCount = useMemo(() => {
    const yesterdayKey = addDays(startOfToday(), -1).toISOString().split("T")[0];
    const yesterdayDay = monthMap.get(yesterdayKey);
    return yesterdayDay?.bookings.filter((b) => b.endDate.split("T")[0] === yesterdayKey).length ?? 0;
  }, [monthMap]);

  useEffect(() => {
    setTodoCleanCount(todoCleanCount);
  }, [todoCleanCount, setTodoCleanCount]);

  const [selectedDate, setSelectedDate] = useState<Date>(startOfToday());
  const [selectedRoom, setSelectedRoom] = useState<roomType>();
  const [selectedBooking, setSelectedBooking] = useState<bookingType | null>(
    null,
  );
  const [selectedUnbooking, setSelectedUnbooking] =
    useState<bookingType | null>(null);
  const [selectedModifyBooking, setSelectedModifyBooking] =
    useState<bookingType | null>(null);

  const [occupancy, setOccupancy] = useState<{
    totalOccupancy: number;
    airbnbOccupancy: number;
    roomOccupancy: { name: string; occupancy: number }[];
  }>({ totalOccupancy: 0, airbnbOccupancy: 0, roomOccupancy: [] });

  const [profit, setProfit] = useState<{ total: number; airbnb: number }>({
    total: 0,
    airbnb: 0,
  });

  const { currentGuest, setCurrentGuest, currentAirBnBGuest, setCurrentAirBnBGuest } = useContext(GuestModeContext)!;
  const [paidDates, setPaidDates] = useState<Date[]>([]);

  const onSync = () => {
    if (shouldCallOnSync) alert("Synchronizing with Airbnb");
    const savedData = localStorage.getItem("syncData");
    const requestBody: {
      calendar?: string;
      guest?: string;
      data?: { room: string; link: string }[];
    } = {};
    if (savedData) {
      const airbnbGuest = guests.find((guest) => guest.name === "AirBnB");
      requestBody.calendar = calendarId;
      requestBody.data = JSON.parse(savedData);
      requestBody.guest = airbnbGuest?.id;
    }

    syncCalendars(
      requestBody as {
        calendar: string;
        guest: string;
        data: { room: string; link: string }[];
      },
      token as string,
    )
      .then((result) => {
        setIsBlockedAirBnBDates(result.blocked);
        if (shouldCallOnSync) setIsCalendarLoading(true);
      })
      .catch((err) => console.error("Error syncing calendars:", err));
  };

  useEffect(() => {
    if (airbnbsyncRef.current) {
      localStorage.setItem("syncData", JSON.stringify(airbnbsyncRef.current));
    }
  }, []);

  useEffect(() => {
    if (initialSync && guests.length > 0) {
      onSync();
      setIsInitialSync(false);
    }
  }, [guests, initialSync]);

  useEffect(() => {
    if (isCalendarLoading) {
      Promise.all([
        fetchGuests(hostId, token as string),
        fetchDays(calendarId, token as string),
        fetchRooms(hostId, token as string),
      ])
        .then(([guests, days, rooms]) => {
          setGuests(guests);
          setRooms(rooms);
          pendingLoadingClearRef.current = true;
          setDays(days); // triggers useEffect([days]) which clears isCalendarLoading
        })
        .catch((err) => {
          console.error("Error fetching data:", err);
          setCalendarErrorMessage(
            "Failed to fetch calendar data. Please try again.",
          );
          setIsCalendarLoading(false);
        });
    }
  }, [isCalendarLoading]);

  useEffect(() => {
    if (guests.length > 0) {
      const guestId = guests.find((guest) => guest.name === "AirBnB")?.id;
      fetchAirBnBBookingCount(guestId as string, token as string)
        .then((result) => {
          setAirBnBBookingCount(result);
        })
        .catch((err) => {
          console.error("Error fetching airbnb booking count:", err);
        });
      fetchGuestBookingCount(calendarId, token as string)
        .then((result) => {
          setGuestBookingCount(result);
        })
        .catch((err) => {
          console.error("Error fetching guest booking count:", err);
        });
    }
  }, [guests]);

  // Migrate localStorage airBnB prices to DB, then clear localStorage
  useEffect(() => {
    const storedPrices = localStorage.getItem("airBnBPrices");
    if (!storedPrices || days.length === 0) return;

    const priceMap = new Map<string, number>(JSON.parse(storedPrices));
    if (priceMap.size === 0) {
      localStorage.removeItem("airBnBPrices");
      return;
    }

    const updates: Promise<unknown>[] = [];
    const matchedKeys = new Set<string>();

    for (const day of days) {
      for (const booking of day.bookings) {
        if (booking.guest.name !== "AirBnB") continue;
        const key = `${booking.room.name}_${booking.startDate}_${booking.endDate}`;
        if (matchedKeys.has(key)) continue;

        const localPrice = priceMap.get(key);
        if (localPrice !== undefined && localPrice > 0) {
          matchedKeys.add(key);
          updates.push(
            updateBookingAirbnbPrice(
              { id: booking.id, airbnbPrice: localPrice },
              token as string,
            ),
          );
        }
      }
    }

    if (updates.length > 0) {
      Promise.all(updates)
        .then(() => {
          localStorage.removeItem("airBnBPrices");
          setIsCalendarLoading(true); // Reload to pick up new DB values
        })
        .catch((err) => {
          console.error("Error migrating airBnB prices to DB:", err);
        });
    } else {
      localStorage.removeItem("airBnBPrices");
    }
  }, [days]);

  const onAirbnbPriceUpdate = (bookingId: string, airbnbPrice: number) => {
    console.log("Updating airbnb price for booking:", bookingId, airbnbPrice);

    updateBookingAirbnbPrice({ id: bookingId, airbnbPrice }, token as string)
      .then(() => {
        setIsCalendarLoading(true);
      })
      .catch((err) => {
        console.error("Error updating airbnb price:", err);
      });
  };

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

  const transformBookings = (
    monthMap: Map<string, dayType>,
    timeZone: string,
  ) => {
    const propagateBooking = (
      booking: bookingType,
      currentKey: string,
      sortedKeys: string[],
      index: number,
      tracking: { startDate: string; endDate: string; duration: number },
      processedBookings: Set<string>,
    ): void => {
      const finalizeBooking = () => {
        // Update the current booking after recursion unwinds
        booking.duration = tracking.duration;
        booking.endDate = tracking.endDate;
        booking.startDate = tracking.startDate;

        // Mark the next booking as processed
        const bookingIdentifier = `${tracking.startDate}-${tracking.endDate}-${booking.guest.id}`;
        processedBookings.add(bookingIdentifier);
      };

      const nextIndex = index + 1;

      // Base case: If there are no more keys, end recursion
      if (nextIndex >= sortedKeys.length) {
        finalizeBooking();
        return;
      }

      const nextKey = sortedKeys[nextIndex];
      const nextDay = monthMap.get(nextKey);

      // Find a matching booking in the next day's bookings
      const nextBooking = nextDay?.bookings.find((b) => {
        const currentDate = toZonedTime(currentKey, timeZone);
        const nextDate = toZonedTime(nextKey, timeZone);
        return (
          b.guest.id === booking.guest.id &&
          b.room.id === booking.room.id &&
          isSameDay(nextDate, addDays(currentDate, 1))
        );
      });

      if (nextBooking) {
        // Update the tracking object
        tracking.endDate = nextBooking.endDate;
        tracking.duration += 1;

        // Recursively propagate the merged booking
        propagateBooking(
          nextBooking,
          nextKey,
          sortedKeys,
          nextIndex,
          tracking,
          processedBookings,
        );
      }

      finalizeBooking();
    };

    const sortedKeys = [...monthMap.keys()].sort(); // Get sorted keys
    const processedBookings = new Set<string>(); // Track processed bookings

    for (let i = 0; i < sortedKeys.length; i++) {
      const currentKey = sortedKeys[i];
      const currentDay = monthMap.get(currentKey);

      if (!currentDay) {
        continue;
      }

      currentDay.bookings.forEach((booking) => {
        // Create a unique identifier for the booking
        const bookingIdentifier = `${booking.startDate}-${booking.endDate}-${booking.guest.id}`;

        // Skip already-processed bookings
        if (
          processedBookings.has(bookingIdentifier) ||
          booking.guest.name === "AirBnB"
        ) {
          return;
        }

        const tracking = {
          startDate: booking.startDate,
          endDate: booking.endDate,
          duration: 1,
        };

        // Mark the booking as processed
        processedBookings.add(bookingIdentifier);

        // Pass the sortedKeys and current index to propagateBooking
        propagateBooking(
          booking,
          currentKey,
          sortedKeys,
          i,
          tracking,
          processedBookings,
        );
      });
    }
  };

  useEffect(() => {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const map = new Map<string, dayType>();
    days.forEach((day) => {
      const formattedDate = toZonedTime(day.date, timeZone)
        .toISOString()
        .split("T")[0];
      map.set(formattedDate, day);
    });
    setMonthMap(map);

    const sortedMap = new Map(
      [...map.entries()].sort(([keyA], [keyB]) => {
        return keyA.localeCompare(keyB); // Lexicographical comparison
      }),
    );

    transformBookings(sortedMap, timeZone);

    if (pendingLoadingClearRef.current) {
      pendingLoadingClearRef.current = false;
      setIsCalendarLoading(false);
    }
  }, [days]);

  useEffect(() => {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    if (days && currentMonth) {
      const targetMonth = currentMonth.getMonth(); // Current month (0-based index)
      const targetYear = currentMonth.getFullYear(); // Current year

      // Get unique days in the current month
      const occupiedDays = days.filter((day) => {
        const processedDate = toZonedTime(day.date, timeZone);
        return (
          processedDate.getFullYear() === targetYear &&
          processedDate.getMonth() === targetMonth
        );
      });

      // Initialize a map to group Sets by normalized room name
      const roomSets = new Map();

      // Function to normalize room names (remove duplicate patterns)
      const getBaseRoomName = (roomName: string) => {
        return roomName.replace(/^(.+)\1$/, "$1");
      };

      // Iterate over each room in the state (filter to selected room if one is chosen)
      const filteredRooms = selectedRoomName
        ? rooms.filter((r) => r.name === selectedRoomName)
        : rooms;

      // blocked nights per room (base name) — subtracted from denominator
      const blockedNightsMap = new Map<string, number>();

      filteredRooms.forEach((room) => {
        const baseRoomName = getBaseRoomName(room.name); // Normalize name
        const roomId = room.id;

        // Filter the dayType objects by the room.id in their bookings
        const roomSpecificSet = new Set(
          occupiedDays.filter((day) =>
            day.bookings.some((booking) => booking.room.id === roomId),
          ),
        );

        // Count blocked nights for this room
        const blockedCount = occupiedDays.filter((day) =>
          day.isBlocked || day.blockedRooms.some((r) => r.id === roomId),
        ).length;
        blockedNightsMap.set(
          baseRoomName,
          (blockedNightsMap.get(baseRoomName) ?? 0) + blockedCount,
        );

        // Add the Set to the Map (using base name as key)
        if (!roomSets.has(baseRoomName)) {
          roomSets.set(baseRoomName, new Set());
        }

        // Merge existing Set with the new room-specific Set
        roomSpecificSet.forEach((day) => roomSets.get(baseRoomName).add(day));
      });

      // Total number of days in the current month
      const daysInMonth = getDaysInMonth(currentMonth);

      // Initialize total occupancy and room-wise occupancy
      let totalOccupiedDays = 0;
      let totalAvailableDays = 0;
      let totalAirbnbGuests = 0;
      let totalAirbnbAvailableDays = 0;
      const roomOccupancy = [];
      const airbnbGuestCountMap = new Map(); // Map for storing counts of Airbnb guests

      for (const [roomName, roomSet] of roomSets.entries()) {
        const blockedNights = blockedNightsMap.get(roomName) ?? 0;
        const availableNights = Math.max(daysInMonth - blockedNights, 1);
        const occupancyPercentage = (roomSet.size / availableNights) * 100;
        roomOccupancy.push({ name: roomName, occupancy: occupancyPercentage });

        totalOccupiedDays += roomSet.size;
        if (roomName !== "Master") totalAvailableDays += availableNights;

        // Count "Airbnb" guests for the current room
        let airbnbCount = 0;
        roomSet.forEach((day: dayType) => {
          day.bookings.forEach((booking) => {
            if (
              getBaseRoomName(booking.room.name) === roomName && // Compare using base name
              booking.guest.name.toLowerCase() === "airbnb"
            ) {
              airbnbCount += 1;
            }
          });
        });

        // Store the count in the map
        airbnbGuestCountMap.set(roomName, airbnbCount);

        // Add to total Airbnb guest count
        if (roomName !== "Master") {
          totalAirbnbGuests += airbnbCount;
          totalAirbnbAvailableDays += availableNights;
        }
      }

      // Calculate total occupancy percentage (excluding "Master")
      const totalOccupancy = totalAvailableDays > 0
        ? (totalOccupiedDays / totalAvailableDays) * 100
        : 0;
      const airbnbOccupancy = totalAirbnbAvailableDays > 0
        ? (totalAirbnbGuests / totalAirbnbAvailableDays) * 100
        : 0;

      // Update state
      setOccupancy({
        totalOccupancy: totalOccupancy,
        airbnbOccupancy: airbnbOccupancy,
        roomOccupancy: roomOccupancy,
      });
    }
  }, [days, currentMonth, rooms, selectedRoomName]);

  useEffect(() => {
    if (shouldCallOnSync) {
      onSync();
      setShouldCallOnSync(false);
    }
  }, [shouldCallOnSync]);

  useEffect(() => {
    let guestProfit = 0;
    let airBnBProfit = 0;
    if (monthMap) {
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

      // Filter and sort only the dates that belong to the current month or beyond
      const sortedKeys = [...monthMap.keys()]
        .filter((dateKey) => {
          const localDate = toZonedTime(dateKey, timeZone); // Convert string to Date object
          return (
            isSameMonth(localDate, currentMonth) ||
            isAfter(localDate, currentMonth)
          );
        })
        .sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

      for (const dateKey of sortedKeys) {
        const day = monthMap.get(dateKey);
        if (!day) continue;

        const currentLocalDate = toZonedTime(dateKey, timeZone);
        if (!isSameMonth(currentLocalDate, currentMonth)) break;

        for (const booking of day.bookings) {
          if (selectedRoomName && booking.room.name !== selectedRoomName)
            continue;

          if (booking.guest.name != "AirBnB") {
            const guestPricing = booking.guest.pricing.find(
              (pricing) => pricing.room === booking.room.id,
            );

            if (guestPricing) {
              guestProfit += guestPricing.price;
            }
          } else {
            if (booking.airbnbPrice && booking.duration) {
              const singleDayProfit = booking.airbnbPrice / booking.duration;
              guestProfit += singleDayProfit;
              airBnBProfit += singleDayProfit;
            }
          }
        }
      }
    }

    setProfit((p) => ({ ...p, total: guestProfit, airbnb: airBnBProfit }));
  }, [monthMap, currentMonth, selectedRoomName]);

  useEffect(() => {
    if (isTodoModalOpen) {
      setCurrentMonth(new Date());
      setScrollToTodayTrigger((t) => t + 1);
    }
  }, [isTodoModalOpen]);

  const onBookingComplete = (bookedDays: dayType[]) => {
    setDays((prev) => [...prev, ...bookedDays]);
    setIsCalendarLoading(true);
  };

  const onBooking = (
    roomName: string,
    date: Date,
    duration: number,
    bookedDays: dayType[],
  ) => {
    // Ensure the roomName exists in blockedAirBnBDates and calculate the date ranges
    if (blockedAirBnBDates && roomName in blockedAirBnBDates) {
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

      // Map over the blocked dates and calculate start and end dates
      const dateRanges = blockedAirBnBDates[
        roomName as keyof typeof blockedAirBnBDates
      ].map((dateRange: { start: string; duration: number }) => {
        const start = toZonedTime(dateRange.start, timeZone); // Parse start date
        const end = addDays(start, dateRange.duration - 1); // Calculate end date
        return { start, end };
      });

      // Calculate the end date for the booking
      const bookingStart = toZonedTime(
        date.toISOString().split("T")[0],
        timeZone,
      );
      const bookingEnd = addDays(bookingStart, duration - 1);

      // Check if the booking date range overlaps with any blocked date ranges
      const isBlocked = dateRanges.some(({ start, end }) => {
        if (
          isWithinInterval(bookingEnd, { start, end }) ||
          isWithinInterval(bookingStart, { start, end })
        ) {
          console.log(
            `${bookingStart.toISOString().split("T")[0]} to ${
              bookingEnd.toISOString().split("T")[0]
            } is within ${start.toISOString().split("T")[0]} to ${
              end.toISOString().split("T")[0]
            }`,
          );
          return true;
        }
      });

      if (isBlocked) console.log("Dates are blocked on AirBnB Calendar");

      const room = rooms.find((room) => room.id === roomName);
      if (!isBlocked) {
        alert(
          `Please block ${date.toISOString().split("T")[0]} to ${
            bookingEnd.toISOString().split("T")[0]
          } for Room: ${room?.name}`,
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
      .catch((err) => {
        console.error("Error updating booked guest:", err);
      });
  };

  const onUnbook = (ids: string[]) => {
    setSelectedUnbooking(null);

    const unbookSequentially = (index: number) => {
      if (index >= ids.length) {
        // All unbookings are done
        setCurrentBookings(null);
        setIsMobileModalOpen(false);
        setIsCalendarLoading(true);
        return;
      }

      const id = ids[index];
      updateUnbookGuest(id, token as string)
        .then((result) => {
          console.log(`Successfully unbooked guest with ID: ${id}`, result);
          // Proceed to the next ID
          unbookSequentially(index + 1);
        })
        .catch((err) => {
          console.error(`Error unbooking guest with ID: ${id}`, err);
          // Continue even if an error occurs
          unbookSequentially(index + 1);
        });
    };

    unbookSequentially(0); // Start the recursive process
  };

  const onPricingUpdate = (
    data: {
      guest: string;
      room: string;
      price: number;
    }[],
  ) => {
    Promise.all(
      data.map((priceUpdate) =>
        updateGuestPricing(priceUpdate, token as string),
      ),
    )
      .then((results) => {
        console.log("All updates completed:", results);
        setCurrentBookings(null);
        setIsMobileModalOpen(false);
        setIsCalendarLoading(true);
      })
      .catch((err) => {
        console.error("Error updating guest pricing:", err);
      });
  };

  const getCurrentGuestBill = (guest: string) => {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    const totalPriceOfMonth = Array.from(monthMap.entries()).reduce(
      (total, [dateStr, dayEntry]) => {
        const date = toZonedTime(dateStr, timeZone);

        if (isSameMonth(date, currentMonth)) {
          const matchingBookings = dayEntry.bookings.filter(
            (booking) =>
              booking.guest.name === guest && booking.startDate === dateStr,
          );

          return (
            total +
            matchingBookings.reduce((sum, booking) => {
              const pricePerNight =
                booking.guest.pricing.find((p) => p.room === booking.room.id)
                  ?.price || booking.price;

              return sum + pricePerNight * booking.duration;
            }, 0)
          );
        }

        return total;
      },
      0,
    );

    return totalPriceOfMonth;
  };

  const formatListWithAnd = (items: string[]): string => {
    if (items.length === 0) return "";
    if (items.length === 1) return items[0];
    if (items.length === 2) return `${items[0]} and ${items[1]}`;
    return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
  };

  const handleBookingConfirmation = (phone: string) => {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    const uniqueMonths = new Set<string>(
      paidDates.map(
        (paidDate) => startOfMonth(paidDate).toISOString().split("T")[0],
      ),
    );

    const months = Array.from(uniqueMonths, (uniqueMonth) =>
      toZonedTime(uniqueMonth, timeZone),
    );

    const monthStrings = months.map((month) => format(month, "LLLL"));

    const body = `Your bookings for ${
      monthStrings.length > 0
        ? formatListWithAnd(monthStrings)
        : format(currentMonth, "LLLL")
    } are now as follows:\n`;

    // Sort monthMap entries using date-fns compareAsc
    const sortedEntries = Array.from(monthMap.entries()).sort(
      ([dateStrA], [dateStrB]) => {
        const dateA = toZonedTime(dateStrA, timeZone);
        const dateB = toZonedTime(dateStrB, timeZone);
        return compareAsc(dateA, dateB);
      },
    );

    let totalPriceOfMonth = 0;
    let guestName = "";
    let numberOfNights = 0;

    // Process the sorted entries
    const bookingDetails = sortedEntries.reduce((acc, [dateStr, dayEntry]) => {
      const date = toZonedTime(dateStr, timeZone);

      // Check if the booking is within the current month
      if (
        (months.length > 0 &&
          months.some((month) => isSameMonth(date, month))) ||
        isSameMonth(date, currentMonth)
      ) {
        // Filter bookings that match the phone number and start date
        const matchingBookings = dayEntry.bookings.filter(
          (booking) =>
            booking.guest.phone === phone && booking.startDate === dateStr,
        );

        // If matching bookings exist, format them and add to accumulator
        if (matchingBookings.length > 0) {
          const bookingText = matchingBookings
            .map((booking: bookingType) => {
              guestName = booking.guest.name;

              const startDate = toZonedTime(
                booking.startDate.split("T")[0],
                timeZone,
              );

              const isPaid = paidDates.some((paidDate) =>
                isSameDay(toZonedTime(paidDate, timeZone), startDate),
              );

              const weekday = format(startDate, "EEE"); // Mon, Tue, etc.
              const dateFormatted = format(startDate, "MMM d");
              const duration = booking.duration;
              const endDate = addDays(startDate, duration);
              const endWeekday = format(endDate, "EEE");
              const endDateFormatted = format(endDate, "MMM d");

              // Get the room name and price
              const roomName = booking.room.name;
              const pricePerNight =
                booking.guest.pricing.find((p) => p.room === booking.room.id)
                  ?.price || booking.price; // Fallback if pricing not found

              if (duration === 1) {
                // Single-night booking format
                totalPriceOfMonth += pricePerNight;
                return `* ${weekday} to ${endWeekday} morning, ${dateFormatted} - ${endDateFormatted} morning, 1 night, ${roomName}, $${pricePerNight} ${
                  isPaid ? "(paid)" : ""
                }`;
              } else {
                const totalPrice = pricePerNight * duration;

                totalPriceOfMonth += totalPrice;

                return `* ${weekday} to ${endWeekday} morning, ${dateFormatted} - ${endDateFormatted} morning, ${duration} nights, ${roomName}, $${pricePerNight} * ${duration} = $${totalPrice} ${
                  isPaid ? "(paid)" : ""
                }`;
              }

              numberOfNights += duration;
            })
            .join("\n");

          // Add the formatted booking details to the accumulator
          return acc + bookingText + "\n";
        }
      }

      return acc; // Return accumulator unchanged if no match
    }, ""); // Initialize with an empty string

    let totalPaidAmount = 0;

    paidDates.map((paidDate) => {
      // Assume that the date always maps correctly

      const day = monthMap.get(paidDate.toISOString().split("T")[0]) as dayType;

      const booking = day.bookings.find((booking) => {
        return booking.guest.id === currentGuest;
      }) as bookingType;

      totalPaidAmount +=
        booking.guest.pricing.find((p) => p.room === booking.room.id)?.price ||
        booking.price;
    });

    const unpaid = totalPriceOfMonth - totalPaidAmount;

    const politePreface = `Many thanks for your ${
      numberOfNights === 1 ? "inquiry" : "inquiries"
    }!`;

    const accomodationPreface = numberOfNights > 3 ? "I do my best to accomodate you." : "";

    const fullBody = `${
      guestName === "" ? "" : `Hi ${guestName},`
    }\n${politePreface}${accomodationPreface ? `\n${accomodationPreface}` : ""}\n${body}${bookingDetails}\nTotal price = $${totalPriceOfMonth}${
      totalPaidAmount > 0 ? `\nTotal paid = $${totalPaidAmount}` : ""
    }${
      unpaid > 0
        ? `\nTo pay = ${
            totalPaidAmount > 0
              ? `$${totalPriceOfMonth} - $${totalPaidAmount} = $${unpaid}`
              : `$${unpaid}`
          }`
        : ""
    }\n\nCould you please confirm whether everything is in order?`;

    window.location.href = `sms:${phone}?&body=${encodeURIComponent(fullBody)}`;
  };

  const handleSendCalEvents = (phone: string, email?: string) => {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    const sortedEntries = Array.from(monthMap.entries()).sort(
      ([a], [b]) => compareAsc(toZonedTime(a, timeZone), toZonedTime(b, timeZone))
    );

    const guestBookings: bookingType[] = [];
    for (const [dateStr, dayEntry] of sortedEntries) {
      const matching = dayEntry.bookings.filter(
        (b) =>
          b.guest.phone === phone &&
          b.startDate === dateStr &&
          paidDates.some((paidDate) =>
            isSameDay(
              toZonedTime(paidDate, timeZone),
              toZonedTime(dateStr, timeZone)
            )
          )
      );
      guestBookings.push(...matching);
    }

    if (guestBookings.length === 0) return;

    const formatICSDateTime = (date: Date, hour: number) =>
      format(date, `yyyyMMdd'T'${String(hour).padStart(2, "0")}0000`);

    const icsEvents = guestBookings.map((booking) => {
      const checkinDate = toZonedTime(booking.startDate.split("T")[0], timeZone);
      const checkoutDate = addDays(checkinDate, booking.duration);
      return [
        "BEGIN:VEVENT",
        `DTSTART;TZID=${timeZone}:${formatICSDateTime(checkinDate, 14)}`,
        `DTEND;TZID=${timeZone}:${formatICSDateTime(checkoutDate, 11)}`,
        `SUMMARY:Stay at ${booking.room.name}${airbnbName ? ` @ ${airbnbName}` : ""}`,
        `DESCRIPTION:${booking.duration} night${booking.duration > 1 ? "s" : ""} at ${booking.room.name}`,
        ...(airbnbAddress ? [`LOCATION:${airbnbAddress.split("\n").join(", ")}`] : []),
        "END:VEVENT",
      ].join("\r\n");
    });

    const icsContent = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//3rd Air Champion//Bookings//EN",
      "CALSCALE:GREGORIAN",
      ...icsEvents,
      "END:VCALENDAR",
    ].join("\r\n");

    const firstBooking = guestBookings[0];
    const lastBooking = guestBookings[guestBookings.length - 1];
    const guestDisplayName = firstBooking.guest.name.trim();
    const guestName = guestDisplayName.replace(/\s+/g, "_");
    const checkinDate = format(toZonedTime(firstBooking.startDate.split("T")[0], timeZone), "yyyy-MM-dd");
    const lastCheckin = toZonedTime(lastBooking.startDate.split("T")[0], timeZone);
    const checkoutDate = format(addDays(lastCheckin, lastBooking.duration), "yyyy-MM-dd");
    setIcsModal({ icsContent, phone, email, guestName, guestDisplayName, checkinDate, checkoutDate, fileName: `booking_${guestName}_${checkinDate}.ics` });
  };

  return (
    <>
      <div className="col-span-5 bg-gray-100 overflow-hidden sm:col-span-4 flex flex-col">
        {isCalendarLoading ? (
          <div className="flex items-center justify-center h-full">
            Loading...
          </div>
        ) : calendarErrorMessage ? (
          <div className="flex items-center justify-center h-full text-red-500">
            {calendarErrorMessage}
          </div>
        ) : (
          <>
            <CalendarNavigator
              currentGuest={
                currentGuest
                  ? (guests.find((guest) => guest.id === currentGuest)
                      ?.name as string)
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
            />
            {showAddPane && (
              <>
                {/* GuestAddPane */}
                {showAddPane === "guest" && (
                  <div
                    className="fixed inset-0 bg-gray-800 bg-opacity-50 flex items-center justify-center z-50"
                    onClick={() => {
                      setShowAddPane(null); // Close modal on background click
                    }}
                  >
                    <div
                      className="w-full max-w-md bg-white p-4 rounded-lg shadow-lg"
                      onClick={(e) => e.stopPropagation()} // Prevent background click inside modal
                    >
                      <GuestAddPane
                        guestErrorMessage={guestErrorMessage}
                        onAddGuest={(guestData) => {
                          onAddGuest(guestData); // Handle guest addition
                          setShowAddPane(null); // Close modal after adding guest
                        }}
                      />
                    </div>
                  </div>
                )}

              </>
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
            onBooking={onBookingComplete}
            setIsModalOpen={setIsModalOpen}
            setShowAddPane={setShowAddPane}
          />
        )}
      </div>

      <div className="hidden bg-white border-l sm:block">
        {isBlockRoomsModalOpen ? (
          <BlockRoomsModal calendarId={calendarId} monthMap={monthMap} rooms={rooms} token={token as string} onDaysUpdate={(updated) => setDays((prev) => { const ids = new Set(updated.map((d) => d.id)); return [...prev.filter((d) => !ids.has(d.id)), ...updated]; })} />
        ) : isBlockAirBnBModalOpen ? (
          <BlockAirBnBModal monthMap={monthMap} rooms={rooms} blockedAirBnBDates={blockedAirBnBDates as Record<string, { start: string; duration: number }[]> | undefined} token={token as string} onDaysUpdate={(updated) => setDays((prev) => { const ids = new Set(updated.map((d) => d.id)); return [...prev.filter((d) => !ids.has(d.id)), ...updated]; })} />
        ) : isAvailabilitiesModalOpen ? (
          <AvailabilitiesModal monthMap={monthMap} rooms={rooms} currentMonth={currentMonth} airbnbName={airbnbName} />
        ) : isTodoModalOpen ? (
          <ToDoList monthMap={monthMap} doorCode={doorCode} airbnbName={airbnbName} airbnbAddress={airbnbAddress} />
        ) : (
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
            onDaysUpdate={(updated) => setDays((prev) => { const ids = new Set(updated.map((d) => d.id)); return [...prev.filter((d) => !ids.has(d.id)), ...updated]; })}
            setCurrentGuest={setCurrentGuest}
            setCurrentAirBnBGuest={setCurrentAirBnBGuest}
            setSelectedBooking={
              setSelectedBooking as React.Dispatch<
                React.SetStateAction<bookingType>
              >
            }
            setSelectedModifyBooking={
              setSelectedModifyBooking as React.Dispatch<
                React.SetStateAction<bookingType>
              >
            }
            setSelectedUnbooking={
              setSelectedUnbooking as React.Dispatch<
                React.SetStateAction<bookingType>
              >
            }
          >
            <BookButton
              setIsModalOpen={setIsModalOpen}
              setSelectedRoom={setSelectedRoom}
            />
          </GuestView>
        )}
      </div>

      {/* Guest View for Small Screens */}
      <div
        className={`fixed bottom-0 left-0 w-full bg-white p-1 border-t border-gray-300 z-50 overflow-y-scroll sm:hidden transition-transform duration-300 ${
          isMobileModalOpen ? "translate-y-0" : "translate-y-full"
        }`}
        style={{ height: "calc(100% - 15rem)" }} // Leaves a 4px margin at the top
      >
        {/* Close Button */}
        <div className="flex justify-center">
          <button
            className="text-gray-500 font-bold text-[1.5rem] leading-none px-6 py-0.5 rounded hover:bg-gray-100"
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
            onDaysUpdate={(updated) => setDays((prev) => { const ids = new Set(updated.map((d) => d.id)); return [...prev.filter((d) => !ids.has(d.id)), ...updated]; })}
            setCurrentAirBnBGuest={setCurrentAirBnBGuest}
            setCurrentGuest={setCurrentGuest}
            setIsMobileModalOpen={setIsMobileModalOpen}
            setSelectedBooking={
              setSelectedBooking as React.Dispatch<
                React.SetStateAction<bookingType>
              >
            }
            setSelectedModifyBooking={
              setSelectedModifyBooking as React.Dispatch<
                React.SetStateAction<bookingType>
              >
            }
            setSelectedUnbooking={
              setSelectedUnbooking as React.Dispatch<
                React.SetStateAction<bookingType>
              >
            }
          >
            <BookButton
              setIsModalOpen={setIsModalOpen}
              setIsMobileModalOpen={setIsMobileModalOpen}
              setSelectedRoom={setSelectedRoom}
            />
          </GuestView>
      </div>

      <div
        className={`fixed bottom-0 left-0 w-full h-auto bg-white p-1 border-t border-gray-300 z-50 overflow-y-scroll sm:hidden transition-transform duration-300 ${
          isTodoModalOpen ? "translate-y-0" : "translate-y-full"
        }`}
      >
        {/* Close Button */}
        <div className="flex justify-center">
          <button
            className="text-gray-500 font-bold text-[1.5rem] leading-none px-6 py-0.5 rounded hover:bg-gray-100"
            onClick={() => setIsTodoModalOpen(false)}
          >
            &times;
          </button>
        </div>

        <ToDoList monthMap={monthMap} doorCode={doorCode} airbnbName={airbnbName} airbnbAddress={airbnbAddress} />
      </div>

      <div
        className={`fixed bottom-0 left-0 w-full h-auto bg-white p-1 border-t border-gray-300 z-50 overflow-y-scroll sm:hidden transition-transform duration-300 ${
          isAvailabilitiesModalOpen ? "translate-y-0" : "translate-y-full"
        }`}
      >
        {/* Close Button */}
        <div className="flex justify-center">
          <button
            className="text-gray-500 font-bold text-[1.5rem] leading-none px-6 py-0.5 rounded hover:bg-gray-100"
            onClick={() => setIsAvailabilitiesModalOpen(false)}
          >
            &times;
          </button>
        </div>

        <AvailabilitiesModal monthMap={monthMap} rooms={rooms} currentMonth={currentMonth} airbnbName={airbnbName} />
      </div>

      <div
        className={`fixed bottom-0 left-0 w-full h-auto bg-white p-1 border-t border-gray-300 z-50 overflow-y-scroll sm:hidden transition-transform duration-300 ${
          isBlockAirBnBModalOpen ? "translate-y-0" : "translate-y-full"
        }`}
      >
        {/* Close Button */}
        <div className="flex justify-center">
          <button
            className="text-gray-500 font-bold text-[1.5rem] leading-none px-6 py-0.5 rounded hover:bg-gray-100"
            onClick={() => setIsBlockAirBnBModalOpen(false)}
          >
            &times;
          </button>
        </div>

        <BlockAirBnBModal monthMap={monthMap} rooms={rooms} blockedAirBnBDates={blockedAirBnBDates as Record<string, { start: string; duration: number }[]> | undefined} token={token as string} onDaysUpdate={(updated) => setDays((prev) => { const ids = new Set(updated.map((d) => d.id)); return [...prev.filter((d) => !ids.has(d.id)), ...updated]; })} />
      </div>

      <div
        className={`fixed bottom-0 left-0 w-full h-auto bg-white p-1 border-t border-gray-300 z-50 overflow-y-scroll sm:hidden transition-transform duration-300 ${
          isBlockRoomsModalOpen ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <div className="flex justify-center">
          <button
            className="text-gray-500 font-bold text-[1.5rem] leading-none px-6 py-0.5 rounded hover:bg-gray-100"
            onClick={() => setIsBlockRoomsModalOpen(false)}
          >
            &times;
          </button>
        </div>

        <BlockRoomsModal calendarId={calendarId} monthMap={monthMap} rooms={rooms} token={token as string} onDaysUpdate={(updated) => setDays((prev) => { const ids = new Set(updated.map((d) => d.id)); return [...prev.filter((d) => !ids.has(d.id)), ...updated]; })} />
      </div>

      {selectedBooking && (
        <DetailsModal
          booking={selectedBooking}
          rooms={rooms}
          onClose={() => setSelectedBooking(null)}
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
      {icsModal && createPortal(
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50"
          onClick={() => setIcsModal(null)}
        >
          <div
            className="bg-white rounded-lg p-4 w-full max-w-lg shadow-lg flex flex-col gap-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col items-center gap-1">
              <button
                onClick={() => setIcsModal(null)}
                className="text-gray-500 font-bold text-[1.5rem] leading-none px-6 py-0.5 rounded hover:bg-gray-100"
              >
                &times;
              </button>
              <h2 className="font-bold text-lg">Calendar Events</h2>
            </div>
            <textarea
              readOnly
              className="border rounded px-2 py-1 text-sm w-full resize-none font-mono"
              rows={14}
              value={icsModal.icsContent}
            />
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600 whitespace-nowrap">File name</label>
              <input
                type="text"
                className="border rounded px-2 py-1 text-sm flex-1"
                value={icsModal.fileName}
                onChange={(e) => setIcsModal({ ...icsModal, fileName: e.target.value })}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setIcsModal(null)}
                className="px-3 py-1 bg-gray-400 text-white text-sm rounded"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  const fileName = icsModal.fileName.endsWith(".ics") ? icsModal.fileName : `${icsModal.fileName}.ics`;
                  const blob = new Blob([icsModal.icsContent], { type: "text/calendar;charset=utf-8" });
                  const file = new File([blob], fileName, { type: "text/calendar" });
                  if (navigator.canShare && navigator.canShare({ files: [file] })) {
                    try {
                      await navigator.share({ files: [file], title: "Calendar Events" });
                    } catch {
                      // user cancelled share sheet
                    }
                  } else {
                    // desktop fallback: download the .ics file
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = fileName;
                    a.click();
                    URL.revokeObjectURL(url);
                  }
                }}
                className="px-3 py-1 bg-blue-600 text-white text-sm rounded"
              >
                Save
              </button>
              <button
                onClick={() => {
                  const checkin = new Date(icsModal.checkinDate);
                  const checkout = new Date(icsModal.checkoutDate);
                  const checkinMonth = checkin.toLocaleString("en-US", { month: "long" });
                  const checkinYear = checkin.getFullYear();
                  const checkoutMonth = checkout.toLocaleString("en-US", { month: "long" });
                  const checkoutYear = checkout.getFullYear();
                  const periodStr =
                    checkinYear === checkoutYear && checkinMonth === checkoutMonth
                      ? `${checkinMonth} ${checkinYear}`
                      : checkinYear === checkoutYear
                      ? `${checkinMonth} to ${checkoutMonth} ${checkinYear}`
                      : `${checkinMonth} ${checkinYear} to ${checkoutMonth} ${checkoutYear}`;
                  const body = `Hello ${icsModal.guestDisplayName}, please find attached your calendar events of your booking from ${periodStr}. Please download the file and save to your phone calendar for better reminding of your upcoming stays at ${airbnbName}. Thanks!`;
                  window.location.href = `sms:${icsModal.phone}?&body=${encodeURIComponent(body)}`;
                }}
                className="px-3 py-1 bg-green-600 text-white text-sm rounded"
              >
                Send Message
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

export default MainView;
