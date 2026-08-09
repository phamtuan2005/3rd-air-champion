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
        airbnbPrice
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

// Restoring what the feed cannot carry. AirBnB's iCal has no payout, alias,
// note or guest count — those are typed in by hand — so a booking re-created
// from the feed comes back blank. These put the values back afterwards.
const restorePriceQuery = `
  mutation UpdateBookingAirbnbPrice($_id: String!, $airbnbPrice: Float!) {
    updateBookingAirbnbPrice(_id: $_id, airbnbPrice: $airbnbPrice) { id }
  }`;

const restoreDetailsQuery = `
  mutation UpdateBookingGuest($_id: String!, $alias: String, $notes: String, $numberOfGuests: Int) {
    updateBookingGuest(_id: $_id, alias: $alias, notes: $notes, numberOfGuests: $numberOfGuests) { id }
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
        airbnbPrice
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
}): Promise<{
  reserved: any[];
  blocked: Record<string, any[]>;
  // What this run changed, so an unattended schedule is auditable.
  changes: { added: number; removed: number; addedKeys: string[] };
}> => {
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

  // Everything a person typed in, captured BEFORE anything is deleted.
  //
  // The sync repairs a changed stay by unbooking it and re-booking from the
  // feed. The feed knows dates and a description — nothing else. So payout,
  // alias, notes and guest count were silently destroyed on every such repair,
  // and there is no way to recover them from AirBnB. Snapshot them here, put
  // them back after the re-book.
  const preserved = new Map<
    string,
    {
      airbnbPrice: number;
      alias: string;
      notes: string;
      numberOfGuests: number;
      description: string;
    }
  >();
  for (const day of currentlyBookedDays) {
    for (const b of day.bookings) {
      if (b.guest?.id !== guest || !b.room) continue;
      preserved.set(`${day.date}_${b.room.id}`, {
        airbnbPrice: b.airbnbPrice ?? 0,
        alias: b.alias ?? "",
        notes: b.notes ?? "",
        numberOfGuests: b.numberOfGuests ?? 0,
        // Identifies WHICH reservation the values belong to. Date and room alone
        // are not identity: if one guest cancels and another books the same room
        // on the same night, restoring by date+room would move the first guest's
        // payout onto the second — inventing money for a stay that never earned
        // it. Only restore when the feed says it is the same reservation.
        description: b.description ?? "",
      });
    }
  }

  // A room whose feed came back with zero reservations is far more likely to be
  // a failed fetch, a rate-limit, or an error page that parsed to nothing than a
  // genuine cancellation of every future stay. Unbooking on that basis would
  // wipe the room's entire forward calendar, so refuse to treat silence as
  // "everything is cancelled" while the room still holds bookings.
  const roomsWithNoFeed = new Set(
    finalResult.filter((r) => r.reserved.length === 0).map((r) => r.room),
  );
  if (roomsWithNoFeed.size) {
    console.warn(
      `[AirbnbSync] ${roomsWithNoFeed.size} room(s) returned an empty feed — skipping unbook for them`,
    );
  }

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
  const todayKey = today.toISOString().split("T")[0];

  // Every stay in progress right now, across EVERY room.
  //
  // This used to be `.find()`, which returns a single booking — so on any given
  // day exactly one room's in-progress stay was protected and the others were
  // fair game for unbooking. That is how a live 2-night Queen stay lost its
  // second night: the one booking `.find()` happened to return belonged to a
  // different room. A guest is asleep in these rooms; none of them may be
  // unbooked on the strength of a feed that momentarily disagrees.
  const todayBookingMap = new Map<string, boolean>();
  for (const [, value] of fetchedDatesMap) {
    const stay = value as any;
    if (stay.date !== todayKey) continue;
    for (let i = 0; i < (stay.duration ?? 1); i++) {
      const date = addDays(toZonedTime(stay.startDate, timeZone), i);
      todayBookingMap.set(`${date.toISOString().split("T")[0]}_${stay.room}`, true);
    }
  }

  const toUnbook = Array.from(fetchedDatesMap)
    .filter(([key, value]) => {
      const [date] = (key as string).split("_");
      if (isBefore(toZonedTime(date, timeZone), startOfToday())) return false;
      if (todayBookingMap.has(key as string)) return false;
      // Empty feed for this room — treat as "unknown", never as "cancelled".
      if (roomsWithNoFeed.has((value as any).room)) return false;
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

  // Put the hand-entered values back onto anything the re-book recreated blank.
  //
  // Matched on date + room, the same identity the rest of the sync uses, since
  // a re-created booking has a new _id. Both mutations spread across the whole
  // stay, so one call per booking id is enough — hence the `restored` guard.
  const restored = new Set<string>();
  let restoredCount = 0;
  for (const day of bookingResults) {
    if (!day?.bookings) continue;
    for (const b of day.bookings) {
      if (b.guest?.id !== guest || !b.room || restored.has(b.id)) continue;
      const prior = preserved.get(`${day.date}_${b.room.id}`);
      if (!prior) continue;
      // Same night, same room, but a different reservation — a cancellation
      // replaced by someone else. Leave it blank for a human rather than
      // attributing the previous guest's payout to this one.
      if (prior.description !== (b.description ?? "")) continue;

      const needsPrice = prior.airbnbPrice > 0 && !(b.airbnbPrice > 0);
      const needsDetails =
        (prior.alias && !b.alias) ||
        (prior.notes && !b.notes) ||
        (prior.numberOfGuests > 0 && !(b.numberOfGuests > 0));
      if (!needsPrice && !needsDetails) continue;

      restored.add(b.id);
      restoredCount++;
      if (needsPrice) {
        const r: any = await sendGraphQLRequest(restorePriceQuery, {
          _id: b.id,
          airbnbPrice: prior.airbnbPrice,
        });
        if (r.errors) console.error(`[AirbnbSync] price restore failed for ${b.id}: ${r.errors[0].message}`);
      }
      if (needsDetails) {
        const r: any = await sendGraphQLRequest(restoreDetailsQuery, {
          _id: b.id,
          alias: prior.alias || undefined,
          notes: prior.notes || undefined,
          numberOfGuests: prior.numberOfGuests > 0 ? prior.numberOfGuests : undefined,
        });
        if (r.errors) console.error(`[AirbnbSync] detail restore failed for ${b.id}: ${r.errors[0].message}`);
      }
    }
  }
  if (restoredCount) console.log(`[AirbnbSync] restored hand-entered values on ${restoredCount} booking(s)`);

  const blockedData = finalResult.reduce((acc: Record<string, any[]>, roomData) => {
    acc[roomData.room] = roomData.blocked;
    return acc;
  }, {});

  // What this run actually CHANGED, as opposed to what it re-asserted.
  //
  // `reserved` above is every future night in the feed — the sync re-books them
  // all each time, so its length says nothing about whether anything moved. An
  // unattended run every 30 minutes needs a signal you can audit: 47 quiet runs
  // and one that added a booking should not look identical.
  //
  // Added = a night the feed reserves that the calendar did not already hold.
  // Removed = `toUnbook`, the nights the feed dropped. Both use the shared
  // `date_roomId` key, and both ignore the past, which the sync never touches.
  const todayKey = startOfToday().toISOString().split("T")[0];
  const addedKeys = Array.from(reservedDatesSet).filter(
    (key) => !fetchedDatesMap.has(key) && (key as string).split("_")[0] >= todayKey,
  );
  const changes = {
    added: addedKeys.length,
    removed: toUnbook.length,
    // Nights, not stays — one new 3-night booking reads as 3. Kept as raw keys
    // so a caller can group them if it needs stay-level detail.
    addedKeys,
  };

  return { reserved: bookingResults, blocked: blockedData, changes };
};