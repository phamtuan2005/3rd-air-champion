import gql from "graphql-tag";

const generalDefs = gql`
  type Query {
    greetings: String
  }
`;

const hostDefs = gql`
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
    ): Host!
    deleteCohosts(_id: String!, cohostIds: [String]!): Host!
    deleteGuests(_id: String!, guestIds: [String!]!): Host!
    deleteRooms(_id: String!, roomIds: [String!]!): Host!
  }
`;

const cohostDefs = gql`
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

const calendarDefs = gql`
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

const guestDefs = gql`
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

const roomDefs = gql`
  type Room {
    id: ID!
    host: ID!
    name: String!
    price: Float!
    createdAt: String
    updatedAt: String
  }

  type Query {
    rooms: [Room]
    roomsHost(host: String!): [Room]
    room(_id: String!): Room!
  }

  type Mutation {
    createRoom(host: String!, name: String!, price: Float!): Room!
    updateRoom(_id: String!, name: String, price: Float): Room!
  }
`;

const dayDefs = gql`
  scalar Date

  type Bookings {
    id: ID
    alias: String
    price: Float
    airbnbPrice: Float
    guest: Guest
    notes: String
    room: Room
    description: String
    duration: Int
    numberOfGuests: Int
    startDate: Date
    endDate: Date
  }

  type Day {
    id: ID!
    calendar: ID!
    date: Date!
    isAirBnB: Boolean
    isBlocked: Boolean
    bookings: [Bookings]
    numberOfGuests: Int
    blockedRooms: [Room]
    createdAt: String
    updatedAt: String
  }

  type AirBnBBookingCount {
    Alias: String
    RoomObjectId: String
    DistinctStartDateCount: Int
  }

  input UnbookBookingInput {
    room: String!
    date: String!
  }

  type Query {
    days: [Day]
    day(_id: String!): Day!
    hostDays(calendarId: String!): [Day]
    airBnBDays(calendar: String!, guest: String!): [Day]
    airBnBBookingCount(guest: String!): [AirBnBBookingCount]
  }

  type Mutation {
    blockDay(calendar: String!, date: String!): Day!
    blockManyDays(calendar: String!, dates: [String!]!): [Day!]!
    blockRange(calendar: String!, date: String!, duration: Int!): [Day!]!

    blockRoom(
      calendar: String!
      room: String!
      date: String!
      duration: Int!
    ): [Day]

    unblockDay(calendar: String!, date: String!): Day
    unblockManyDays(calendar: String!, dates: [String!]!): [Day]
    unblockRange(calendar: String!, startDate: String!, endDate: String!): [Day]

    bookDays(
      calendar: String!
      date: String!
      guest: String!
      isAirBnB: Boolean!
      numberOfGuests: Int!
      room: String!
      duration: Int!
    ): [Day]

    bookAirBnB(
      calendar: String!
      date: String!
      guest: String!
      description: String!
      room: String!
      duration: Int!
    ): [Day]

    unbookAirBnB(
      calendar: String!
      guest: String!
      bookings: [UnbookBookingInput!]!
    ): Boolean!

    updateBookingGuest(
      _id: String!
      alias: String
      notes: String
      numberOfGuests: Int
    ): [Day]

    updateBookingAirbnbPrice(
      _id: String!
      airbnbPrice: Float!
    ): [Day]

    unbookGuest(_id: String!): [Day]

    updateDay(
      _id: String!
      isAirBnB: Boolean
      isBlocked: Boolean
      room: String
      guest: String
    ): Day!
  }
`;

const authenticationDefs = gql`
  type Account {
    hostId: ID!
    cohostId: ID
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

export const typeDefs = [
  generalDefs,
  hostDefs,
  cohostDefs,
  calendarDefs,
  guestDefs,
  roomDefs,
  dayDefs,
  authenticationDefs,
];
