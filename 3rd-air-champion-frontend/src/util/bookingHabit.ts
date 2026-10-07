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
}

/**
 * The next stays to propose: on the habit's weekday and length, in the guest's
 * usual room where it is free, else the next room they use — never one they
 * have not stayed in. Weeks they already have a stay overlapping are skipped.
 */
export const proposalsFor = (
  habit: Habit,
  today: Date,
  isFree: (roomId: string, night: string) => boolean | null,
  theirUpcoming: PastStay[],
  opts: { weeks?: number; max?: number } = {},
): Proposal[] => {
  const { weeks = 8, max = 3 } = opts;
  const theirs = new Set(theirUpcoming.flatMap((s) => nightsFrom(s.start, s.nights)));
  const out: Proposal[] = [];
  for (const start of upcomingStarts(habit, today, weeks)) {
    if (out.length >= max) break;
    const nights = nightsFrom(start, habit.nights);
    if (nights.some((n) => theirs.has(n))) continue;
    const room = habit.rooms.find((r) => freeFor(r, nights, isFree));
    if (room) out.push({ start, nights, roomId: room, usualRoom: room === habit.rooms[0] });
  }
  return out;
};

/** Proposals from every habit, soonest first, at most `max`, never two overlapping. */
export const proposalsForAll = (
  habits: Habit[],
  today: Date,
  isFree: (roomId: string, night: string) => boolean | null,
  theirUpcoming: PastStay[],
  opts: { weeks?: number; max?: number } = {},
): Proposal[] => {
  const max = opts.max ?? 3;
  const all = habits
    .flatMap((h) => proposalsFor(h, today, isFree, theirUpcoming, { weeks: opts.weeks, max }))
    .sort((a, b) => a.start.localeCompare(b.start));
  const taken = new Set<string>();
  const out: Proposal[] = [];
  for (const p of all) {
    if (out.length >= max) break;
    if (p.nights.some((n) => taken.has(n))) continue;
    p.nights.forEach((n) => taken.add(n));
    out.push(p);
  }
  return out;
};
