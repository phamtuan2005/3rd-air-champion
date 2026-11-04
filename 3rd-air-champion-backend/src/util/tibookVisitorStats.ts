import { continentOfCountry } from "./continentOfCountry";

// How TiBook is doing, from the visits it has recorded.
//
// A visit row is one DEVICE on one UTC DAY (see tibookVisitSchema) — opening
// TiBook ten times on a Tuesday is one row. So every number here is people, not
// page loads: a guest refreshing the calendar while they decide is not growth.
//
// "Came back" has one meaning everywhere below, so the tiles and the chart can
// never disagree: within a window, a visitor came back if their latest day in
// it is later than the first day they ever opened TiBook. For a window ending
// today that is exactly "has used it on more than one day".

export interface VisitRow {
  visitorId: string;
  day: string; // yyyy-MM-dd, UTC
  continent: string;
  // Two letters from the connection (CloudFront-Viewer-Country); "" or absent
  // for a visit recorded before that was turned on (2026-11-03) or one that
  // did not come through CloudFront. Only a visit with one is on the map.
  country?: string;
  guestPhone?: string; // "" or absent when the visit is not tied to a guest
}

// A guest who let TiBook remember them, and how they used it in a span.
export interface GuestVisits {
  phone: string;
  // DISTINCT days. The same guest on a phone and a laptop on one afternoon is
  // two rows and one day.
  days: number;
  lastDay: string; // yyyy-MM-dd
}

export interface ContinentCount {
  continent: string;
  visitors: number;
}

export interface SeriesPoint {
  start: string; // yyyy-MM-dd for a day bucket, yyyy-MM for a month bucket
  visitors: number;
  cameBack: number;
}

export interface SpanStats {
  key: SpanKey;
  label: string;
  from: string | null; // null when nothing has been recorded yet
  to: string;
  visitors: number;
  cameBack: number;
  // The same length of time immediately before, for "up or down". Null for
  // All time, which has nothing before it, and for any span whose earlier
  // stretch reaches back before counting began.
  previousVisitors: number | null;
  continents: ContinentCount[];
  guests: GuestVisits[];
  seriesUnit: "day" | "month" | null;
  series: SeriesPoint[];
}

export interface TiBookVisitorStats {
  since: string | null; // the first day any visit was recorded
  today: string;
  spans: SpanStats[];
}

export type SpanKey = "today" | "week" | "month" | "year" | "all";

const SPANS: { key: SpanKey; label: string; days: number | null }[] = [
  { key: "today", label: "Today", days: 1 },
  { key: "week", label: "7 days", days: 7 },
  { key: "month", label: "30 days", days: 30 },
  { key: "year", label: "12 months", days: 365 },
  { key: "all", label: "All time", days: null },
];

