import type { dayType } from "./types/dayType";
import type { bookingType } from "./types/bookingType";
import { airbnbReservationDetails } from "./ttIntents";

// The AirBnB guests the calendar's Filter can offer, by name.
//
// The Filter dropdown listed rooms and the house's own guests and left AirBnB
// out: every AirBnB stay hangs off one shared placeholder guest record, so
// there was no "guest" to list. But half the house's guests come through
// AirBnB (Anh-Tuan, 2026-10-02), and each of their stays carries an `alias` —
// the name copied from AirBnB — which the calendar could already filter by
// from a booking card. This turns those aliases into a list.
//
// What the list must get right, each learned elsewhere in this codebase:
//
//  - A stay is written onto every night it covers. It is read here from its
//    START night only, or a three-night stay is three people.
//  - A cancelled AirBnB stay is KEPT in the day's record when another guest
//    books the same night. The live one is the most recently booked, and on a
//    tie the later entry (the same rule as cleaningTasks' mostRecentPerRoom).
//    Without it the list names a guest who is not coming.
//  - A blocked placeholder (airbnbBlocked) is not a guest.
//  - Dates are yyyy-MM-dd strings and are compared as strings.
//
// An alias is a first name, so two different people can share one, and a
// returning AirBnB guest reuses theirs: the row says how many stays it covers,
// and filtering by it shows them all, as the card's filter always has.

export interface AirBnBGuestRow {
  alias: string;
  // Their stay that is on now or still to come, by its first night.
  next?: string;
  // Otherwise their most recent stay, by its first night.
  last?: string;
  // The room of that stay.
  room: string;
  // Sleeping here tonight.
  inHouse: boolean;
  stays: number;
  // What AirBnB's feed says about each of their stays: the reservation code,
  // and the last four digits of the phone — all of the number AirBnB gives.
  // So a guest can be found by the code on an AirBnB message or by the four
  // digits, not only by a first name several guests share. Empty for a
  // hand-entered stay, which carries neither.
  codes: string[];
  last4s: string[];
}

const day10 = (s: string | undefined) => String(s ?? "").slice(0, 10);

/** The live AirBnB stays starting on one night: one per room, the most recently booked. */
const liveStartsOn = (day: dayType, dateKey: string): bookingType[] => {
  const live = new Map<string, bookingType>();
  for (const b of day.bookings) {
    if (b.guest?.name !== "AirBnB" || !b.room || !b.alias || b.airbnbBlocked) continue;
    if (day10(b.startDate) !== dateKey) continue;
    const held = live.get(b.room.id);
    // >= so a later array position wins a tie, including when both are "".
    if (!held || (b.bookedOn ?? "") >= (held.bookedOn ?? "")) live.set(b.room.id, b);
  }
  return [...live.values()];
};

export const airbnbGuestList = (monthMap: Map<string, dayType>, todayKey: string): AirBnBGuestRow[] => {
  const rows = new Map<string, AirBnBGuestRow & { nextRoom?: string; lastRoom?: string }>();
  monthMap.forEach((day, dateKey) => {
    for (const b of liveStartsOn(day, dateKey)) {
      const start = dateKey;
      // endDate is the last night slept, so a stay ending last night is over.
      const end = day10(b.endDate) || start;
      let row = rows.get(b.alias);
      if (!row) {
        row = { alias: b.alias, room: "", inHouse: false, stays: 0, codes: [], last4s: [] };
        rows.set(b.alias, row);
      }
      row.stays += 1;
      const { code, last4 } = airbnbReservationDetails(b.description);
      if (code && !row.codes.includes(code)) row.codes.push(code);
      if (last4 && !row.last4s.includes(last4)) row.last4s.push(last4);
      if (end >= todayKey) {
        if (!row.next || start < row.next) {
          row.next = start;
          row.nextRoom = b.room!.name;
        }
        if (start <= todayKey) row.inHouse = true;
      } else if (!row.last || start > row.last) {
        row.last = start;
        row.lastRoom = b.room!.name;
      }
    }
  });
  return [...rows.values()]
    .map(({ nextRoom, lastRoom, ...r }) => ({ ...r, room: (r.next ? nextRoom : lastRoom) ?? "" }))
    .sort((a, b) => {
      // Here tonight, then arriving soonest, then gone most recently — the
      // guest a host is looking for is nearly always one who is here soon.
      if (a.inHouse !== b.inHouse) return a.inHouse ? -1 : 1;
      if (a.next && b.next) return a.next < b.next ? -1 : a.next > b.next ? 1 : a.alias.localeCompare(b.alias);
      if (a.next) return -1;
      if (b.next) return 1;
      if (a.last && b.last) return a.last > b.last ? -1 : a.last < b.last ? 1 : a.alias.localeCompare(b.alias);
      return a.alias.localeCompare(b.alias);
    });
};
