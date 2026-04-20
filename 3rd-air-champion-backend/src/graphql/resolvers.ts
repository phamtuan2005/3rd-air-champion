import Host from "../model/hostSchema";
import Cohost from "../model/cohostSchema";
import Calendar from "../model/calendarSchema";
import Guest from "../model/guestSchema";
import Room from "../model/roomSchema";
import Day from "../model/daySchema";
import { GraphQLDate } from "graphql-scalars";
import mongoose from "mongoose";
import {
  startOfDay,
  isBefore,
  isAfter,
  isEqual,
  addDays,
  startOfToday,
  parseISO,
  format,
} from "date-fns";
import { toZonedTime } from "date-fns-tz";

const generalResolvers = {
  Query: {
    greetings: () => "GraphQL is Awesome",
    hosts: async () => {
      return await Host.find();
    },
  },
};

const hostResolvers = {
  Query: {
    hosts: async () => {
      return await Host.find();
    },
    host: async (_: unknown, { _id }: any) => {
      // Redirect airbnbsync to the correct host
      const hostData = await Host.findById(_id);
      if (!hostData) throw new Error("Host not found");

      if (_id === "681410b9d51d1dd6c713e947") {

        const mainHost = await Host.findById("677203811c91b1e24326db49");
        if (mainHost) {
          hostData.airbnbsync = mainHost.airbnbsync;
        }

      }

      return hostData;
    },
  },
  Mutation: {
    createHost: async (_: unknown, { email, name, password }: any) => {
      const host = new Host({ email, name, password });
      return await host.save();
    },
    updateHost: async (
      _: unknown,
      { _id, email, name, password, airbnbsync, doorCode, airbnbName, airbnbAddress, houseRules, phone, contactEmail, licenseNumber }: any
    ) => {
      const updateData: {
        email?: string;
        name?: string;
        password?: string;
        airbnbsync?: any;
        doorCode?: string;
        airbnbName?: string;
        airbnbAddress?: string;
        houseRules?: string;
        phone?: string;
        contactEmail?: string;
        licenseNumber?: string;
      } = {};
      if (email) updateData.email = email;
      if (name) updateData.name = name;
      if (password) {
        updateData.password = password;
      }
      if (airbnbsync) {
        updateData.airbnbsync = JSON.parse(airbnbsync);
      }
      if (doorCode !== undefined) updateData.doorCode = doorCode;
      if (airbnbName !== undefined) updateData.airbnbName = airbnbName;
      if (airbnbAddress !== undefined) updateData.airbnbAddress = airbnbAddress;
      if (houseRules !== undefined) updateData.houseRules = houseRules;
      if (phone !== undefined) updateData.phone = phone;
      if (contactEmail !== undefined) updateData.contactEmail = contactEmail;
      if (licenseNumber !== undefined) updateData.licenseNumber = licenseNumber;

      // Perform the update
      const updatedHost = await Host.findByIdAndUpdate(_id, { $set: updateData }, {
        new: true,
        runValidators: true,
      });

      return updatedHost;
    },
    deleteCohosts: async (_: unknown, { _id, cohostIds }: any) => {
      await Cohost.deleteMany({ _id: { $in: cohostIds } });
      return await Host.findByIdAndUpdate(
        _id,
        { $pull: { cohosts: { $in: cohostIds } } },
        { runValidators: true, new: true }
      );
    },
    deleteGuests: async (_: unknown, { _id, guestIds }: any) => {
      await Guest.deleteMany({ _id: { $in: guestIds } });
      return await Host.findByIdAndUpdate(
        _id,
        { $pull: { guests: { $in: guestIds } } },
        { runValidators: true, new: true }
      );
    },
    deleteRooms: async (_: unknown, { _id, roomIds }: any) => {
      await Room.deleteMany({ _id: { $in: roomIds } });
      return await Host.findByIdAndUpdate(
        _id,
        { $pull: { rooms: { $in: roomIds } } },
        { runValidators: true, new: true }
      );
    },
  },
};

