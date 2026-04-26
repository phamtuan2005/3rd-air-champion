import gql from "graphql-tag";

export const cohostDefs = gql`
  type Cohost {
    id: ID!
    email: String!
    password: String!
    name: String!
    host: ID!
    createdAt: String
    updatedAt: String
  }

  type Query {
    cohosts: [Cohost]
    cohost(_id: String!): Cohost!
  }

  type Mutation {
    createCohost(
      email: String!
      name: String!
      password: String!
      host: String!
    ): Cohost!
    updateCohost(
      _id: String!
      email: String
      name: String
      password: String
    ): Cohost!
  }
`;