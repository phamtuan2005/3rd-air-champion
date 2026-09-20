import { feeType } from "./types/bookingType";

// The discount a long-staying guest has earned, as money off the stay.
//
// The house gives it per NIGHT — "five dollars a night off" is how it is
// agreed with a nurse who has been here two years — but a booking records it
// as ONE per-stay fee with a negative amount, because that is the mechanism
// that already exists end to end: stored on every night, counted once, shown
// itemised in the guest's confirmation text, and carried into the month's
// money without a second code path.
//
// So the number typed is per night, and the number stored is the whole stay.
// Keeping that conversion in one tested place is the point of this file: the
// booking modal, the confirmation text and the stored fee must never disagree
// about what a $5 discount on six nights comes to.
export const LOYALTY_FEE_LABEL = "Loyalty discount";

// The loyalty discount sits apart from every other fee in the confirmation
// text: parking and cleaning are itemised with the rooms and are part of what
// the stay costs, while the discount is subtracted from that cost afterwards.
// The house asked for it to read as arithmetic —
//
//   Total price = $600
//   Loyalty discount = -$30
//   To pay = $570
//
// so the composer needs the two kinds of fee apart. Splitting by label is
// enough because the label is written in exactly one place (LOYALTY_FEE_LABEL).
export const splitLoyalty = (
  fees: feeType[],
): { loyaltySum: number; otherFees: feeType[] } => {
  let loyaltyCents = 0;
  const otherFees: feeType[] = [];
  for (const fee of fees) {
    const amount = Number(fee.amount) || 0;
    if (fee.label === LOYALTY_FEE_LABEL) loyaltyCents += Math.round(amount * 100);
    else otherFees.push(fee);
  }
  return { loyaltySum: loyaltyCents / 100, otherFees };
};

export const loyaltyFee = (perNight: number, nights: number): feeType | null => {
  // A blank input, a zero, or a negative typed by accident all mean "no
  // discount" rather than "a charge". Nothing here may ever ADD money.
  const rate = Number(perNight);
  if (!Number.isFinite(rate) || rate <= 0) return null;
  if (!Number.isFinite(nights) || nights <= 0) return null;

  // Cents, not floats: 4.35 * 3 is 13.049999999999999 in binary floating point,
  // and a stay's discount is money somebody reconciles by hand.
  const cents = Math.round(rate * 100) * nights;
  if (cents <= 0) return null;

  return { label: LOYALTY_FEE_LABEL, amount: -(cents / 100) };
};
