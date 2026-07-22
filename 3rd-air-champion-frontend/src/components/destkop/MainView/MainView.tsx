import { useContext, useEffect, useMemo, useRef, useState } from "react";
import CalendarNavigator from "./CalendarView/CalendarNavigatorDesktop";
import CustomCalendar from "./CalendarView/CustomCalendarDesktop";
import { dayType } from "../../../util/types/dayType";
import BookingModal from "../BookingModal/BookingModal";
import { bookingType } from "../../../util/types/bookingType";
import { addDays, format, isWithinInterval, startOfToday } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { roomType } from "../../../util/types/roomType";
import { createRoom, deleteRoom, fetchRooms, updateRoom } from "../../../util/roomOperations";
import { guestType } from "../../../util/types/guestType";
import { createGuest, deleteGuest, updateGuest, updateGuestPricing } from "../../../util/guestOperations";
import GuestView from "./GuestView/GuestView";
import BookButton from "../BookButton";
import { AddPaneContext, GuestModeContext, isSyncModalOpenContext } from "../../../context";
import DetailsModal from "./GuestView/DetailsModal";
import { updateBookingGuest, updateBookingAirbnbPrice, updateBookingReserved, updateUnbookGuest } from "../../../util/bookingOperations";
import { fetchAssignments } from "../../../util/cleanerOperations";
import { getCleaningForecast } from "../../../util/cleaningTasks";
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
import CleanersModal from "./CleanersModal";
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
  houseRules?: string;
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
  setCleanTodoCount: React.Dispatch<React.SetStateAction<number>>;
  setCleanUnassignedCount: React.Dispatch<React.SetStateAction<number>>;
  isRequestManagerOpen: boolean;
  setIsRequestManagerOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setBookingRequestPendingCount: React.Dispatch<React.SetStateAction<number>>;
  setWishListAvailableCount: React.Dispatch<React.SetStateAction<number>>;
  cancellationFullRefundDays?: number;
  cancellationHalfRefundDays?: number;
}

