import gql from "graphql-tag";

export const calendarDefs = gql`
  type Calendar {
    id: ID!
    host: ID!
    createdAt: String
    updatedAt: String
  }

  type Query {
    calendars: [Calendar]
    calendar(_id: String!): Calendar!
  }

  type Mutation {
    createCalendar(host: String!): Calendar!
  }
`;