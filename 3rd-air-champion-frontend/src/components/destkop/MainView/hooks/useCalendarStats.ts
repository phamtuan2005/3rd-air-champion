import { useEffect, useMemo, useState } from "react";
import {
  addDays,
  eachDayOfInterval,
  endOfMonth,
  format,
  getDaysInMonth,
  isAfter,
  isBefore,
  isSameMonth,
  startOfMonth,
  startOfToday,
} from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { dayType } from "../../../../util/types/dayType";
import { roomType } from "../../../../util/types/roomType";
import { bookingType } from "../../../../util/types/bookingType";

interface UseCalendarStatsParams {
  monthMap: Map<string, dayType>;
  days: dayType[];
  rooms: roomType[];
  currentMonth: Date;
  selectedRoomName: string | null;
  blockedAirBnBDates: { room: { duration: number; start: string }[] } | undefined;
  setAirbnbPendingCount: React.Dispatch<React.SetStateAction<number>>;
  setAvailableNightsCount: React.Dispatch<React.SetStateAction<number>>;
  setTodoCleanCount: React.Dispatch<React.SetStateAction<number>>;
}

export const useCalendarStats = ({
  monthMap,
  days,
  rooms,
  currentMonth,
  selectedRoomName,
  blockedAirBnBDates,
  setAirbnbPendingCount,
  setAvailableNightsCount,
  setTodoCleanCount,
}: UseCalendarStatsParams) => {
  const [occupancy, setOccupancy] = useState<{
    totalOccupancy: number;
    airbnbOccupancy: number;
    roomOccupancy: { name: string; occupancy: number }[];
  }>({ totalOccupancy: 0, airbnbOccupancy: 0, roomOccupancy: [] });

  const [profit, setProfit] = useState<{ total: number; airbnb: number }>({
    total: 0,
    airbnb: 0,
  });

  const airbnbPendingCount = useMemo(() => {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const today = startOfToday();
    const blockedTyped = blockedAirBnBDates as
      | Record<string, { start: string; duration: number }[]>
      | undefined;

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
        )
          j++;
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
    return rooms
      .filter((r) => r.active)
      .reduce((total, room) => {
        for (const dateKey of eligibleDateKeys) {
          const day = monthMap.get(dateKey);
          const isBooked = day ? day.bookings.some((b) => b.room.id === room.id) : false;
          const isBlocked = day
            ? day.isBlocked || day.blockedRooms.some((r) => r.id === room.id)
            : false;
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
    return (
      yesterdayDay?.bookings.filter((b) => b.endDate.split("T")[0] === yesterdayKey).length ?? 0
    );
  }, [monthMap]);

  useEffect(() => {
    setTodoCleanCount(todoCleanCount);
  }, [todoCleanCount, setTodoCleanCount]);

  useEffect(() => {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!days || !currentMonth) return;

    const targetMonth = currentMonth.getMonth();
    const targetYear = currentMonth.getFullYear();

    const occupiedDays = days.filter((day) => {
      const processedDate = toZonedTime(day.date, timeZone);
      return processedDate.getFullYear() === targetYear && processedDate.getMonth() === targetMonth;
    });

    const roomSets = new Map();
    const getBaseRoomName = (roomName: string) => roomName.replace(/^(.+)\1$/, "$1");
    const filteredRooms = selectedRoomName ? rooms.filter((r) => r.name === selectedRoomName) : rooms;
    const blockedNightsMap = new Map<string, number>();

    filteredRooms.forEach((room) => {
      const baseRoomName = getBaseRoomName(room.name);
      const roomId = room.id;

      const roomSpecificSet = new Set(
        occupiedDays.filter((day) => day.bookings.some((booking) => booking.room.id === roomId)),
      );

      const blockedCount = occupiedDays.filter(
        (day) => day.isBlocked || day.blockedRooms.some((r) => r.id === roomId),
      ).length;
      blockedNightsMap.set(baseRoomName, (blockedNightsMap.get(baseRoomName) ?? 0) + blockedCount);

      if (!roomSets.has(baseRoomName)) roomSets.set(baseRoomName, new Set());
      roomSpecificSet.forEach((day) => roomSets.get(baseRoomName).add(day));
    });

    const daysInMonth = getDaysInMonth(currentMonth);
    let totalOccupiedDays = 0;
    let totalAvailableDays = 0;
    let totalAirbnbGuests = 0;
    let totalAirbnbAvailableDays = 0;
    const roomOccupancy = [];
    const airbnbGuestCountMap = new Map();

    for (const [roomName, roomSet] of roomSets.entries()) {
      const blockedNights = blockedNightsMap.get(roomName) ?? 0;
      const availableNights = Math.max(daysInMonth - blockedNights, 1);
      const occupancyPercentage = (roomSet.size / availableNights) * 100;
      roomOccupancy.push({ name: roomName, occupancy: occupancyPercentage });

      totalOccupiedDays += roomSet.size;
      if (roomName !== "Master") totalAvailableDays += availableNights;

      let airbnbCount = 0;
      roomSet.forEach((day: dayType) => {
        day.bookings.forEach((booking) => {
          if (
            getBaseRoomName(booking.room.name) === roomName &&
            booking.guest.name.toLowerCase() === "airbnb"
          ) {
            airbnbCount += 1;
          }
        });
      });

      airbnbGuestCountMap.set(roomName, airbnbCount);
      if (roomName !== "Master") {
        totalAirbnbGuests += airbnbCount;
        totalAirbnbAvailableDays += availableNights;
      }
    }

    const totalOccupancy =
      totalAvailableDays > 0 ? (totalOccupiedDays / totalAvailableDays) * 100 : 0;
    const airbnbOccupancy =
      totalAirbnbAvailableDays > 0 ? (totalAirbnbGuests / totalAirbnbAvailableDays) * 100 : 0;

    setOccupancy({ totalOccupancy, airbnbOccupancy, roomOccupancy });
  }, [days, currentMonth, rooms, selectedRoomName]);

  useEffect(() => {
    let guestProfit = 0;
    let airBnBProfit = 0;
    if (monthMap) {
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const sortedKeys = [...monthMap.keys()]
        .filter((dateKey) => {
          const localDate = toZonedTime(dateKey, timeZone);
          return isSameMonth(localDate, currentMonth) || isAfter(localDate, currentMonth);
        })
        .sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

      for (const dateKey of sortedKeys) {
        const day = monthMap.get(dateKey);
        if (!day) continue;

        const currentLocalDate = toZonedTime(dateKey, timeZone);
        if (!isSameMonth(currentLocalDate, currentMonth)) break;

        for (const booking of day.bookings) {
          if (selectedRoomName && booking.room.name !== selectedRoomName) continue;

          if (booking.guest.name !== "AirBnB") {
            const guestPricing = booking.guest.pricing.find((p) => p.room === booking.room.id);
            if (guestPricing) guestProfit += guestPricing.price;
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

  return { occupancy, profit };
};