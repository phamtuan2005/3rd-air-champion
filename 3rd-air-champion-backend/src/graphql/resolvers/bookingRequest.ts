import BookingRequest from "../../model/bookingRequestSchema";
import { phoneRegex } from "../../util/usPhone";
import { createBookingRequest } from "../../util/createBookingRequest";

export const bookingRequestResolvers = {
  Query: {
    bookingRequests: async () => {
      return await BookingRequest.find();
    },
    bookingRequest: async (_: unknown, { _id }: any) => {
      return await BookingRequest.findById(_id);
    },
    bookingRequestsByHost: async (_: unknown, { hostId }: any) => {
      return await BookingRequest.find({ host: hostId });
    },
    bookingRequestsByGuest: async (_: unknown, { hostId, phone }: any) => {
      return await BookingRequest.find({
        host: hostId,
        guestPhone: { $regex: phoneRegex(phone) },
        status: { $in: ["pending", "confirmed", "reserved"] },
      }).sort({ date: 1 });
    },
  },
  Mutation: {
    createBookingRequest: async (
      _: unknown,
      { host, guestName, guestPhone: typedPhone, date, room, duration, numberOfGuests, notes }: any
    ) => {
      // Written by util/createBookingRequest, which the assistant connector
      // also uses, so a request reads the same whichever door it came in by.
      return await createBookingRequest({ host, guestName, guestPhone: typedPhone, date, room, duration, numberOfGuests, notes });
    },
    updateBookingRequest: async (_: unknown, { _id, status }: any) => {
      return await BookingRequest.findByIdAndUpdate(
        _id,
        { status },
        { runValidators: true, new: true }
      );
    },
    deleteBookingRequest: async (_: unknown, { _id }: any) => {
      const deleted = await BookingRequest.findByIdAndDelete(_id);
      return deleted !== null;
    },
  },
};