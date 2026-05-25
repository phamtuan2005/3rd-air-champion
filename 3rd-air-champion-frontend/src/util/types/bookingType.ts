import { guestType } from "./guestType";
import { roomType } from "./roomType";

export interface bookingType {
  id: string;
  alias: string;
  price: number;
  airbnbPrice: number;
  notes: string;
  earlyCheckin: boolean;
  lateCheckout: boolean;
  guest: guestType;
  room: roomType;
  description: string;
  duration: number;
  numberOfGuests: number;
  startDate: string;
  endDate: string;
  airbnbBlocked: boolean;
  reserved?: boolean;
}
