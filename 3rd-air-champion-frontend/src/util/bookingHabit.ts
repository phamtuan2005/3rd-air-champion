import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns";

// A returning guest's booking HABIT, and the stays TiBook proposes from it.
//
// Why (host, 2026-10-07): guests book in habits — some Mon→Fri, four nights, in
// King, Cute or Queen; some Monday and Thursday in Chill or Cozy — and TiBook
// waited to be asked, while King's weekdays filled up. TiBook should work the
// habit out itself and come forward with the next stays that fit it, saying how
// fast that room is going, so a regular can book ahead instead of finding the
// week gone.
//
// Plain arithmetic on the guest's own stays and the calendar — no model, and
// nothing asked of the guest. Dates are yyyy-MM-dd strings; weekdays come from
// those strings, never through a timezone conversion.

export interface PastStay {
  start: string; // yyyy-MM-dd, the first night
  nights: number;
  roomId: string;
}

export interface Habit {
  /** 0 = Sunday … 6 = Saturday, the night the stay usually starts. */
  startWeekday: number;
  nights: number;
  /** Rooms the guest stays in, most-used first (nights in the room). */
  rooms: string[];
  /** How many stays share this start day and length. */
  times: number;
}

const key = (d: Date) => format(d, "yyyy-MM-dd");
const weekdayOf = (k: string) => parseISO(k).getDay();

// Two stays on the same weekday for the same length is a pattern a person would
// notice; one is not. Within the last half-year, so an old routine that has
// stopped does not keep being pushed.
export const MIN_TIMES = 2;
export const LOOKBACK_DAYS = 183;

/**
 * Every habit the guest has — up to three, most repeated first. A guest who
 * books Monday AND Thursday each week (two one-night stays) has two habits, and
 * both are proposed (host, 2026-10-07: "Some guests book Mon & Thursday in
 * Chill or Cozy").
 */
export const habitsOf = (stays: PastStay[], today: Date): Habit[] => {
  const out: Habit[] = [];
  let rest = stays;
  for (let i = 0; i < 3; i++) {
    const h = habitOf(rest, today);
    if (!h) break;
    // Ranked again over ALL the guest's stays: the leftover list alone could
    // miss the room they use most.
    out.push({ ...h, rooms: rankRooms(stays.filter((s) => weekdayOf(s.start) === h.startWeekday && s.nights === h.nights), stays, today) });
    rest = rest.filter((s) => !(weekdayOf(s.start) === h.startWeekday && s.nights === h.nights));
  }
  // Rooms are the guest's across ALL their stays, not only the shape's.
  return out;
};

/** The guest's usual stay — start weekday, length, rooms — or null when there is no habit yet. */
export const habitOf = (stays: PastStay[], today: Date): Habit | null => {
  const recent = stays.filter(
    (s) => s.nights >= 1 && differenceInCalendarDays(today, parseISO(s.start)) <= LOOKBACK_DAYS,
  );
  const groups = new Map<string, PastStay[]>();
  for (const s of recent) {
    const g = `${weekdayOf(s.start)}|${s.nights}`;
    groups.set(g, [...(groups.get(g) ?? []), s]);
  }
  // The most repeated shape; a tie goes to the one booked most recently.
  const best = [...groups.values()].sort(
    (a, b) =>
      b.length - a.length ||
      Math.max(...b.map((s) => parseISO(s.start).getTime())) - Math.max(...a.map((s) => parseISO(s.start).getTime())),
  )[0];
  if (!best || best.length < MIN_TIMES) return null;

  return { startWeekday: weekdayOf(best[0].start), nights: best[0].nights, rooms: rankRooms(best, recent, today), times: best.length };
};

