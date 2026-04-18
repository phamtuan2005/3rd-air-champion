import { bookingType } from "./bookingType";
import { roomType } from "./roomType";

export interface dayType {
  id: string;
  blockedRooms: roomType[];
  bookings: bookingType[];
  isBlocked: boolean;
  isAirBnB: boolean;
  date: Date;
  numberOfGuests: number;
}
