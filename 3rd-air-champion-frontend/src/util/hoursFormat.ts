// Worked time, the way people actually say it.
//
// The backend stores decimal hours because pay is hours × rate, but nobody
// works "1.58333 hours" — they work an hour and thirty-five minutes. Every
// screen that shows or collects worked time goes through here, so TiMag and
// TiWork can never render the same figure two different ways.

// "3h 15m" from decimal hours. Whole hours drop the minutes and sub-hour times
// drop the hours, so a short visit reads "45m" rather than "0h 45m".
export const formatHrMin = (dec: number): string => {
  const total = Math.round((dec ?? 0) * 60);
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
};

// The two halves of an hours+minutes input, back to what the backend stores.
export const hmToDecimal = (h?: string, m?: string): number =>
  (parseFloat(h ?? "") || 0) + (parseFloat(m ?? "") || 0) / 60;

// Decimal hours split for editing. Rounded to the minute first, so a stored
// 1.5833333 opens as 1h 35m rather than 1h 34.9999m.
export const decimalToHm = (dec: number): { h: string; m: string } => {
  const total = Math.round((dec ?? 0) * 60);
  return { h: String(Math.floor(total / 60)), m: String(total % 60) };
};