// Date arithmetic on the strings, in UTC, and nowhere else — a local timezone
// here would shift every bucket by a day for anyone east or west of the server.
export const addDays = (day: string, n: number): string => {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

const addMonths = (month: string, n: number): string => {
  const d = new Date(`${month}-01T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 7);
};

export const utcDay = (date: Date = new Date()): string =>
  date.toISOString().slice(0, 10);

const summarise = (
  rows: VisitRow[],
  firstDayOf: Map<string, string>,
  from: string,
  to: string,
) => {
  // Each visitor once, on their latest day in the window — so someone who
  // visited from Asia and later from Europe is counted where they last were.
  const latest = new Map<string, VisitRow>();
  for (const r of rows) {
    if (r.day < from || r.day > to) continue;
    const seen = latest.get(r.visitorId);
    if (!seen || r.day > seen.day) latest.set(r.visitorId, r);
  }

  let cameBack = 0;
  for (const [visitorId, r] of latest) {
    if (r.day > (firstDayOf.get(visitorId) ?? r.day)) cameBack += 1;
  }

  // WHERE: only from visits that carry the connection's country (host,
  // 2026-11-03: "This statistics is about location of visitor, not about the
  // time zone"). Visits placed by the phone's time zone before then put the
  // host in North America for a week he spent in Korea, and two that reported
  // plain "UTC" sat on the chart as "Unknown". They still count as visitors
  // above; they are just not on the map, so there is no Unknown row. Each
  // visitor once, where their LATEST located visit in the span was.
  const located = new Map<string, VisitRow>();
  for (const r of rows) {
    if (r.day < from || r.day > to) continue;
    if (continentOfCountry(r.country) === "Unknown") continue;
    const seen = located.get(r.visitorId);
    if (!seen || r.day > seen.day) located.set(r.visitorId, r);
  }
  const byContinent = new Map<string, number>();
  for (const r of located.values()) {
    const c = continentOfCountry(r.country);
    byContinent.set(c, (byContinent.get(c) ?? 0) + 1);
  }
  const continents = Array.from(byContinent, ([continent, visitors]) => ({
    continent,
    visitors,
  })).sort((a, b) => b.visitors - a.visitors || a.continent.localeCompare(b.continent));

  // Every row in the window, not just each device's latest: a guest is a
  // phone number, and they may have opened TiBook on more than one device.
  const daysByPhone = new Map<string, Set<string>>();
  for (const r of rows) {
    if (!r.guestPhone || r.day < from || r.day > to) continue;
    const days = daysByPhone.get(r.guestPhone) ?? new Set<string>();
    days.add(r.day);
    daysByPhone.set(r.guestPhone, days);
  }
  const guests = Array.from(daysByPhone, ([phone, days]) => ({
    phone,
    days: days.size,
    lastDay: [...days].sort()[days.size - 1],
  })).sort(
    (a, b) =>
      b.lastDay.localeCompare(a.lastDay) || b.days - a.days || a.phone.localeCompare(b.phone),
  );

  return { visitors: latest.size, cameBack, continents, guests };
};

export const tibookVisitorStats = (
  rows: VisitRow[],
  today: string,
): TiBookVisitorStats => {
  const firstDayOf = new Map<string, string>();
  let since: string | null = null;
  for (const r of rows) {
    const first = firstDayOf.get(r.visitorId);
    if (!first || r.day < first) firstDayOf.set(r.visitorId, r.day);
    if (!since || r.day < since) since = r.day;
  }

  const spans = SPANS.map(({ key, label, days }): SpanStats => {
    const from = days === null ? since : addDays(today, -(days - 1));
    if (!from) {
      return {
        key, label, from: null, to: today, visitors: 0, cameBack: 0,
        previousVisitors: null,
        continents: [], guests: [], seriesUnit: null, series: [],
      };
    }

    const { visitors, cameBack, continents, guests } = summarise(rows, firstDayOf, from, today);

    // Only when that earlier stretch was counted in full. Before counting began
    // it reads as zero, and "▲ 1,520 vs the 12 months before" on the first
    // year of numbers is growth that never happened.
    const previousFrom = days === null ? null : addDays(from, -days);
    const previousVisitors =
      previousFrom === null || !since || previousFrom < since
        ? null
        : summarise(rows, firstDayOf, previousFrom, addDays(from, -1)).visitors;

    // One bar per day up to a month; past that a day is too thin to see, so
    // months. Today has no chart — a single bar says nothing the tile does not.
    let seriesUnit: SpanStats["seriesUnit"] = null;
    const series: SeriesPoint[] = [];
    if (key === "week" || key === "month") {
      seriesUnit = "day";
      for (let d = from; d <= today; d = addDays(d, 1)) {
        const s = summarise(rows, firstDayOf, d, d);
        series.push({ start: d, visitors: s.visitors, cameBack: s.cameBack });
      }
    } else if (key === "year" || key === "all") {
      seriesUnit = "month";
      for (let m = from.slice(0, 7); m <= today.slice(0, 7); m = addMonths(m, 1)) {
        // A month clipped to the span, so the first bar of "12 months" does not
        // count the part of that month that falls outside it.
        const start = `${m}-01` < from ? from : `${m}-01`;
        const end = addDays(`${addMonths(m, 1)}-01`, -1);
        const s = summarise(rows, firstDayOf, start, end < today ? end : today);
        series.push({ start: m, visitors: s.visitors, cameBack: s.cameBack });
      }
    }

    return {
      key, label, from, to: today, visitors, cameBack, previousVisitors,
      continents, guests, seriesUnit, series,
    };
  });

  return { since, today, spans };
};
