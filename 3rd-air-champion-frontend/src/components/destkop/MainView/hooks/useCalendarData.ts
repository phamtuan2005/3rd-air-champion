import { useEffect, useRef, useState } from "react";
import {
  fetchAirBnBBookingCount,
  fetchDays,
  fetchGuestBookingCount,
} from "../../../../util/dayOperations";
import { fetchRooms } from "../../../../util/roomOperations";
import { fetchGuests } from "../../../../util/guestOperations";
import { syncCalendars } from "../../../../util/syncOperations";
import { updateBookingAirbnbPrice } from "../../../../util/bookingOperations";
import { dayType } from "../../../../util/types/dayType";
import { roomType } from "../../../../util/types/roomType";
import { guestType } from "../../../../util/types/guestType";
import { bookingType } from "../../../../util/types/bookingType";

interface UseCalendarDataParams {
  calendarId: string;
  hostId: string;
  token: string;
  airbnbsync: { room: string; link: string }[] | undefined;
  shouldCallOnSync: boolean;
  setShouldCallOnSync: React.Dispatch<React.SetStateAction<boolean>>;
}

export const useCalendarData = ({
  calendarId,
  hostId,
  token,
  airbnbsync,
  shouldCallOnSync,
  setShouldCallOnSync,
}: UseCalendarDataParams) => {
  const airbnbsyncRef = useRef(airbnbsync);
  // Set by the isCalendarLoading effect after fetching; cleared by useEffect([days])
  // after monthMap is built. Ensures the calendar is never shown with an empty monthMap.
  const pendingLoadingClearRef = useRef(false);

  const [initialSync, setIsInitialSync] = useState(true);
  const [days, setDays] = useState<dayType[]>([]);
  const [guests, setGuests] = useState<guestType[]>([]);
  const [rooms, setRooms] = useState<roomType[]>([]);
  const [isCalendarLoading, setIsCalendarLoading] = useState(true);
  const [calendarErrorMessage, setCalendarErrorMessage] = useState("");
  const [monthMap, setMonthMap] = useState<Map<string, dayType>>(new Map());
  const [blockedAirBnBDates, setIsBlockedAirBnBDates] = useState<{
    room: { duration: number; start: string }[];
  }>();
  const [syncStatus, setSyncStatus] = useState<"syncing" | "done" | null>(null);
  const [airBnBBookingCount, setAirBnBBookingCount] = useState<
    { Alias: string; Room: string; DistinctStartDateCount: number }[]
  >([]);
  const [guestBookingCount, setGuestBookingCount] = useState<
    { GuestId: string; DistinctStartDateCount: number; FirstStayDate: string }[]
  >([]);

  const transformBookings = (
    map: Map<string, dayType>,
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
        booking.duration = tracking.duration;
        booking.endDate = tracking.endDate;
        booking.startDate = tracking.startDate;
        const bookingIdentifier = `${tracking.startDate}-${tracking.endDate}-${booking.guest.id}`;
        processedBookings.add(bookingIdentifier);
      };

      const nextIndex = index + 1;
      if (nextIndex >= sortedKeys.length) {
        finalizeBooking();
        return;
      }

      const nextKey = sortedKeys[nextIndex];
      const nextDay = map.get(nextKey);
      const nextBooking = nextDay?.bookings.find((b) => {
        // Consecutive-day check on the yyyy-MM-dd keys — timezone-stable. (toZonedTime +
        // isSameDay here truncated multi-night stays in timezones east of the host's.)
        const [y, m, d] = currentKey.split("-").map(Number);
        const nx = new Date(y, m - 1, d + 1);
        const nextOfCurrent = `${nx.getFullYear()}-${String(nx.getMonth() + 1).padStart(2, "0")}-${String(nx.getDate()).padStart(2, "0")}`;
        return (
          b.guest.id === booking.guest.id &&
          b.room.id === booking.room.id &&
          nextKey === nextOfCurrent
        );
      });

      if (nextBooking) {
        tracking.endDate = nextBooking.endDate;
        tracking.duration += 1;
        propagateBooking(nextBooking, nextKey, sortedKeys, nextIndex, tracking, processedBookings);
      }

      finalizeBooking();
    };

    const sortedKeys = [...map.keys()].sort();
    const processedBookings = new Set<string>();

    for (let i = 0; i < sortedKeys.length; i++) {
      const currentKey = sortedKeys[i];
      const currentDay = map.get(currentKey);
      if (!currentDay) continue;

      currentDay.bookings.forEach((booking) => {
        const bookingIdentifier = `${booking.startDate}-${booking.endDate}-${booking.guest.id}`;
        if (processedBookings.has(bookingIdentifier) || booking.guest.name === "AirBnB") return;

        const tracking = {
          startDate: booking.startDate,
          endDate: booking.endDate,
          duration: 1,
        };
        processedBookings.add(bookingIdentifier);
        propagateBooking(booking, currentKey, sortedKeys, i, tracking, processedBookings);
      });
    }
  };

  const onSync = (isAuto = false) => {
    if (shouldCallOnSync || isAuto) setSyncStatus("syncing");
    const savedData = localStorage.getItem("syncData");
    const requestBody: {
      calendar?: string;
      guest?: string;
      data?: { room: string; link: string }[];
    } = {};
    if (savedData) {
      const airbnbGuest = guests.find((g) => g.name === "AirBnB");
      requestBody.calendar = calendarId;
      requestBody.data = JSON.parse(savedData);
      requestBody.guest = airbnbGuest?.id;
    }

    syncCalendars(
      requestBody as { calendar: string; guest: string; data: { room: string; link: string }[] },
      token,
    )
      .then((result) => {
        setIsBlockedAirBnBDates(result.blocked);
        if (shouldCallOnSync || isAuto) {
          setSyncStatus("done");
          setTimeout(() => setSyncStatus(null), 2500);
          setIsCalendarLoading(true);
        }
      })
      .catch((err) => {
        console.error("Error syncing calendars:", err);
        setSyncStatus(null);
      });
  };

  const onAirbnbPriceUpdate = (bookingId: string, airbnbPrice: number) => {
    updateBookingAirbnbPrice({ id: bookingId, airbnbPrice }, token)
      .then(() => setIsCalendarLoading(true))
      .catch((err) => console.error("Error updating airbnb price:", err));
  };

  useEffect(() => {
    if (airbnbsyncRef.current) {
      localStorage.setItem("syncData", JSON.stringify(airbnbsyncRef.current));
    }
  }, []);

  useEffect(() => {
    if (initialSync && guests.length > 0) {
      onSync(true);
      setIsInitialSync(false);
    }
  }, [guests, initialSync]);

  useEffect(() => {
    if (isCalendarLoading) {
      Promise.all([
        fetchGuests(hostId, token),
        fetchDays(calendarId, token),
        fetchRooms(hostId, token),
      ])
        .then(([fetchedGuests, fetchedDays, fetchedRooms]) => {
          setGuests(fetchedGuests);
          setRooms(fetchedRooms);
          pendingLoadingClearRef.current = true;
          setDays(fetchedDays);
        })
        .catch((err) => {
          console.error("Error fetching data:", err);
          setCalendarErrorMessage("Failed to fetch calendar data. Please try again.");
          setIsCalendarLoading(false);
        });
    }
  }, [isCalendarLoading]);

  useEffect(() => {
    if (guests.length > 0) {
      const guestId = guests.find((g) => g.name === "AirBnB")?.id;
      fetchAirBnBBookingCount(guestId as string, token)
        .then(setAirBnBBookingCount)
        .catch((err) => console.error("Error fetching airbnb booking count:", err));
      fetchGuestBookingCount(calendarId, token)
        .then(setGuestBookingCount)
        .catch((err) => console.error("Error fetching guest booking count:", err));
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
          updates.push(updateBookingAirbnbPrice({ id: booking.id, airbnbPrice: localPrice }, token));
        }
      }
    }

    if (updates.length > 0) {
      Promise.all(updates)
        .then(() => {
          localStorage.removeItem("airBnBPrices");
          setIsCalendarLoading(true);
        })
        .catch((err) => console.error("Error migrating airBnB prices to DB:", err));
    } else {
      localStorage.removeItem("airBnBPrices");
    }
  }, [days]);

  // Build monthMap from days
  useEffect(() => {
    const map = new Map<string, dayType>();
    days.forEach((day) => {
      // Key by the UTC calendar day of the stored date — timezone-stable, matches the
      // grid's local cell keys. (toZonedTime(deviceTz) shifted keys in other timezones.)
      const formattedDate = new Date(day.date).toISOString().split("T")[0];
      map.set(formattedDate, day);
    });
    setMonthMap(map);

    const sortedMap = new Map(
      [...map.entries()].sort(([keyA], [keyB]) => keyA.localeCompare(keyB)),
    );
    transformBookings(sortedMap);

    if (pendingLoadingClearRef.current) {
      pendingLoadingClearRef.current = false;
      setIsCalendarLoading(false);
    }
  }, [days]);

  useEffect(() => {
    if (shouldCallOnSync) {
      onSync();
      setShouldCallOnSync(false);
    }
  }, [shouldCallOnSync]);

  useEffect(() => {
    const pending = localStorage.getItem("pendingSync");
    if (pending && localStorage.getItem("syncData")) {
      localStorage.removeItem("pendingSync");
      setShouldCallOnSync(true);
    }
  }, []);

  return {
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
    syncStatus,
  };
};