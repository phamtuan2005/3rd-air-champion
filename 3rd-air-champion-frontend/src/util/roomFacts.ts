import { t } from "../contexts/TiBookLanguageContext";

// What a guest wants to know before choosing a room. The facts are in
// roomFactsData.ts (see the note at its top for why they moved there); this
// file adds the one line that is translated where it is written.
export * from "./roomFactsData";

// The other fact that belongs to the whole house rather than to any one room,
// and the reason a guest picks a room here over a lockbox in an empty hallway:
// the host is not a landlord somewhere else. They live in it.
//
// Written as a fact, not as a feeling. "Peace of mind" tells a guest how they
// ought to feel; naming what the host IS and where they LIVE lets the guest
// draw it themselves, which is how the rest of TiBook talks.
//
// Kept to ONE line on a 360px phone (a Galaxy S at default zoom), which is the
// real constraint here: this sits in a two-line band above the calendar, and a
// third line comes straight out of the calendar on a short screen.
//
// The budget is 45 characters, MEASURED rather than estimated — 45 fits on one
// line at 360px and 46 wraps. "living here" instead of "living in the house"
// is what buys the fit; on the house's own booking page "here" is not
// ambiguous. Re-measure if you lengthen this or if a host name grows: the name
// is interpolated, so it spends the same budget.
//
// Takes the host's first name so the sentence names the person whose face is
// at the top of the same screen, rather than an abstract "your host".
//
// Through t() because only TiBook's strip shows it. The facts in roomFactsData.ts are NOT
// translated in this file: askTT matches on their English ("Shared", the
// highlight words), so they are translated where they are drawn instead.
export const hostOnSite = (hostFirstName?: string) =>
  t("Stay with {name}, an engineer living here", { name: hostFirstName || t("your host") });
