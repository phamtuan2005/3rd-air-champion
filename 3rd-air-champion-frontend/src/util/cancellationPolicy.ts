// A translator for the policy's sentences. TiBook passes its own t() so a
// German guest reads it in German; TiMag passes nothing and gets the English it
// always had. Not wired to TiBook's language directly, because TiMag quotes the
// same policy in the messages the host sends, and those stay English whatever
// language TiBook was last left in on that device.
type Translate = (en: string, vars?: Record<string, string | number>) => string;
const asIs: Translate = (s, vars) =>
  vars ? s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : s;

// The one line worth showing before the fine print. A cancellation policy read
// at booking time is reassurance, not a warning — so the generous half leads and
// the refund tiers wait behind a tap.
export const cancellationHeadline = (fullRefundDays: number, tr: Translate = asIs): string =>
  tr("Free cancellation up to {days} days before check-in", { days: fullRefundDays });

export const formatCancellationPolicy = (fullRefundDays: number, halfRefundDays: number, tr: Translate = asIs): string =>
  tr("We fully understand your plans can change, and TT House will be flexible with that.") + " " +
  tr("Full refund if you cancel {full}+ days before check-in", { full: fullRefundDays }) + " · " +
  tr("50% refund if {half}–{last} days before", { half: halfRefundDays, last: fullRefundDays - 1 }) + " · " +
  tr("No refund within {half} days.", { half: halfRefundDays }) + " " +
  tr("Feel free to reach out to us anytime!");