const MainView = ({
  calendarId,
  hostId,
  airbnbsync,
  doorCode,
  airbnbName,
  airbnbAddress,
  houseRules = "",
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
  setCleanTodoCount,
  setCleanUnassignedCount,
  isRequestManagerOpen,
  setIsRequestManagerOpen,
  setBookingRequestPendingCount,
  setWishListAvailableCount,
  cancellationFullRefundDays,
  cancellationHalfRefundDays,
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
    isCleanersOpen: boolean;
    setIsCleanersOpen: React.Dispatch<React.SetStateAction<boolean>>;
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
    isCleanersOpen,
    setIsCleanersOpen,
  } = addPaneContext;

  const { currentGuest, setCurrentGuest, currentAirBnBGuest, setCurrentAirBnBGuest } =
    useContext(GuestModeContext)!;

  // ── Local UI state ────────────────────────────────────────────────────────
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  // Bookings whose dates still need blocking on Airbnb — shown as a toast
  const [blockReminders, setBlockReminders] = useState<
    { room: string; start: string; end: string }[]
  >([]);
  const [currentBookings, setCurrentBookings] = useState<bookingType[] | null>();
  const [selectedRoomName, setSelectedRoomName] = useState<string | null>(null);
  const [gapsMode, setGapsMode] = useState(false);
  const [editingRoomId, setEditingRoomId] = useState<string>("");
  const [isMobileModalOpen, setIsMobileModalOpen] = useState(false);
  const [scrollToTodayTrigger, setScrollToTodayTrigger] = useState(0);
  const [todayInView, setTodayInView] = useState(true);
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
  // One or many stays queued for the unbook confirmation (single card action or
  // the whole hold-bar selection).
  const [unbookBookings, setUnbookBookings] = useState<bookingType[] | null>(null);
  const [selectedModifyBooking, setSelectedModifyBooking] = useState<bookingType | null>(null);
  const [paidDates, setPaidDates] = useState<Date[]>([]);
  // Guest mode: soft-hold dates double-tapped for batch confirm-to-firm
  const [holdDates, setHoldDates] = useState<Date[]>([]);
  const [isConfirmingHolds, setIsConfirmingHolds] = useState(false);
  const [confirmHoldsError, setConfirmHoldsError] = useState("");
  // Drag offset of the floating confirm bar (movable so panels can't trap it)
  const [holdBarOffset, setHoldBarOffset] = useState({ x: 0, y: 0 });

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
    onFeesUpdate,
    airBnBBookingCount,
    guestBookingCount,
    syncStatus,
  } = useCalendarData({
    calendarId,
    hostId,
    token: token as string,
    airbnbsync,
    shouldCallOnSync,
    setShouldCallOnSync,
  });

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

  // Clean button badges, refetched when the Clean modal opens/closes:
  //  • cleanTodoCount       = finished cleanings (<= today) still needing hours
  //                           logged (per cleaner-day, matches Clean → Hours)
  //  • cleanUnassignedCount = upcoming forecast cleanings (next 7 days) with no
  //                           cleaner assigned yet (matches Clean → Plan "Unassigned")
  useEffect(() => {
    if (!hostId || !token) return;
    const monthStart = `${format(startOfToday(), "yyyy-MM")}-01`;
    const todayStr = format(startOfToday(), "yyyy-MM-dd");
    const end = format(addDays(startOfToday(), 7), "yyyy-MM-dd");
    fetchAssignments(hostId, monthStart, end, token)
      .then((assigns) => {
        const days = new Set<string>();
        assigns.forEach((a) => {
          if (a.date <= todayStr && a.hours == null && a.cleaner)
            days.add(`${a.cleaner.id}|${a.date}`);
        });
        setCleanTodoCount(days.size);

        let unassigned = 0;
        getCleaningForecast(monthMap).forEach((day) =>
          day.entries.forEach((e) => {
            const has = assigns.some(
              (a) =>
                a.date === day.morningKey &&
                a.room?.id === e.checkoutBooking.room.id &&
                a.cleaner,
            );
            if (!has) unassigned++;
          }),
        );
        setCleanUnassignedCount(unassigned);
      })
      .catch(() => {
        setCleanTodoCount(0);
        setCleanUnassignedCount(0);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hostId, token, isCleanersOpen, monthMap]);

  // ── Messaging hook ────────────────────────────────────────────────────────
  const {
    icsModal,
    setIcsModal,
    getCurrentGuestBill,
    handleBookingConfirmation,
    buildConfirmationForBookings,
    handleSendCalEvents,
    calEventsHint,
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
        // In-design toast instead of a browser alert — links to the Block panel
        setBlockReminders((prev) => [
          ...prev,
          {
            room: room?.name ?? "",
            start: date.toISOString().split("T")[0],
            end: bookingEnd.toISOString().split("T")[0],
          },
        ]);
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
    setUnbookBookings(null);
    setHoldDates([]);

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

  // Distinct stays covered by the double-tapped (amber) dates, split by direction:
  // reserved stays get confirmed to firm, firm stays get downgraded to soft hold.
  // One entry per stay (guest+room+startDate) — actions flip the WHOLE stay.
  const { reservedHoldStays, firmHoldStays, allHoldStays } = useMemo(() => {
    const reserved = new Map<string, string>(); // stayKey -> a booking id within the stay
    const firm = new Map<string, string>();
    const all = new Map<string, bookingType>(); // stayKey -> the stay (for batch unbook)
    if (!currentGuest) return { reservedHoldStays: reserved, firmHoldStays: firm, allHoldStays: all };
    holdDates.forEach((d) => {
      const day = monthMap.get(format(d, "yyyy-MM-dd"));
      day?.bookings.forEach((b) => {
        if (b.guest?.id !== currentGuest || !b.room) return;
        const key = `${b.room.id}|${b.startDate}`;
        if (b.reserved) reserved.set(key, b.id);
        else firm.set(key, b.id);
        all.set(key, b);
      });
    });
    return { reservedHoldStays: reserved, firmHoldStays: firm, allHoldStays: all };
  }, [holdDates, monthMap, currentGuest]);

  const totalHoldSelection = reservedHoldStays.size + firmHoldStays.size;

  const runHoldAction = async (stays: Map<string, string>, reserved: boolean) => {
    if (stays.size === 0) return;
    setIsConfirmingHolds(true);
    setConfirmHoldsError("");
    try {
      // Sequential to avoid write races on shared Day docs.
      for (const id of stays.values()) {
        const updatedDays = await updateBookingReserved({ id, reserved }, token as string);
        onDaysUpdate(updatedDays);
      }
      setHoldDates([]);
    } catch (err) {
      // Surface in the bar — console-only errors are invisible on the phone.
      console.error("Error updating holds:", err);
      setConfirmHoldsError(typeof err === "string" ? err : "Update failed. Please try again.");
    }
    setIsConfirmingHolds(false);
  };

  const onConfirmHolds = () => runHoldAction(reservedHoldStays, false);
  const onDowngradeHolds = () => runHoldAction(firmHoldStays, true);
  // Unbook the whole hold selection — route it through the same confirmation the
  // per-card Unbook uses, which expands each stay to its night ids on Confirm.
  const onUnbookHolds = () => setUnbookBookings([...allHoldStays.values()]);

  // The confirm bar is draggable (pointer events) so it can be pulled clear of
  // whatever panel happens to occupy the bottom of the screen.
  const holdBarDragRef = useRef<{ startX: number; startY: number; baseX: number; baseY: number } | null>(null);
  const holdBarMovedRef = useRef(false);
  const onHoldBarPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    holdBarDragRef.current = { startX: e.clientX, startY: e.clientY, baseX: holdBarOffset.x, baseY: holdBarOffset.y };
    holdBarMovedRef.current = false;
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onHoldBarPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = holdBarDragRef.current;
    if (!drag) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    if (Math.abs(dx) + Math.abs(dy) > 6) holdBarMovedRef.current = true;
    setHoldBarOffset({ x: drag.baseX + dx, y: drag.baseY + dy });
  };
  const onHoldBarPointerUp = () => {
    holdBarDragRef.current = null;
  };
  // Suppress the click that follows a drag so releasing over a button doesn't fire it.
  const holdBarClickGuard = (action: () => void) => () => {
    if (holdBarMovedRef.current) return;
    action();
  };

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
    return result.sort((a, b) => a.startDate.localeCompare(b.startDate));
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
              todayInView={todayInView}
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
              holdDates={holdDates}
              setHoldDates={setHoldDates}
              scrollToTodayTrigger={scrollToTodayTrigger}
              gapsMode={gapsMode}
              onTodayInViewChange={setTodayInView}
            />
            {/* Floating hold bar — appears once dates are double-tapped into the amber
                selection. Confirms holds → firm, or downgrades firm → hold, per what's
                selected. z-[60] keeps it above the guest contact panel (z-50); drag to move. */}
            {totalHoldSelection > 0 && (
              <div
                className="fixed bottom-24 left-1/2 z-[60] flex flex-col items-center gap-1"
                style={{
                  transform: `translate(calc(-50% + ${holdBarOffset.x}px), ${holdBarOffset.y}px)`,
                  touchAction: "none",
                }}
                onPointerDown={onHoldBarPointerDown}
                onPointerMove={onHoldBarPointerMove}
                onPointerUp={onHoldBarPointerUp}
              >
                <div className="flex items-center gap-2.5 bg-white border border-amber-300 shadow-lg rounded-full pl-2.5 pr-2 py-1.5 cursor-grab active:cursor-grabbing">
                  {/* Grip dots — signals the bar is movable */}
                  <span className="text-gray-300 text-sm leading-none select-none">⠿</span>
                  <span className="text-sm font-medium text-amber-700 whitespace-nowrap select-none">
                    {totalHoldSelection} selected
                  </span>
                  <button
                    type="button"
                    onClick={holdBarClickGuard(() => { setHoldDates([]); setConfirmHoldsError(""); })}
                    className="text-xs text-gray-400 hover:text-gray-600"
                  >
                    Clear
                  </button>
                  {reservedHoldStays.size > 0 && (
                    <button
                      type="button"
                      onClick={holdBarClickGuard(onConfirmHolds)}
                      disabled={isConfirmingHolds}
                      className="bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold px-3.5 py-1.5 rounded-full disabled:opacity-50 whitespace-nowrap"
                    >
                      {isConfirmingHolds ? "Working…" : `Confirm ${reservedHoldStays.size} as booked`}
                    </button>
                  )}
                  {firmHoldStays.size > 0 && (
                    <button
                      type="button"
                      onClick={holdBarClickGuard(onDowngradeHolds)}
                      disabled={isConfirmingHolds}
                      className="border border-amber-400 text-amber-600 hover:bg-amber-50 text-sm font-semibold px-3.5 py-1.5 rounded-full disabled:opacity-50 whitespace-nowrap"
                    >
                      {isConfirmingHolds ? "Working…" : `${firmHoldStays.size} → soft hold`}
                    </button>
                  )}
                  {/* Batch unbook the whole selection, from the same pill */}
                  <button
                    type="button"
                    onClick={holdBarClickGuard(onUnbookHolds)}
                    disabled={isConfirmingHolds}
                    className="bg-red-600 hover:bg-red-700 text-white text-sm font-semibold px-3.5 py-1.5 rounded-full disabled:opacity-50 whitespace-nowrap"
                  >
                    Unbook {totalHoldSelection}
                  </button>
                </div>
                {confirmHoldsError && (
                  <span className="bg-white border border-red-200 text-red-500 text-xs rounded-full px-3 py-1 shadow">
                    {confirmHoldsError}
                  </span>
                )}
              </div>
            )}
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
            monthMap={monthMap}
            selectedDate={selectedDate}
            selectedRoom={selectedRoom}
            showAddPane={showAddPane}
            prefills={bookingPrefills ?? undefined}
            onBooking={onBookingComplete}
            setIsModalOpen={setIsModalOpen}
            setShowAddPane={setShowAddPane}
            buildConfirmationForBookings={buildConfirmationForBookings}
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
            houseRules={houseRules}
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
            onUnbook={onUnbook}
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
              guests={guests}
              setCurrentGuest={setCurrentGuest}
              setCurrentAirBnBGuest={setCurrentAirBnBGuest}
              setCurrentMonth={setCurrentMonth}
              setSelectedBooking={setSelectedBooking as React.Dispatch<React.SetStateAction<bookingType>>}
              setSelectedModifyBooking={setSelectedModifyBooking as React.Dispatch<React.SetStateAction<bookingType>>}
              onRequestUnbook={(b) => setUnbookBookings([b])}
              onPricingEdit={onPricingEdit}
            >
              <BookButton setIsModalOpen={setIsModalOpen} setSelectedRoom={setSelectedRoom} />
            </GuestView>
          </>
        )}
      </div>

      {/* Mobile slide-up panels */}
      {/* Booking list uses the same resizable MobilePanel as the ToDo panel */}
      <MobilePanel
        isOpen={isMobileModalOpen}
        onClose={() => {
          setCurrentBookings(null);
          setIsMobileModalOpen(false);
        }}
      >
        <div className="flex h-full flex-col">
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
        <div className="min-h-0 flex-1">
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
          guests={guests}
          setCurrentAirBnBGuest={setCurrentAirBnBGuest}
          setCurrentGuest={setCurrentGuest}
          setCurrentMonth={setCurrentMonth}
          setIsMobileModalOpen={setIsMobileModalOpen}
          setSelectedBooking={setSelectedBooking as React.Dispatch<React.SetStateAction<bookingType>>}
          setSelectedModifyBooking={setSelectedModifyBooking as React.Dispatch<React.SetStateAction<bookingType>>}
          onRequestUnbook={(b) => setUnbookBookings([b])}
          onPricingEdit={onPricingEdit}
        >
          <BookButton
            setIsModalOpen={setIsModalOpen}
            setIsMobileModalOpen={setIsMobileModalOpen}
            setSelectedRoom={setSelectedRoom}
          />
        </GuestView>
        </div>
        </div>
      </MobilePanel>

      <MobilePanel isOpen={isTodoModalOpen} onClose={() => setIsTodoModalOpen(false)}>
        <ToDoList
          monthMap={monthMap}
          doorCode={doorCode}
          airbnbName={airbnbName}
          airbnbAddress={airbnbAddress}
          houseRules={houseRules}
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
            onUnbook={onUnbook}
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
          onFeesUpdate={onFeesUpdate}
          onPricingUpdate={onPricingUpdate}
        />
      )}
      {unbookBookings && unbookBookings.length > 0 && (
        <UnbookingConfirmation
          monthMap={monthMap}
          bookings={unbookBookings}
          cancellationFullRefundDays={cancellationFullRefundDays}
          cancellationHalfRefundDays={cancellationHalfRefundDays}
          onClose={() => setUnbookBookings(null)}
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
      {/* Block-on-Airbnb reminder toast — replaces the old browser alert */}
      {blockReminders.length > 0 && (
        <div className="fixed bottom-4 left-1/2 z-[220] w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 overflow-hidden rounded-2xl border border-amber-300 bg-amber-50 shadow-2xl">
          <div className="flex items-start gap-3 p-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-amber-800">Block these dates on Airbnb</p>
              {blockReminders.map((r, i) => (
                <p key={i} className="mt-0.5 text-xs text-amber-700">
                  <span className="font-semibold">{r.room}</span> ·{" "}
                  {format(new Date(r.start + "T00:00:00"), "MMM d")} –{" "}
                  {format(new Date(r.end + "T00:00:00"), "MMM d")}
                </p>
              ))}
            </div>
            <button
              className="shrink-0 rounded-lg bg-amber-600 px-2.5 py-1.5 text-xs font-semibold text-white"
              onClick={() => {
                setBlockReminders([]);
                setIsBlockAirBnBModalOpen(true);
              }}
            >
              Review
            </button>
            <button
              className="shrink-0 px-1 text-lg leading-none text-amber-400"
              onClick={() => setBlockReminders([])}
              aria-label="Dismiss"
            >
              &times;
            </button>
          </div>
        </div>
      )}

      {isCleanersOpen && (
        <CleanersModal
          hostId={hostId}
          token={token as string}
          monthMap={monthMap}
          onClose={() => setIsCleanersOpen(false)}
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

      {/* Cal Events hint toast */}
      {calEventsHint && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[9999] pointer-events-none">
          <div className="flex items-center gap-3 px-6 py-4 rounded-2xl shadow-xl text-base font-semibold text-white bg-amber-500 transition-all max-w-[90vw]">
            <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
            {calEventsHint}
          </div>
        </div>
      )}

      {/* Sync status toast */}
      {syncStatus && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[9999] pointer-events-none">
          <div className={`flex items-center gap-3 px-6 py-4 rounded-2xl shadow-xl text-base font-semibold text-white transition-all
            ${syncStatus === "syncing" ? "bg-blue-500" : "bg-green-500"}`}>
            {syncStatus === "syncing" ? (
              <>
                <svg className="w-5 h-5 animate-spin shrink-0" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
                Syncing with Airbnb…
              </>
            ) : (
              <>
                <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Sync complete
              </>
            )}
          </div>
        </div>
      )}

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
