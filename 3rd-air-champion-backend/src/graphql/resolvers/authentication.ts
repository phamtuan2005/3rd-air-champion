import Host from "../../model/hostSchema";
import Cohost from "../../model/cohostSchema";
import Calendar from "../../model/calendarSchema";
import Guest from "../../model/guestSchema";
import mongoose from "mongoose";

export const authenticationResolvers = {
  Query: {
    login: async (_: unknown, { email, password }: any) => {
      const host = await Host.findOne({ email: email.toLowerCase() });
      const cohost = await Cohost.findOne({ email: email.toLowerCase() });

      if (!(host || cohost)) throw new Error("Account not found");

      if (
        (host && !(await (host as any).comparePassword(password))) ||
        (cohost && !(await (cohost as any).comparePassword(password)))
      )
        throw new Error("Invalid password");

      const account: {
        hostId: mongoose.Types.ObjectId;
        cohostId?: mongoose.Types.ObjectId;
        cohostName?: string;
        role: string;
      } = {
        hostId: (host ? host._id : cohost?.host) as mongoose.Types.ObjectId,
        role: host ? "Host" : "Cohost",
      };
      if (cohost) {
        account.cohostId = cohost._id;
        account.cohostName = cohost.name;
      }

      /**
       * Temporary fix to prototype TiBook — update once TiBook concept is fully established
       */
      if (host?.email === "tibook@mock.com") account.role = "TiBook";

      return account;
    },
  },
  Mutation: {
    registerHost: async (_: unknown, { email, password, name }: any) => {
      if (await Host.findOne({ email })) throw new Error("Account already exists");
      const newHost = await new Host({ email, password, name }).save();

      await new Calendar({ host: newHost._id }).save();
      await new Guest({ host: newHost._id, name: "AirBnB", phone: "5555555555" }).save();

      return { hostId: newHost._id, cohostId: null, role: "Host" };
    },
    registerCohost: async (_: unknown, { host, email, password, name }: any) => {
      if (await Cohost.findOne({ email })) throw new Error("Account already exists");
      const newCohost = await new Cohost({ host, email, password, name }).save();

      return { hostId: newCohost.host, cohostId: newCohost._id, role: "Cohost" };
    },
  },
};