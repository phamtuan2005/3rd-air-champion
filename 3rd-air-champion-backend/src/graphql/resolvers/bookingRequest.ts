import BookingRequest from "../../model/bookingRequestSchema";

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
  },
  Mutation: {
    createBookingRequest: async (
      _: unknown,
      { host, guestName, guestPhone, date, room, duration, numberOfGuests, notes }: any
    ) => {
      const existing = await BookingRequest.findOne({
        host,
        guestPhone,
        date: new Date(date),
        room,
        duration,
        numberOfGuests,
        status: "pending",
      });
      if (existing) return existing;

      return await new BookingRequest({
        host,
        guestName,
        guestPhone,
        date,
        room,
        duration,
        numberOfGuests,
        status: "pending",
        notes: notes ?? "",
      }).save();
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