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
