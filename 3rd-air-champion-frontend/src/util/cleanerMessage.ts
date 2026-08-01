// The TT House brand promise, sent to cleaners the same way every time so the
// slogan reaches them consistently. Kept in ONE place so the wording never
// drifts between the Cleaning modal and the ToDo list.
//
// The sign-off is signed by whoever is SENDING (Anh-Tuan or the logged-in cohost,
// e.g. Cindy) — pass their name; the first name is used and it falls back to
// Anh-Tuan when unknown.

const signerFirstName = (sender?: string) => (sender || "").trim().split(" ")[0] || "Anh-Tuan";

// The slogan line — used to close messages that have their own custom lead-in
// (e.g. a raise announcement, a rules reminder).
export const ttPromiseLine = (sender?: string) =>
  `"Your comfort. Our mission." 🏠 — ${signerFirstName(sender)}`;

// The standard sign-off (gratitude + the promise) appended to routine cleaner
// messages (weekly schedule, pay summary, today's cleaning list).
export const cleanerSignoff = (sender?: string) =>
  [
    `Thank you for your wonderful work! Together, we work hard so our guests always feel comfortable — that is TT House's promise to every guest:`,
    ttPromiseLine(sender),
  ].join("\n");
