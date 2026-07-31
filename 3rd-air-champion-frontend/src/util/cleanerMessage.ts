// The TT House brand promise, sent to cleaners the same way every time so the
// slogan reaches them consistently. Kept in ONE place so the wording never
// drifts between the Cleaning modal and the ToDo list.

// The slogan line itself — used to close messages that have their own custom
// lead-in (e.g. a raise announcement, a rules reminder).
export const TT_PROMISE_LINE = `"Your comfort. Our mission." 🏠 — Anh-Tuan`;

// The standard sign-off (gratitude + the promise) appended to routine cleaner
// messages (weekly schedule, pay summary, today's cleaning list).
export const CLEANER_SIGNOFF = [
  `Thank you for your wonderful work! Together, we work hard so our guests always feel comfortable — that is TT House's promise to every guest:`,
  TT_PROMISE_LINE,
].join("\n");
