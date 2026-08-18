import { useMemo, useState } from "react";
import { addDays, format, parseISO, startOfToday } from "date-fns";
import CleanerAvatar from "../../shared/CleanerAvatar";
import { getRoomColor } from "../../../util/getRoomColor";
import { updateGuestPricing } from "../../../util/guestOperations";
import { dayType } from "../../../util/types/dayType";
import { guestType } from "../../../util/types/guestType";
import { roomType } from "../../../util/types/roomType";

interface DefaultRateGuestsModalProps {
  guests: guestType[];
  rooms: roomType[];
  monthMap: Map<string, dayType>;
  guestBookingCount: { GuestId: string; DistinctStartDateCount: number; FirstStayDate: string }[];
  token: string;
  onSaved: (guestId: string, roomId: string, price: number) => void;
  onClose: () => void;
}

// A guest counts as returning at two separate stays.
const RETURNING_AT = 2;

// Default look-back for the AirBnB average. A month smooths a weekend spike
// without reaching so far back that a since-changed price still counts.
const DEFAULT_LOOKBACK = 30;

const money = (n: number) => (Number.isInteger(n) ? `$${n}` : `$${n.toFixed(2)}`);

/**
 * What every room and guest is actually being paid, against what it should be.
 *
 * Two questions, two tabs, one subject — the nightly rate:
 *
 *  · "Behind" — guests whose own rate now sits BELOW the room's current rate. A
 *    rate agreed with a guest is stored once and stays put while the room's
 *    price moves on, so every rise quietly widens a gap nothing else reports.
 *
 *  · "AirBnB" — what AirBnB has actually paid per night lately. The room rate is
 *    a number someone chose; this is the number the market returned, and it is
 *    the evidence for whether the room rate itself is the thing that is behind.
 */
