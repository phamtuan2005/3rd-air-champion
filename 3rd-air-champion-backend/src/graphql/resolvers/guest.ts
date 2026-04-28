import Guest from "../../model/guestSchema";
import { redirectHost } from "../../util/hostRedirect";

export const guestResolvers = {
  Query: {
    guests: async () => {
      return await Guest.find();
    },
    guestsHost: async (_: unknown, { host }: any) => {
      return await Guest.find({ host: redirectHost(host) });
    },
    guestByPhone: async (_: unknown, { host, phone }: any) => {
      const digits = phone.replace(/\D/g, "");
      const phoneRegex = new RegExp(digits.split("").join("\\D*"));
      return await Guest.findOne({ host: redirectHost(host), phone: { $regex: phoneRegex } });
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
      } = { name, phone, host: redirectHost(host) };
      if (email) guestData.email = email;
      if (numberOfGuests) guestData.numberOfGuests = numberOfGuests;
      if (returning) guestData.returning = returning;
      if (notes) guestData.notes = notes;
      return await new Guest(guestData).save();
    },
    updateGuestPricing: async (_: unknown, { guest, room, price }: any) => {
      const guestData = await Guest.findOne({ _id: guest, "pricing.room": room });

      if (guestData) {
        await Guest.updateOne(
          { _id: guest, "pricing.room": room },
          { $set: { "pricing.$.price": price } }
        );
      } else {
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

      return await Guest.findByIdAndUpdate(_id, updateData, {
        new: true,
        runValidators: true,
      });
    },
  },
};