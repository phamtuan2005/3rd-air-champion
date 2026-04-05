import { guestType } from "./guestType";
import { roomType } from "./roomType";

export interface bookingType {
  id: string;
  alias: string;
  price: number;
  notes: string;
  earlyCheckin: boolean;
  guest: guestType;
  room: roomType;
  description: string;
  duration: number;
  numberOfGuests: number;
  startDate: string;
  endDate: string;
}
