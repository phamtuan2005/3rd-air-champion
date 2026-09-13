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
  // A sofa bed to make up. Per booking, not per guest — the same guest may
  // want it one stay and not the next. It exists mainly so the CLEANER knows
  // there is a bed to make that the room does not normally have.
  sofaBed?: boolean;
  guest: guestType;
  room: roomType;
  description: string;
  duration: number;
  numberOfGuests: number;
  startDate: string;
  endDate: string;
  airbnbBlocked: boolean;
  reserved?: boolean;
  // yyyy-MM-dd the guest said they would send payment for a HELD stay. "" until
  // asked. Per stay, stored on every night — read it from the start night.
  expectedPayDate?: string;
  // yyyy-MM-dd this booking was CREATED — stamped on direct bookings and on
  // AirBnB-synced ones alike. "" on anything that predates the field.
  //
  // It exists here to settle which of two bookings on the same room and night
  // is the live one: a guest cancels, another books the same night, and the
  // cancelled stay stays in the day's record. The newer booking is the one the
  // house is actually serving.
  bookedOn?: string;
}

// Sum of a booking's extra fees — counted ONCE per stay (fees are stored on
// every night's copy but represent one whole-stay charge).
export const feesTotal = (fees?: feeType[] | null): number =>
  (fees ?? []).reduce((sum, f) => sum + (Number(f.amount) || 0), 0);
