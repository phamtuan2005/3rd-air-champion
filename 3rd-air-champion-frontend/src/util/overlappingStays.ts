import { addDays, parseISO } from "date-fns";
import type { GuestBooking } from "../components/tibook/MyBookingsSheet";

// Two of a guest's stays in one room on the same night are one stay written
// twice — fold them into one, the way TiMag already reads them.
//
// On 2026-09-27 Susan's two nights in King (Oct 19–20) were booked twice in
// the same moment: both requests passed the backend's availability check
// before either had written, and every night ended up with two copies of
// the booking. TiMag draws a bar from each copy's own start and end dates,
// so the two bars lie exactly on each other and read as one booking. The
// backend hands TiBook the nights instead, split into stays wherever two
// nights are not a day apart — and a night that is 0 days from its twin
// breaks the run, so Susan's stay came back as three: Oct 19, Oct 19–20 and
// Oct 20. TiBook keys a stay by its check-in and room, so the guest saw two
// cells, one a night each, where TiMag showed one two-night booking.
//
// The backend is left as it is, by Anh-Tuan's call: TiBook reads the data the
// way TiMag does instead. Overlapping stays in one room, with one status, are
// one stay; the rule is only ever reached by a duplicate, because a room
// cannot hold the same guest twice on one night any other way.
//
// Stays that merely TOUCH (checkout morning = next check-in) are never folded:
// a paid stay and a hold can sit back to back, and a held night must stay a
// hold (TIBOOK.md: a hold is never shown as confirmed). The backend already
// joins touching nights of one status, so none reach here.

const key = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const startOf = (b: GuestBooking) => String(b.date).slice(0, 10);
// The last night slept, yyyy-MM-dd.
const lastNightOf = (b: GuestBooking) => key(addDays(parseISO(startOf(b)), Math.max(1, b.duration) - 1));

export const mergeOverlappingStays = (bookings: GuestBooking[]): GuestBooking[] => {
  const groups = new Map<string, GuestBooking[]>();
  for (const b of bookings) {
    const k = `${b.room}|${b.status}`;
    groups.set(k, [...(groups.get(k) ?? []), b]);
  }
  const out: GuestBooking[] = [];
  for (const group of groups.values()) {
    const sorted = [...group].sort((a, b) =>
      startOf(a) < startOf(b) ? -1 : startOf(a) > startOf(b) ? 1 : b.duration - a.duration,
    );
    let cur: GuestBooking | undefined;
    for (const b of sorted) {
      if (cur && startOf(b) <= lastNightOf(cur)) {
        const end = lastNightOf(b) > lastNightOf(cur) ? lastNightOf(b) : lastNightOf(cur);
        const nights =
          Math.round((parseISO(end).getTime() - parseISO(startOf(cur)).getTime()) / 86_400_000) + 1;
        cur = {
          ...cur,
          duration: nights,
          // Each split's total counted its own nights once, so the widest split
          // is the one that priced the whole stay. Never a sum: that is the
          // duplicate charged twice, which is what the guest must not see.
          total:
            cur.total == null ? b.total :
            b.total == null ? cur.total :
            Math.max(cur.total, b.total),
        };
      } else {
        if (cur) out.push(cur);
        cur = b;
      }
    }
    if (cur) out.push(cur);
  }
  return out.sort((a, b) => (startOf(a) < startOf(b) ? -1 : startOf(a) > startOf(b) ? 1 : 0));
};
