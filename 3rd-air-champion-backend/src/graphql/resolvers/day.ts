import Day from "../../model/daySchema";
import Room from "../../model/roomSchema";
import Calendar from "../../model/calendarSchema";
import Guest from "../../model/guestSchema";
import { GraphQLDate } from "graphql-scalars";
import mongoose from "mongoose";
import {
  isBefore,
  isAfter,
  isEqual,
  addDays,
  startOfToday,
  format,
} from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { buildDateRange } from "../../util/dateRange";
import BookingRequest from "../../model/bookingRequestSchema";

export const dayResolvers = {
  Date: GraphQLDate,
  Query: {
    days: async () => {
      return await Day.find()
        .populate("bookings.guest")
        .populate("bookings.room")
        .populate("blockedRooms");
    },
    day: async (_: unknown, { _id }: any) => {
      return await Day.findById(_id)
        .populate("bookings.guest")
        .populate("bookings.room")
        .populate("blockedRooms");
    },
    hostDays: async (_: unknown, { calendarId }: any) => {
      return await Day.find({ calendar: calendarId })
        .populate("bookings.guest")
        .populate("bookings.room")
        .populate("blockedRooms");
    },
    airBnBDays: async (_: unknown, { calendar, guest }: any) => {
      return await Day.find({ calendar, "bookings.guest": guest })
        .populate("bookings.guest")
        .populate("bookings.room")
        .populate("blockedRooms");
    },
    airBnBBookingCount: async (_: unknown, { guest }: any) => {
      return await Day.aggregate([
        { $unwind: "$bookings" },
        {
          $match: {
            "bookings.guest": mongoose.Types.ObjectId.createFromHexString(guest),
            "bookings.alias": { $nin: ["", null] },
          },
        },
        {
          $group: {
            _id: {
              alias: "$bookings.alias",
              room: "$bookings.room",
              startDate: "$bookings.startDate",
            },
          },
        },
        {
          $group: {
            _id: { alias: "$_id.alias", room: "$_id.room" },
            DistinctStartDateCount: { $sum: 1 },
          },
        },
        {
          $project: {
            _id: 0,
            Alias: "$_id.alias",
            RoomObjectId: "$_id.room",
            DistinctStartDateCount: 1,
          },
        },
        { $sort: { Alias: 1 } },
      ]);
    },
    guestBookingCount: async (_: unknown, { calendarId }: any) => {
      return await Day.aggregate([
        {
          $match: {
            calendar: mongoose.Types.ObjectId.createFromHexString(calendarId),
          },
        },
        { $unwind: "$bookings" },
        { $match: { "bookings.description": { $not: { $regex: "airbnb" } } } },
        {
          $group: {
            _id: { guest: "$bookings.guest", startDate: "$bookings.startDate" },
          },
        },
        {
          $group: {
            _id: "$_id.guest",
            DistinctStartDateCount: { $sum: 1 },
            FirstStayDate: { $min: "$_id.startDate" },
          },
        },
        {
          $project: {
            _id: 0,
            GuestId: { $toString: "$_id" },
            DistinctStartDateCount: 1,
            FirstStayDate: { $dateToString: { format: "%Y-%m-%d", date: "$FirstStayDate" } },
          },
        },
      ]);
    },
    calendarBookingsByGuest: async (_: unknown, { calendarId, phone }: any) => {
      const cal = await Calendar.findById(calendarId);
      if (!cal) return [];

      const digits = phone.replace(/\D/g, "");
      const phoneRegex = new RegExp(digits.split("").join("\\D*"));
      const guest = await Guest.findOne({ host: cal.host, phone: { $regex: phoneRegex } });
      if (!guest) return [];

      const days = await Day.find({ calendar: calendarId, "bookings.guest": guest._id })
        .populate("bookings.room")
        ;

      const seen = new Set<string>();
      const result: any[] = [];

      for (const day of days) {
        for (const booking of day.bookings as any[]) {
          if (booking.guest?.toString() !== guest._id.toString()) continue;
          const rawStart = booking.startDate ?? day.date;
          const startDate: Date = rawStart instanceof Date ? rawStart : new Date(rawStart);
          const roomId = booking.room?._id?.toString() ?? booking.room?.toString();
          const key = `${roomId}:${startDate.toISOString().slice(0, 10)}`;
          if (seen.has(key)) continue;
          seen.add(key);
          result.push({
            id: booking._id.toString(),
            guestName: guest.name,
            date: startDate.toISOString(),
            room: roomId,
            duration: booking.duration ?? 1,
            numberOfGuests: booking.numberOfGuests ?? 1,
            status: "confirmed",
            createdAt: (day as any).createdAt?.toISOString() ?? startDate.toISOString(),
          });
        }
      }

      return result;
    },
    availableRooms: async (_: unknown, { calendar, date, duration }: any) => {
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const localDate = toZonedTime(date.split("T")[0], timeZone);
      const dates = buildDateRange(localDate, duration);

      const occupiedDays = await Day.find({ calendar, date: { $in: dates } });

      const unavailableRoomIds = new Set<string>();
      for (const day of occupiedDays) {
        if (day.isBlocked) {
          const cal = await Calendar.findById(calendar);
          if (!cal) throw new Error("Calendar not found");
          const allRooms = await Room.find({ host: cal.host, active: true });
          allRooms.forEach((r) => unavailableRoomIds.add(r._id.toString()));
          break;
        }
        for (const booking of day.bookings as any[]) {
          unavailableRoomIds.add(booking.room.toString());
        }
        for (const blockedRoom of day.blockedRooms as any[]) {
          unavailableRoomIds.add(blockedRoom.toString());
        }
      }

      const cal = await Calendar.findById(calendar);
      if (!cal) throw new Error("Calendar not found");

      // Also block rooms that are reserved by another guest for overlapping dates
      const reservedReqs = await BookingRequest.find({ host: cal.host, status: "reserved" });
      for (const req of reservedReqs) {
        const reqEnd = addDays(req.date, req.duration - 1);
        if (req.date <= dates[dates.length - 1] && reqEnd >= dates[0]) {
          unavailableRoomIds.add(req.room.toString());
        }
      }

      return await Room.find({
        host: cal.host,
        active: true,
        _id: { $nin: [...unavailableRoomIds] },
      });
    },
  },
  Mutation: {
    blockDay: async (_: unknown, { calendar, date }: any) => {
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const localDate = toZonedTime(date, timeZone);

      const day = await Day.findOne({ date: localDate });

      if (day) {
        return await Day.findByIdAndUpdate(
          { _id: day._id },
          { isBlocked: true },
          { runValidators: true, new: true }
        );
      } else {
        return await new Day({ calendar, date: localDate, isBlocked: true }).save();
      }
    },
    blockManyDays: async (_: unknown, { calendar, dates }: any) => {
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const currentDate = startOfToday();

      const validDates = dates.filter((date: Date) => {
        const localDate = toZonedTime(date, timeZone);
        return isAfter(localDate, currentDate);
      });

      const bulkOps = validDates.map((date: Date) => {
        const localDate = toZonedTime(date, timeZone);
        return {
          updateOne: {
            filter: {
              calendar,
              date: localDate,
              $or: [
                { guest: { $exists: false } },
                { guest: null },
                { room: { $exists: false } },
                { room: null },
              ],
            },
            update: { $set: { isBlocked: true } },
            upsert: true,
          },
        };
      });

      await Day.bulkWrite(bulkOps, { ordered: false });
      return await Day.find();
    },
    blockRange: async (_: unknown, { calendar, date, duration }: any) => {
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const localDate = toZonedTime(date, timeZone);

      if (isBefore(localDate, startOfToday())) {
        throw new Error("Cannot block past days");
      }

      const dates = buildDateRange(localDate, duration);

      const bulkOps = dates.map((date: Date) => ({
        updateOne: {
          filter: { calendar, date },
          update: { $set: { isBlocked: true } },
          upsert: true,
        },
      }));

      await Day.bulkWrite(bulkOps);
      return await Day.find({ date: { $in: dates } });
    },
    unblockDay: async (_: unknown, { calendar, date }: any) => {
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const localDate = toZonedTime(date, timeZone);

      return await Day.findOneAndUpdate(
        { calendar, date: localDate },
        { isBlocked: false },
        { runValidators: true, new: true }
      );
    },
    unblockManyDays: async (_: unknown, { calendar, dates }: any) => {
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      let localDates: Date[] = [];

      const bulkOperation = dates.map((date: Date) => {
        const localDate = toZonedTime(date, timeZone);
        localDates.push(localDate);
        return {
          updateOne: {
            filter: { calendar, date: localDate },
            update: { $set: { isBlocked: false } },
          },
        };
      });

      await Day.bulkWrite(bulkOperation, { ordered: false });
      return await Day.find({ calendar, date: { $in: localDates } });
    },
    unblockRange: async (_: unknown, { calendar, startDate, endDate }: any) => {
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const localStartDate = toZonedTime(startDate, timeZone);
      const localEndDate = toZonedTime(endDate, timeZone);

      const today = startOfToday();
      let currentDate = localStartDate;
      if (isBefore(currentDate, today) || isEqual(currentDate, today)) {
        currentDate = addDays(today, 1);
      }

      const datesInRange: Date[] = [];
      while (isBefore(currentDate, addDays(localEndDate, 1))) {
        datesInRange.push(currentDate);
        currentDate = addDays(currentDate, 1);
      }

      const bulkOps = datesInRange.map((date: Date) => ({
        updateOne: {
          filter: { calendar, date },
          update: { $set: { isBlocked: false } },
        },
      }));

      await Day.bulkWrite(bulkOps, { ordered: false });
      return await Day.find({ calendar, date: { $in: datesInRange } });
    },
    blockRoom: async (_: unknown, { calendar, room, date, duration }: any) => {
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const localDate = toZonedTime(date.split("T")[0], timeZone);

      if (isBefore(localDate, startOfToday())) {
        throw new Error("Cannot block past days");
      }

      const dates = buildDateRange(localDate, duration);

      const conflictingDays = await Day.find({
        calendar,
        date: { $in: dates },
        $or: [{ bookings: { $elemMatch: { room } } }],
      });

      if (conflictingDays.length > 0) {
        const conflictingDates = conflictingDays.map((day) =>
          format(toZonedTime(day.date, timeZone), "yyyy-MM-dd")
        );
        throw new Error(`The following dates are unavailable: ${conflictingDates.join(", ")}`);
      }

      const bulkOperation = dates.map((bookingDate) => ({
        updateOne: {
          filter: { calendar, date: bookingDate },
          update: { $addToSet: { blockedRooms: room } },
          upsert: true,
        },
      }));

      await Day.bulkWrite(bulkOperation);

      return await Day.find({ calendar, date: { $in: dates } })
        .populate("bookings.guest")
        .populate("bookings.room")
        .populate("blockedRooms");
    },
    unblockRoom: async (_: unknown, { calendar, room, date, duration }: any) => {
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const localDate = toZonedTime(date.split("T")[0], timeZone);
      const dates = buildDateRange(localDate, duration);

      const bulkOperation = dates.map((bookingDate) => ({
        updateOne: {
          filter: { calendar, date: bookingDate },
          update: { $pull: { blockedRooms: new mongoose.Types.ObjectId(room) } },
        },
      }));

      await Day.bulkWrite(bulkOperation);

      return await Day.find({ calendar, date: { $in: dates } })
        .populate("bookings.guest")
        .populate("bookings.room")
        .populate("blockedRooms");
    },
    bookDays: async (
      _: unknown,
      { calendar, date, guest, isAirBnB, numberOfGuests, room, duration, reserved }: any
    ) => {
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const localDate = toZonedTime(date.split("T")[0], timeZone);
      const dates = buildDateRange(localDate, duration);

      const conflictingDays = await Day.find({
        calendar,
        date: { $in: dates },
        $or: [
          { isBlocked: true },
          { bookings: { $elemMatch: { room, "guest.name": { $ne: "AirBnB" } } } },
          { blockedRooms: room },
        ],
      });

      if (conflictingDays.length > 0) {
        const conflictingDates = conflictingDays.map((day) =>
          format(toZonedTime(day.date, timeZone), "yyyy-MM-dd")
        );
        throw new Error(`The following dates are unavailable: ${conflictingDates.join(", ")}`);
      }

      const currentRoom = await Room.findById(room);
      const roomPrice = currentRoom?.price;

      const currentGuest = await Guest.findById(guest);
      const notes = currentGuest?.name !== "AirBnB" ? currentGuest?.notes : "";
      const alias = currentGuest?.name !== "AirBnB" ? currentGuest?.alias : "";

      const bulkOperation = dates.map((bookingDate) => ({
        updateOne: {
          filter: { calendar, date: bookingDate },
          update: {
            $set: { isAirBnB },
            $addToSet: {
              bookings: {
                guest,
                room,
                notes,
                alias,
                price: roomPrice,
                duration,
                numberOfGuests,
                startDate: dates[0],
                endDate: dates[dates.length - 1],
                reserved: reserved ?? false,
              },
            },
          },
          upsert: true,
        },
      }));

      await Day.bulkWrite(bulkOperation);

      return await Day.find({ calendar, date: { $in: dates } })
        .populate("bookings.guest")
        .populate("bookings.room")
        .populate("blockedRooms");
    },
    bookAirBnB: async (
      _: unknown,
      { calendar, date, guest, description, room, duration }: any
    ) => {
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const localDate = toZonedTime(date.split("T")[0], timeZone);

      if (isBefore(localDate, startOfToday())) {
        throw new Error("Cannot book past days");
      }

      const existingBookings = await Day.find({
        calendar,
        "bookings.room": room,
        date: { $gte: localDate, $lte: addDays(localDate, duration - 1) },
      });

      const existingDates = new Set(
        existingBookings.map((booking) => booking.date.toISOString())
      );

      const dates: Date[] = [];
      for (let i = 0; i < duration; i++) {
        const bookingDate = addDays(localDate, i);
        if (!existingDates.has(bookingDate.toISOString())) {
          dates.push(bookingDate);
        }
      }

      const currentRoom = await Room.findById(room);
      const roomPrice = currentRoom?.price;

      const bulkOperation = dates.map((bookingDate) => ({
        updateOne: {
          filter: { calendar, date: bookingDate },
          update: {
            $set: { isAirBnB: true },
            $addToSet: {
              bookings: {
                guest,
                room,
                price: roomPrice,
                description,
                duration,
                numberOfGuests: 1,
                startDate: dates[0],
                endDate: dates[dates.length - 1],
              },
            },
          },
          upsert: true,
        },
      }));

      await Day.bulkWrite(bulkOperation);

      return await Day.find({ calendar, date: { $in: dates } })
        .populate("bookings.guest")
        .populate("bookings.room")
        .populate("blockedRooms");
    },
    unbookAirBnB: async (_: unknown, { calendar, guest, bookings }: any) => {
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

      for await (const { room, date } of bookings) {
        const localDate = toZonedTime(date.split("T")[0], timeZone);
        Day.updateOne(
          { calendar, date: localDate, "bookings.room": room, "bookings.guest": guest },
          { $pull: { bookings: { guest, room } } }
        )
          .then(() => {
            console.log(`Successfully unbooked room ${room} on ${date}`);
          })
          .catch((error: any) => {
            console.error(`Failed to unbook room ${room} on ${date}:`, error.message);
          });
      }

      return true;
    },
    updateBookingGuest: async (
      _: unknown,
      { _id, alias, notes, earlyCheckin, lateCheckout, numberOfGuests }: any
    ) => {
      const updateBody: {
        "bookings.$[matchingBooking].alias"?: string;
        "bookings.$[matchingBooking].notes"?: string;
        "bookings.$[matchingBooking].earlyCheckin"?: boolean;
        "bookings.$[matchingBooking].lateCheckout"?: boolean;
        "bookings.$[matchingBooking].numberOfGuests"?: number;
      } = {};

      if (alias) updateBody["bookings.$[matchingBooking].alias"] = alias;
      if (notes) updateBody["bookings.$[matchingBooking].notes"] = notes;
      if (earlyCheckin !== undefined) updateBody["bookings.$[matchingBooking].earlyCheckin"] = earlyCheckin;
      if (lateCheckout !== undefined) updateBody["bookings.$[matchingBooking].lateCheckout"] = lateCheckout;
      if (numberOfGuests) updateBody["bookings.$[matchingBooking].numberOfGuests"] = numberOfGuests;

      const dayOfBooking = await Day.findOne({ "bookings._id": _id });
      const calendar = dayOfBooking?.calendar;
      const currentBooking = dayOfBooking?.bookings.find((booking) => booking.id === _id);

      let startDate = currentBooking?.startDate;
      let endDate = currentBooking?.endDate;
      if (!startDate || !endDate) {
        startDate = dayOfBooking!.date;
        endDate = addDays(dayOfBooking!.date, (currentBooking?.duration ?? 1) - 1);
      }

      const currentGuest = await Guest.findById(currentBooking?.guest);

      if (currentGuest?.name !== "AirBnB" && notes) {
        await Guest.findByIdAndUpdate(currentBooking?.guest, { notes }, { runValidators: true });
        await Day.updateMany(
          { calendar, "bookings.guest": currentBooking?.guest, "bookings.room": currentBooking?.room },
          { $set: { "bookings.$[matchingBooking].notes": notes } },
          {
            arrayFilters: [{ "matchingBooking.guest": currentBooking?.guest, "matchingBooking.room": currentBooking?.room }],
            runValidators: true,
          }
        );
      }

      if (currentGuest?.name !== "AirBnB" && alias) {
        await Guest.findByIdAndUpdate(currentBooking?.guest, { alias }, { runValidators: true });
        await Day.updateMany(
          { calendar, "bookings.guest": currentBooking?.guest, "bookings.room": currentBooking?.room },
          { $set: { "bookings.$[matchingBooking].alias": alias } },
          {
            arrayFilters: [{ "matchingBooking.guest": currentBooking?.guest, "matchingBooking.room": currentBooking?.room }],
            runValidators: true,
          }
        );
      }

      await Day.updateMany(
        {
          calendar,
          date: { $gte: startDate, $lte: endDate },
          "bookings.guest": currentBooking?.guest,
          "bookings.room": currentBooking?.room,
        },
        { $set: updateBody },
        {
          arrayFilters: [{ "matchingBooking.guest": currentBooking?.guest, "matchingBooking.room": currentBooking?.room }],
          runValidators: true,
        }
      );

      return await Day.find({ calendar, date: { $gte: startDate, $lte: endDate } })
        .populate("bookings.guest")
        .populate("bookings.room")
        .populate("blockedRooms");
    },
    updateBookingAirbnbPrice: async (_: unknown, { _id, airbnbPrice }: any) => {
      const dayOfBooking = await Day.findOne({ "bookings._id": _id });
      if (!dayOfBooking) throw new Error("Booking not found");

      const calendar = dayOfBooking.calendar;
      const currentBooking = dayOfBooking.bookings.find((booking: any) => booking.id === _id);

      let startDate = currentBooking?.startDate;
      let endDate = currentBooking?.endDate;
      if (!startDate || !endDate) {
        startDate = dayOfBooking.date;
        endDate = addDays(dayOfBooking.date, (currentBooking?.duration ?? 1) - 1);
      }

      await Day.updateMany(
        {
          calendar,
          date: { $gte: startDate, $lte: endDate },
          "bookings.guest": currentBooking?.guest,
          "bookings.room": currentBooking?.room,
        },
        { $set: { "bookings.$[matchingBooking].airbnbPrice": airbnbPrice } },
        {
          arrayFilters: [{ "matchingBooking.guest": currentBooking?.guest, "matchingBooking.room": currentBooking?.room }],
          runValidators: true,
        }
      );

      return await Day.find({ calendar, date: { $gte: startDate, $lte: endDate } })
        .populate("bookings.guest")
        .populate("bookings.room")
        .populate("blockedRooms");
    },
    markAirBnBBlocked: async (_: unknown, { _id, blocked }: any) => {
      const dayOfBooking = await Day.findOne({ "bookings._id": _id });
      if (!dayOfBooking) throw new Error("Booking not found");

      const calendar = dayOfBooking.calendar;
      const currentBooking = dayOfBooking.bookings.find((booking: any) => booking.id === _id);
      const startDate = currentBooking?.startDate;
      const endDate = currentBooking?.endDate;

      await Day.updateMany(
        {
          calendar,
          date: { $gte: startDate, $lte: endDate },
          "bookings.guest": currentBooking?.guest,
          "bookings.room": currentBooking?.room,
        },
        { $set: { "bookings.$[matchingBooking].airbnbBlocked": blocked } },
        {
          arrayFilters: [{ "matchingBooking.guest": currentBooking?.guest, "matchingBooking.room": currentBooking?.room }],
          runValidators: true,
        }
      );

      return await Day.find({ calendar, date: { $gte: startDate, $lte: endDate } })
        .populate("bookings.guest")
        .populate("bookings.room")
        .populate("blockedRooms");
    },
    unbookGuest: async (_: unknown, { _id }: any) => {
      const dayOfBooking = await Day.findOne({ "bookings._id": _id });
      const calendar = dayOfBooking?.calendar;
      const currentBooking = dayOfBooking?.bookings.find((booking) => booking.id === _id);
      const startDate = currentBooking?.startDate;
      const endDate = currentBooking?.endDate;

      await Day.updateMany(
        {
          calendar,
          date: { $gte: startDate, $lte: endDate },
          "bookings.guest": currentBooking?.guest,
          "bookings.room": currentBooking?.room,
        },
        { $pull: { bookings: { guest: currentBooking?.guest, room: currentBooking?.room } } },
        { runValidators: true }
      );

      return await Day.find({ calendar, date: { $gte: startDate, $lte: endDate } })
        .populate("bookings.guest")
        .populate("bookings.room")
        .populate("blockedRooms");
    },
    updateDay: async (
      _: unknown,
      { _id, isAirBnB, isBlocked, rooms, guests }: any
    ) => {
      const updatedData: {
        isAirBnB?: boolean;
        isBlocked?: boolean;
        rooms?: string;
        guests?: string;
      } = {};
      if (typeof isAirBnB !== "undefined" || isAirBnB !== null) updatedData.isAirBnB = isAirBnB;
      if (typeof isBlocked !== "undefined" || isBlocked !== null) updatedData.isBlocked = isBlocked;
      if (rooms) updatedData.rooms = rooms;
      if (guests) updatedData.guests = guests;

      return await Day.findByIdAndUpdate(_id, updatedData, {
        runValidators: true,
        new: true,
      });
    },
  },
};