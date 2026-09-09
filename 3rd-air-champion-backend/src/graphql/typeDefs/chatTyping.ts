import gql from "graphql-tag";

export const chatTypingDefs = gql`
  type TypingState {
    guestTyping: Boolean!
    hostTyping: Boolean!
  }

  type Mutation {
    # Says "I am still typing" (or, with typing: false, "I have stopped") and
    # answers with the state of BOTH sides in the same round trip.
    #
    # One call rather than a set and a separate poll: this runs every couple of
    # seconds while a conversation is open, and the answer a client wants is
    # always "what is the other side doing right now".
    setChatTyping(
      host: String!
      phone: String!
      sender: String!
      typing: Boolean!
    ): TypingState!
  }
`;
