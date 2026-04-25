import express, { Request, Response } from "express";
import axios from "axios";
import ical from "ical";
import dotenv from "dotenv";
import {
  addDays,
  differenceInCalendarDays,
  isAfter,
  isBefore,
  startOfToday,
} from "date-fns";
import { sendGraphQLRequest } from "./util/sendToGraphQL";
import { toZonedTime } from "date-fns-tz";

dotenv.config();

const router = express.Router();

router.post("/sync", async (req: Request, res: any) => {
  // curl -X POST http://localhost:8080/airbnb/sync \
  // -H "Content-Type: application/json" \
  // -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJjb2hvc3RJZCI6bnVsbCwiaG9zdElkIjoiNjc2OGY3MGExZDcyMzY4MzUzNGEwZTk3Iiwicm9sZSI6Ikhvc3QiLCJpYXQiOjE3MzU1MTM2NTYsImV4cCI6MTczNTUxNzI1Nn0.gAl3_X8fTSpRUcHZ3CLepa3sDqNxooaUwPESDh5q-CM" \
  // -d '{"data": [{"room": "6770ccf567b89518e7760b92", "link": "https://www.airbnb.com/calendar/ical/1177648203505001777.ics?s=aa6cf3fa517af7329c98b8aa99bb2a91"}, {"room": "6770cdc267b89518e7760bbe", "link": "https://www.airbnb.com/calendar/ical/1144526275550691711.ics?s=50a66e22348fe3b6ea9e78a59e2da65e"}], "calendar": "6768f70a1d723683534a0e99", "guest": "6770dd1490009b0857d7fcbd"}'

  if (!("user" in req))
    return res.status(401).json({ error: "Invalid or expired token" });

  const { data, calendar, guest } = req.body;
  const AirBnBObjects: { room: string; link: string }[] = data;

  const ICSObjects = [];

  for await (const { room, link } of AirBnBObjects) {
    const events = await axios
      .get(link)
      .then((res) => res.data)
      .catch((error) => {
        throw new Error(
          `Error processing ICS link for ${link}: ${error.message}`
        );
      });
    ICSObjects.push({ room, events });
  }

  const parsedICS = ICSObjects.map(({ room, events }) => ({
    room,
    events: ical.parseICS(events),
  }));

  const finalResult = parsedICS.map(({ room, events }) => {
    const reserved: any[] = [];
    const blocked: any[] = [];

    Object.values(events).forEach((event: any) => {
      if (event.type === "VEVENT" && event.start && event.end) {
        // Skip days in the past

        // if (isBefore(event.start, startOfToday())) return;

        const duration = differenceInCalendarDays(
          event.end as Date,
          event.start as Date
        );

        if (event.summary?.includes("Reserved")) {
          reserved.push({
            start: event.start.toISOString().split("T")[0],
            duration,
            description: event.description,
          });
        } else if (event.summary?.includes("Not available")) {
          blocked.push({
            start: event.start.toISOString().split("T")[0],
            duration,
          });
        }
      }
    });

    return { room, reserved, blocked };
  });

  const variables = { calendar, guest };

  const fetchDayQuery = `
        query AirBnBDays($calendar: String!, $guest: String!) {
          airBnBDays(calendar: $calendar, guest: $guest) {
            id
            calendar
            date
            isAirBnB
            isBlocked
            blockedRooms {
              host
              id
              name
              price
            }
            bookings {
              id
              alias
              price
              notes
              guest {
                id
                name
                alias
                email
                phone
                numberOfGuests
                returning
                notes
                host
                pricing {
                  id
                  price
                  room
                }
              }
              room {
                id
                host
                name
                price
              }
              description
              duration
              numberOfGuests
              startDate
              endDate
            }
          }
        }`;

  const unbookQuery = `mutation UnbookAirBnB($calendar: String!, $guest: String!, $bookings: [UnbookBookingInput!]!) {
                        unbookAirBnB(calendar: $calendar, guest: $guest, bookings: $bookings)
                      }`;

  const bookQuery = `mutation BookAirBnB($calendar: String!, $date: String!, $guest: String!, $description: String!, $room: String!, $duration: Int!) {
        bookAirBnB(calendar: $calendar, date: $date, guest: $guest, description: $description, room: $room, duration: $duration) {
            id
            calendar
            date
            isAirBnB
            isBlocked
            bookings {
            id
            alias
            price
            notes
            guest {
                id
                name
                alias
                email
                phone
                numberOfGuests
                returning
                notes
                host
            }
            room {
                id
                host
                name
                price
            }
            description
            duration
            numberOfGuests
            startDate
            endDate
            }
            numberOfGuests
            blockedRooms {
            id
            host
            name
            price
            }
            createdAt
            updatedAt
        }
    }`;

  sendGraphQLRequest(fetchDayQuery, variables)
    .then((result: any) => {
      if (result.errors) {
        throw new Error(result.errors[0].message);
      }
      const currentlyBookedDays = result.data.airBnBDays;

      // Create fetchedDatesMap
      const fetchedDatesMap = new Map(
        currentlyBookedDays.flatMap((day: any) =>
          day.bookings
            .filter((booking: any) => booking.guest.id === guest)
            .map((booking: any) => [
              `${day.date}_${booking.room.id}`,
              {
                date: day.date,
                room: booking.room.id,
                startDate: booking.startDate,
                endDate: booking.endDate,
                duration: booking.duration,
              },
            ])
        )
      );

      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

      // Create reservedDatesSet
      const reservedDatesSet = new Set(
        finalResult.flatMap(({ room, reserved }) =>
          reserved.flatMap((booking) => {
            return Array.from({ length: booking.duration }, (_, i) => {
              const date = addDays(toZonedTime(booking.start, timeZone), i); // Add i days to the start date
              const dateString = date.toISOString().split("T")[0];

              return `${dateString}_${room}`;
            });
          })
        )
      );

      // Map each (date, room) key → the new iCal booking's startDate and duration,
      // so we can detect stale entries whose metadata changed (e.g. guest shortened stay).
      const newReservationMetaMap = new Map<string, { startDate: string; duration: number }>(
        finalResult.flatMap(({ room, reserved }) =>
          reserved.flatMap((booking) =>
            Array.from({ length: booking.duration }, (_, i) => {
              const date = addDays(toZonedTime(booking.start, timeZone), i);
              const dateString = date.toISOString().split("T")[0];
              return [`${dateString}_${room}`, { startDate: booking.start, duration: booking.duration }] as [string, { startDate: string; duration: number }];
            })
          )
        )
      );

      console.log("reservedDatesSet:", reservedDatesSet);

      // Find today's booking from fetchedDatesMap
      const today = startOfToday();
      const todayBooking = Array.from(fetchedDatesMap).find(([key, value]) => {
        const { date } = value as any;
        return date === today.toISOString().split("T")[0]; // Match today's date
      })?.[1]; // Directly return the value (booking object)

      // Create a map for today's booking duration
      const todayBookingMap = new Map();

      if (todayBooking) {
        // Populate the map with all dates in the duration of today's booking
        Array.from({ length: (todayBooking as any).duration }, (_, i) => {
          const date = addDays(
            toZonedTime((todayBooking as any).startDate, timeZone),
            i
          );
          todayBookingMap.set(
            `${date.toISOString().split("T")[0]}_${(todayBooking as any).room}`,
            {
              date: date.toISOString().split("T")[0],
              room: (todayBooking as any).room,
            }
          );
        });
      }

      //Determine dates to unbook
      const toUnbook = Array.from(fetchedDatesMap)
        .filter(([key, value]) => {
          const [date] = (key as string).split("_"); // Extract the date part from the key

          if (isBefore(toZonedTime(date, timeZone), startOfToday())) return false;
          if (todayBookingMap.has(key as string)) return false;

          // Date no longer appears in the new iCal at all → unbook
          if (!reservedDatesSet.has(key as string)) return true;

          // Date still appears in the new iCal, but check whether the booking
          // metadata (startDate / duration) changed. If so, the stored entry is
          // stale and must be removed so bookAirBnB can re-add it correctly.
          const newMeta = newReservationMetaMap.get(key as string);
          if (newMeta) {
            const { startDate: storedStart, duration: storedDuration } = value as any;
            const storedStartStr = storedStart
              ? toZonedTime(storedStart, timeZone).toISOString().split("T")[0]
              : null;
            const newStartStr = toZonedTime(newMeta.startDate, timeZone).toISOString().split("T")[0];
            if (storedStartStr !== newStartStr || storedDuration !== newMeta.duration) return true;
          }

          return false;
        })
        .map(([key, value]) => {
          // Extract only room and date fields for the toUnbook array
          const { room, date } = value as any;
          return { room, date };
        });

      console.log("toUnbook:", toUnbook);

      // Return the `toUnbook` array for chaining
      return sendGraphQLRequest(unbookQuery, {
        calendar,
        guest,
        bookings: toUnbook,
      });
    })
    .then((result: any) => {
      if (result.errors) {
        throw new Error(result.errors[0].message);
      }
      console.log("Unbooked successfully:", result.data.unbookAirBnB);

      // Process booking requests
      const bookingRequests = finalResult.flatMap((roomData) =>
        roomData.reserved
          .filter((booking) => {
            const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

            const startDate = toZonedTime(booking.start, timeZone);
            return !isBefore(startDate, startOfToday());
          })
          .map((booking) => {
            const bookQueryBody = {
              ...variables,
              room: roomData.room,
              description: booking.description,
              date: booking.start,
              duration: booking.duration,
            };
            return sendGraphQLRequest(bookQuery, bookQueryBody).then(
              (result: any) => {
                if (result.errors) {
                  throw new Error(result.errors[0].message);
                }
                return { type: "reserved", data: result.data.bookAirBnB };
              }
            );
          })
      );

      // Return a Promise.all for booking requests
      return Promise.all(bookingRequests);
    })
    .then((results) => {
      const reservedResults = results.filter((r) => r.type === "reserved");

      // Prepare the response
      const blockedData = finalResult.reduce(
        (acc: Record<string, any[]>, roomData) => {
          acc[roomData.room] = roomData.blocked;
          return acc;
        },
        {}
      );

      // Send success response
      res.status(200).json({
        success: true,
        reserved: reservedResults.map((r) => r.data),
        blocked: blockedData,
      });
    })
    .catch((error) => {
      // Handle all errors collectively
      console.error("Error during processing:", error.message);
      res.status(500).json({ error: error.message });
    });
});

export default router;
