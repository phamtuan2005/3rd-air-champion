import Host from "../../model/hostSchema";
import Cohost from "../../model/cohostSchema";
import Guest from "../../model/guestSchema";
import Room from "../../model/roomSchema";
import { AIRBNB_SYNC_HOST_ID, MAIN_HOST_ID } from "../../util/hostRedirect";

export const hostResolvers = {
  Query: {
    hosts: async () => {
      return await Host.find({ email: { $not: /tibook@mock.com/ } }).sort({ name: 1 });
    },
    host: async (_: unknown, { _id }: any) => {
      const hostData = await Host.findById(_id);
      if (!hostData) throw new Error("Host not found");

      if (_id === AIRBNB_SYNC_HOST_ID) {
        const mainHost = await Host.findById(MAIN_HOST_ID);
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
      { _id, email, name, password, airbnbsync, doorCode, airbnbName, airbnbAddress, airbnbRating, airbnbReviewCount, airbnbReviewsUrl, airbnbProfileUrl, cohostProfileUrls, airbnbSuperhost, highlights, houseRules, cleaningRules, phone, contactEmail, licenseNumber, cancellationFullRefundDays, cancellationHalfRefundDays }: any
    ) => {
      const updateData: {
        email?: string;
        name?: string;
        password?: string;
        airbnbsync?: any;
        doorCode?: string;
        airbnbName?: string;
        airbnbAddress?: string;
        airbnbRating?: number;
        airbnbReviewCount?: number;
        airbnbReviewsUrl?: string;
        airbnbProfileUrl?: string;
        cohostProfileUrls?: string[];
        airbnbSuperhost?: boolean;
        highlights?: string[];
        houseRules?: string;
        cleaningRules?: string;
        phone?: string;
        contactEmail?: string;
        licenseNumber?: string;
        cancellationFullRefundDays?: number;
        cancellationHalfRefundDays?: number;
      } = {};
      if (email) updateData.email = email;
      if (name) updateData.name = name;
      if (password) updateData.password = password;
      // One entry per room, enforced here rather than trusted from the client.
      //
      // The list is posted wholesale from a browser's localStorage, so any
      // device still holding a stale copy re-uploads it — King accumulated
      // three identical entries that way, and cleaning the collection by hand
      // only lasted until the next Room Link modal opened. Later entries win,
      // matching how autoSync reads the list.
      if (airbnbsync) {
        const parsed = JSON.parse(airbnbsync);
        const byRoom = new Map<string, any>();
        for (const entry of Array.isArray(parsed) ? parsed : []) {
          if (entry?.room && entry?.link) byRoom.set(entry.room.toString(), entry);
        }
        updateData.airbnbsync = [...byRoom.values()];
      }
      if (doorCode !== undefined) updateData.doorCode = doorCode;
      if (airbnbName !== undefined) updateData.airbnbName = airbnbName;
      if (airbnbAddress !== undefined) updateData.airbnbAddress = airbnbAddress;
      if (airbnbRating !== undefined) updateData.airbnbRating = airbnbRating;
      if (airbnbReviewCount !== undefined) updateData.airbnbReviewCount = airbnbReviewCount;
      if (airbnbReviewsUrl !== undefined) updateData.airbnbReviewsUrl = airbnbReviewsUrl;
      if (airbnbProfileUrl !== undefined) updateData.airbnbProfileUrl = airbnbProfileUrl;
      if (cohostProfileUrls !== undefined) updateData.cohostProfileUrls = cohostProfileUrls;
      if (airbnbSuperhost !== undefined) updateData.airbnbSuperhost = airbnbSuperhost;
      if (highlights !== undefined) updateData.highlights = highlights;
      if (houseRules !== undefined) updateData.houseRules = houseRules;
      if (cleaningRules !== undefined) updateData.cleaningRules = cleaningRules;
      if (phone !== undefined) updateData.phone = phone;
      if (contactEmail !== undefined) updateData.contactEmail = contactEmail;
      if (licenseNumber !== undefined) updateData.licenseNumber = licenseNumber;
      if (cancellationFullRefundDays !== undefined) updateData.cancellationFullRefundDays = cancellationFullRefundDays;
      if (cancellationHalfRefundDays !== undefined) updateData.cancellationHalfRefundDays = cancellationHalfRefundDays;

      return await Host.findByIdAndUpdate(_id, { $set: updateData }, {
        new: true,
        runValidators: true,
      });
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