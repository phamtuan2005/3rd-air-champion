import { useEffect, useMemo, useState } from "react";
import { isAfter, startOfToday, startOfMonth, endOfMonth, eachDayOfInterval, subMonths } from "date-fns";
import { format } from "date-fns-tz";
import { dayType } from "../../../util/types/dayType";
import { roomType } from "../../../util/types/roomType";
import RoomBadge from "../../shared/RoomBadge";
import { fetchAssignments, fetchCleaners, rateOn, CleanerType } from "../../../util/cleanerOperations";
import { fetchMiscExpenses, isExpenseInMonth } from "../../../util/miscOperations";

// App money palette (matches the Total / Net badges): emerald for profit, rose
// for a loss. A single measure per chart, so no categorical CVD pair — and the
// Net chart encodes sign by bar direction (above/below zero) + a signed label,
// not color alone.
const TREND_BLUE = "#2563eb"; // Gross profit (revenue / top line)
const TREND_EMERALD = "#059669"; // Net profit ≥ 0 (bottom line kept)
const TREND_ROSE = "#e11d48"; // Net profit < 0 (a loss month)
const TREND_ORANGE = "#eb6834"; // AirBnB-share bars — distinct from the money greens
const TREND_AMBER = "#d97706"; // Cleaning fee (a cost) — validated pair w/ violet, ≥3:1
const TREND_VIOLET = "#7c3aed"; // Misc fee (a cost)

interface TrendRow {
  month: string; // yyyy-MM
  label: string; // "Jul"
  longLabel: string; // "Jul 2026"
  gross: number;
  cleaning: number;
  misc: number;
  net: number;
}

const fmtFull = (n: number) => `${n < 0 ? "−" : ""}$${Math.round(Math.abs(n)).toLocaleString()}`;
const fmtShort = (n: number) => {
  const a = Math.abs(n);
  const s = n < 0 ? "−" : "";
  // Always one decimal in the k-range so e.g. $10,333 reads "$10.3k", not "$10k".
  if (a >= 1000) return `${s}$${(a / 1000).toFixed(1)}k`;
  return `${s}$${Math.round(a)}`;
};
const fmtPct = (n: number) => `${Math.round(n)}%`;
const fmtPctFull = (n: number) => `${n.toFixed(1)}%`;

interface BarRow {
  month: string;
  label: string;
  longLabel: string;
  value: number;
  predicted?: number; // projected total (booked + expected open nights); drawn as a dashed cap when > value
}

