import { VisitRow } from "./tibookVisitorStats";

// Which LOCAL day a TiBook visit happened on, for whoever is reading the
// numbers.
//
// The stats first counted in UTC days because that is how the rows are keyed.
// For the host in California that made "Today" turn over at 4 pm, and put an
// evening visit on tomorrow (host, 2026-11-14: the visitors screen "did not
// take into account local time of the user"). A visit is a MOMENT, not a stay
// date, so unlike booking dates it is right to read it through a time zone --
// the rule against converting stored dates is about stays, which are calendar
// days with no clock time at all.
//
// The rows stay as they are: one per device per UTC day, with createdAt (its
// first look that UTC day) and updatedAt (its latest). A UTC day overlaps at
// most two local days anywhere on earth, so those two moments are enough to say
// which of the two the device was seen on: both, when they fall either side of
// local midnight. That is why nothing had to be migrated and why the reader's
// zone can change (the host in Seoul next month) without the history moving.

// The house's own zone, for a reader that sent none or one we cannot read.
export const HOUSE_TIME_ZONE = "America/Los_Angeles";

const formatters = new Map<string, Intl.DateTimeFormat>();
const formatterFor = (timeZone: string): Intl.DateTimeFormat => {
  let f = formatters.get(timeZone);
  if (!f) {
    // en-CA writes yyyy-MM-dd, the form every day string here already has.
    f = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    formatters.set(timeZone, f);
  }
  return f;
};

// The zone comes from a browser, so it is checked by trying it: Intl throws on
// a name it does not know. Anything else falls back to the house.
export const readerTimeZone = (value: unknown): string => {
  if (typeof value !== "string") return HOUSE_TIME_ZONE;
  const zone = value.trim();
  if (!zone || zone.length > 64) return HOUSE_TIME_ZONE;
  try {
    formatterFor(zone);
    return zone;
  } catch {
    return HOUSE_TIME_ZONE;
  }
};

export const localDay = (moment: Date, timeZone: string): string =>
  formatterFor(timeZone).format(moment);

export interface StoredVisit extends VisitRow {
  createdAt?: Date | string;
  updatedAt?: Date | string;
  // Hits by UTC hour of the row's day (see tibookVisitSchema). Absent on rows
  // from before hits were counted.
  hitHours?: Record<string, number> | Map<string, number>;
}

const asDate = (value: Date | string | undefined): Date | null => {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

// A row's hits, each on the local day its hour fell on.
const hitsByLocalDay = (
  utcDayOfRow: string,
  hitHours: StoredVisit["hitHours"],
  timeZone: string,
): Map<string, number> => {
  const byDay = new Map<string, number>();
  if (!hitHours) return byDay;
  const entries = hitHours instanceof Map ? [...hitHours] : Object.entries(hitHours);
  for (const [hour, count] of entries) {
    const n = Number(count);
    const moment = new Date(`${utcDayOfRow}T${hour}:00:00Z`);
    if (!(n > 0) || Number.isNaN(moment.getTime())) continue;
    const day = localDay(moment, timeZone);
    byDay.set(day, (byDay.get(day) ?? 0) + n);
  }
  return byDay;
};

// Each stored row as the local day(s) it covers. The result may hold the same
// device twice on one local day (late one UTC day, early the next); the stats
// count devices and distinct days, so a repeat changes nothing -- and hits are
// summed, so each piece carries only its own.
export const visitsByLocalDay = (rows: StoredVisit[], timeZone: string): VisitRow[] => {
  const out: VisitRow[] = [];
  for (const { createdAt, updatedAt, hitHours, ...row } of rows) {
    const first = asDate(createdAt);
    // A row with no timestamps cannot be placed; leave it on the day it was
    // stored under rather than drop a real visitor.
    if (!first) {
      out.push(row);
      continue;
    }
    const firstDay = localDay(first, timeZone);
    const last = asDate(updatedAt);
    const lastDay = last ? localDay(last, timeZone) : firstDay;

    const hits = hitsByLocalDay(row.day, hitHours, timeZone);
    // A row from before hits were counted, or one made by a call that was not
    // a hit: the device was still there, which is one.
    if (hits.size === 0) hits.set(firstDay, 1);

    const days = new Set([firstDay, lastDay, ...hits.keys()]);
    for (const day of days) out.push({ ...row, day, hits: hits.get(day) ?? 0 });
  }
  return out;
};
