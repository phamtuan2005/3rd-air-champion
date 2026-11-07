import { addDays } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { bookingType } from "./types/bookingType";
import { dayType } from "./types/dayType";

const CODE = /reservations\/details\/([A-Z0-9]+)/i;

// The reservation code on a stay from AirBnB's feed. A hand-entered stay has none.
export const airbnbCodeOf = (booking: bookingType): string | null =>
  String(booking.description || "").match(CODE)?.[1].toUpperCase() ?? null;

/*
 * Which booking records to send to unbook for the chosen stays.
 *
 * Each stay is stored as one record per night, so a direct guest's stay is every
 * night's record for that guest and room.
 *
 * Not an AirBnB stay: every AirBnB stay shares one guest, so that test also
 * catches any other reservation in the room on those nights, and its id would
 * then be unbooked too. The record the host chose is enough, since the server
 * takes every night of that reservation from it.
 */
export const unbookIdsFor = (bookings: bookingType[], monthMap: Map<string, dayType>): string[] => {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const ids: string[] = [];
  bookings.forEach((booking) => {
    if (booking.guest.name === "AirBnB") {
      ids.push(booking.id);
      return;
    }
    const startDate = toZonedTime(booking.startDate, timeZone);
    for (let i = 0; i < booking.duration; i++) {
      const currentDay = monthMap.get(addDays(startDate, i).toISOString().split("T")[0]);
      currentDay?.bookings.forEach((b) => {
        if (b.guest.id === booking.guest.id && b.room.id === booking.room.id) ids.push(b.id);
      });
    }
  });
  return ids;
};
