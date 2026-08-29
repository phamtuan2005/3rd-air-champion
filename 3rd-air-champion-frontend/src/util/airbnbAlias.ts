// How many guests the AirBnB name is already telling us.
//
// The alias is COPIED STRAIGHT FROM AIRBNB, and AirBnB puts the party size in
// it. The host is reading the name and the payout at that moment — that is
// where the attention goes, and it is why the guest count is the field left at
// 1. Nothing here needs asking for; it is in the text just pasted.
//
// Getting it wrong is not cosmetic. The sofa bed is prepared from three guests
// up, and the cleaner has to know before the guest arrives rather than on the
// day.
//
// Two shapes, in the order they are trusted:
//
//   "Isaac's group of 2"  → 2, exactly. AirBnB has counted them for us.
//   "Isaac's"             → 2, the FLOOR. The possessive means more than one
//                           and nothing more precise, so this can only ever
//                           under-count — which the host corrects — rather than
//                           promise a sofa bed nobody needs.
//   "Isaac"               → nothing. One guest, and no reason to touch it.
//
// A name merely ending in s is not a possessive: Chris, James and Desmond must
// come back untouched, or every one of them gains a guest who does not exist.

// Straight and curly both: AirBnB serves the typographic apostrophe and a paste
// carries it through unchanged.
const POSSESSIVE = /['’]s(\s|$)/;
// "group of 2", and the same line however AirBnB spaces or cases it.
const GROUP_OF = /\bgroup\s+of\s+(\d+)/i;

// The booking form offers 1–4. A larger party is a conversation with the host,
// not a silent 7 the form cannot represent — clamped rather than dropped, so
// the count still moves off 1 and the host sees it needs attention.
export const MAX_FORM_GUESTS = 4;

export interface AliasGuests {
  count: number;
  // Whether AirBnB gave the number outright, or it was inferred from the
  // possessive. The host is told which, because one is a fact and the other is
  // a floor they may need to raise.
  exact: boolean;
}

export const guestsFromAlias = (alias: string): AliasGuests | null => {
  const text = (alias ?? "").trim();
  if (!text) return null;

  const group = text.match(GROUP_OF);
  if (group) {
    const n = Number(group[1]);
    if (Number.isFinite(n) && n >= 1) {
      return { count: Math.min(n, MAX_FORM_GUESTS), exact: true };
    }
  }

  if (POSSESSIVE.test(text)) return { count: 2, exact: false };
  return null;
};

// The name on its own, for the calendar bar.
//
// The host pastes the whole AirBnB line — "Isaac's group of 2" — because
// retyping half of it is the sort of work the app should be doing. Once the
// count has been read out of it, the rest is noise on a bar that has to fit a
// day column, and every stay would carry the same four redundant words.
//
// The possessive goes too. It only ever meant "and others", which is now the
// guest count's job to say, and "Isaac's" alone reads as a name with something
// missing after it.
//
// Applied on BLUR, never while typing: trimming as the host types would eat the
// apostrophe-s the moment it appeared and fight them for the rest of the name.
export const tidyAlias = (alias: string): string =>
  (alias ?? "")
    .replace(GROUP_OF, "")
    // Only a TRAILING possessive, so a name that genuinely contains one
    // mid-string is left as the host wrote it.
    .replace(/['’]s\s*$/, "")
    .replace(/\s+/g, " ")
    .trim();
