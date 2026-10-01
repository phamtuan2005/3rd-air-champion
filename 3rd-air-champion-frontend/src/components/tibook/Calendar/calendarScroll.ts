// Shared by the month grid and the day-by-day list.

// Amber diagonal hatch overlaid on a (R) hold's room color so it reads as
// "pending / tentative", clearly different from a solid confirmed stay.
// The square a 45° pattern of 9px period tiles into (9 / sin 45°). Needed
// because background-position only lines segments up once the gradient has a
// size of its own rather than the element's.
export const HOLD_HATCH_TILE = 12.728;
export const HOLD_HATCH =
  "repeating-linear-gradient(45deg, rgba(217,119,6,0.62) 0 4px, rgba(255,255,255,0) 4px 9px)";

// How many months ahead the calendar goes. TiBook's choice of opening month
// never looks further ahead than the calendar can scroll to.
export const MONTHS_FORWARD = 36;

/*
 * The last scroll-to-month request either view carried out.
 *
 * TiBook asks the calendar to jump once — to the first month with a free
 * night, or to a returning guest's next stay — and stamps the request with a
 * seq so it is carried out only once. Each view used to remember that in its
 * own ref, which starts empty whenever the view mounts. So switching to the
 * list and back, or between Classic and Hero, mounted a fresh calendar that
 * saw the old request as new and yanked the guest back to the opening month
 * from wherever they had scrolled to.
 *
 * Kept here instead, outside any one mount, so a request is spent once for
 * the whole visit. A request that arrives before any calendar is laid out is
 * still unspent and still lands when one is.
 */
export const appliedMonthTrigger = { seq: 0 };

// The month grid's week-rows per page, and the tile height its type was first
// tuned at — see GuestCalendar's "Type and bar geometry".
export const NUM_ROWS = 6;
export const REF_TILE = 80;

/*
 * The grid's day number, in px, for a tile of this height.
 *
 * Here rather than in GuestCalendar because the list reads it too: the list's
 * type is sized off it, so on any phone the list reads at least as large as
 * the grid the guest just switched from. The list's 12px chips beside a 21px
 * day number in the grid were too small to read on a phone.
 */
export const dayNumberPx = (tile: number) => Math.min(24, Math.max(13, (tile / REF_TILE) * 16));
