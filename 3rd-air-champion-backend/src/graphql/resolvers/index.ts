import { generalResolvers } from "./general";
import { hostResolvers } from "./host";
import { cohostResolvers } from "./cohost";
import { calendarResolvers } from "./calendar";
import { guestResolvers } from "./guest";
import { roomResolvers } from "./room";
import { dayResolvers } from "./day";
import { authenticationResolvers } from "./authentication";
import { bookingRequestResolvers } from "./bookingRequest";

export const resolvers = [
  generalResolvers,
  hostResolvers,
  cohostResolvers,
  calendarResolvers,
  guestResolvers,
  roomResolvers,
  dayResolvers,
  authenticationResolvers,
  bookingRequestResolvers,
];