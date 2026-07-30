import { useEffect, useMemo, useState } from "react";
import { isAfter, startOfToday, startOfMonth, endOfMonth, eachDayOfInterval, subMonths } from "date-fns";
import { format } from "date-fns-tz";
import { dayType } from "../../../util/types/dayType";
import { roomType } from "../../../util/types/roomType";
import RoomBadge from "../../shared/RoomBadge";
import { fetchAssignments } from "../../../util/cleanerOperations";
import { fetchMiscExpenses, isExpenseInMonth } from "../../../util/miscOperations";

// App money palette (matches the Total / Net badges): emerald for profit, rose
// for a loss. A single measure per chart, so no categorical CVD pair — and the
// Net chart encodes sign by bar direction (above/below zero) + a signed label,
// not color alone.
const TREND_EMERALD = "#059669";
const TREND_ROSE = "#e11d48";

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

// Dependency-free SVG bar chart with a zero baseline (handles negatives), direct
// value labels, and a native hover tooltip per bar.
const TrendBars = ({
  rows,
  pick,
  colorFor,
}: {
  rows: TrendRow[];
  pick: (r: TrendRow) => number;
  colorFor: (v: number) => string;
}) => {
  const vals = rows.map(pick);
  const maxV = Math.max(0, ...vals);
  const minV = Math.min(0, ...vals);
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
        const v = pick(r);
        const x = padX + slot * i + (slot - bw) / 2;
        const h = (Math.abs(v) / range) * plotH;
        const y = v >= 0 ? zeroY - h : zeroY;
        return (
          <g key={r.month}>
            <rect x={x} y={y} width={bw} height={Math.max(h, 1)} rx="2.5" fill={colorFor(v)}>
              <title>{`${r.longLabel}: ${fmtFull(v)}`}</title>
            </rect>
            <text
              x={x + bw / 2}
              y={v >= 0 ? y - 3 : zeroY - 4}
              textAnchor="middle"
              fontSize="9"
              fontWeight="600"
              fill="#52514e"
            >
              {fmtShort(v)}
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

interface AvailabilitiesModalProps {
  monthMap: Map<string, dayType>;
  rooms: roomType[];
  currentMonth: Date;
  airbnbName?: string;
  hostId?: string;
  token?: string;
}

const AvailabilitiesModal = ({ monthMap, rooms, currentMonth, airbnbName, hostId, token }: AvailabilitiesModalProps) => {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const today = startOfToday();

  // This month's cleaning cost (recorded hours × rate) and misc-expense total.
  // Both are subtracted from the estimated gross to show a net figure.
  const [cleaningFee, setCleaningFee] = useState(0);
  const [miscFee, setMiscFee] = useState(0);

  useEffect(() => {
    if (!hostId || !token) return;
    const start = format(startOfMonth(currentMonth), "yyyy-MM-dd", { timeZone });
    const end = format(endOfMonth(currentMonth), "yyyy-MM-dd", { timeZone });
    const monthKey = format(startOfMonth(currentMonth), "yyyy-MM", { timeZone });

    fetchAssignments(hostId, start, end, token)
      .then((assignments) =>
        setCleaningFee(
          assignments.reduce(
            (sum, a) => sum + (a.hours != null && a.cleaner ? a.hours * a.cleaner.payRate : 0),
            0,
          ),
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
  }, [hostId, token, currentMonth, timeZone]);

  // ── Trend tab: gross & net profit over the last 6 months ──────────────────
  const [tab, setTab] = useState<"month" | "trend">("month");

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
        const roomId = b.room.id;
        const isStart = b.startDate.split("T")[0] === dateKey;
        if (b.guest.name !== "AirBnB") {
          const gp = b.guest.pricing?.find((p) => p.room === roomId);
          if (gp) add(mk, gp.price);
          if (isStart) add(mk, feesTotal(b.fees));
        } else {
          if (b.airbnbPrice && b.duration) add(mk, b.airbnbPrice / b.duration);
          if (isStart) add(mk, feesTotal(b.fees));
        }
      }
    }
    return m;
  }, [monthMap]);

  const [trendData, setTrendData] = useState<TrendRow[]>([]);
  useEffect(() => {
    if (!hostId || !token) {
      setTrendData([]);
      return;
    }
    const months = Array.from({ length: 6 }, (_, i) =>
      startOfMonth(subMonths(currentMonth, 5 - i)),
    );
    const rangeStart = format(months[0], "yyyy-MM-dd", { timeZone });
    const rangeEnd = format(endOfMonth(months[5]), "yyyy-MM-dd", { timeZone });
    Promise.all([
      fetchAssignments(hostId, rangeStart, rangeEnd, token).catch(() => []),
      fetchMiscExpenses(hostId, token).catch(() => []),
    ]).then(([assigns, misc]) => {
      setTrendData(
        months.map((mDate) => {
          const mk = format(mDate, "yyyy-MM", { timeZone });
          const gross = grossByMonth.get(mk) ?? 0;
          const cleaning = assigns
            .filter((a) => a.date.slice(0, 7) === mk && a.hours != null && a.cleaner)
            .reduce((s, a) => s + a.hours! * a.cleaner!.payRate, 0);
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
  }, [hostId, token, currentMonth, timeZone, grossByMonth]);

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
              const guestPricing = booking.guest.pricing?.find((p) => p.room === booking.room?.id);
              return sum + (guestPricing ? guestPricing.price : 0) + fee;
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

      {/* Tabs: this month's breakdown vs the multi-month trend */}
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-gray-100 p-1">
        {(["month", "trend"] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={`rounded-lg py-1.5 text-xs font-semibold transition-colors ${
              tab === k ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
            }`}
          >
            {k === "month" ? "This Month" : "Trend"}
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

      {tab === "trend" &&
        (trendData.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-400">Loading trend…</p>
        ) : (
          <div className="flex flex-col gap-4">
            <div>
              <div className="mb-1 flex items-baseline justify-between">
                <span className="text-xs font-semibold text-gray-700">Gross profit</span>
                <span className="text-[10px] text-gray-400">last 6 months</span>
              </div>
              <TrendBars rows={trendData} pick={(r) => r.gross} colorFor={() => TREND_EMERALD} />
            </div>
            <div>
              <div className="mb-1 flex items-baseline justify-between">
                <span className="text-xs font-semibold text-gray-700">Net profit</span>
                <span className="text-[10px] text-gray-400">gross − cleaning − misc</span>
              </div>
              <TrendBars
                rows={trendData}
                pick={(r) => r.net}
                colorFor={(v) => (v >= 0 ? TREND_EMERALD : TREND_ROSE)}
              />
            </div>
            <p className="text-[10px] text-gray-400">
              Gross = realized booking income. The current month is still in progress. Tap/hover a
              bar for the exact amount.
            </p>
          </div>
        ))}
    </div>
  );
};

export default AvailabilitiesModal;