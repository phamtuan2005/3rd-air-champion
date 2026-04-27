import Calendar from "../../model/calendarSchema";

export const calendarResolvers = {
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