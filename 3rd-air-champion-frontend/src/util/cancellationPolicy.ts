// The one line worth showing before the fine print. A cancellation policy read
// at booking time is reassurance, not a warning — so the generous half leads and
// the refund tiers wait behind a tap.
export const cancellationHeadline = (fullRefundDays: number): string =>
  `Free cancellation up to ${fullRefundDays} days before check-in`;

export const formatCancellationPolicy = (fullRefundDays: number, halfRefundDays: number): string =>
  `We fully understand your plans can change, and TT House will be flexible with that. ` +
  `Full refund if you cancel ${fullRefundDays}+ days before check-in · ` +
  `50% refund if ${halfRefundDays}–${fullRefundDays - 1} days before · ` +
  `No refund within ${halfRefundDays} days. Feel free to reach out to us anytime!`;