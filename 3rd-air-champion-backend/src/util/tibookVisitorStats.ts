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
  const byContinent = new Map<string, number>();
  for (const [visitorId, r] of latest) {
    if (r.day > (firstDayOf.get(visitorId) ?? r.day)) cameBack += 1;
    const c = r.continent || "Unknown";
    byContinent.set(c, (byContinent.get(c) ?? 0) + 1);
  }

  const continents = Array.from(byContinent, ([continent, visitors]) => ({
    continent,
    visitors,
  })).sort((a, b) => {
    // Unknown last whatever its size: it is the absence of an answer, and at
    // the top of the list it would read as the biggest market.
    if (a.continent === "Unknown") return 1;
    if (b.continent === "Unknown") return -1;
    return b.visitors - a.visitors || a.continent.localeCompare(b.continent);
  });

  return { visitors: latest.size, cameBack, continents };
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
        continents: [], seriesUnit: null, series: [],
      };
    }

    const { visitors, cameBack, continents } = summarise(rows, firstDayOf, from, today);

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
      continents, seriesUnit, series,
    };
  });

  return { since, today, spans };
};
