import Room from "../../model/roomSchema";
import { redirectHost } from "../../util/hostRedirect";

export const roomResolvers = {
  Query: {
    rooms: async () => {
      return await Room.find().sort({ name: 1 });
    },
    roomsHost: async (_: unknown, { host }: any) => {
      return await Room.find({ host: redirectHost(host) }).sort({ name: 1 });
    },
    room: async (_: unknown, { _id }: any) => {
      return await Room.findById(_id);
    },
  },
  Mutation: {
    createRoom: async (_: unknown, { host, name, price, roomCode, color }: any) => {
      const roomData: { host: string; name: string; price: number; roomCode?: string; color?: string } = {
        host: redirectHost(host),
        name,
        price,
      };
      if (roomCode !== undefined) roomData.roomCode = roomCode;
      if (color !== undefined) roomData.color = color;
      return await new Room(roomData).save();
    },
    updateRoom: async (_: unknown, { _id, name, price, roomCode, color, active, photos, airbnbUrl, checkInInstructions }: any) => {
      const updatedData: {
        name?: string;
        price?: number;
        roomCode?: string;
        color?: string;
        active?: boolean;
        photos?: string[];
        airbnbUrl?: string;
        checkInInstructions?: string;
      } = {};
      if (name !== undefined) updatedData.name = name;
      if (price !== undefined) updatedData.price = price;
      if (roomCode !== undefined) updatedData.roomCode = roomCode;
      if (color !== undefined) updatedData.color = color;
      if (active !== undefined) updatedData.active = active;
      if (photos !== undefined) updatedData.photos = photos;
      if (airbnbUrl !== undefined) updatedData.airbnbUrl = airbnbUrl;
      if (checkInInstructions !== undefined) updatedData.checkInInstructions = checkInInstructions;

      return await Room.findByIdAndUpdate(_id, { $set: updatedData }, {
        runValidators: true,
        new: true,
      });
    },
  },
};