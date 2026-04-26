import Cohost from "../../model/cohostSchema";

export const cohostResolvers = {
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
      const cohost = new Cohost({ email, name, password, host });
      return await cohost.save();
    },
    updateCohost: async (_: unknown, { _id, email, name, password }: any) => {
      const updateData: { email?: string; name?: string; password?: string } = {};
      if (email) updateData.email = email;
      if (name) updateData.name = name;
      if (password) updateData.password = password;

      return await Cohost.findByIdAndUpdate(_id, updateData, {
        new: true,
        runValidators: true,
      });
    },
  },
};