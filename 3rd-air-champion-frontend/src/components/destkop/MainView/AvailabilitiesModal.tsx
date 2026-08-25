import { useEffect, useMemo, useRef, useState } from "react";
import { startOfToday, startOfMonth, endOfMonth, eachDayOfInterval, subMonths, startOfWeek, addDays, isSameMonth } from "date-fns";
import { format } from "date-fns-tz";
import { dayType } from "../../../util/types/dayType";
import { roomType } from "../../../util/types/roomType";
import RoomBadge from "../../shared/RoomBadge";
import { fetchAssignments, fetchCleaners, rateOn, CleanerType, CleaningAssignmentType } from "../../../util/cleanerOperations";
import { fetchMiscExpenses, isExpenseInMonth } from "../../../util/miscOperations";
import { fetchCharges, isChargeInMonth, ChargeType } from "../../../util/chargeOperations";
import { bookingNightAmount, getRoomMonthEstimates, monthDateKeys, getDayGross } from "../../../util/profit";
import { getCleaningEntriesFor } from "../../../util/cleaningTasks";

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
        //
        // The old threshold hid the cap unless the projection beat booked by 1%
        // of the whole axis — so a nearly-full month, where projected sits just
        // above booked, lost its projection entirely. That is precisely the month
        // the projection is most reassuring on, and it read as a missing feature.
        // Now anything above booked draws; the floor only screens float noise and
        // past months, where projected equals booked exactly.
        const showPred = r.predicted != null && r.predicted - v > Math.max(0.5, range * 0.002);
        const yPred = showPred ? zeroY - (r.predicted! / range) * plotH : 0;
        // With the cap that close to the bar top, the two value labels would sit
        // on each other. The projected number keeps the space above the dashed
        // line and the booked number moves inside its own bar, which is solid
        // enough to read white — rather than one of them being dropped.
        const gap = y - yPred;
        const labelInside = showPred && gap <= 11 && h > 16;
        const showPredLabel = showPred && (gap > 11 || labelInside);
        return (
          <g key={r.month}>
            {showPred && (
              <>
                <rect x={x} y={yPred} width={bw} height={Math.max(0, y - yPred)} fill={colorFor(r.predicted!)} opacity={0.13} />
                <line x1={x - 2} x2={x + bw + 2} y1={yPred} y2={yPred} stroke={colorFor(r.predicted!)} strokeWidth="1.5" strokeDasharray="3 2" />
                {showPredLabel && (
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
              y={labelInside ? y + 11 : v >= 0 ? y - 3 : zeroY - 4}
              textAnchor="middle"
              fontSize="9"
              fontWeight="600"
              fill={labelInside ? "#ffffff" : "#52514e"}
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
  // Guest charges landing in the viewed month (cancellation fees, damage).
  const [charges, setCharges] = useState<ChargeType[]>([]);
  // This month's assignments, and a longer history used only to price cleanings
  // that have not happened yet.
  const [monthAssignments, setMonthAssignments] = useState<CleaningAssignmentType[]>([]);
  const [historyAssignments, setHistoryAssignments] = useState<CleaningAssignmentType[]>([]);

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
      .then((assignments) => {
        // Kept, not just summed: the month's still-unworked assignments are what
        // the cleaning outlook prices, and they carry the cleaner (hence the
        // rate) even before any hours are recorded.
        setMonthAssignments(assignments);
        setCleaningFee(
          assignments.reduce(
            (sum, a) =>
              sum + (a.hours != null && a.cleaner ? a.hours * rateOn(a.cleaner, a.date) : 0),
            0,
          ) + baselineFeeFor(monthKey),
        );
      })
      .catch(() => {
        setMonthAssignments([]);
        setCleaningFee(0);
      });

    fetchMiscExpenses(hostId, token)
      .then((items) =>
        setMiscFee(
          items.filter((e) => isExpenseInMonth(e, monthKey)).reduce((s, e) => s + e.amount, 0),
        ),
      )
      .catch(() => setMiscFee(0));

    // Guest charges with no stay behind them — a cancellation fee above all.
    // They are real money in, so they belong in the month's total; without this
    // a fee could be recorded and still never be reported anywhere.
    fetchCharges(hostId, token)
      .then((items) => setCharges(items.filter((c) => isChargeInMonth(c, monthKey))))
      .catch(() => setCharges([]));
  }, [hostId, token, currentMonth, timeZone, cleaners, isOpen]);

  // ── Trend tabs: profit & booking metrics over the last 6 months ───────────
  const [tab, setTab] = useState<"month" | "profit" | "bookings" | "weekday">("month");

  // The 6-month window (oldest → current), shared by both trend tabs.
  const trendMonths = useMemo(
    () => Array.from({ length: 6 }, (_, i) => startOfMonth(subMonths(currentMonth, 5 - i))),
    [currentMonth],
  );

  // Realized booking income bucketed by month, from the full calendar history in
  // monthMap (same per-night formula as the calendar's profit stat).
  const grossByMonth = useMemo(() => {
    const m = new Map<string, number>();
    const add = (k: string, v: number) => m.set(k, (m.get(k) ?? 0) + v);
    for (const [dateKey, day] of monthMap) {
      const mk = dateKey.slice(0, 7);
      for (const b of day.bookings) {
        if (!b.room) continue;
        add(mk, bookingNightAmount(b, dateKey));
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
            bookedProfit += roomBookings.reduce((sum, b) => sum + bookingNightAmount(b, dk), 0);
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
      // Charges belong in the trend for the same reason they belong in Net:
      // leave them out here and the August bar disagrees with the August card
      // about the same month. Start-night fees taught this lesson once already.
      fetchCharges(hostId, token).catch(() => []),
    ]).then(([assigns, misc, chargeList]) => {
      // Six months of history is a far steadier basis for "what does a cleaning
      // cost" than the handful recorded so far this month.
      setHistoryAssignments(assigns);
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
          const chargeTotal = chargeList
            .filter((c) => isChargeInMonth(c, mk))
            .reduce((s, c) => s + c.amount, 0);
          return {
            month: mk,
            label: format(mDate, "MMM", { timeZone }),
            longLabel: format(mDate, "MMM yyyy", { timeZone }),
            gross,
            cleaning,
            misc: miscTotal,
            net: gross + chargeTotal - cleaning - miscTotal,
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

  // Per-room booked + projected income. Shared with the day view's open-room
  // projection so a room is worth the same per open night on both screens.
  // From today onward is what's left to sell; a month entirely in the past has
  // no eligible nights and so no potential, which falls out of the same filter.
  const stats = getRoomMonthEstimates(
    monthMap,
    rooms,
    format(startOfMonth(currentMonth), "yyyy-MM"),
    format(today, "yyyy-MM-dd"),
  );

  stats.sort((a, b) => a.unbookedNights - b.unbookedNights);

  // Width enough to cover the longest room name (6.5px per char at text-[10px] + 16px padding)

  const totalNights = stats.reduce((sum, s) => sum + s.unbookedNights, 0);
  const totalMonthProfit = stats.reduce((sum, s) => sum + s.estimatedProfit, 0);

  // ── Cleaning outlook: what the REST of this month will cost ────────────────
  //
  // Cindy is both cohost and cleaner, and decides from this tab whether to take
  // more cleanings herself to hold the cost down. A recorded-only figure cannot
  // answer that: on the 5th it reads near zero regardless of how heavy the month
  // ahead is. She needs the month's landing cost, early enough to act on.
  //
  // It also fixes an inconsistency that flattered the month. Net already used
  // PROJECTED gross but recorded-only cleaning, so income counted nights nobody
  // had booked while cost ignored cleanings nobody had worked.
  //
  // A cleaning's price is hours x rate, and hours are only known once worked, so
  // future ones are priced at the trailing average of what cleanings actually
  // took. Where a cleaner is already assigned, their own rate is used; otherwise
  // the average rate paid.
  //
  // Averaged as COST, never as average-hours x average-rate. Those two means
  // are not independent here: Cindy cleans as owner at $0 and takes the long
  // visits, the paid cleaners take the short ones, so hours and rate correlate
  // negatively. E[h] x E[r] priced a room at $36.71 when 116 real cleanings say
  // $15.03 — a 2.44x overcharge that tracked rooms-per-visit (2.47) closely
  // enough to look like a per-visit/per-room mixup, and was not one.
  //
  // A cleaning EVENT is a cleaner-day, not a row: the visit's hours sit on one
  // room's row and 0 on its siblings. So group into visits first, then divide
  // by ROOMS for anything per-room.
  const cleaningNorms = useMemo(() => {
    const visits = new Map<
      string,
      { date: string; cleaner: CleanerType; rooms: number; hours: number }
    >();
    for (const a of historyAssignments) {
      if (!a.cleaner || !a.room) continue;
      const key = `${a.cleaner.id}|${a.date}`;
      const v = visits.get(key) ?? { date: a.date, cleaner: a.cleaner, rooms: 0, hours: 0 };
      v.rooms += 1;
      if (a.hours != null) v.hours += a.hours;
      visits.set(key, v);
    }
    const worked = [...visits.values()].filter((v) => v.hours > 0);
    if (worked.length === 0) return null;

    const totalRooms = worked.reduce((s, v) => s + v.rooms, 0);
    const totalHours = worked.reduce((s, v) => s + v.hours, 0);
    const totalCost = worked.reduce((s, v) => s + v.hours * rateOn(v.cleaner, v.date), 0);

    // Each cleaner's own speed, so a room somebody is already down for is priced
    // at what THEY take rather than at the house average — the house average
    // includes unpaid owner hours and would misprice a paid cleaner's morning.
    const per = new Map<string, { rooms: number; hours: number }>();
    for (const v of worked) {
      const p = per.get(v.cleaner.id) ?? { rooms: 0, hours: 0 };
      p.rooms += v.rooms;
      p.hours += v.hours;
      per.set(v.cleaner.id, p);
    }

    const hoursPerRoom = totalHours / totalRooms;
    return {
      hoursPerRoom,
      // What a room has actually cost, whoever cleaned it — the right price for
      // a morning with nobody assigned yet.
      costPerRoom: totalCost / totalRooms,
      hoursPerRoomFor: (id: string) => {
        const p = per.get(id);
        return p && p.rooms > 0 ? p.hours / p.rooms : hoursPerRoom;
      },
      sample: worked.length,
      rooms: totalRooms,
    };
  }, [historyAssignments]);

  // Cleanings still to come this month, and what they should cost. Uses the same
  // determination the Plan tab and the Clean badge use, so the count here is the
  // count you see there rather than a second opinion.
  const cleaningOutlook = useMemo(() => {
    if (!cleaningNorms) return null;
    const todayKey = format(today, "yyyy-MM-dd", { timeZone });
    const monthKey = format(startOfMonth(currentMonth), "yyyy-MM", { timeZone });
    let cost = 0;
    let count = 0;
    let probable = 0;
    for (const dateKey of monthDateKeys(monthKey)) {
      if (dateKey < todayKey) continue; // already happened; recorded hours cover it
      for (const entry of getCleaningEntriesFor(monthMap, dateKey)) {
        const roomId = entry.checkoutBooking.room?.id;
        if (!roomId) continue;
        const assigned = monthAssignments.find(
          (a) => a.date === dateKey && a.room?.id === roomId,
        );
        // Hours already recorded — it is in the actual figure, not the outlook.
        if (assigned?.hours != null) continue;
        count++;
        if (entry.probable) probable++;
        // Weighted by the odds the cleaning actually happens. A gap turnover is
        // a room with no booking yet — it only needs cleaning if that night
        // sells, which rebookOdds measures. Charging every one of them at full
        // price billed the month for cleanings nobody may ever do, and at high
        // occupancy that is most of the rooms in an empty stretch. The field has
        // carried these odds all along (Plan prints them as the % on a dashed
        // chip); this was the one surface spending them as certainties.
        //
        // A confirmed checkout carries odds of exactly 1, so it is unaffected.
        cost +=
          entry.rebookOdds *
          (assigned?.cleaner
            ? cleaningNorms.hoursPerRoomFor(assigned.cleaner.id) *
              rateOn(assigned.cleaner, dateKey)
            : cleaningNorms.costPerRoom);
      }
    }
    return { cost, count, probable };
  }, [cleaningNorms, monthAssignments, monthMap, currentMonth, timeZone, today]);

  const estimatedCleaningFee = cleaningFee + (cleaningOutlook?.cost ?? 0);
  // Guest charges with no stay behind them. Money IN, so it ADDS — the one line
  // on this card that is a cost-shaped row and yet increases the total.
  const chargesTotal = charges.reduce((s, c) => s + c.amount, 0);
  const chargesUnpaid = charges.filter((c) => !c.paid).length;
  // The month this modal is showing — the one the outlook was computed for.
  const viewedMonthKey = format(startOfMonth(currentMonth), "yyyy-MM", { timeZone });
  // Charges ride INSIDE the headline Total rather than sitting beside it. A fee
  // is money the month earned; splitting it out made the host add two numbers to
  // learn what the month took. Net is unchanged by the move — it always counted
  // them, just further down.
  const totalWithCharges = totalMonthProfit + chargesTotal;
  const netProfit = totalWithCharges - estimatedCleaningFee - miscFee;
  const dollars = (n: number) => `$${Math.round(n).toLocaleString()}`;
  // Shared style so the Total and Net profit amounts always render identical size.
  const bigAmountCls = "inline-block rounded-lg px-3 py-1 text-2xl font-bold text-white";

  // One week at a time: what each day of THAT week actually earned.
  //
  // An average across many weeks answers a different question — it smooths
  // away the week being looked at, which is the one with a slow Tuesday in it.
  const [weekStart, setWeekStart] = useState<Date>(() =>
    startOfWeek(isSameMonth(startOfToday(), currentMonth) ? startOfToday() : startOfMonth(currentMonth), {
      weekStartsOn: 0,
    }),
  );

  // Follow the calendar when the host changes month, landing on the current
  // week if that month contains today and on its first week otherwise.
  useEffect(() => {
    setWeekStart(
      startOfWeek(isSameMonth(startOfToday(), currentMonth) ? startOfToday() : startOfMonth(currentMonth), {
        weekStartsOn: 0,
      }),
    );
  }, [currentMonth]);

  const weekDays = useMemo(() => {
    const rows = Array.from({ length: 7 }, (_, i) => {
      const date = addDays(weekStart, i);
      const key = format(date, "yyyy-MM-dd", { timeZone });
      const day = monthMap.get(key);
      // The same per-night formula the Daily Profit tab uses, so a day here and
      // a day there can never disagree.
      const gross = getDayGross(day, key).total;
      const roomsSold = day ? new Set(day.bookings.filter((x) => x.room).map((x) => x.room!.id)).size : 0;
      return { date, key, label: format(date, "EEE", { timeZone }), dayNum: format(date, "d", { timeZone }), gross, roomsSold };
    });
    const total = rows.reduce((sum, r) => sum + r.gross, 0);
    const earning = rows.filter((r) => r.gross > 0);
    const best = earning.length ? earning.reduce((x, y) => (y.gross > x.gross ? y : x)) : null;
    const worst = earning.length ? earning.reduce((x, y) => (y.gross < x.gross ? y : x)) : null;
    return { rows, total, best, worst, any: earning.length > 0 };
  }, [weekStart, monthMap, timeZone]);

  const todayKey = format(startOfToday(), "yyyy-MM-dd", { timeZone });

  // Swipe the bars to change week.
  //
  // Same direction as the calendar — content moving left means "next" — so the
  // two surfaces never disagree about which way time runs. The arrows stay: this
  // panel is used on a desktop too, and a swipe leaves no trace of existing.
  const weekSwipeRef = useRef<{ x: number; y: number; t: number } | null>(null);

  const onWeekTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    const t = e.touches[0];
    weekSwipeRef.current = { x: t.clientX, y: t.clientY, t: performance.now() };
  };

  const onWeekTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    const start = weekSwipeRef.current;
    weekSwipeRef.current = null;
    if (!start) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    // The panel scrolls vertically, so a gesture only counts when it is clearly
    // horizontal — otherwise scrolling past this card would jump the week.
    if (performance.now() - start.t > 600) return;
    if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 2) return;
    setWeekStart((w) => addDays(w, dx < 0 ? 7 : -7));
  };

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

      {/* Tabs: this month · profit trend · booking trend · day-of-week.
          Two rows of two rather than four across — four tabs on a phone would
          shrink each label past reading, and these labels are already long. */}
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-gray-100 p-1">
        {(
          [
            ["month", "This Month"],
            ["weekday", "Weekly"],
            ["profit", "Monthly Profit"],
            ["bookings", "Monthly Bookings"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            // nowrap: "Monthly Bookings" would otherwise wrap on a phone and
            // leave this tab two lines tall next to "This Month".
            className={`whitespace-nowrap rounded-lg py-1.5 text-[11px] font-semibold transition-colors ${
              tab === k ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "weekday" && (
        <>
          {/* Week picker. Arrows rather than a date field: the question is
              almost always "this week" or "the one before". */}
          <div className="flex items-center justify-between gap-2 rounded-xl border border-gray-200 px-2 py-1.5">
            <button
              type="button"
              onClick={() => setWeekStart((w) => addDays(w, -7))}
              className="rounded-lg px-2 py-1 text-sm font-bold text-gray-500 hover:bg-gray-100"
              aria-label="Previous week"
            >
              ‹
            </button>
            <span className="text-xs font-bold text-gray-700">
              {format(weekStart, "MMM d", { timeZone })} – {format(addDays(weekStart, 6), "MMM d", { timeZone })}
            </span>
            <button
              type="button"
              onClick={() => setWeekStart((w) => addDays(w, 7))}
              className="rounded-lg px-2 py-1 text-sm font-bold text-gray-500 hover:bg-gray-100"
              aria-label="Next week"
            >
              ›
            </button>
          </div>

          {/* touch-pan-y: vertical scrolling stays the browser's; only the
              horizontal gesture is claimed here. */}
          <div
            className="touch-pan-y rounded-xl border border-gray-200 p-3"
            onTouchStart={onWeekTouchStart}
            onTouchEnd={onWeekTouchEnd}
          >
            <div className="flex items-baseline justify-between gap-2">
              {/* Two numbers, two labels. The heading describes the LIST below
                  it; the big figure is the SUM of that list. Titled "Profit by
                  day" with a week total beside it, the total read as a daily
                  figure. And "Gross", not "Profit" — nothing is subtracted here,
                  and the Daily Profit tab already calls this exact figure Gross.
                  Two names for one number is how surfaces drift apart. */}
              <h3 className="text-xs font-bold text-gray-700">Gross per night</h3>
              <span className="flex items-baseline gap-1">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                  Week total
                </span>
                <span className="text-lg font-bold text-emerald-600">{dollars(weekDays.total)}</span>
              </span>
            </div>

            <div className="mt-2 flex flex-col gap-1.5">
              {weekDays.rows.map((r) => {
                const max = Math.max(...weekDays.rows.map((x) => x.gross), 1);
                const isToday = r.key === todayKey;
                const isBest = weekDays.best?.key === r.key && weekDays.total > 0;
                return (
                  <div key={r.key} className="flex items-center gap-2">
                    <span
                      className={`w-14 shrink-0 text-[11px] font-semibold ${
                        isToday ? "text-blue-600" : "text-gray-500"
                      }`}
                    >
                      {r.label} {r.dayNum}
                    </span>
                    <div className="h-4 flex-1 overflow-hidden rounded bg-gray-100">
                      <div
                        className={`h-full rounded ${isBest ? "bg-emerald-600" : "bg-emerald-400"}`}
                        style={{ width: `${(r.gross / max) * 100}%` }}
                      />
                    </div>
                    <span className="w-12 shrink-0 text-right text-[11px] font-bold text-gray-800">
                      {r.gross > 0 ? dollars(r.gross) : "—"}
                    </span>
                    {/* Spelled out. "5rm" saved eight pixels and cost a question. */}
                    <span className="w-14 shrink-0 text-right text-[10px] text-gray-400">
                      {r.roomsSold > 0 ? `${r.roomsSold} room${r.roomsSold === 1 ? "" : "s"}` : ""}
                    </span>
                  </div>
                );
              })}
            </div>

            {weekDays.any && weekDays.best && weekDays.worst && weekDays.best.key !== weekDays.worst.key && (
              <p className="mt-2 text-[11px] leading-tight text-gray-600">
                Best {weekDays.best.label} {dollars(weekDays.best.gross)} · weakest {weekDays.worst.label}{" "}
                {dollars(weekDays.worst.gross)} — a spread of {dollars(weekDays.best.gross - weekDays.worst.gross)}.
              </p>
            )}

            {/* Legend below the data, per the panel convention. */}
            <p className="mt-1 text-[10px] leading-tight text-gray-400">
              What the whole house took on each night — room rates plus a stay's one-off fees
              on its check-in night — before cleaning and misc costs. Future nights show only
              what is already booked. Swipe across the bars to change week.
            </p>
          </div>
        </>
      )}

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
                  ${Math.round(totalWithCharges).toLocaleString()}
                </span>
              </td>
            </tr>
            {/* Named, because a charge belongs to no room and so appears nowhere
                in the rows above — without this the Total would not add up from
                what is on screen. */}
            {chargesTotal > 0 && (
              <tr>
                <td colSpan={3} className="pt-1 text-right text-[11px] font-medium text-gray-400">
                  includes {dollars(chargesTotal)} guest charges
                </td>
              </tr>
            )}
          </tfoot>
        </table>
      )}

      {/* Financial summary — gross Total (above) minus this month's costs → net */}
      {stats.length > 0 && (
        <div className="flex flex-col gap-1 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs">
          {/* Cleaning is the one cost Cindy can change: she is the cleaner, and
              decides from this tab whether to take more turnovers herself. So it
              is sized to be read at a glance rather than hunted for — second
              only to Net, which stays the largest figure on the card. The
              recorded amount and the remaining count sit underneath: the
              progress behind the number she is steering. */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 flex-col">
              <span className="text-sm font-bold text-gray-800">
                Cleaning fee{cleaningOutlook && cleaningOutlook.count > 0 ? " (est.)" : ""}
              </span>
              {/* The probable half is named rather than folded into one number.
                  "29 still to clean" read as 29 booked jobs when a third of them
                  were rooms with no booking yet — the estimate looked wrong
                  because the count did. */}
              {cleaningOutlook && cleaningOutlook.count > 0 && (
                <span className="text-xs text-gray-500">
                  <span className="font-bold text-gray-800">
                    {cleaningOutlook.count - cleaningOutlook.probable}
                  </span>{" "}
                  booked
                  {cleaningOutlook.probable > 0 && (
                    <>
                      {" + "}
                      <span className="font-bold text-gray-800">{cleaningOutlook.probable}</span>{" "}
                      likely
                    </>
                  )}{" "}
                  · <span className="font-bold text-gray-800">{dollars(cleaningFee)}</span> recorded
                  {cleaningNorms && (
                    // The rate the forecast is using, shown rather than left to
                    // be reverse-engineered from the total. A number that looks
                    // wrong can now be checked against what a cleaning costs.
                    <>
                      {" · at "}
                      <span className="font-bold text-gray-800">
                        {dollars(cleaningNorms.costPerRoom)}
                      </span>
                      /room
                    </>
                  )}
                </span>
              )}
            </div>
            <span className="shrink-0 text-xl font-bold tabular-nums text-rose-600">
              −{dollars(cleaningOutlook ? estimatedCleaningFee : cleaningFee)}
            </span>
          </div>
          {/* Guest charges — the only PLUS among the cost rows, so it is emerald
              and signed "+", never rose. A cancellation fee arrives here because
              unbooking deleted the stay it was charged against. */}
          {charges.length > 0 && (
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 flex-col">
                <span className="text-sm font-bold text-gray-800">
                  Guest charges <span className="font-medium text-gray-400">· in Total</span>
                </span>
                <span className="text-xs text-gray-500">
                  {charges
                    .slice(0, 2)
                    .map((c) => `${c.guest.name.split(" ")[0]} ${c.label.toLowerCase()}`)
                    .join(" · ")}
                  {charges.length > 2 && ` · +${charges.length - 2} more`}
                  {chargesUnpaid > 0 && (
                    <span className="font-bold text-amber-600"> · {chargesUnpaid} unpaid</span>
                  )}
                </span>
              </div>
              {/* No "+" any more: it is already inside the Total above, and a
                  plus sign here read as a second addition. */}
              <span className="shrink-0 text-xl font-bold tabular-nums text-emerald-600">
                {dollars(chargesTotal)}
              </span>
            </div>
          )}

          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-gray-800">Misc fee</span>
            <span className="shrink-0 text-xl font-bold tabular-nums text-rose-600">−{dollars(miscFee)}</span>
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
                  // The viewed month nets projected income against PROJECTED
                  // cleaning, matching This Month. Using recorded-only cleaning here
                  // would show a rosier bottom line on the same month in two tabs.
                  predicted:
                    (predictedByMonth.get(r.month) ?? r.gross) -
                    (r.month === viewedMonthKey ? estimatedCleaningFee : r.cleaning) -
                    r.misc,
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