// GENERATED FILE — DO NOT EDIT.
//
// Copied from 3rd-air-champion-frontend/src/util/types/guestType.ts by
// scripts/sync-cleaning-rule.js, so TiMag and TiWork decide which rooms
// need cleaning with one piece of code instead of two that can disagree.
//
// Change the rule in the FRONTEND file and run `npm run build` (or
// `node scripts/sync-cleaning-rule.js`). Editing this copy is undone by
// the next build, and the drift test will fail in the meantime.

import { pricingType } from "./pricingType";

export interface guestType {
  id: string;
  name: string;
  alias: string;
  notes: string;
  // Short note the illustrated avatar is generated from. Empty means plain
  // initials — see util/guestAvatars.
  character?: string;
  pricing: pricingType[];
  numberOfGuests: number;
  phone: string;
  returning: boolean;
  email: string;
}
