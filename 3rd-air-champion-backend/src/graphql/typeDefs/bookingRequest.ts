import gql from "graphql-tag";

export const bookingRequestDefs = gql`
  type BookingRequest {
    id: ID!
    host: ID!
    guestName: String!
    guestPhone: String!
    date: Date!
    room: ID!
    duration: Int!
    numberOfGuests: Int!
    status: String!
    notes: String
    createdAt: String!
    updatedAt: String!
  }

  type Query {
    bookingRequests: [BookingRequest]
    bookingRequest(_id: String!): BookingRequest!
    bookingRequestsByHost(hostId: String!): [BookingRequest]
  }

  type Mutation {
    createBookingRequest(host: String!, guestName: String!, guestPhone: String!, date: Date!, room: String!, duration: Int!, numberOfGuests: Int!, notes: String): BookingRequest!
    updateBookingRequest(_id: String!, status: String!): BookingRequest!
    deleteBookingRequest(_id: String!): Boolean!
  }
`;