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
  // Dollars off each night, for a guest who has earned it. 0 or absent means
  // none. A booking turns it into one per-stay fee — see loyaltyDiscount.ts.
  loyaltyDiscountPerNight?: number;
  returning: boolean;
  email: string;
}
