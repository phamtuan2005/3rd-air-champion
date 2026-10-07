import { format, parseISO } from "date-fns";

// One measure, month by month, as bars — used twice on TiWork's pay screen:
// what was PAID to the worker each month, and the HOURS they worked.
//
// Two charts and not one with two scales: money and hours are not on the same
// scale, and a second axis invites reading one bar against the other. The two
// share the selected month instead — tap a bar in either and both name that
// month's figure — so they are read together without being drawn together.
//
// Plain HTML bars: a handful of months needs no chart library, and each bar is
// a real button a finger can hit and a screen reader can name.

export interface MonthBar {
  month: string; // yyyy-MM
  value: number;
}

const monthShort = (m: string) => format(parseISO(`${m}-01`), "MMM");
const monthLong = (m: string) => format(parseISO(`${m}-01`), "MMMM yyyy");

const MonthlyBars = ({
  title,
  rows,
  selected,
  onSelect,
  color,
  show,
}: {
  title: string;
  rows: MonthBar[];
  selected: string;
  onSelect: (month: string) => void;
  /** The bar fill, as a class — one hue per chart, it is one series. */
  color: string;
  /** The figure as words: "$480.00", "22h 30m". */
  show: (value: number) => string;
}) => {
  const max = Math.max(...rows.map((r) => r.value), 0);
  const current = rows.find((r) => r.month === selected) ?? rows[rows.length - 1];

  return (
    <div className="rounded-2xl bg-gray-50 p-3">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[12px] font-bold uppercase tracking-widest text-gray-500">{title}</p>
        {current && (
          <p className="text-sm text-gray-600">
            {monthShort(current.month)} <span className="font-bold text-gray-900">{show(current.value)}</span>
          </p>
        )}
      </div>
      <div className="mt-2 flex h-28 items-end gap-0.5 border-b border-gray-300" role="group" aria-label={title}>
        {rows.map((r) => {
          const on = r.month === current?.month;
          const pct = max > 0 ? Math.max((r.value / max) * 100, r.value > 0 ? 3 : 0) : 0;
          return (
            <button
              key={r.month}
              type="button"
              onClick={() => onSelect(r.month)}
              aria-pressed={on}
              aria-label={`${monthLong(r.month)}: ${show(r.value)}`}
              // The whole column is the target, taller than its bar, so a short
              // month is as easy to tap as a tall one.
              className="flex h-full flex-1 items-end justify-center px-1.5"
            >
              <span
                className={`block w-full max-w-[28px] rounded-t ${color} ${on ? "" : "opacity-60"}`}
                style={{ height: `${pct}%` }}
              />
            </button>
          );
        })}
      </div>
      <div className="mt-1 flex gap-0.5">
        {rows.map((r) => (
          <span
            key={r.month}
            className={`flex-1 text-center text-[11px] ${r.month === current?.month ? "font-bold text-gray-900" : "text-gray-500"}`}
          >
            {monthShort(r.month)}
          </span>
        ))}
      </div>
      {/* The same figures as a table, for a screen reader. */}
      <table className="sr-only">
        <caption>{title}</caption>
        <tbody>
          {rows.map((r) => (
            <tr key={r.month}>
              <th scope="row">{monthLong(r.month)}</th>
              <td>{show(r.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default MonthlyBars;