const cohostResolvers = {
  Query: {
    cohosts: async () => {
      return await Cohost.find();
    },
    cohost: async (_: unknown, { _id }: any) => {
      return await Cohost.findById(_id);
    },
  },
  Mutation: {
    createCohost: async (_: unknown, { email, name, password, host }: any) => {
      const cohost = new Cohost({
        email: email,
        name: name,
        password: password,
        host: host,
      });
      return await cohost.save();
    },
    updateCohost: async (_: unknown, { _id, email, name, password }: any) => {
      const updateData: { email?: string; name?: string; password?: string } =
        {};
      if (email) updateData.email = email;
      if (name) updateData.name = name;
      if (password) {
        updateData.password = password;
      }

      // Perform the update
      const updatedCohost = await Cohost.findByIdAndUpdate(_id, updateData, {
        new: true,
        runValidators: true,
      });

      return updatedCohost;
    },
  },
};

const calendarResolver = {
  Query: {
    calendars: async () => {
      return await Calendar.find();
    },
    calendar: async (_: unknown, { _id }: any) => {
      return await Calendar.findById(_id);
    },
  },
  Mutation: {
    createCalendar: async (_: unknown, { host }: any) => {
      return await new Calendar({ host }).save();
    },
  },
};

const guestResolver = {
  Query: {
    guests: async () => {
      return await Guest.find();
    },
    guestsHost: async (_: unknown, { host }: any) => {
      const redirectedHost = host === "681410b9d51d1dd6c713e947" ? "677203811c91b1e24326db49" : host;
      return await Guest.find({ host: redirectedHost });
    },
    guest: async (_: unknown, { _id }: any) => {
      return await Guest.findById(_id);
    },
  },
  Mutation: {
    createGuest: async (
      _: unknown,
      { name, email, phone, numberOfGuests, returning, notes, host }: any
    ) => {
      const guestData: {
        name: string;
        email?: string;
        phone: string;
        numberOfGuests?: number;
        returning?: boolean;
        notes?: string;
        host: string;
      } = { name, phone, host };
      const redirectedHost = host === "681410b9d51d1dd6c713e947" ? "677203811c91b1e24326db49" : host;
      if (email) guestData.email = email;
      if (numberOfGuests) guestData.numberOfGuests = numberOfGuests;
      if (returning) guestData.returning = returning;
      if (notes) guestData.notes = notes;
      guestData.host = redirectedHost;
      return await new Guest(guestData).save();
    },
    updateGuestPricing: async (_: unknown, { guest, room, price }: any) => {
      const guestData = await Guest.findOne({
        _id: guest,
        "pricing.room": room,
      });

      if (guestData) {
        // Room exists, update its price
        await Guest.updateOne(
          { _id: guest, "pricing.room": room },
          { $set: { "pricing.$.price": price } }
        );
      } else {
        // Room doesn't exist, add a new entry
        await Guest.updateOne(
          { _id: guest },
          { $push: { pricing: { room, price } } }
        );
      }

      return await Guest.findById(guest);
    },
    updateGuest: async (
      _: unknown,
      { _id, name, email, phone, numberOfGuests, returning, notes }: any
    ) => {
      const updateData: {
        name?: string;
        email?: string;
        phone?: string;
        numberOfGuests?: number;
        returning?: boolean;
        notes?: string;
      } = {};
      if (name) updateData.name = name;
      if (email) updateData.email = email;
      if (phone) updateData.phone = phone;
      if (numberOfGuests) updateData.numberOfGuests = numberOfGuests;
      if (returning) updateData.returning = returning;
      if (notes) updateData.notes = notes;

      // Perform the update
      const updatedGuest = await Guest.findByIdAndUpdate(_id, updateData, {
        new: true,
        runValidators: true,
      });

      return updatedGuest;
    },
  },
};

const roomResolver = {
  Query: {
    rooms: async () => {
      return await Room.find().sort({ name: 1 });
    },
    roomsHost: async (_: unknown, { host }: any) => {
      const redirectedHost = host === "681410b9d51d1dd6c713e947" ? "677203811c91b1e24326db49" : host;
      return await Room.find({ host: redirectedHost }).sort({ name: 1 });
    },
    room: async (_: unknown, { _id }: any) => {
      return await Room.findById(_id);
    },
  },
  Mutation: {
    createRoom: async (_: unknown, { host, name, price, roomCode, color }: any) => {
      const redirectedHost = host === "681410b9d51d1dd6c713e947" ? "677203811c91b1e24326db49" : host;
      const roomData: { host: string; name: string; price: number; roomCode?: string; color?: string } = { host: redirectedHost, name, price };
      if (roomCode !== undefined) roomData.roomCode = roomCode;
      if (color !== undefined) roomData.color = color;
      return await new Room(roomData).save();
    },
    updateRoom: async (_: unknown, { _id, name, price, roomCode, color, active }: any) => {
      const updatedData: {
        name?: string;
        price?: number;
        roomCode?: string;
        color?: string;
        active?: boolean;
      } = {};
      if (name !== undefined) updatedData.name = name;
      if (price !== undefined) updatedData.price = price;
      if (roomCode !== undefined) updatedData.roomCode = roomCode;
      if (color !== undefined) updatedData.color = color;
      if (active !== undefined) updatedData.active = active;

      return await Room.findByIdAndUpdate(_id, { $set: updatedData }, {
        runValidators: true,
        new: true,
      });
    },
  },
};

