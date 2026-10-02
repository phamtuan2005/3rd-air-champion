import type { dayType } from "./types/dayType";
import type { guestType } from "./types/guestType";

// What the calendar's Filter searches, and how.
//
// The Filter began as lists: every room, then every guest the house has had.
// AirBnB guests were added as a third list behind a switch (2026-10-02), and
// the same day Anh-Tuan asked what a thousand guests would do to it. A list
// that long is bad design, and capping it was not the answer either: "even
// when the list is more than 10-15, I no longer [use] the drop down list.
// Instead, I type the name directly." His design, which this implements: no
// items at all, one text box, and the host types a room, a guest's name, or a
// phone number.
//
// So nothing here builds a list to browse. It builds the rows a search runs
// over, ordered so the likeliest match comes first — the guest a host is
// looking for is nearly always one who is here soon — and a search never
// returns more than a handful.

export interface HouseGuestRow {
  id: string;
  name: string;
  phone: string;
  // Their next night from today (today included), yyyy-MM-dd.
  next?: string;
  // Otherwise their most recent night before today.
  last?: string;
  // The room of that night: what tells two guests of one name apart.
  room: string;
}

export const houseGuestList = (
  guests: guestType[],
  monthMap: Map<string, dayType>,
  todayKey: string,
): HouseGuestRow[] => {
  const next = new Map<string, { key: string; room: string }>();
  const last = new Map<string, { key: string; room: string }>();
  monthMap.forEach((day, dateKey) => {
    day.bookings.forEach((b) => {
      const id = b.guest?.id;
      if (!id || !b.room) return;
      if (dateKey >= todayKey) {
        const seen = next.get(id);
        if (!seen || dateKey < seen.key) next.set(id, { key: dateKey, room: b.room.name });
      } else {
        const seen = last.get(id);
        if (!seen || dateKey > seen.key) last.set(id, { key: dateKey, room: b.room.name });
      }
    });
  });
  // AirBnB is one shared placeholder record, not a person — its guests are
  // searched by their own names (util/airbnbGuestList).
  return guests
    .filter((g) => g.name !== "AirBnB")
    .map((g) => {
      const n = next.get(g.id);
      const l = last.get(g.id);
      return {
        id: g.id,
        name: g.alias || g.name,
        phone: g.phone ?? "",
        next: n?.key,
        last: l?.key,
        room: (n ?? l)?.room ?? "",
      };
    })
    .sort((a, b) => {
      if (a.next && b.next) return a.next < b.next ? -1 : a.next > b.next ? 1 : a.name.localeCompare(b.name);
      if (a.next) return -1;
      if (b.next) return 1;
      if (a.last && b.last) return a.last > b.last ? -1 : a.last < b.last ? 1 : a.name.localeCompare(b.name);
      if (a.last) return -1;
      if (b.last) return 1;
      return a.name.localeCompare(b.name);
    });
};

const digits = (s: string) => s.replace(/\D/g, "");

// A phone search needs this many digits. Fewer match half the house: nearly
// every number here shares an area code.
export const PHONE_MIN_DIGITS = 3;

/** Whether what was typed is being read as a phone number: digits and phone punctuation only, enough of them. */
export const isPhoneQuery = (query: string): boolean =>
  /^[\d\s()+.-]+$/.test(query.trim()) && digits(query).length >= PHONE_MIN_DIGITS;

/**
 * Does a name, or a phone number, match what was typed?
 *
 * A name matches anywhere in it, whatever the case. A phone number matches on
 * its digits alone, so "650 416" finds "(650) 416-9448" however either was
 * written — but only when the query is nothing but a number, or "2" typed
 * while looking for a room would bring back every guest with a 2 in their
 * phone.
 */
export const matchesTyped = (query: string, name: string, phone = ""): boolean => {
  const q = query.trim().toLowerCase();
  if (!q) return false;
  if (name.toLowerCase().includes(q)) return true;
  return isPhoneQuery(query) && digits(phone).includes(digits(query));
};

/** The first `limit` rows that match, in the order given, and how many matched in all. */
export const topMatches = <T>(rows: T[], matches: (row: T) => boolean, limit: number): { shown: T[]; total: number } => {
  const all = rows.filter(matches);
  return { shown: all.slice(0, limit), total: all.length };
};
