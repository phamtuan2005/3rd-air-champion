import axios from "axios";
import ical from "ical";
import { addDays, differenceInCalendarDays, isBefore, startOfToday } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { sendGraphQLRequest } from "../route/util/sendToGraphQL";

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

const unbookQuery = `
  mutation UnbookAirBnB($calendar: String!, $guest: String!, $bookings: [UnbookBookingInput!]!) {
    unbookAirBnB(calendar: $calendar, guest: $guest, bookings: $bookings)
  }`;

const bookQuery = `
  mutation BookAirBnB($calendar: String!, $date: String!, $guest: String!, $description: String!, $room: String!, $duration: Int!) {
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

export const runAirbnbSync = async (params: {
  calendar: string;
  guest: string;
  data: { room: string; link: string }[];
}): Promise<{ reserved: any[]; blocked: Record<string, any[]> }> => {
  const { calendar, guest, data: airbnbObjects } = params;

  const icsObjects = [];
  for (const { room, link } of airbnbObjects) {
    const events = await axios
      .get(link)
      .then((res) => res.data)
      .catch((err) => {
        throw new Error(`Error fetching ICS for ${link}: ${err.message}`);
      });
    icsObjects.push({ room, events });
  }

  const parsedICS = icsObjects.map(({ room, events }) => ({
    room,
    events: ical.parseICS(events),
  }));

  const finalResult = parsedICS.map(({ room, events }) => {
    const reserved: any[] = [];
    const blocked: any[] = [];

    Object.values(events).forEach((event: any) => {
      if (event.type === "VEVENT" && event.start && event.end) {
        const duration = differenceInCalendarDays(event.end as Date, event.start as Date);

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
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const fetchResult: any = await sendGraphQLRequest(fetchDayQuery, variables);
  if (fetchResult.errors) throw new Error(fetchResult.errors[0].message);

  const currentlyBookedDays = fetchResult.data.airBnBDays;

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

  const reservedDatesSet = new Set(
    finalResult.flatMap(({ room, reserved }) =>
      reserved.flatMap((booking) =>
        Array.from({ length: booking.duration }, (_, i) => {
          const date = addDays(toZonedTime(booking.start, timeZone), i);
          return `${date.toISOString().split("T")[0]}_${room}`;
        })
      )
    )
  );

  const newReservationMetaMap = new Map<string, { startDate: string; duration: number }>(
    finalResult.flatMap(({ room, reserved }) =>
      reserved.flatMap((booking) =>
        Array.from({ length: booking.duration }, (_, i) => {
          const date = addDays(toZonedTime(booking.start, timeZone), i);
          const dateString = date.toISOString().split("T")[0];
          return [`${dateString}_${room}`, { startDate: booking.start, duration: booking.duration }] as [
            string,
            { startDate: string; duration: number }
          ];
        })
      )
    )
  );

  const today = startOfToday();
  const todayBooking = Array.from(fetchedDatesMap).find(([, value]) => {
    return (value as any).date === today.toISOString().split("T")[0];
  })?.[1];

  const todayBookingMap = new Map();
  if (todayBooking) {
    Array.from({ length: (todayBooking as any).duration }, (_, i) => {
      const date = addDays(toZonedTime((todayBooking as any).startDate, timeZone), i);
      todayBookingMap.set(
        `${date.toISOString().split("T")[0]}_${(todayBooking as any).room}`,
        true
      );
    });
  }

  const toUnbook = Array.from(fetchedDatesMap)
    .filter(([key, value]) => {
      const [date] = (key as string).split("_");
      if (isBefore(toZonedTime(date, timeZone), startOfToday())) return false;
      if (todayBookingMap.has(key as string)) return false;
      if (!reservedDatesSet.has(key as string)) return true;

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
    .map(([, value]) => {
      const { room, date } = value as any;
      return { room, date };
    });

  const unbookResult: any = await sendGraphQLRequest(unbookQuery, { calendar, guest, bookings: toUnbook });
  if (unbookResult.errors) throw new Error(unbookResult.errors[0].message);

  const bookingResults = await Promise.all(
    finalResult.flatMap((roomData) =>
      roomData.reserved
        .filter((booking) => !isBefore(toZonedTime(booking.start, timeZone), startOfToday()))
        .map((booking) =>
          sendGraphQLRequest(bookQuery, {
            ...variables,
            room: roomData.room,
            description: booking.description,
            date: booking.start,
            duration: booking.duration,
          }).then((result: any) => {
            if (result.errors) throw new Error(result.errors[0].message);
            return result.data.bookAirBnB;
          })
        )
    )
  );

  const blockedData = finalResult.reduce((acc: Record<string, any[]>, roomData) => {
    acc[roomData.room] = roomData.blocked;
    return acc;
  }, {});

  return { reserved: bookingResults, blocked: blockedData };
};