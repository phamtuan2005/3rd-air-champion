// One look for every button in TiMag that removes, deletes or refuses.
//
// There were six: red-500 and red-600 and rose-600; square corners, rounded,
// rounded-md, rounded-lg, rounded-xl and a pill; semibold and bold; xs and sm.
// Anh-Tuan, 2026-10-04: "The design of delete button is somewhat
// inconsistent … It is better to keep a single design only." So this is the
// design, and a destructive button gets it from here rather than spelling its
// own. Layout (width, flex-1) is still the caller's; the look is not.

export const DANGER_BUTTON =
  "rounded-lg bg-red-600 px-3 py-1.5 text-sm font-bold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50";

// The Delete revealed behind a row swiped left: the same button, set a
// little in from the row's edge so it reads as a button and not a red wall.
export const SWIPE_DELETE =
  "absolute inset-y-1 right-1 flex w-[72px] items-center justify-center rounded-lg bg-red-600 text-sm font-bold text-white";