// Rooms by nights spent in them — the habit's own stays first, then the rest,
// so a guest who switched rooms once is still offered their real usual.
const rankRooms = (shape: PastStay[], all: PastStay[], today: Date): string[] => {
  const recent = all.filter((s) => differenceInCalendarDays(today, parseISO(s.start)) <= LOOKBACK_DAYS);
  const nightsIn = new Map<string, number>();
  for (const s of shape) nightsIn.set(s.roomId, (nightsIn.get(s.roomId) ?? 0) + s.nights * 1000);
  for (const s of recent) nightsIn.set(s.roomId, (nightsIn.get(s.roomId) ?? 0) + s.nights);
  return [...nightsIn.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
};

/** The nights of a stay starting on `start`. */
const nightsFrom = (start: string, nights: number) =>
  Array.from({ length: nights }, (_, i) => key(addDays(parseISO(start), i)));

/** The next `weeks` starts on the habit's weekday, after today. */
export const upcomingStarts = (habit: Habit, today: Date, weeks: number): string[] => {
  const ahead = (habit.startWeekday - today.getDay() + 7) % 7 || 7;
  return Array.from({ length: weeks }, (_, i) => key(addDays(today, ahead + 7 * i)));
};

/**
 * Whether the room is free every night of the stay. `isFree` answers for one
 * night: true free, false taken, null not known (the calendar not loaded that
 * far) — unknown never counts as free.
 */
const freeFor = (roomId: string, nights: string[], isFree: (roomId: string, night: string) => boolean | null) =>
  nights.every((n) => isFree(roomId, n) === true);

/** How many of the coming weeks the room is already taken on the habit's nights. */
export const fillRate = (
  habit: Habit,
  roomId: string,
  today: Date,
  isFree: (roomId: string, night: string) => boolean | null,
  weeks = 8,
): { taken: number; known: number } => {
  let taken = 0;
  let known = 0;
  for (const start of upcomingStarts(habit, today, weeks)) {
    const answers = nightsFrom(start, habit.nights).map((n) => isFree(roomId, n));
    if (answers.some((a) => a === null)) continue;
    known++;
    if (answers.some((a) => a === false)) taken++;
  }
  return { taken, known };
};

export interface Proposal {
  start: string;
  nights: string[];
  roomId: string;
  /** False when it is not the guest's usual room — the card must say so. */
  usualRoom: boolean;
  /**
   * The nights of a week the guest booked only part of — "adds Wednesday to
   * your Tuesday stay". Their nights that week, as weekday indexes, so the card
   * can say which stay this joins.
   */
  completes?: number[];
  /** For `completes`: the room the rest of that week is booked in. */
  theirRoom?: string;
  /**
   * Nights of the guest's usual week that NO room has free, as weekday indexes —
   * set when only part of the week could be offered, so the card can say
   * "Tuesday is full that week" and the shorter stay makes sense.
   */
  full?: number[];
}

/**
 * The given nights (in order) placed in rooms: each run of consecutive nights in
 * one room where a room has the whole run free — the first in `order` — else
 * split, night by night, into the first free room for each, keeping neighbours
 * in the same room. Nights no room has free are left out.
 */
const placeNights = (
  nights: string[],
  order: string[],
  isFree: (roomId: string, night: string) => boolean | null,
): { nights: string[]; roomId: string }[] => {
  const out: { nights: string[]; roomId: string }[] = [];
  const open = nights.filter((n) => order.some((r) => isFree(r, n) === true));
  for (const run of runs(open)) {
    const whole = order.find((r) => freeFor(r, run, isFree));
    if (whole) {
      out.push({ nights: run, roomId: whole });
      continue;
    }
    for (const n of run) {
      const prev = out[out.length - 1];
      // Stay in the previous night's room when it is free tonight too.
      if (prev && isFree(prev.roomId, n) === true && key(addDays(parseISO(prev.nights[prev.nights.length - 1]), 1)) === n) {
        prev.nights.push(n);
        continue;
      }
      out.push({ nights: [n], roomId: order.find((r) => isFree(r, n) === true)! });
    }
  }
  return out;
};

// Splits nights (in order) into runs of consecutive ones.
const runs = (nights: string[]) => {
  const out: string[][] = [];
  for (const n of nights) {
    const last = out[out.length - 1];
    if (last && key(addDays(parseISO(last[last.length - 1]), 1)) === n) last.push(n);
    else out.push([n]);
  }
  return out;
};

/**
 * The next stays to propose: on the habit's weekday and length, in the guest's
 * usual room where it is free, else the next room they use, else another free
 * room that holds their party (opts.otherRooms). Weeks they hold in full are
 * skipped; a week they hold in part is offered its remaining nights.
 */
export const proposalsFor = (
  habit: Habit,
  today: Date,
  isFree: (roomId: string, night: string) => boolean | null,
  theirUpcoming: PastStay[],
  opts: { weeks?: number; max?: number; otherRooms?: string[] } = {},
): Proposal[] => {
  const { weeks = 8, max = 3 } = opts;
  // When none of the guest's own rooms is free that week, another free room is
  // offered (host, 2026-10-07: "If the room is taken, we suggest another
  // available room") — `otherRooms`, already narrowed by the caller to rooms
  // that hold their party. Their own rooms always come first.
  const others = (opts.otherRooms ?? []).filter((r) => !habit.rooms.includes(r));
  // Their nights, and the room each is in — a week they booked part of is
  // completed in the room they already have that week, so they do not move.
  const roomOn = new Map<string, string>();
  for (const st of theirUpcoming) for (const n of nightsFrom(st.start, st.nights)) roomOn.set(n, st.roomId);
  const out: Proposal[] = [];
  for (const start of upcomingStarts(habit, today, weeks)) {
    if (out.length >= max) break;
    const nights = nightsFrom(start, habit.nights);
    const held = nights.filter((n) => roomOn.has(n));
    if (held.length === nights.length) continue;
    if (held.length === 0) {
      const order = [...habit.rooms, ...others];
      const room = order.find((r) => freeFor(r, nights, isFree));
      if (room) {
        out.push({ start, nights, roomId: room, usualRoom: room === habit.rooms[0] });
        continue;
      }
      // No room has the whole usual week: offer the nights of it that ARE free,
      // and say which are full — rather than skipping the week. Sean's Mon–Thu
      // was skipped for two weeks running because every room was taken on the
      // Tuesday, while Monday, Wednesday and Thursday sat open (host,
      // 2026-10-07: "There are some nights available fulfilling his booking
      // pattern").
      const full = nights.filter((n) => !order.some((r) => isFree(r, n) === true)).map(weekdayOf);
      for (const piece of placeNights(nights, order, isFree)) {
        if (out.length >= max) break;
        out.push({ start: piece.nights[0], nights: piece.nights, roomId: piece.roomId, usualRoom: piece.roomId === habit.rooms[0], full });
      }
      continue;
    }
    // Part of the week is booked: offer the nights left — one proposal per run
    // of them — rather than skipping the week (host, 2026-10-07: "if the guest
    // booked just a night in the pattern of 2 nights … give them some
    // suggestions for the remaining night").
    const theirRoom = roomOn.get(held[0])!;
    const order = [theirRoom, ...habit.rooms.filter((r) => r !== theirRoom), ...others.filter((r) => r !== theirRoom)];
    const left = nights.filter((n) => !roomOn.has(n));
    const fullLeft = left.filter((n) => !order.some((r) => isFree(r, n) === true)).map(weekdayOf);
    for (const piece of placeNights(left, order, isFree)) {
      if (out.length >= max) break;
      out.push({
        start: piece.nights[0],
        nights: piece.nights,
        roomId: piece.roomId,
        usualRoom: piece.roomId === habit.rooms[0],
        completes: held.map(weekdayOf),
        theirRoom,
        ...(fullLeft.length ? { full: fullLeft } : {}),
      });
    }
  }
  return out;
};

/** Proposals from every habit, soonest first, at most `max`, never two overlapping. */
export const proposalsForAll = (
  habits: Habit[],
  today: Date,
  isFree: (roomId: string, night: string) => boolean | null,
  theirUpcoming: PastStay[],
  opts: { weeks?: number; max?: number; otherRooms?: string[] } = {},
): Proposal[] => {
  const max = opts.max ?? 3;
  const all = habits
    .flatMap((h) => proposalsFor(h, today, isFree, theirUpcoming, { weeks: opts.weeks, max, otherRooms: opts.otherRooms }))
    .sort((a, b) => a.start.localeCompare(b.start));
  const taken = new Set<string>();
  const out: Proposal[] = [];
  for (const p of all) {
    if (out.length >= max) break;
    if (p.nights.some((n) => taken.has(n))) continue;
    p.nights.forEach((n) => taken.add(n));
    out.push(p);
  }
  return joinBackToBack(out.sort((a, b) => a.start.localeCompare(b.start)));
};

/**
 * Proposals that run on night after night in the same room become ONE stay.
 * A guest who stays Tuesdays and Wednesdays has two one-night habits, and each
 * was offered on its own — "Nov 24 Tue, 1 night" and "Nov 25 Wed, 1 night", in
 * Cute both times (Srinivas, host 2026-10-07). That is one two-night stay: one
 * row, one booking, one clean. The guest can still untick a night of it.
 */
const joinBackToBack = (ps: Proposal[]): Proposal[] => {
  const out: Proposal[] = [];
  for (const p of ps) {
    const prev = out[out.length - 1];
    const after = prev && key(addDays(parseISO(prev.nights[prev.nights.length - 1]), 1));
    if (prev && prev.roomId === p.roomId && after === p.start) {
      const completes = [...new Set([...(prev.completes ?? []), ...(p.completes ?? [])])];
      const full = [...new Set([...(prev.full ?? []), ...(p.full ?? [])])];
      out[out.length - 1] = {
        ...prev,
        nights: [...prev.nights, ...p.nights],
        ...(completes.length ? { completes, theirRoom: prev.theirRoom ?? p.theirRoom } : {}),
        ...(full.length ? { full } : {}),
      };
      continue;
    }
    out.push({ ...p });
  }
  return out;
};

// How far past a guest's last booked stay TiBook lines up the next ones.
export const MONTHS_AHEAD = 3;

export interface Series {
  /** The guest's last booked night, when they have stays ahead. */
  lastBooked: string | null;
  /** The last night the series reaches — the end of the month MONTHS_AHEAD past. */
  until: string;
  proposals: Proposal[];
}

/**
 * The next MONTHS of a regular's stays, proposed in one go.
 *
 * Regulars do not book a couple of nights; they book months ahead — Rostam was
 * already booked to January 2027 (host, 2026-10-07), so "the next eight weeks"
 * were all his own stays and nothing was offered. A host who knows a regular
 * reads where their bookings end and lines up what comes next: from the week
 * after today to the end of the month MONTHS_AHEAD past their last booked
 * night — Feb, March, April for Rostam — plus any week left open before it.
 * Weeks they already have are skipped; a week no room of theirs is free is
 * left out.
 */
export const seriesFor = (
  habits: Habit[],
  today: Date,
  isFree: (roomId: string, night: string) => boolean | null,
  theirStays: PastStay[],
  monthsAhead = MONTHS_AHEAD,
  otherRooms: string[] = [],
): Series => {
  const todayKey = key(today);
  const ahead = theirStays.filter((s) => s.start >= todayKey);
  const lastBooked = ahead.length
    ? ahead.map((s) => key(addDays(parseISO(s.start), s.nights - 1))).sort().pop()!
    : null;
  const from = parseISO(lastBooked ?? todayKey);
  // End of the month `monthsAhead` past: "Feb, March, April", whole months.
  const until = key(new Date(from.getFullYear(), from.getMonth() + monthsAhead + 1, 0));
  const weeks = Math.ceil(differenceInCalendarDays(parseISO(until), today) / 7) + 1;
  const proposals = proposalsForAll(habits, today, isFree, ahead, { weeks, max: Infinity, otherRooms }).filter(
    (p) => p.nights[p.nights.length - 1] <= until,
  );
  return { lastBooked, until, proposals };
};

export interface LastStayOffer {
  /** The stay TT takes as the example. */
  last: PastStay;
  /** That stay as a one-off "habit": its weekday, length, and their rooms. */
  habit: Habit;
  proposals: Proposal[];
}

/**
 * For a guest who has stayed before but has no pattern yet — one stay, or a few
 * that do not repeat — and nothing booked ahead: their LAST stay as the
 * example, and the next weeks the same nights are free (host, 2026-10-07: a
 * guest who booked one or two nights before should get something too, "smart
 * like this"). It claims no pattern it does not have; the card says "last time".
 *
 * Their last stay's room first, then the other rooms they have used, then any
 * other free room that holds their party (`otherRooms`). Not for a stay more than
 * a year ago — that guest is not "back" in any sense a host would mean.
 */
export const lastStayOffer = (
  stays: PastStay[],
  today: Date,
  isFree: (roomId: string, night: string) => boolean | null,
  otherRooms: string[] = [],
  activeRooms?: Set<string>,
): LastStayOffer | null => {
  const todayKey = key(today);
  if (stays.some((s) => s.start >= todayKey)) return null;
  const past = [...stays].filter((s) => s.nights >= 1).sort((a, b) => a.start.localeCompare(b.start));
  const last = past[past.length - 1];
  if (!last || differenceInCalendarDays(today, parseISO(last.start)) > 365) return null;
  const used = rankRooms([last], past, today).filter((r) => !activeRooms || activeRooms.has(r));
  if (used.length === 0 && otherRooms.length === 0) return null;
  const habit: Habit = { startWeekday: weekdayOf(last.start), nights: Math.min(last.nights, 7), rooms: used, times: 1 };
  const proposals = proposalsFor(habit, today, isFree, [], { weeks: 8, max: 3, otherRooms });
  return proposals.length ? { last, habit, proposals } : null;
};
