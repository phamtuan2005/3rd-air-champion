import { useCallback, useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import {
  fetchTiBookVisitorStats,
  SeriesPoint,
  SpanKey,
  SpanStats,
  TiBookVisitorStats,
} from "../../util/tibookVisitOperations";

interface TiBookVisitorsModalProps {
  onClose: () => void;
}

// The chart's two series, checked as a pair for colour-blind separation and
// contrast on white. Hex in inline styles rather than Tailwind classes: they sit
// beside computed heights, and keeping both in one style attribute is clearer.
const FIRST_LOOK = "#2a78d6";
const CAME_BACK = "#eb6834";
// The continent bars are one measure, not a series — so not blue, which on this
// screen already means "first look" and would suggest a split that isn't there.
const CONTINENT = "#64748b";
const UNKNOWN = "#cbd5e1";

// What each span is compared against, in words the host would say.
const BEFORE: Record<SpanKey, string | null> = {
  today: "yesterday",
  week: "the 7 days before",
  month: "the 30 days before",
  year: "the 12 months before",
  all: null,
};

// The dates arrive as UTC day strings. parseISO reads a bare date as that
// calendar day at local midnight, so the label is the same day the server
// counted — never shifted by the host's own zone.
const dayLabel = (day: string) => format(parseISO(day), "MMM d");
const monthLabel = (month: string, withYear: boolean) =>
  format(parseISO(`${month}-01`), withYear ? "MMM yyyy" : "MMM");

// A round top for the axis with a whole-number midpoint, so the middle gridline
// never reads "1.5 visitors".
const niceMax = (m: number) => {
  if (m <= 2) return 2;
  const pow = 10 ** Math.floor(Math.log10(m));
  for (const step of [1, 2, 4, 5, 6, 8, 10]) {
    const c = step * pow;
    if (c >= m && Number.isInteger(c / 2)) return c;
  }
  return 10 * pow;
};

const pct = (part: number, whole: number) =>
  whole > 0 ? Math.round((part / whole) * 100) : 0;

const TiBookVisitorsModal = ({ onClose }: TiBookVisitorsModalProps) => {
  const [stats, setStats] = useState<TiBookVisitorStats | null>(null);
  const [error, setError] = useState("");
  const [spanKey, setSpanKey] = useState<SpanKey>("month");

  const load = useCallback(() => {
    setError("");
    fetchTiBookVisitorStats()
      .then(setStats)
      .catch(() => setError("The numbers didn't load. Check the connection and try again."));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const span = stats?.spans.find((s) => s.key === spanKey) ?? null;

  return (
    <div
      className="modal-type fixed inset-0 z-[300] flex items-center justify-center bg-black/50 p-3"
      onClick={onClose}
    >
      <div
        className="flex max-h-[88vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <div>
            <h2 className="text-base font-bold text-gray-900">📈 TiBook visitors</h2>
            <p className="text-xs text-gray-500">
              How many people open TiBook, who comes back, and from where
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-xl leading-none text-gray-400 hover:bg-gray-100"
          >
            &times;
          </button>
        </div>

        {/* Spans above everything they change. Wrapping, not scrolling: on a
            400px phone a scrolling row cut "All time" off at the edge, and an
            option you cannot see is one you do not know is there. */}
        <div className="flex flex-wrap gap-0.5 border-b border-gray-100 bg-gray-50 px-2 py-2 sm:gap-1 sm:px-3">
          {(stats?.spans ?? []).map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setSpanKey(s.key)}
              aria-pressed={s.key === spanKey}
              className={`shrink-0 rounded-lg px-2 py-1 text-sm font-semibold whitespace-nowrap transition-colors sm:px-3 ${
                s.key === spanKey
                  ? "bg-white text-gray-900 shadow-sm ring-1 ring-gray-200"
                  : "text-gray-500 hover:bg-gray-200"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
          {error ? (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <p className="text-sm text-gray-600">{error}</p>
              <button
                type="button"
                onClick={load}
                className="rounded-lg bg-gray-800 px-4 py-1.5 text-sm font-semibold text-white hover:bg-gray-900"
              >
                Try again
              </button>
            </div>
          ) : !stats || !span ? (
            <p className="py-10 text-center text-sm text-gray-500">Counting…</p>
          ) : !stats.since ? (
            <div className="py-10 text-center">
              <p className="text-sm font-semibold text-gray-700">Nobody has been counted yet</p>
              <p className="mx-auto mt-1 max-w-sm text-sm text-gray-500">
                Once this version of TiBook is live, every guest who opens it shows up
                here: which day, whether they come back, and which continent they are on.
              </p>
            </div>
          ) : (
            <SpanView span={span} since={stats.since} />
          )}
        </div>
      </div>
    </div>
  );
};

const SpanView = ({ span, since }: { span: SpanStats; since: string }) => {
  const firstLook = span.visitors - span.cameBack;
  const before = BEFORE[span.key];

  const range =
    span.key === "today"
      ? dayLabel(span.to)
      : span.key === "all"
        ? `Since ${format(parseISO(since), "MMM d, yyyy")}`
        : `${dayLabel(span.from ?? span.to)} – ${dayLabel(span.to)}`;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <div className="grid grid-cols-3 gap-2">
          <Tile label="Visitors" value={span.visitors}>
            {before && span.previousVisitors !== null && (
              <Delta now={span.visitors} was={span.previousVisitors} before={before} />
            )}
          </Tile>
          <Tile label="Came back" value={span.cameBack} swatch={CAME_BACK}>
            {span.visitors > 0 ? `${pct(span.cameBack, span.visitors)}% of visitors` : "—"}
          </Tile>
          <Tile label="First look" value={firstLook} swatch={FIRST_LOOK}>
            not back yet
          </Tile>
        </div>
        <p className="mt-2 text-xs text-gray-400">{range} · days counted in UTC</p>
      </div>

      {span.seriesUnit && span.series.length > 0 && (
        <Columns series={span.series} unit={span.seriesUnit} />
      )}

      <Continents continents={span.continents} total={span.visitors} />

      <p className="border-t border-gray-100 pt-3 text-xs leading-relaxed text-gray-400">
        A visitor is one phone or computer, counted once a day however often it opens
        TiBook. "Came back" means it has opened TiBook on more than one day. The
        continent comes from the time zone the device is set to. Nobody's name or
        number is recorded, and devices signed in to TiMag are not counted.
      </p>
    </div>
  );
};

const Tile = ({
  label,
  value,
  swatch,
  children,
}: {
  label: string;
  value: number;
  swatch?: string;
  children?: React.ReactNode;
}) => (
  <div className="rounded-xl border border-gray-200 px-3 py-2.5">
    <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
      {swatch && (
        <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: swatch }} aria-hidden="true" />
      )}
      {label}
    </div>
    <div className="mt-0.5 text-2xl font-semibold text-gray-900">{value.toLocaleString("en-US")}</div>
    <div className="mt-0.5 text-[12px] leading-snug text-gray-500">{children}</div>
  </div>
);

// Up or down against the same length of time just before. The arrow carries
// the direction as well as the colour.
const Delta = ({ now, was, before }: { now: number; was: number; before: string }) => {
  const diff = now - was;
  if (diff === 0) return <span>Same as {before}</span>;
  return (
    <span className={diff > 0 ? "text-emerald-700" : "text-rose-700"}>
      {diff > 0 ? "▲" : "▼"} {Math.abs(diff).toLocaleString("en-US")} <span className="text-gray-500">vs {before}</span>
    </span>
  );
};

const Columns = ({ series, unit }: { series: SeriesPoint[]; unit: "day" | "month" }) => {
  const [active, setActive] = useState<number | null>(null);
  const [asTable, setAsTable] = useState(false);

  const max = niceMax(Math.max(...series.map((p) => p.visitors)));
  const spansYears =
    unit === "month" && series[0].start.slice(0, 4) !== series[series.length - 1].start.slice(0, 4);
  const label = (p: SeriesPoint) =>
    unit === "day" ? dayLabel(p.start) : monthLabel(p.start, spansYears);

  // First, middle and last only: thirty date labels under thirty thin bars
  // collide into an unreadable strip.
  const labelled = new Set([0, Math.floor((series.length - 1) / 2), series.length - 1]);

  const shown = active !== null ? series[active] : null;

  return (
    <section>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-gray-800">
          Visitors {unit === "day" ? "per day" : "per month"}
        </h3>
        <div className="flex items-center gap-3 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: FIRST_LOOK }} aria-hidden="true" />
            First look
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: CAME_BACK }} aria-hidden="true" />
            Came back
          </span>
          <button
            type="button"
            onClick={() => setAsTable((t) => !t)}
            className="font-semibold text-gray-600 underline decoration-gray-300 underline-offset-2 hover:text-gray-900"
          >
            {asTable ? "Chart" : "Table"}
          </button>
        </div>
      </div>

      {asTable ? (
        <div className="max-h-64 overflow-y-auto rounded-lg border border-gray-200">
          <table className="w-full text-sm tabular-nums">
            <thead className="sticky top-0 bg-gray-50 text-left text-xs text-gray-500">
              <tr>
                <th className="px-3 py-1.5 font-medium">{unit === "day" ? "Day" : "Month"}</th>
                <th className="px-3 py-1.5 text-right font-medium">Visitors</th>
                <th className="px-3 py-1.5 text-right font-medium">Came back</th>
              </tr>
            </thead>
            <tbody>
              {[...series].reverse().map((p) => (
                <tr key={p.start} className="border-t border-gray-100 text-gray-700">
                  <td className="px-3 py-1">{label(p)}</td>
                  <td className="px-3 py-1 text-right">{p.visitors}</td>
                  <td className="px-3 py-1 text-right">{p.cameBack}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="relative pt-9">
          {/* The hovered or tapped bar's numbers, pinned over the plot so it
              never runs off the edge of the modal at the first or last bar. */}
          {shown && active !== null && (
            <div
              className="pointer-events-none absolute top-0 z-10 whitespace-nowrap rounded-md bg-gray-900 px-2 py-1 text-xs text-white shadow"
              style={{
                left: `calc(2.25rem + (100% - 2.25rem) * ${(active + 0.5) / series.length})`,
                transform: `translateX(${active < series.length / 3 ? "-15%" : active > (series.length * 2) / 3 ? "-85%" : "-50%"})`,
              }}
            >
              <span className="font-semibold">{label(shown)}</span> · {shown.visitors} visitor
              {shown.visitors === 1 ? "" : "s"} · {shown.cameBack} came back
            </div>
          )}

          <div className="relative h-40">
            {/* Gridlines at 0, half and the top, labelled on the left. */}
            {[1, 0.5, 0].map((f) => (
              <div
                key={f}
                className="absolute left-0 right-0 flex items-center"
                style={{ bottom: `${f * 100}%`, transform: "translateY(50%)" }}
              >
                <span className="w-8 pr-1 text-right text-[11px] tabular-nums text-gray-400">
                  {max * f}
                </span>
                <span className="h-px flex-1 bg-gray-100" />
              </div>
            ))}

            <div
              className="absolute bottom-0 left-9 right-0 top-0 flex items-end gap-[2px]"
              onMouseLeave={() => setActive(null)}
            >
              {series.map((p, i) => {
                const first = p.visitors - p.cameBack;
                return (
                  <button
                    key={p.start}
                    type="button"
                    aria-label={`${label(p)}: ${p.visitors} visitors, ${p.cameBack} came back`}
                    onMouseEnter={() => setActive(i)}
                    onFocus={() => setActive(i)}
                    onBlur={() => setActive(null)}
                    onClick={() => setActive((a) => (a === i ? null : i))}
                    className={`flex h-full min-w-0 flex-1 flex-col items-center justify-end rounded-sm ${
                      active === i ? "bg-gray-100/70" : ""
                    }`}
                  >
                    {/* Came back on top, first looks from the baseline. Only the
                        top segment is rounded; a 2px white gap splits the two. */}
                    {p.cameBack > 0 && (
                      <span
                        className="block w-full max-w-[24px] rounded-t-[4px]"
                        style={{
                          height: `${(p.cameBack / max) * 100}%`,
                          background: CAME_BACK,
                          marginBottom: first > 0 ? 2 : 0,
                        }}
                      />
                    )}
                    {first > 0 && (
                      <span
                        className={`block w-full max-w-[24px] ${p.cameBack > 0 ? "" : "rounded-t-[4px]"}`}
                        style={{ height: `${(first / max) * 100}%`, background: FIRST_LOOK }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="relative ml-9 mt-1 h-4 text-[11px] text-gray-400">
            {series.map((p, i) =>
              labelled.has(i) ? (
                <span
                  key={p.start}
                  className="absolute whitespace-nowrap"
                  style={{
                    left: `${((i + 0.5) / series.length) * 100}%`,
                    transform: `translateX(${i === 0 ? "-25%" : i === series.length - 1 ? "-75%" : "-50%"})`,
                  }}
                >
                  {label(p)}
                </span>
              ) : null,
            )}
          </div>
        </div>
      )}
    </section>
  );
};

const Continents = ({
  continents,
  total,
}: {
  continents: { continent: string; visitors: number }[];
  total: number;
}) => {
  const top = Math.max(1, ...continents.map((c) => c.visitors));
  return (
    <section>
      <h3 className="mb-2 text-sm font-semibold text-gray-800">Where visitors are</h3>
      {continents.length === 0 ? (
        <p className="text-sm text-gray-500">No visitors in this span yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {continents.map((c) => (
            <li key={c.continent}>
              <div className="flex items-baseline justify-between text-sm">
                <span className="text-gray-700">{c.continent}</span>
                <span className="tabular-nums text-gray-500">
                  {c.visitors.toLocaleString("en-US")} · {pct(c.visitors, total)}%
                </span>
              </div>
              <div className="mt-1 h-2 rounded-full bg-gray-100">
                <div
                  className="h-2 rounded-full"
                  style={{
                    width: `${(c.visitors / top) * 100}%`,
                    background: c.continent === "Unknown" ? UNKNOWN : CONTINENT,
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

export default TiBookVisitorsModal;
