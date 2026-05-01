import gql from "graphql-tag";

export const roomDefs = gql`
  type Room {
    id: ID!
    host: ID!
    name: String!
    price: Float!
    roomCode: String
    color: String
    active: Boolean
    photos: [String]
    airbnbUrl: String
    createdAt: String
    updatedAt: String
  }

  type Query {
    rooms: [Room]
    roomsHost(host: String!): [Room]
    room(_id: String!): Room!
  }

  type Mutation {
    createRoom(host: String!, name: String!, price: Float!, roomCode: String, color: String): Room!
    updateRoom(_id: String!, name: String, price: Float, roomCode: String, color: String, active: Boolean, photos: [String], airbnbUrl: String): Room!
  }
`;