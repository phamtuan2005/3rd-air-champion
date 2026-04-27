import Host from "../../model/hostSchema";

export const generalResolvers = {
  Query: {
    greetings: () => "GraphQL is Awesome",
    hosts: async () => {
      return await Host.find();
    },
  },
};