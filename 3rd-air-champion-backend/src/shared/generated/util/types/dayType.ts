// GENERATED FILE — DO NOT EDIT.
//
// Copied from 3rd-air-champion-frontend/src/util/types/dayType.ts by
// scripts/sync-cleaning-rule.js, so TiMag and TiWork decide which rooms
// need cleaning with one piece of code instead of two that can disagree.
//
// Change the rule in the FRONTEND file and run `npm run build` (or
// `node scripts/sync-cleaning-rule.js`). Editing this copy is undone by
// the next build, and the drift test will fail in the meantime.

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
