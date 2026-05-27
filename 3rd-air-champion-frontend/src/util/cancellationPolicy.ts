export const formatCancellationPolicy = (fullRefundDays: number, halfRefundDays: number): string =>
  `We fully understand your plans can change, and TT House will be flexible with that. ` +
  `Full refund if you cancel ${fullRefundDays}+ days before check-in · ` +
  `50% refund if ${halfRefundDays}–${fullRefundDays - 1} days before · ` +
  `No refund within ${halfRefundDays} days. Feel free to reach out to us anytime!`;