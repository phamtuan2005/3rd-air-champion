// GENERATED FILE — DO NOT EDIT.
//
// Copied from 3rd-air-champion-frontend/src/util/types/roomType.ts by
// scripts/sync-cleaning-rule.js, so TiMag and TiWork decide which rooms
// need cleaning with one piece of code instead of two that can disagree.
//
// Change the rule in the FRONTEND file and run `npm run build` (or
// `node scripts/sync-cleaning-rule.js`). Editing this copy is undone by
// the next build, and the drift test will fail in the meantime.

export interface roomType {
  id: string;
  name: string;
  price: number;
  roomCode: string;
  color?: string;
  active: boolean;
  photos?: string[];
  airbnbUrl?: string;
  checkInInstructions?: string;
}
