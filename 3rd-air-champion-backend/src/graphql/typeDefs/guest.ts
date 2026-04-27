import gql from "graphql-tag";

export const guestDefs = gql`
  type Prcicing {
    id: ID
    room: ID
    price: Float
  }

  type Guest {
    id: ID!
    name: String!
    alias: String
    email: String
    phone: String!
    pricing: [Prcicing]
    numberOfGuests: Int
    returning: Boolean
    notes: String
    host: ID!
    createdAt: String
    updatedAt: String
  }

  type Query {
    guests: [Guest]
    guestsHost(host: String!): [Guest]
    guest(_id: String!): Guest!
    guestByPhone(host: String!, phone: String!): Guest
  }

  type Mutation {
    createGuest(
      name: String!
      email: String
      phone: String!
      numberOfGuests: Int
      returning: Boolean
      notes: String
      host: String!
    ): Guest!

    updateGuestPricing(guest: String!, room: String, price: Float): Guest!

    updateGuest(
      _id: String!
      name: String
      email: String
      phone: String
      numberOfGuests: Int
      returning: Boolean
      notes: String
    ): Guest!
  }
`;