// Dependency-free SVG bar chart with a zero baseline (handles negatives), direct
// value labels, and a native hover tooltip per bar. Unit-agnostic: pass fmt/fmtTip
// for $ or %; pass axisMax to pin the scale (e.g. 100 for a percentage).
const TrendBars = ({
  rows,
  colorFor,
  fmt = fmtShort,
  fmtTip = fmtFull,
  axisMax,
}: {
  rows: BarRow[];
  colorFor: (v: number) => string;
  fmt?: (v: number) => string;
  fmtTip?: (v: number) => string;
  axisMax?: number;
}) => {
  const vals = rows.map((r) => r.value);
  // Predicted caps can sit above the bars, so include them when scaling.
  const scaleVals = [...vals, ...rows.map((r) => r.predicted ?? r.value)];
  const maxV = axisMax ?? Math.max(0, ...scaleVals);
  const minV = axisMax != null ? 0 : Math.min(0, ...vals);
  const range = maxV - minV || 1;
  const W = 320;
  const H = 150;
  const padX = 6;
  const padTop = 16;
  const padBottom = 20;
  const plotH = H - padTop - padBottom;
  const n = Math.max(rows.length, 1);
  const slot = (W - padX * 2) / n;
  const bw = Math.min(30, slot * 0.62);
  const zeroY = padTop + (maxV / range) * plotH;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" style={{ display: "block" }}>
      <line x1={padX} x2={W - padX} y1={zeroY} y2={zeroY} stroke="#c3c2b7" strokeWidth="1" />
      {rows.map((r, i) => {
        const v = r.value;
        const x = padX + slot * i + (slot - bw) / 2;
        const h = (Math.abs(v) / range) * plotH;
        const y = v >= 0 ? zeroY - h : zeroY;
        // Projected total (this + future months): a dashed cap above the solid
        // "booked" bar, with a faint fill for the expected-still-to-come portion.
        const showPred = r.predicted != null && r.predicted > v + Math.max(1, range * 0.01);
        const yPred = showPred ? zeroY - (r.predicted! / range) * plotH : 0;
        return (
          <g key={r.month}>
            {showPred && (
              <>
                <rect x={x} y={yPred} width={bw} height={Math.max(0, y - yPred)} fill={colorFor(r.predicted!)} opacity={0.13} />
                <line x1={x - 2} x2={x + bw + 2} y1={yPred} y2={yPred} stroke={colorFor(r.predicted!)} strokeWidth="1.5" strokeDasharray="3 2" />
                {y - yPred > 11 && (
                  <text x={x + bw / 2} y={yPred - 2.5} textAnchor="middle" fontSize="8" fill="#9aa0a6">
                    {fmt(r.predicted!)}
                  </text>
                )}
              </>
            )}
            <rect x={x} y={y} width={bw} height={Math.max(h, 1)} rx="2.5" fill={colorFor(v)}>
              <title>{`${r.longLabel}: ${fmtTip(v)}${showPred ? ` · projected ${fmtTip(r.predicted!)}` : ""}`}</title>
            </rect>
            <text
              x={x + bw / 2}
              y={v >= 0 ? y - 3 : zeroY - 4}
              textAnchor="middle"
              fontSize="9"
              fontWeight="600"
              fill="#52514e"
            >
              {fmt(v)}
            </text>
            <text x={x + bw / 2} y={H - 6} textAnchor="middle" fontSize="9" fill="#898781">
              {r.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
};

// Grouped bar chart — two bars per month (e.g. Cleaning vs Misc), all positive.
// A legend names the series (required for >= 2), native hover tooltip per bar.
const GroupedBars = ({
  rows,
  series,
}: {
  rows: { month: string; label: string; longLabel: string; values: number[] }[];
  series: { name: string; color: string }[];
}) => {
  const maxV = Math.max(0, ...rows.flatMap((r) => r.values)) || 1;
  const W = 320;
  const H = 150;
  const padX = 6;
  const padTop = 18;
  const padBottom = 20;
  const plotH = H - padTop - padBottom;
  const baseY = padTop + plotH;
  const n = Math.max(rows.length, 1);
  const slot = (W - padX * 2) / n;
  const groupW = Math.min(38, slot * 0.66);
  const gap = 3;
  const bw = (groupW - gap * (series.length - 1)) / series.length;
  return (
    <>
      <div className="mb-1 flex items-center gap-3">
        {series.map((s) => (
          <span key={s.name} className="flex items-center gap-1 text-[10px] text-gray-500">
            <span className="h-2 w-2 rounded-sm" style={{ background: s.color }} />
            {s.name}
          </span>
        ))}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" style={{ display: "block" }}>
        <line x1={padX} x2={W - padX} y1={baseY} y2={baseY} stroke="#c3c2b7" strokeWidth="1" />
        {rows.map((r, i) => {
          const gx = padX + slot * i + (slot - groupW) / 2;
          return (
            <g key={r.month}>
              {series.map((s, j) => {
                const v = r.values[j];
                const h = (v / maxV) * plotH;
                const x = gx + j * (bw + gap);
                return (
                  <g key={s.name}>
                    <rect x={x} y={baseY - h} width={bw} height={Math.max(h, 1)} rx="2" fill={s.color}>
                      <title>{`${s.name} · ${r.longLabel}: ${fmtFull(v)}`}</title>
                    </rect>
                    <text
                      x={x + bw / 2}
                      y={baseY - h - 3}
                      textAnchor="middle"
                      fontSize="7.5"
                      fontWeight="600"
                      fill={s.color}
                    >
                      {fmtShort(v)}
                    </text>
                  </g>
                );
              })}
              <text x={gx + groupW / 2} y={H - 6} textAnchor="middle" fontSize="9" fill="#898781">
                {r.label}
              </text>
            </g>
          );
        })}
      </svg>
    </>
  );
};

interface AvailabilitiesModalProps {
  monthMap: Map<string, dayType>;
  rooms: roomType[];
  currentMonth: Date;
  airbnbName?: string;
  hostId?: string;
  token?: string;
  // On mobile this lives inside MobilePanel, which keeps its children MOUNTED
  // and only slides them off screen — so without this the cleaning and misc
  // figures were fetched once at page load and never again, and a change in
  // Clean or Misc only appeared after reloading TiMag. Flipping to true on open
  // re-runs the fetches.
  isOpen?: boolean;
}

const AvailabilitiesModal = ({ monthMap, rooms, currentMonth, airbnbName, hostId, token, isOpen = true }: AvailabilitiesModalProps) => {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const today = startOfToday();

  // This month's cleaning cost (recorded hours × rate) and misc-expense total.
  // Both are subtracted from the estimated gross to show a net figure.
  const [cleaningFee, setCleaningFee] = useState(0);
  const [miscFee, setMiscFee] = useState(0);

  // The cleaner roster — needed for baseline hours (pre-tracking hours entered
  // for a month), which the Pay tab counts toward that month's cost. Without it
  // the Stats cleaning fee would be short by the baseline and disagree with Pay.
  const [cleaners, setCleaners] = useState<CleanerType[]>([]);
  useEffect(() => {
    if (!hostId || !token) return;
    fetchCleaners(hostId, token)
      .then(setCleaners)
      .catch(() => setCleaners([]));
  }, [hostId, token, isOpen]);

  // Baseline pay for a given month (yyyy-MM) — Σ over cleaners whose baseline is
  // anchored to that month, hours × the rate in effect that month. Mirrors the
  // Pay tab exactly (CleanersModal.monthlyPay).
  const baselineFeeFor = (monthKey: string) =>
    cleaners.reduce(
      (s, c) =>
        c.baselineMonth === monthKey && c.baselineHours > 0
          ? s + c.baselineHours * rateOn(c, `${monthKey}-01`)
          : s,
      0,
    );

  useEffect(() => {
    if (!hostId || !token) return;
    const start = format(startOfMonth(currentMonth), "yyyy-MM-dd", { timeZone });
    const end = format(endOfMonth(currentMonth), "yyyy-MM-dd", { timeZone });
    const monthKey = format(startOfMonth(currentMonth), "yyyy-MM", { timeZone });

    fetchAssignments(hostId, start, end, token)
      .then((assignments) =>
        setCleaningFee(
          assignments.reduce(
            (sum, a) =>
              sum + (a.hours != null && a.cleaner ? a.hours * rateOn(a.cleaner, a.date) : 0),
            0,
          ) + baselineFeeFor(monthKey),
        ),
      )
      .catch(() => setCleaningFee(0));

    fetchMiscExpenses(hostId, token)
      .then((items) =>
        setMiscFee(
          items.filter((e) => isExpenseInMonth(e, monthKey)).reduce((s, e) => s + e.amount, 0),
        ),
      )
      .catch(() => setMiscFee(0));
  }, [hostId, token, currentMonth, timeZone, cleaners, isOpen]);

  // ── Trend tabs: profit & booking metrics over the last 6 months ───────────
  const [tab, setTab] = useState<"month" | "profit" | "bookings">("month");

  // The 6-month window (oldest → current), shared by both trend tabs.
  const trendMonths = useMemo(
    () => Array.from({ length: 6 }, (_, i) => startOfMonth(subMonths(currentMonth, 5 - i))),
    [currentMonth],
  );

  const feesTotal = (fees?: { amount: number }[]) =>
    (fees ?? []).reduce((s, f) => s + (f.amount || 0), 0);

  // Realized booking income bucketed by month, from the full calendar history in
  // monthMap (same per-night formula as the calendar's profit stat).
  const grossByMonth = useMemo(() => {
    const m = new Map<string, number>();
    const add = (k: string, v: number) => m.set(k, (m.get(k) ?? 0) + v);
    for (const [dateKey, day] of monthMap) {
      const mk = dateKey.slice(0, 7);
      for (const b of day.bookings) {
        if (!b.room) continue;
        const isStart = b.startDate.split("T")[0] === dateKey;
        if (b.guest.name !== "AirBnB") {
          add(mk, b.price ?? 0);
          if (isStart) add(mk, feesTotal(b.fees));
        } else {
          if (b.airbnbPrice && b.duration) add(mk, b.airbnbPrice / b.duration);
          if (isStart) add(mk, feesTotal(b.fees));
        }
      }
    }
    return m;
  }, [monthMap]);

  // PREDICTED gross per month = booked income + projected income from the still-open
  // FUTURE nights (per-room blended rate → room.price prior), same estimator as the
  // This-Month "Estimated Total". Past months have no open future nights, so their
  // prediction equals realized (no dashed cap). Present + future months project up.
  const predictedByMonth = useMemo(() => {
    const activeRooms = rooms.filter((r) => r.active);
    const now = startOfToday();
    const K = 5; // shrinkage prior strength toward room.price
    const out = new Map<string, number>();
    for (const mDate of trendMonths) {
      const mk = format(mDate, "yyyy-MM", { timeZone });
      const dateKeys = eachDayOfInterval({ start: startOfMonth(mDate), end: endOfMonth(mDate) }).map(
        (d) => format(d, "yyyy-MM-dd", { timeZone }),
      );
      let potential = 0;
      for (const room of activeRooms) {
        let bookedNights = 0;
        let bookedProfit = 0;
        let openFutureNights = 0;
        for (const dk of dateKeys) {
          const day = monthMap.get(dk);
          const roomBookings = day?.bookings.filter((b) => b.room?.id === room.id) ?? [];
          if (roomBookings.length > 0) {
            bookedNights++;
            bookedProfit += roomBookings.reduce((sum, b) => {
              const fee = b.startDate.split("T")[0] === dk ? feesTotal(b.fees) : 0;
              if (b.guest.name !== "AirBnB") {
                return sum + (b.price ?? 0) + fee;
              }
              const nightly = b.airbnbPrice && b.duration ? b.airbnbPrice / b.duration : 0;
              return sum + nightly + fee;
            }, 0);
          } else {
            const blocked = day ? day.isBlocked || day.blockedRooms.some((r) => r?.id === room.id) : false;
            if (!blocked && new Date(`${dk}T12:00:00`) >= now) openFutureNights++;
          }
        }
        const weight = bookedNights / (bookedNights + K);
        const avgRate = weight * (bookedNights > 0 ? bookedProfit / bookedNights : 0) + (1 - weight) * room.price;
        potential += openFutureNights * avgRate;
      }
      out.set(mk, (grossByMonth.get(mk) ?? 0) + potential);
    }
    return out;
  }, [rooms, trendMonths, monthMap, timeZone, grossByMonth]);

  const [trendData, setTrendData] = useState<TrendRow[]>([]);
  useEffect(() => {
    if (!hostId || !token) {
      setTrendData([]);
      return;
    }
    const rangeStart = format(trendMonths[0], "yyyy-MM-dd", { timeZone });
    const rangeEnd = format(endOfMonth(trendMonths[5]), "yyyy-MM-dd", { timeZone });
    Promise.all([
      fetchAssignments(hostId, rangeStart, rangeEnd, token).catch(() => []),
      fetchMiscExpenses(hostId, token).catch(() => []),
    ]).then(([assigns, misc]) => {
      setTrendData(
        trendMonths.map((mDate) => {
          const mk = format(mDate, "yyyy-MM", { timeZone });
          const gross = grossByMonth.get(mk) ?? 0;
          const cleaning =
            assigns
              .filter((a) => a.date.slice(0, 7) === mk && a.hours != null && a.cleaner)
              .reduce((s, a) => s + a.hours! * rateOn(a.cleaner!, a.date), 0) +
            baselineFeeFor(mk);
          const miscTotal = misc
            .filter((e) => isExpenseInMonth(e, mk))
            .reduce((s, e) => s + e.amount, 0);
          return {
            month: mk,
            label: format(mDate, "MMM", { timeZone }),
            longLabel: format(mDate, "MMM yyyy", { timeZone }),
            gross,
            cleaning,
            misc: miscTotal,
            net: gross - cleaning - miscTotal,
          };
        }),
      );
    });
  }, [hostId, token, trendMonths, timeZone, grossByMonth, cleaners, isOpen]);

  // Booking-rate (occupancy) and AirBnB-share per month, computed straight from
  // monthMap — no fetch. Occupancy = booked ÷ available room-nights (blocked
  // nights excluded as off-market); AirBnB share = AirBnB ÷ all booked nights.
  const bookingTrend = useMemo(() => {
    const active = rooms.filter((r) => r.active);
    return trendMonths.map((mDate) => {
      const days = eachDayOfInterval({ start: startOfMonth(mDate), end: endOfMonth(mDate) });
      let available = 0;
      let booked = 0;
      let airbnb = 0;
      for (const room of active) {
        for (const dt of days) {
          const dk = format(dt, "yyyy-MM-dd", { timeZone });
          const d = monthMap.get(dk);
          const blocked = d ? d.isBlocked || d.blockedRooms.some((r) => r?.id === room.id) : false;
          if (blocked) continue;
          available++;
          const b = d?.bookings.find((x) => x.room?.id === room.id);
          if (b) {
            booked++;
            if (b.guest.name === "AirBnB") airbnb++;
          }
        }
      }
      return {
        month: format(mDate, "yyyy-MM", { timeZone }),
        label: format(mDate, "MMM", { timeZone }),
        longLabel: format(mDate, "MMM yyyy", { timeZone }),
        occupancy: available ? (booked / available) * 100 : 0,
        airbnbShare: booked ? (airbnb / booked) * 100 : 0,
      };
    });
  }, [trendMonths, rooms, monthMap, timeZone]);

  // All date keys in the current month (includes days with no bookings)
  const allMonthDateKeys = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth),
  }).map((date) => format(date, "yyyy-MM-dd", { timeZone }));

  // Collect date keys that are in the current month and >= today, sorted chronologically
  const eligibleDateKeys = allMonthDateKeys
    .filter((dateKey) => {
      const date = new Date(`${dateKey}T12:00:00`);
      return isAfter(date, today) || date.toDateString() === today.toDateString();
    })
    .sort();

  const stats = rooms
    .filter((r) => r.active)
    .map((room) => {
      const unbookedDates: string[] = [];
      for (const dateKey of eligibleDateKeys) {
        const day = monthMap.get(dateKey);
        const isBooked = day ? day.bookings.some((b) => b.room?.id === room.id) : false;
        const isBlocked = day ? (day.isBlocked || day.blockedRooms.some((r) => r?.id === room.id)) : false;
        if (!isBooked && !isBlocked) unbookedDates.push(dateKey);
      }

      let bookedNights = 0;
      const bookedProfit = allMonthDateKeys.reduce((total, dateKey) => {
        const day = monthMap.get(dateKey);
        if (!day) return total;
        const roomBookings = day.bookings.filter((b) => b.room?.id === room.id);
        if (roomBookings.length > 0) bookedNights++;
        return total + roomBookings.reduce((sum, booking) => {
            // Whole-stay fees (parking/cleaning/etc.) count once, on the start
            // night — same as the main calendar's profit stat. Omitting them made
            // this Total read low vs the calendar figure.
            const fee = booking.startDate.split("T")[0] === dateKey ? feesTotal(booking.fees) : 0;
            if (booking.guest.name !== "AirBnB") {
              return sum + (booking.price ?? 0) + fee;
            } else {
              const nightly =
                booking.airbnbPrice && booking.duration
                  ? booking.airbnbPrice / booking.duration
                  : 0;
              return sum + nightly + fee;
            }
          }, 0);
      }, 0);

      // Shrinkage estimator: blend sample avg toward room.price prior when sample is small
      const k = 5;
      const weight = bookedNights / (bookedNights + k);
      const avgNightlyRate = weight * (bookedNights > 0 ? bookedProfit / bookedNights : 0) + (1 - weight) * room.price;
      const potentialProfit = unbookedDates.length * avgNightlyRate;
      return {
        room,
        unbookedDates,
        unbookedNights: unbookedDates.length,
        potentialProfit,
        bookedProfit,
        estimatedProfit: bookedProfit + potentialProfit,
      };
    });

  stats.sort((a, b) => a.unbookedNights - b.unbookedNights);

  // Width enough to cover the longest room name (6.5px per char at text-[10px] + 16px padding)

  const totalNights = stats.reduce((sum, s) => sum + s.unbookedNights, 0);
  const totalMonthProfit = stats.reduce((sum, s) => sum + s.estimatedProfit, 0);
  const netProfit = totalMonthProfit - cleaningFee - miscFee;
  const dollars = (n: number) => `$${Math.round(n).toLocaleString()}`;
  // Shared style so the Total and Net profit amounts always render identical size.
  const bigAmountCls = "inline-block rounded-lg px-3 py-1 text-2xl font-bold text-white";

  const monthLabel = currentMonth.toLocaleString("default", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="p-3 flex flex-col gap-3 h-full overflow-y-auto">
      <div className="flex flex-col gap-0.5">
        <h2 className="text-sm font-bold text-gray-700">
          {airbnbName ? `${airbnbName}: Statistics` : "Statistics"} — {monthLabel}
        </h2>
        <span className="text-xs text-gray-500">
          Today: <span className="font-semibold text-gray-700">{format(today, "MMM d, yyyy", { timeZone })}</span>
        </span>
      </div>

      {/* Tabs: this month's breakdown · profit trend · booking trend */}
      <div className="grid grid-cols-3 gap-1 rounded-xl bg-gray-100 p-1">
        {(
          [
            ["month", "This Month"],
            ["profit", "Profit"],
            ["bookings", "Bookings"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={`rounded-lg py-1.5 text-xs font-semibold transition-colors ${
              tab === k ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "month" && (
        <>
      {stats.length === 0 ? (
        <p className="text-xs text-gray-500">No active rooms found.</p>
      ) : (
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="text-left text-gray-500 border-b">
              <th className="pb-1 font-semibold">Room</th>
              <th className="pb-1 font-semibold">Nights left</th>
              <th className="pb-1 font-semibold text-right">Estimated profit</th>
            </tr>
          </thead>
          <tbody>
            {stats.map(({ room, unbookedNights, unbookedDates, estimatedProfit }) => {
              const days = unbookedDates.map((dateKey) =>
                format(new Date(`${dateKey}T12:00:00`), "d", { timeZone }),
              );
              const monthName =
                unbookedDates.length > 0
                  ? format(new Date(`${unbookedDates[0]}T12:00:00`), "MMMM", { timeZone })
                  : "";
              const dateList =
                unbookedDates.length > 0
                  ? `${monthName} ${days.join(", ")}`
                  : "";
              return (
                <tr key={room.id} className="border-b border-gray-100">
                  <td className="py-1.5">
                    <RoomBadge room={room} rooms={rooms} />
                  </td>
                  <td className="py-1.5 text-gray-600">
                    {unbookedNights > 0 ? (
                      `${unbookedNights} (${dateList})`
                    ) : (
                      <span className="text-emerald-600 font-medium">Sold out</span>
                    )}
                  </td>
                  <td className="py-1.5 text-right font-medium text-emerald-600">
                    ${estimatedProfit.toFixed(2)}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="font-bold text-gray-800">
              <td className="pt-2">Total</td>
              <td className="pt-2">{totalNights}</td>
              <td className="pt-2 text-right">
                <span className={`${bigAmountCls} bg-emerald-600`}>
                  ${Math.round(totalMonthProfit).toLocaleString()}
                </span>
              </td>
            </tr>
          </tfoot>
        </table>
      )}

      {/* Financial summary — gross Total (above) minus this month's costs → net */}
      {stats.length > 0 && (
        <div className="flex flex-col gap-1 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-gray-500">Cleaning fee</span>
            <span className="font-medium text-rose-500">−{dollars(cleaningFee)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-500">Misc fee</span>
            <span className="font-medium text-rose-500">−{dollars(miscFee)}</span>
          </div>
          <div className="mt-0.5 flex items-center justify-between border-t border-gray-200 pt-2">
            <span className="text-base font-bold text-gray-800">Net profit</span>
            <span className={`${bigAmountCls} ${netProfit >= 0 ? "bg-emerald-600" : "bg-rose-600"}`}>
              {dollars(netProfit)}
            </span>
          </div>
        </div>
      )}

<p className="text-[10px] text-gray-400">
        Booked nights use actual pricing · unbooked nights use shrinkage-adjusted avg (blended toward default rate when sample is small)
      </p>
        </>
      )}

      {tab === "profit" &&
        (trendData.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-400">Loading trend…</p>
        ) : (
          <div className="flex flex-col gap-4">
            <div>
              <div className="mb-1 flex items-baseline justify-between">
                <span className="text-xs font-semibold text-gray-700">Gross profit</span>
                <span className="text-[10px] text-gray-400">booked ▪ · projected ┄</span>
              </div>
              <TrendBars
                rows={trendData.map((r) => ({ ...r, value: r.gross, predicted: predictedByMonth.get(r.month) }))}
                colorFor={() => TREND_BLUE}
              />
            </div>
            <div>
              <div className="mb-1 flex items-baseline justify-between">
                <span className="text-xs font-semibold text-gray-700">Net profit</span>
                <span className="text-[10px] text-gray-400">booked ▪ · projected ┄</span>
              </div>
              <TrendBars
                rows={trendData.map((r) => ({
                  ...r,
                  value: r.net,
                  // Projected net = projected gross − this month's cleaning & misc.
                  predicted: (predictedByMonth.get(r.month) ?? r.gross) - r.cleaning - r.misc,
                }))}
                colorFor={(v) => (v >= 0 ? TREND_EMERALD : TREND_ROSE)}
              />
            </div>
            <div>
              <div className="mb-1 flex items-baseline justify-between">
                <span className="text-xs font-semibold text-gray-700">Costs</span>
                <span className="text-[10px] text-gray-400">cleaning &amp; misc per month</span>
              </div>
              <GroupedBars
                rows={trendData.map((r) => ({
                  month: r.month,
                  label: r.label,
                  longLabel: r.longLabel,
                  values: [r.cleaning, r.misc],
                }))}
                series={[
                  { name: "Cleaning", color: TREND_AMBER },
                  { name: "Misc", color: TREND_VIOLET },
                ]}
              />
            </div>
            <p className="text-[10px] text-gray-400">
              Gross = realized booking income. The current month is still in progress. Tap/hover a
              bar for the exact amount.
            </p>
          </div>
        ))}

      {tab === "bookings" && (
        <div className="flex flex-col gap-4">
          <div>
            <div className="mb-1 flex items-baseline justify-between">
              <span className="text-xs font-semibold text-gray-700">Booking rate</span>
              <span className="text-[10px] text-gray-400">occupancy, last 6 months</span>
            </div>
            <TrendBars
              rows={bookingTrend.map((r) => ({ ...r, value: r.occupancy }))}
              colorFor={() => TREND_EMERALD}
              fmt={fmtPct}
              fmtTip={fmtPctFull}
              axisMax={100}
            />
          </div>
          <div>
            <div className="mb-1 flex items-baseline justify-between">
              <span className="text-xs font-semibold text-gray-700">AirBnB share</span>
              <span className="text-[10px] text-gray-400">% of booked nights via AirBnB</span>
            </div>
            <TrendBars
              rows={bookingTrend.map((r) => ({ ...r, value: r.airbnbShare }))}
              colorFor={() => TREND_ORANGE}
              fmt={fmtPct}
              fmtTip={fmtPctFull}
              axisMax={100}
            />
          </div>
          <p className="text-[10px] text-gray-400">
            Booking rate = booked ÷ available room-nights (blocked nights excluded). AirBnB share =
            AirBnB ÷ all booked nights. Current month still in progress.
          </p>
        </div>
      )}
    </div>
  );
};

export default AvailabilitiesModal;