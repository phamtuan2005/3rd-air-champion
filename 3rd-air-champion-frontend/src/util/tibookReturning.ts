// Has this device opened TiBook before?
//
// One question, asked in one place. TiBook uses it for exactly one decision:
// which look a guest who has never picked one starts in (see
// TiBookThemeContext). A first look gets Classic, someone coming back gets
// Hero. A second way of working out "new or returning" would eventually
// disagree with this one, and what the guest would see is the app changing
// shape for no reason they could name — the same trap as two availability
// rules (TIBOOK.md rule 1).
//
// It is a per-DEVICE fact and deliberately says nothing about WHO: one flag,
// no name, no number, nothing that identifies anyone. That is why it needs no
// ask, unlike the remembered phone number in guestConsent — the same reasoning
// as the visitor id in tibookVisitOperations.

const SEEN_KEY = "tiBookSeen";

// Private browsing throws on localStorage rather than returning null, so every
// access is wrapped. A device we cannot read is treated as a first look, which
// is the harmless way round: a guest gets the quiet white app rather than a
// nav that will not render.
const readKey = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

// Traces TiBook was already leaving on devices before this flag existed.
//
// Without these, every guest who has been coming here for months would be
// greeted as brand new on their next visit — one Classic visit each before the
// flag caught up. A small thing, but the wrong thing to say to a returning
// guest, and the evidence to avoid it is already sitting on their device.
//
// Any one of them means TiBook has been open here before: the visitor id is
// written by the visit counter, the token by TiBook signing the device in, the
// consent answer once the guest has been asked about their number, and the
// palette once they have picked a colour.
const PRIOR_VISIT_KEYS = [
  "tibookVisitorId",
  "tiBookToken",
  "tiBookRememberConsent",
  "tiBookTheme",
];

// The raw read. Exported for its tests; everything else should ask
// hasVisitedTiBookBefore, which freezes the answer for the page load.
export const readTiBookVisited = (): boolean =>
  readKey(SEEN_KEY) === "1" || PRIOR_VISIT_KEYS.some((k) => readKey(k) !== null);

// Answered ONCE, when this module is first loaded — before any component has
// mounted and long before markTiBookVisited can write the flag.
//
// Freezing it is the point. Read live, a guest's first visit would turn into a
// returning one the moment the flag was written, and anything that remounted
// the theme provider mid-visit — React's own StrictMode does exactly this in
// development — would drop them from Classic into Hero while they were using
// it. A first visit stays a first visit all the way through.
const visitedBefore = readTiBookVisited();

export const hasVisitedTiBookBefore = (): boolean => visitedBefore;

// Called once TiBook is actually on screen. Takes effect on the NEXT visit, by
// the freeze above.
export const markTiBookVisited = (): void => {
  try {
    localStorage.setItem(SEEN_KEY, "1");
  } catch {
    // Storage refused. Every visit then looks like a first one and the guest
    // keeps getting Classic — quieter than the alternative, and the same
    // outcome private browsing gives everywhere else in TiBook.
  }
};
