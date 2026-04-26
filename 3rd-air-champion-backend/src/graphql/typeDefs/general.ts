import gql from "graphql-tag";

export const generalDefs = gql`
  type Query {
    greetings: String
  }
`;