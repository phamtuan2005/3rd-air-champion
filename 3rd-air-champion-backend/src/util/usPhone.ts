// "+1 408 306 2219" and "408 306 2219" are one guest (host, 2026-10-20).
//
// A guest's number reached the database with and without the +1 depending on
// which form they used and how their phone autofilled it. Every lookup here
// compares digits, and "14083062219" is not "4083062219": the same person came
// back as a stranger — no rate, no bookings found, a second message thread.
//
// Only a typed "+1" is dropped. A bare "1408…" is left alone: an eleven-digit
// number starting with 1 is also every Chinese mobile, typed without its +86,
// and dropping its first digit would store somebody else's number. Any other
// country code is kept exactly as typed — without it the number cannot be
// dialled or texted from here.

/** The number without its +1, formatting kept: "+1 (408) 306-2219" → "(408) 306-2219". Anything else unchanged. */
export const dropUsCountryCode = (raw: string): string => {
  const text = String(raw ?? "");
  const m = text.match(/^\s*\+\s*1[\s.\-]*(.*)$/s);
  if (!m) return text;
  // Exactly ten digits after it, or it is not a US number with a +1 on it —
  // "+1" on its own while the guest is still typing, say, stays as it is.
  return m[1].replace(/\D/g, "").length === 10 ? m[1].trim() : text;
};

/** The digits a phone is compared by, +1 dropped — so old rows stored with it still match. */
export const phoneKey = (raw: string): string => dropUsCountryCode(raw).replace(/\D/g, "");

/**
 * Finds a stored phone with these digits whatever punctuation sits between
 * them. Unanchored, so a row stored as "+14083062219" before the +1 was dropped
 * is still found by "4083062219".
 */
export const phoneRegex = (raw: string): RegExp => new RegExp(phoneKey(raw).split("").join("\\D*"));