const DefaultRateGuestsModal = ({
  guests,
  rooms,
  monthMap,
  guestBookingCount,
  token,
  onSaved,
  onClose,
}: DefaultRateGuestsModalProps) => {
  // AirBnB first, and the tab you land on: it is the reference the other tab is
  // judged against — what the market actually pays — so it reads before the list
  // of guests who have fallen behind it.
  const [tab, setTab] = useState<"behind" | "airbnb">("airbnb");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [lookbackInput, setLookbackInput] = useState(String(DEFAULT_LOOKBACK));

  const activeRooms = useMemo(() => rooms.filter((r) => r.active), [rooms]);

  // ── Tab 1: guests behind the room rate ────────────────────────────────────
  const rows = useMemo(() => {
    const statsFor = new Map(guestBookingCount.map((g) => [g.GuestId, g]));
    const roomById = new Map(activeRooms.map((r) => [r.id, r]));

    return guests
      .filter((g) => g.name !== "AirBnB")
      .map((guest) => {
        const stats = statsFor.get(guest.id);
        const stays = stats?.DistinctStartDateCount ?? 0;
        // The stay count is the evidence; guest.returning is a hand-set flag and
        // says nothing about how many times someone has actually come.
        if (stays < RETURNING_AT) return null;

        // Only rooms this guest HAS a rate for can be behind — no rate means
        // they already pay whatever the room charges today.
        const behind = (guest.pricing ?? [])
          .map((p) => {
            const room = roomById.get(p.room);
            if (!room) return null; // retired room, or one no longer active
            if (p.price <= 0) return null; // a deliberate comp, not a gap
            if (p.price >= room.price) return null;
            return { room, theirs: p.price, gap: room.price - p.price };
          })
          .filter((r): r is { room: roomType; theirs: number; gap: number } => r !== null)
          .sort((a, b) => b.gap - a.gap);

        if (behind.length === 0) return null;

        return {
          guest,
          stays,
          since: stats?.FirstStayDate ?? null,
          behind,
          // Widest single gap first — the furthest behind is the most overdue
          // conversation, and what the host would act on first.
          worstGap: behind[0].gap,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .sort((a, b) => b.worstGap - a.worstGap || a.guest.name.localeCompare(b.guest.name));
  }, [guests, activeRooms, guestBookingCount]);

  // ── Tab 2: what AirBnB actually paid, per room, over the look-back ────────
  //
  // Averaged over NIGHTS, not over stays: a seven-night booking says seven times
  // as much about the going rate as a one-night one, and averaging per stay
  // would let a single cheap night outweigh a good week.
  //
  // Fees are deliberately excluded. bookingNightAmount folds whole-stay fees
  // into the check-in night, which is right for a day's takings and wrong for a
  // nightly RATE — it would make the same stay look dearer the shorter it was.
  const lookbackDays = useMemo(() => {
    const n = parseInt(lookbackInput, 10);
    return Number.isFinite(n) ? Math.min(365, Math.max(1, n)) : DEFAULT_LOOKBACK;
  }, [lookbackInput]);

  const airbnbAverages = useMemo(() => {
    const today = startOfToday();
    const totals = new Map<string, { sum: number; nights: number; min: number; max: number }>();

    // Yesterday backwards: tonight has not been earned yet.
    for (let i = 1; i <= lookbackDays; i++) {
      const key = format(addDays(today, -i), "yyyy-MM-dd");
      const day = monthMap.get(key);
      if (!day) continue;
      for (const b of day.bookings) {
        if (!b.room || b.guest?.name !== "AirBnB") continue;
        if (!b.airbnbPrice || !b.duration) continue; // payout not entered yet
        const nightly = b.airbnbPrice / b.duration;
        const cur = totals.get(b.room.id) ?? {
          sum: 0,
          nights: 0,
          min: Infinity,
          max: 0,
        };
        cur.sum += nightly;
        cur.nights += 1;
        cur.min = Math.min(cur.min, nightly);
        cur.max = Math.max(cur.max, nightly);
        totals.set(b.room.id, cur);
      }
    }

    const perRoom = activeRooms
      .map((room) => {
        const t = totals.get(room.id);
        if (!t || t.nights === 0) return { room, nights: 0, avg: null as number | null, min: 0, max: 0 };
        return { room, nights: t.nights, avg: t.sum / t.nights, min: t.min, max: t.max };
      })
      .sort((a, b) => (b.avg ?? -1) - (a.avg ?? -1));

    const allNights = perRoom.reduce((s, r) => s + r.nights, 0);
    const allSum = perRoom.reduce((s, r) => s + (r.avg ?? 0) * r.nights, 0);
    return { perRoom, allNights, overall: allNights ? allSum / allNights : null };
  }, [monthMap, activeRooms, lookbackDays]);

  const save = (guestId: string, room: roomType, fallback: number) => {
    const key = `${guestId}|${room.id}`;
    const raw = drafts[key];
    // Empty box = "bring them to today's room rate", the common case, and saves
    // typing a number already on screen.
    const price = raw === undefined || raw === "" ? fallback : parseFloat(raw);
    if (!Number.isFinite(price) || price < 0) {
      setError("Enter a rate of 0 or more.");
      return;
    }
    setError("");
    setSaving(key);
    updateGuestPricing({ guest: guestId, room: room.id, price }, token)
      .then(() => {
        onSaved(guestId, room.id, price);
        setDrafts((d) => {
          const next = { ...d };
          delete next[key];
          return next;
        });
      })
      .catch((err) => setError(typeof err === "string" ? err : "Could not save that rate."))
      .finally(() => setSaving(null));
  };

  const tabCls = (key: "behind" | "airbnb") =>
    `flex min-w-fit flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-2 py-1.5 text-sm font-semibold transition-colors ${
      tab === key ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
    }`;

  return (
    <div
      className="modal-type fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-2 border-b border-gray-100 px-4 py-3">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-gray-800">Rates</h2>
            <p className="mt-0.5 text-xs text-gray-400">
              {tab === "behind"
                ? "Returning guests paying less than the room now charges"
                : `What AirBnB actually paid per night, last ${lookbackDays} days`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 px-1 text-xl leading-none text-gray-400 hover:text-gray-600"
          >
            &times;
          </button>
        </div>

        {/* Sized to their words rather than to a half each — the same rule the
            Clean modal's tabs learned when the type scale grew them. */}
        <div className="mx-4 mb-2 mt-2 flex shrink-0 gap-1 overflow-x-auto rounded-xl bg-gray-100 p-1">
          <button type="button" onClick={() => setTab("airbnb")} className={tabCls("airbnb")}>
            AirBnB average
          </button>
          <button type="button" onClick={() => setTab("behind")} className={tabCls("behind")}>
            Returning behind
            {rows.length > 0 && (
              <span
                className={`min-w-[1.25rem] shrink-0 rounded-full px-1 py-0.5 text-center text-[12px] font-bold leading-none ${
                  tab === "behind" ? "bg-gray-900 text-white" : "bg-gray-200 text-gray-600"
                }`}
              >
                {rows.length}
              </span>
            )}
          </button>
        </div>

        {error && tab === "behind" && (
          <p className="shrink-0 px-4 pb-1 text-sm font-semibold text-red-500">{error}</p>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-2">
          {tab === "behind" ? (
            rows.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-400">
                No returning guest is behind the current room rates.
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {rows.map(({ guest, stays, since, behind }) => (
                  <div key={guest.id} className="rounded-xl border border-gray-200 bg-white p-3">
                    <div className="flex items-center gap-2">
                      <CleanerAvatar
                        name={guest.name}
                        character={guest.character}
                        sizeClass="h-9 w-9"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-base font-bold text-gray-900">{guest.name}</p>
                        <p className="mt-0.5 text-xs text-gray-500">
                          ↩ {stays} stays
                          {since &&
                            (() => {
                              try {
                                return ` since ${format(parseISO(since.slice(0, 10)), "MMM yyyy")}`;
                              } catch {
                                return "";
                              }
                            })()}
                        </p>
                      </div>
                    </div>

                    <div className="mt-2.5 flex flex-col gap-2.5">
                      {behind.map(({ room, theirs, gap }) => {
                        const key = `${guest.id}|${room.id}`;
                        const draft = drafts[key] ?? "";
                        return (
                          <div key={room.id} className="flex flex-col gap-1.5">
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={`${getRoomColor(room.name, room.color)} shrink-0 rounded-md px-2 py-0.5 text-xs font-bold text-black`}
                              >
                                {room.name}
                              </span>
                              <span className="text-sm font-bold text-rose-600">
                                {money(theirs)}
                              </span>
                              <span className="text-xs text-gray-400">
                                vs {money(room.price)} today
                              </span>
                              <span className="shrink-0 rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-bold text-rose-600">
                                −{money(gap)}/night
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="relative flex-1">
                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                                  $
                                </span>
                                <input
                                  type="number"
                                  inputMode="decimal"
                                  min={0}
                                  placeholder={String(room.price)}
                                  value={draft}
                                  onChange={(e) =>
                                    setDrafts((d) => ({ ...d, [key]: e.target.value }))
                                  }
                                  onKeyDown={(e) =>
                                    e.key === "Enter" && save(guest.id, room, room.price)
                                  }
                                  className="w-full rounded-lg border border-gray-200 py-1.5 pl-5 pr-2 text-sm focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-300"
                                />
                              </div>
                              <button
                                type="button"
                                onClick={() => save(guest.id, room, room.price)}
                                disabled={saving === key}
                                className="shrink-0 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-40"
                              >
                                {saving === key
                                  ? "…"
                                  : draft === ""
                                    ? `Match ${money(room.price)}`
                                    : "Set"}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
                <label className="shrink-0 text-sm font-semibold text-gray-500" htmlFor="lookback">
                  Past
                </label>
                <input
                  id="lookback"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={365}
                  value={lookbackInput}
                  onChange={(e) => setLookbackInput(e.target.value)}
                  className="w-20 rounded-lg border border-gray-200 px-2 py-1.5 text-sm focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-300"
                />
                <span className="shrink-0 text-sm font-semibold text-gray-500">days</span>
                <span className="ml-auto shrink-0 text-xs text-gray-400">
                  {airbnbAverages.allNights} night
                  {airbnbAverages.allNights === 1 ? "" : "s"}
                </span>
              </div>

              {airbnbAverages.allNights === 0 ? (
                <p className="py-8 text-center text-sm text-gray-400">
                  No AirBnB nights with a payout recorded in this window.
                </p>
              ) : (
                <>
                  {airbnbAverages.perRoom.map(({ room, nights, avg, min, max }) => {
                    // Against the room's own rate: this is the comparison the
                    // tab exists for — is the number we chose behind the number
                    // the market returned?
                    const delta = avg == null ? 0 : avg - room.price;
                    const ahead = delta > 0.005;
                    return (
                      <div
                        key={room.id}
                        className="rounded-xl border border-gray-200 bg-white p-3"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`${getRoomColor(room.name, room.color)} shrink-0 rounded-md px-2 py-0.5 text-xs font-bold text-black`}
                          >
                            {room.name}
                          </span>
                          {avg == null ? (
                            <span className="text-sm text-gray-400">no AirBnB nights</span>
                          ) : (
                            <>
                              <span className="text-lg font-bold leading-none text-emerald-600">
                                {money(Math.round(avg * 100) / 100)}
                              </span>
                              <span className="text-xs text-gray-400">
                                avg / night · {nights} night{nights === 1 ? "" : "s"}
                              </span>
                              <span
                                className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${
                                  ahead
                                    ? "bg-emerald-50 text-emerald-600"
                                    : "bg-rose-50 text-rose-600"
                                }`}
                                title={`Room rate is ${money(room.price)}`}
                              >
                                {ahead ? "+" : "−"}
                                {money(Math.abs(Math.round(delta * 100) / 100))} vs room
                              </span>
                            </>
                          )}
                        </div>
                        {avg != null && min !== max && (
                          <p className="mt-1.5 text-xs text-gray-400">
                            range {money(Math.round(min * 100) / 100)} –{" "}
                            {money(Math.round(max * 100) / 100)} · room rate {money(room.price)}
                          </p>
                        )}
                      </div>
                    );
                  })}

                  {airbnbAverages.overall != null && (
                    <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600">
                      All rooms:{" "}
                      <span className="font-bold text-emerald-600">
                        {money(Math.round(airbnbAverages.overall * 100) / 100)}
                      </span>{" "}
                      avg / night across {airbnbAverages.allNights} AirBnB night
                      {airbnbAverages.allNights === 1 ? "" : "s"}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        <p className="shrink-0 border-t border-gray-100 px-4 py-2 text-[11px] leading-relaxed text-gray-400">
          {tab === "behind"
            ? "A guest's rate is stored once and stays put while the room's price moves on. Comped stays ($0) are deliberate and never listed."
            : "Payout ÷ nights, averaged per night and excluding one-off fees. Stays with no payout entered yet are not counted."}
        </p>
      </div>
    </div>
  );
};

export default DefaultRateGuestsModal;
