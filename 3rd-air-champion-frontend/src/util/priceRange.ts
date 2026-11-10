// What a guest with no agreed rate is told a room costs: a range, never one
// number.
//
// Until 2026-11 TiBook showed such a guest no price at all — "Hero was quoting
// the list price, so a first-time guest saw $75 / night for a number nobody
// had agreed with them" (see HeroShell's myRate). That kept the promise, but
// left a new guest with no idea whether a room was $50 or $150 until they had
// messaged the host. The house now shows a range instead: the room's own rate
// is the floor, and ten dollars above it the ceiling, so "Cozy $55–$65/night"
// for a room set at $55. The exact figure is still agreed with the host — the
// range is what that conversation will land inside, not a quote.
//
// One rule, used by the room cards, Hero, the gallery and TT, so no two
// screens can show a stranger different ranges for the same room. A rate the
// guest already HAS always wins over this; this is only for when there is none.

// How far above the room's own rate the range reaches.
export const PRICE_RANGE_SPREAD = 10;

export interface PriceRange {
  min: number;
  max: number;
}

// A room with no rate set (0, missing, nonsense) gets no range rather than a
// "$0–$10" that reads as a broken price: the screens fall back to saying the
// price is agreed with the host, as they did before ranges.
export const priceRangeOf = (roomRate: number | null | undefined): PriceRange | null => {
  const min = Number(roomRate);
  if (!Number.isFinite(min) || min <= 0) return null;
  // Cents rounded so $54.90 + $10 cannot print as $64.900000001.
  return { min, max: Math.round((min + PRICE_RANGE_SPREAD) * 100) / 100 };
};

const money = (n: number) => `$${Number.isInteger(n) ? n : n.toFixed(2)}`;

// "$55–$65". The dollar sign and digits read the same in every language
// TiBook speaks, so the range itself is not translated; the words around it are.
export const priceRangeText = (r: PriceRange): string => `${money(r.min)}–${money(r.max)}`;
