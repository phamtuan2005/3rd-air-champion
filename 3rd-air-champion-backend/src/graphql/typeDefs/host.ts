import gql from "graphql-tag";

export const hostDefs = gql`
  type AirBnBSync {
    room: ID
    link: String
  }

  type Host {
    id: ID!
    email: String!
    password: String!
    name: String!
    rooms: [ID]
    airbnbsync: [AirBnBSync]
    calendar: ID
    guests: [ID]
    cohosts: [ID]
    doorCode: String
    airbnbName: String
    airbnbAddress: String
    airbnbRating: Float
    airbnbReviewCount: Int
    airbnbSuperhost: Boolean
    highlights: [String]
    houseRules: String
    phone: String
    contactEmail: String
    licenseNumber: String
    createdAt: String
    updatedAt: String
  }

  type Query {
    hosts: [Host]
    host(_id: String!): Host!
  }

  type Mutation {
    createHost(email: String!, name: String!, password: String!): Host!
    updateHost(
      _id: String!
      email: String
      name: String
      password: String
      airbnbsync: String
      doorCode: String
      airbnbName: String
      airbnbAddress: String
      airbnbRating: Float
      airbnbReviewCount: Int
      airbnbSuperhost: Boolean
      highlights: [String]
      houseRules: String
      phone: String
      contactEmail: String
      licenseNumber: String
    ): Host!
    deleteCohosts(_id: String!, cohostIds: [String]!): Host!
    deleteGuests(_id: String!, guestIds: [String!]!): Host!
    deleteRooms(_id: String!, roomIds: [String!]!): Host!
  }
`;