const dayResolver = {
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
        {
          $unwind: "$bookings",
        },
        {
          $match: {
            "bookings.guest":
              mongoose.Types.ObjectId.createFromHexString(guest),
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
            _id: {
              alias: "$_id.alias",
              room: "$_id.room",
            },
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
        {
          $sort: {
            Alias: 1,
          },
        },
      ]);
    },
    availableRooms: async (
      _: unknown,
      { calendar, date, duration }: any
    ) => {
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const localDate = toZonedTime(date.split("T")[0], timeZone);

      const dates: Date[] = [];
      for (let i = 0; i < duration; i++) {
        dates.push(addDays(localDate, i));
      }

      // Collect all booked and blocked room IDs across the date range
      const occupiedDays = await Day.find({
        calendar,
        date: { $in: dates },
      });

      const unavailableRoomIds = new Set<string>();
      for (const day of occupiedDays) {
        if (day.isBlocked) {
          // Whole day is blocked — all rooms unavailable on this day;
          // signal by returning empty list
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

      return await Room.find({
        host: cal.host,
        active: true,
        _id: { $nin: [...unavailableRoomIds] },
      });
    },
  },
  Mutation: {
    blockDay: async (_: unknown, { calendar, date }: any) => {
      // Check if day already exists
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
        return await new Day({
          calendar,
          date: localDate,
          isBlocked: true,
        }).save();
      }
    },
    blockManyDays: async (_: unknown, { calendar, dates }: any) => {
      const validDates = dates.filter((date: Date) => {
        const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const currentDate = startOfToday();
        const localDate = toZonedTime(date, timeZone);

        return isAfter(localDate, currentDate);
      });

      const bulkOps = validDates.map((date: Date) => {
        const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const localDate = toZonedTime(date, timeZone);

        return {
          updateOne: {
            filter: {
              calendar: calendar,
              date: localDate,
              $or: [
                { guest: { $exists: false } },
                { guest: null },
                { room: { $exists: false } },
                { room: null },
              ],
            },
            update: {
              $set: { isBlocked: true },
            },
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

      const dates: Date[] = [];
      for (let i = 0; i < duration; i++) {
        dates.push(addDays(localDate, i));
      }

      const bulkOps = dates.map((date: Date) => ({
        updateOne: {
          filter: {
            calendar: calendar,
            date: date,
          },
          update: {
            $set: { isBlocked: true },
          },
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
      let localDates: Date[] = [];
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

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
      let datesInRange: Date[] = [];
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const localStartDate = toZonedTime(startDate, timeZone);
      const localEndDate = toZonedTime(endDate, timeZone);

      const today = startOfToday();
      let currentDate = localStartDate;

      if (isBefore(currentDate, today) || isEqual(currentDate, today))
        currentDate = addDays(today, 1);

      // Loop through dates
      while (isBefore(currentDate, addDays(localEndDate, 1))) {
        datesInRange.push(currentDate);
        currentDate = addDays(currentDate, 1);
      }

      const bulkOps = datesInRange.map((date: Date) => ({
        updateOne: {
          filter: {
            calendar: calendar,
            date: date,
          },
          update: {
            $set: { isBlocked: false },
          },
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

      const dates: Date[] = [];
      for (let i = 0; i < duration; i++) {
        dates.push(addDays(localDate, i));
      }

      const conflictingDays = await Day.find({
        calendar,
        date: { $in: dates },
        $or: [
          {
            bookings: {
              $elemMatch: {
                room,
              },
            },
          },
        ],
      });

      if (conflictingDays.length > 0) {
        const conflictingDates = conflictingDays.map((day) =>
          format(toZonedTime(day.date, timeZone), "yyyy-MM-dd")
        );
        throw new Error(
          `The following dates are unavailable: ${conflictingDates.join(", ")}`
        );
      }

      const bulkOperation = dates.map((bookingDate) => ({
        updateOne: {
          filter: { calendar, date: bookingDate },
          update: {
            $addToSet: {
              blockedRooms: room,
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
    unblockRoom: async (_: unknown, { calendar, room, date, duration }: any) => {
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const localDate = toZonedTime(date.split("T")[0], timeZone);

      const dates: Date[] = [];
      for (let i = 0; i < duration; i++) {
        dates.push(addDays(localDate, i));
      }

      const bulkOperation = dates.map((bookingDate) => ({
        updateOne: {
          filter: { calendar, date: bookingDate },
          update: {
            $pull: { blockedRooms: new mongoose.Types.ObjectId(room) },
          },
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
      { calendar, date, guest, isAirBnB, numberOfGuests, room, duration }: any
    ) => {
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const localDate = toZonedTime(date.split("T")[0], timeZone);

      const dates: Date[] = [];
      for (let i = 0; i < duration; i++) {
        dates.push(addDays(localDate, i));
      }

      const conflictingDays = await Day.find({
        calendar,
        date: { $in: dates },
        $or: [
          { isBlocked: true }, // The day is blocked
          {
            bookings: {
              $elemMatch: {
                room, // Check if the room is already assigned
                "guest.name": { $ne: "AirBnB" }, // Only conflict if it's not "AirBnB"
              },
            },
          },
          {
            blockedRooms: room, // Check if the room is in the blockedRooms array
          },
        ],
      });

      if (conflictingDays.length > 0) {
        const conflictingDates = conflictingDays.map((day) =>
          format(toZonedTime(day.date, timeZone), "yyyy-MM-dd")
        );
        throw new Error(
          `The following dates are unavailable: ${conflictingDates.join(", ")}`
        );
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
            $set: {
              isAirBnB,
            },
            $addToSet: {
              bookings: {
                guest,
                room,
                notes: notes,
                alias: alias,
                price: roomPrice,
                duration,
                numberOfGuests,
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
    bookAirBnB: async (
      _: unknown,
      { calendar, date, guest, description, room, duration }: any
    ) => {
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const localDate = toZonedTime(date.split("T")[0], timeZone);

      if (isBefore(localDate, startOfToday())) {
        throw new Error("Cannot book past days");
      }

      const dates: Date[] = [];

      // Fetch all existing bookings for the specified calendar and room in the date range
      const existingBookings = await Day.find({
        calendar,
        "bookings.room": room,
        date: { $gte: localDate, $lte: addDays(localDate, duration - 1) },
      });

      // Extract existing booked dates
      const existingDates = new Set(
        existingBookings.map((booking) => booking.date.toISOString())
      );

      // Iterate through the duration
      for (let i = 0; i < duration; i++) {
        const bookingDate = addDays(localDate, i);

        // Check if the current date is already booked
        if (existingDates.has(bookingDate.toISOString())) continue;

        dates.push(bookingDate);
      }

      // Assume no day conflicts (Handled by AirBnB)
      const currentRoom = await Room.findById(room);
      const roomPrice = currentRoom?.price;

      const bulkOperation = dates.map((bookingDate) => ({
        updateOne: {
          filter: { calendar, date: bookingDate },
          update: {
            $set: {
              isAirBnB: true,
            },
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
          {
            calendar,
            date: localDate,
            "bookings.room": room,
            "bookings.guest": guest,
          },
          {
            $pull: { bookings: { guest, room } }, // Remove the specific booking
          }
        )
          .then(() => {
            console.log(`Successfully unbooked room ${room} on ${date}`);
          })
          .catch((error: any) => {
            console.error(
              `Failed to unbook room ${room} on ${date}:`,
              error.message
            );
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
        "bookings.$[matchingBooking].price"?: number;
        "bookings.$[matchingBooking].notes"?: string;
        "bookings.$[matchingBooking].earlyCheckin"?: boolean;
        "bookings.$[matchingBooking].lateCheckout"?: boolean;
        "bookings.$[matchingBooking].numberOfGuests"?: number;
      } = {};

      if (alias) updateBody["bookings.$[matchingBooking].alias"] = alias;
      if (notes) updateBody["bookings.$[matchingBooking].notes"] = notes;
      if (earlyCheckin !== undefined)
        updateBody["bookings.$[matchingBooking].earlyCheckin"] = earlyCheckin;
      if (lateCheckout !== undefined)
        updateBody["bookings.$[matchingBooking].lateCheckout"] = lateCheckout;
      if (numberOfGuests)
        updateBody["bookings.$[matchingBooking].numberOfGuests"] =
          numberOfGuests;

      const dayOfBooking = await Day.findOne({ "bookings._id": _id });
      const calendar = dayOfBooking?.calendar;
      const currentBooking = dayOfBooking?.bookings.find(
        (booking) => booking.id === _id
      );

      const startDate = currentBooking?.startDate;
      const endDate = currentBooking?.endDate;

      const currentGuest = await Guest.findById(currentBooking?.guest);
      if (currentGuest?.name !== "AirBnB" && notes) {
        await Guest.findByIdAndUpdate(
          currentBooking?.guest,
          { notes },
          { runValidators: true }
        );

        await Day.updateMany(
          {
            calendar,
            "bookings.guest": currentBooking?.guest,
            "bookings.room": currentBooking?.room,
          },
          {
            $set: { "bookings.$[matchingBooking].notes": notes },
          },
          {
            arrayFilters: [
              {
                "matchingBooking.guest": currentBooking?.guest,
                "matchingBooking.room": currentBooking?.room,
              },
            ],
            runValidators: true,
          }
        );
      }

      if (currentGuest?.name !== "AirBnB" && alias) {
        await Guest.findByIdAndUpdate(
          currentBooking?.guest,
          { alias },
          { runValidators: true }
        );

        await Day.updateMany(
          {
            calendar,
            "bookings.guest": currentBooking?.guest,
            "bookings.room": currentBooking?.room,
          },
          {
            $set: { "bookings.$[matchingBooking].alias": alias },
          },
          {
            arrayFilters: [
              {
                "matchingBooking.guest": currentBooking?.guest,
                "matchingBooking.room": currentBooking?.room,
              },
            ],
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
        {
          $set: updateBody,
        },
        {
          arrayFilters: [
            {
              "matchingBooking.guest": currentBooking?.guest,
              "matchingBooking.room": currentBooking?.room,
            },
          ],
          runValidators: true,
        }
      );

      return await Day.find({
        calendar,
        date: { $gte: startDate, $lte: endDate },
      })
        .populate("bookings.guest")
        .populate("bookings.room")
        .populate("blockedRooms");
    },
    updateBookingAirbnbPrice: async (
      _: unknown,
      { _id, airbnbPrice }: any
    ) => {
      const dayOfBooking = await Day.findOne({ "bookings._id": _id });
      if (!dayOfBooking) throw new Error("Booking not found");

      const calendar = dayOfBooking.calendar;
      const currentBooking = dayOfBooking.bookings.find(
        (booking: any) => booking.id === _id
      );

      const startDate = currentBooking?.startDate;
      const endDate = currentBooking?.endDate;

      await Day.updateMany(
        {
          calendar,
          date: { $gte: startDate, $lte: endDate },
          "bookings.guest": currentBooking?.guest,
          "bookings.room": currentBooking?.room,
        },
        {
          $set: {
            "bookings.$[matchingBooking].airbnbPrice": airbnbPrice,
          },
        },
        {
          arrayFilters: [
            {
              "matchingBooking.guest": currentBooking?.guest,
              "matchingBooking.room": currentBooking?.room,
            },
          ],
          runValidators: true,
        }
      );

      return await Day.find({
        calendar,
        date: { $gte: startDate, $lte: endDate },
      })
        .populate("bookings.guest")
        .populate("bookings.room")
        .populate("blockedRooms");
    },
    markAirBnBBlocked: async (_: unknown, { _id, blocked }: any) => {
      const dayOfBooking = await Day.findOne({ "bookings._id": _id });
      if (!dayOfBooking) throw new Error("Booking not found");

      const calendar = dayOfBooking.calendar;
      const currentBooking = dayOfBooking.bookings.find(
        (booking: any) => booking.id === _id
      );

      const startDate = currentBooking?.startDate;
      const endDate = currentBooking?.endDate;

      await Day.updateMany(
        {
          calendar,
          date: { $gte: startDate, $lte: endDate },
          "bookings.guest": currentBooking?.guest,
          "bookings.room": currentBooking?.room,
        },
        {
          $set: {
            "bookings.$[matchingBooking].airbnbBlocked": blocked,
          },
        },
        {
          arrayFilters: [
            {
              "matchingBooking.guest": currentBooking?.guest,
              "matchingBooking.room": currentBooking?.room,
            },
          ],
          runValidators: true,
        }
      );

      return await Day.find({
        calendar,
        date: { $gte: startDate, $lte: endDate },
      })
        .populate("bookings.guest")
        .populate("bookings.room")
        .populate("blockedRooms");
    },
    unbookGuest: async (_: unknown, { _id }: any) => {
      const dayOfBooking = await Day.findOne({ "bookings._id": _id });
      const calendar = dayOfBooking?.calendar;
      const currentBooking = dayOfBooking?.bookings.find(
        (booking) => booking.id === _id
      );

      const startDate = currentBooking?.startDate;
      const endDate = currentBooking?.endDate;

      await Day.updateMany(
        {
          calendar,
          date: { $gte: startDate, $lte: endDate },
          "bookings.guest": currentBooking?.guest,
          "bookings.room": currentBooking?.room,
        },
        {
          $pull: {
            bookings: {
              guest: currentBooking?.guest,
              room: currentBooking?.room,
            },
          },
        },
        {
          runValidators: true,
        }
      );

      return await Day.find({
        calendar,
        date: { $gte: startDate, $lte: endDate },
      })
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
      if (typeof isAirBnB !== "undefined" || isAirBnB !== null)
        updatedData.isAirBnB = isAirBnB;
      if (typeof isBlocked !== "undefined" || isBlocked !== null)
        updatedData.isBlocked = isBlocked;
      if (rooms) updatedData.rooms = rooms;
      if (guests) updatedData.guests = guests;

      return await Day.findByIdAndUpdate(_id, updatedData, {
        runValidators: true,
        new: true,
      });
    },
  },
};

const authenticationResolver = {
  Query: {
    login: async (_: unknown, { email, password }: any) => {
      // Check if account exsists
      const host = await Host.findOne({ email: email.toLowerCase() });
      const cohost = await Cohost.findOne({ email: email.toLowerCase() });

      if (!(host || cohost)) throw new Error("Account not found");

      if (
        (host && !(await (host as any).comparePassword(password))) ||
        (cohost && !(await (cohost as any).comparePassword(password)))
      )
        throw new Error("Invalid password");

      // Successful authentication
      const account: {
        hostId: mongoose.Types.ObjectId;
        cohostId?: mongoose.Types.ObjectId;
        role: string;
      } = {
        hostId: (host ? host._id : cohost?.host) as mongoose.Types.ObjectId,
        role: host ? "Host" : "Cohost",
      };
      if (cohost) account.cohostId = cohost._id;

      return account;
    },
  },
  Mutation: {
    registerHost: async (_: unknown, { email, password, name }: any) => {
      // Check if account already exists
      if (await Host.findOne({ email }))
        throw new Error("Account already exists");
      const newHost = await new Host({ email, password, name }).save();

      // Assign a calendar to the host
      await new Calendar({ host: newHost._id }).save();

      // Assign a new AirBnB guest to the host
      await new Guest({
        host: newHost._id,
        name: "AirBnB",
        phone: "5555555555",
      }).save();

      return {
        hostId: newHost._id,
        cohostId: null,
        role: "Host",
      };
    },
    registerCohost: async (
      _: unknown,
      { host, email, password, name }: any
    ) => {
      // Check if account already exists
      if (await Cohost.findOne({ email }))
        throw new Error("Account already exists");
      const newCohost = await new Cohost({
        host,
        email,
        password,
        name,
      }).save();

      return {
        hostId: newCohost.host,
        cohostId: newCohost._id,
        role: "Cohost",
      };
    },
  },
};

export const resolvers = [
  generalResolvers,
  hostResolvers,
  cohostResolvers,
  calendarResolver,
  guestResolver,
  roomResolver,
  dayResolver,
  authenticationResolver,
];
