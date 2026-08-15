import { useEffect, useMemo, useState } from "react";
import { format, startOfToday } from "date-fns";
import { dayType } from "../../../../util/types/dayType";
import { getRoomColor } from "../../../../util/getRoomColor";
import {
  CleaningAssignmentType,
  CleanerType,
  fetchAssignments,
  fetchCleaners,
  rateOn,
} from "../../../../util/cleanerOperations";
import { MiscExpenseType, fetchMiscExpenses } from "../../../../util/miscOperations";
import { roomType } from "../../../../util/types/roomType";
import {
  bookingNightAmount,
  getDayGross,
  getOpenRoomProjections,
  getRoomWeekdayOdds,
  miscExpensesOn,
  sumAmounts,
} from "../../../../util/profit";

interface DayProfitProps {
  selectedDate: Date;
  monthMap: Map<string, dayType>;
  rooms: roomType[];
  hostId?: string;
  token?: string | null;
}

const dollars = (n: number) => `$${Math.round(n).toLocaleString()}`;
// Cents matter on hand-entered AirBnB payouts, so a fractional day total is
// shown to the cent rather than rounded away.
const money = (n: number) =>
  Number.isInteger(Math.round(n * 100) / 100) ? dollars(n) : `$${(Math.round(n * 100) / 100).toFixed(2)}`;

