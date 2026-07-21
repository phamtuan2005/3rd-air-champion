import { guestType } from "./guestType";
import { roomType } from "./roomType";

// Per-stay extra charge on a direct booking (parking, cleaning, cancellation,
// …). amount may be negative for a discount.
export interface feeType {
  label: string;
  amount: number;
}

export interface bookingType {
  id: string;
  alias: string;
  price: number;
  airbnbPrice: number;
  fees?: feeType[];
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

// Sum of a booking's extra fees — counted ONCE per stay (fees are stored on
// every night's copy but represent one whole-stay charge).
export const feesTotal = (fees?: feeType[] | null): number =>
  (fees ?? []).reduce((sum, f) => sum + (Number(f.amount) || 0), 0);
