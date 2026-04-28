import gql from "graphql-tag";

export const authenticationDefs = gql`
  type Account {
    hostId: ID!
    cohostId: ID
    cohostName: String
    role: String!
  }

  type Query {
    login(email: String!, password: String!): Account!
  }

  type Mutation {
    registerHost(email: String!, password: String!, name: String!): Account!
    registerCohost(
      host: String!
      email: String!
      password: String!
      name: String!
    ): Account!
  }
`;