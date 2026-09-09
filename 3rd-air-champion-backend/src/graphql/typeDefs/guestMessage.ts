import gql from "graphql-tag";

export const guestMessageDefs = gql`
  type GuestMessage {
    id: ID!
    host: ID!
    guestName: String!
    guestPhone: String!
    sender: String!
    body: String!
    readByHost: Boolean!
    readByGuest: Boolean!
    createdAt: String!
    updatedAt: String!
  }

  # One guest's conversation, newest last. Carries the guest's name and the
  # unread count so the host's inbox list needs one query rather than one per
  # thread.
  type GuestMessageThread {
    guestName: String!
    guestPhone: String!
    lastBody: String!
    lastSender: String!
    lastAt: String!
    unreadForHost: Int!
    total: Int!
  }

  type Query {
    guestMessages(hostId: String!, phone: String!): [GuestMessage]
    guestMessageThreads(hostId: String!): [GuestMessageThread]
  }

  type Mutation {
    sendGuestMessage(host: String!, guestName: String!, guestPhone: String!, sender: String!, body: String!): GuestMessage!
    markGuestMessagesRead(hostId: String!, phone: String!, reader: String!): Int!
  }
`;