// One day's money, end to end: what came in, what went out, what's left.
//
// Day-actual on purpose — every figure here is a real amount with a real date,
// never a monthly total smeared across the month. Nightly income is already
// 1/N per night (direct stays carry a per-night rate; an AirBnB payout is
// divided by its duration), recorded cleaning hours belong to their morning,
// and a recurring bill lands on its own day of the month. So the days of a
// month sum to that month's figures in Stats.
const DayProfit = ({ selectedDate, monthMap, rooms, hostId, token }: DayProfitProps) => {
  const dateKey = format(selectedDate, "yyyy-MM-dd");
  const monthKey = dateKey.slice(0, 7);
  // TONIGHT is still sellable, so today projects like any future date.
  //
  // This was future-ONLY, borrowed from the cleaning forecast where today is
  // excluded because that morning's work depends on last night, which has
  // already happened. A night is the opposite: today's night has not been slept
  // yet and can still sell this evening. Excluding it meant the tab you land on
  // by default — today — showed no open rooms and no estimate at all, and read
  // as though the feature were missing.
  const canProject = dateKey >= format(startOfToday(), "yyyy-MM-dd");

  const [assignments, setAssignments] = useState<CleaningAssignmentType[]>([]);
  const [expenses, setExpenses] = useState<MiscExpenseType[]>([]);
  const [cleaners, setCleaners] = useState<CleanerType[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!hostId || !token) {
      setLoading(false);
      return;
    }
    let live = true;
    setLoading(true);
    Promise.all([
      fetchAssignments(hostId, dateKey, dateKey, token).catch(() => []),
      fetchMiscExpenses(hostId, token).catch(() => []),
      fetchCleaners(hostId, token).catch(() => []),
    ]).then(([a, m, c]) => {
      if (!live) return;
      setAssignments(a);
      setExpenses(m);
      setCleaners(c);
      setLoading(false);
    });
    return () => {
      live = false;
    };
  }, [hostId, token, dateKey]);

  // ── In ────────────────────────────────────────────────────────────────────
  const gross = useMemo(
    () => getDayGross(monthMap.get(dateKey), dateKey),
    [monthMap, dateKey],
  );

  // Per-room lines, so a day's total can be read back to the rooms that earned it.
  const roomLines = useMemo(() => {
    const day = monthMap.get(dateKey);
    if (!day) return [];
    return day.bookings
      .filter((b) => b.room)
      .map((b) => ({
        key: `${b.id}-${b.room.id}`,
        room: b.room,
        who: b.guest.alias || b.alias || b.guest.name,
        // Same test the rest of GuestView uses (DetailsModal, BookingCard): the
        // AirBnB guest is a real guest doc named "AirBnB", and every AirBnB stay
        // hangs off it under its own alias. Without the tag those aliases are
        // indistinguishable from direct guests on this tab, while the Gross
        // summary below splits Direct from AirBnB — so the lines could not be
        // read back to the split they add up to.
        isAirBnB: b.guest.name === "AirBnB",
        amount: bookingNightAmount(b, dateKey),
        isStart: b.startDate.split("T")[0] === dateKey,
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [monthMap, dateKey]);

  // ── Out ───────────────────────────────────────────────────────────────────
  // Cleaning billed at the rate in effect that day, so a later raise never
  // re-prices this morning. Only recorded hours count — an assignment with no
  // hours yet has cost nothing.
  const cleaningLines = useMemo(
    () =>
      assignments
        .filter((a) => a.date === dateKey && a.hours != null && a.cleaner)
        .map((a) => ({
          key: a.id,
          name: a.cleaner!.name,
          room: a.room?.name ?? null,
          hours: a.hours!,
          rate: rateOn(a.cleaner!, a.date),
          amount: a.hours! * rateOn(a.cleaner!, a.date),
        })),
    [assignments, dateKey],
  );
  const cleaningFee = cleaningLines.reduce((s, l) => s + l.amount, 0);

  const miscLines = useMemo(() => miscExpensesOn(expenses, dateKey), [expenses, dateKey]);
  const miscFee = sumAmounts(miscLines);

  // Rooms cleaned today whose hours nobody has entered yet — the cost is real
  // but unrecorded, so it is NOT in the net. Say so rather than quietly under-
  // reporting the day.
  const unrecordedCleanings = assignments.filter(
    (a) => a.date === dateKey && a.hours == null && a.cleaner,
  ).length;

  // Pre-tracking hours are anchored to a MONTH with no per-day records behind
  // them, so no day can honestly claim a share. Surfaced (not silently dropped)
  // because it is the one reason a month's days can total under Stats.
  const baselineThisMonth = cleaners.reduce(
    (s, c) =>
      c.baselineMonth === monthKey && c.baselineHours > 0
        ? s + c.baselineHours * rateOn(c, `${monthKey}-01`)
        : s,
    0,
  );

  const net = gross.total - cleaningFee - miscFee;

  // ── Still open ────────────────────────────────────────────────────────────
  // Today and forward. A PAST open night earned nothing, and that is a fact
  // rather than a forecast, so those dates show a single figure — projected and
  // realized are the same thing there.
  const openRooms = useMemo(() => {
    if (!canProject) return [];
    return getOpenRoomProjections(monthMap, rooms, dateKey, getRoomWeekdayOdds(monthMap));
  }, [canProject, monthMap, rooms, dateKey]);
  const expectedOpen = openRooms.reduce((s, o) => s + o.expected, 0);
  const projectedOpen = openRooms.reduce((s, o) => s + o.rate, 0);

  // Headline = the PROJECTED figure, matching the Stats This Month tab.
  //
  // At this house's occupancy (99–100% across all five rooms since the remodel)
  // an open night is not a gamble — it sells, so the projection is what actually
  // lands at month end. That is why Stats leads with it, and this tab must lead
  // with the same thing or the two screens teach different habits.
  //
  // Projected at FULL rate, not risk-adjusted, for the same reason Stats does:
  // it keeps a day's figure summing exactly to This Month's Total. The measured
  // odds stay visible per room, and a risk-adjusted total appears only if they
  // ever fall far enough for the distinction to matter.
  const hasProjection = openRooms.length > 0;
  const projectedGross = gross.total + projectedOpen;
  const projectedNet = projectedGross - cleaningFee - miscFee;
  // Only worth showing when demand is genuinely soft — otherwise it is noise.
  const showRiskAdjusted = hasProjection && expectedOpen < projectedOpen * 0.95;

  // Shared so the Gross and Net amounts always render identical size — the same
  // guarantee the Stats modal makes for its Total and Net badges.
  const bigAmountCls =
    "inline-block rounded-lg px-3 py-1 text-xl font-bold tabular-nums text-white";

  if (loading) {
    return <p className="py-6 text-center text-sm text-gray-400">Loading…</p>;
  }

  const Row = ({
    label,
    value,
    sub,
    tone = "gray",
    bold = false,
  }: {
    label: React.ReactNode;
    value: string;
    sub?: React.ReactNode;
    tone?: "gray" | "rose" | "emerald";
    bold?: boolean;
  }) => (
    <div className="flex items-start justify-between gap-3 px-3 py-2">
      <div className="min-w-0">
        <p className={`text-sm ${bold ? "font-bold text-gray-900" : "text-gray-600"}`}>{label}</p>
        {sub && <div className="mt-0.5 text-xs text-gray-400">{sub}</div>}
      </div>
      <span
        className={`shrink-0 text-sm tabular-nums ${bold ? "font-bold" : "font-medium"} ${
          tone === "rose" ? "text-rose-500" : tone === "emerald" ? "text-emerald-600" : "text-gray-900"
        }`}
      >
        {value}
      </span>
    </div>
  );

  return (
    <div className="flex flex-col gap-2 px-2 pb-4 pt-2">
      {/* ── Money in ── */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-3 py-2">
          <span className="text-base font-bold text-gray-800">Gross profit</span>
          <div className="flex flex-col items-end gap-0.5">
            <span className={`${bigAmountCls} bg-emerald-600`}>{money(projectedGross)}</span>
            {hasProjection && (
              <span className="text-xs font-semibold tabular-nums text-gray-400">
                booked {money(gross.total)}
              </span>
            )}
          </div>
        </div>
        {roomLines.length === 0 && openRooms.length === 0 ? (
          <p className="px-3 py-3 text-center text-sm text-gray-400">No income on this date</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {roomLines.map((l) => (
              <div key={l.key} className="flex items-center justify-between gap-2 px-3 py-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className={`${getRoomColor(l.room.name, l.room.color)} shrink-0 rounded-md px-2 py-0.5 text-xs font-bold text-black`}
                  >
                    {l.room.name}
                  </span>
                  <span className="truncate text-sm text-gray-600">{l.who}</span>
                  {l.isAirBnB && (
                    <span className="shrink-0 rounded-full bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-rose-600">
                      AirBnB
                    </span>
                  )}
                  {/* A stay's whole-stay fees land once, on its check-in date —
                      so a spike here has a visible reason. */}
                  {l.isStart && (
                    <span className="shrink-0 rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold text-gray-500">
                      check-in
                    </span>
                  )}
                </div>
                {/* Money in is green everywhere on this tab — the room lines are
                    the same income the Gross pill totals. */}
                <span className="shrink-0 text-sm font-semibold tabular-nums text-emerald-600">
                  {money(l.amount)}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Rooms still to sell, inside the Gross card but below a dashed rule —
            same subject (income for this date), different certainty. Their
            value IS in the pill above — the pill is the projected figure, the
            way Stats This Month reads. The "booked" line under it is what has
            actually been sold so far. */}
        {openRooms.length > 0 && (
          <>
            <div className="flex items-center justify-between border-t border-dashed border-gray-300 bg-gray-50/70 px-3 py-1">
              <span className="text-[11px] font-bold uppercase tracking-wide text-gray-400">
                Still open · {openRooms.length} room{openRooms.length === 1 ? "" : "s"}
              </span>
              <span className="text-[11px] text-gray-400">{format(selectedDate, "EEEE")} odds</span>
            </div>
            <div className="divide-y divide-gray-100">
              {openRooms.map((o) => (
                <div key={o.room.id} className="flex items-center justify-between gap-2 px-3 py-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className={`${getRoomColor(o.room.name, o.room.color)} shrink-0 rounded-md px-2 py-0.5 text-xs font-bold text-black opacity-60`}
                    >
                      {o.room.name}
                    </span>
                    {/* The measured odds this weekday sells. At 99–100% they
                        simply confirm the projection; if they ever drop, the
                        risk-adjusted total below appears on its own. */}
                    <span className="truncate text-xs text-gray-400">
                      ~{dollars(o.rate)} · {Math.round(o.odds * 100)}% books
                    </span>
                  </div>
                  <span className="shrink-0 text-sm font-medium tabular-nums text-emerald-600/70">
                    {money(o.rate)}
                  </span>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between border-t border-gray-100 px-3 py-1.5">
              <span className="text-xs text-gray-400">
                Projected{showRiskAdjusted && ` · at these odds ${money(expectedOpen)}`}
              </span>
              <span className="shrink-0 text-sm font-semibold tabular-nums text-emerald-600/70">
                +{money(projectedOpen)}
              </span>
            </div>
          </>
        )}

        {(gross.direct > 0 || gross.airbnb > 0) && (
          <div className="flex items-center justify-end gap-3 border-t border-gray-100 bg-gray-50 px-3 py-1.5 text-xs text-gray-500">
            <span>
              Direct <span className="font-semibold text-emerald-600">{money(gross.direct)}</span>
            </span>
            <span>
              AirBnB <span className="font-semibold text-emerald-600">{money(gross.airbnb)}</span>
            </span>
            {gross.fees > 0 && (
              <span>
                Fees <span className="font-semibold text-emerald-600">{money(gross.fees)}</span>
              </span>
            )}
          </div>
        )}
      </div>

      {/* ── Money out ── */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-3 py-1.5">
          <span className="text-xs font-bold uppercase tracking-wide text-gray-500">Costs</span>
          <span className="text-base font-bold text-rose-500 tabular-nums">
            {cleaningFee + miscFee > 0 ? `−${money(cleaningFee + miscFee)}` : money(0)}
          </span>
        </div>
        <div className="divide-y divide-gray-100">
          <Row
            label="Cleaning fee"
            value={cleaningFee > 0 ? `−${money(cleaningFee)}` : money(0)}
            tone={cleaningFee > 0 ? "rose" : "gray"}
            sub={
              cleaningLines.length > 0 ? (
                <div className="flex flex-col gap-0.5">
                  {cleaningLines.map((l) => (
                    <span key={l.key}>
                      {l.name}
                      {l.room ? ` · ${l.room}` : ""} · {l.hours}h @ {dollars(l.rate)}/h
                    </span>
                  ))}
                </div>
              ) : (
                "No hours recorded"
              )
            }
          />
          <Row
            label="Misc fee"
            value={miscFee > 0 ? `−${money(miscFee)}` : money(0)}
            tone={miscFee > 0 ? "rose" : "gray"}
            sub={
              miscLines.length > 0 ? (
                <div className="flex flex-col gap-0.5">
                  {miscLines.map((e) => (
                    <span key={e.id}>
                      {e.label || e.category}
                      {e.recurring ? " · monthly" : ""} · {dollars(e.amount)}
                    </span>
                  ))}
                </div>
              ) : (
                "Nothing logged"
              )
            }
          />
        </div>
      </div>

      {/* ── Bottom line ── */}
      <div
        className={`flex items-center justify-between rounded-xl border px-3 py-2.5 ${
          projectedNet >= 0 ? "border-emerald-200 bg-emerald-50" : "border-rose-200 bg-rose-50"
        }`}
      >
        <span className="text-base font-bold text-gray-800">Net profit</span>
        <div className="flex flex-col items-end gap-0.5">
          {/* Projected gross minus this day's costs — the same derivation Stats
              This Month uses for its Net badge. */}
          <span
            className={`${bigAmountCls} ${projectedNet >= 0 ? "bg-emerald-600" : "bg-rose-600"}`}
          >
            {money(projectedNet)}
          </span>
          {hasProjection && (
            <span className="text-xs font-semibold tabular-nums text-gray-500">
              booked {money(net)}
            </span>
          )}
        </div>
      </div>

      {/* Anything the net cannot honestly include, named rather than dropped. */}
      {(unrecordedCleanings > 0 || baselineThisMonth > 0) && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {unrecordedCleanings > 0 && (
            <p>
              {unrecordedCleanings} cleaning{unrecordedCleanings === 1 ? "" : "s"} today {" "}
              {unrecordedCleanings === 1 ? "has" : "have"} no hours recorded — not in this net.
            </p>
          )}
          {baselineThisMonth > 0 && (
            <p className={unrecordedCleanings > 0 ? "mt-1" : ""}>
              {dollars(baselineThisMonth)} of pre-tracking cleaning hours belongs to{" "}
              {format(selectedDate, "MMMM")} as a whole, not to any one day.
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default DayProfit;
