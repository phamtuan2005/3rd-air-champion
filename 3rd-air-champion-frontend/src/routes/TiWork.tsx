import { useEffect, useMemo, useState } from "react";
import { addDays, format, parseISO, startOfToday } from "date-fns";
import {
  WorkCreds,
  WorkEntryType,
  WorkMe,
  WorkShift,
  addMyEntry,
  deleteMyEntry,
  editMyEntry,
  fetchMyEntries,
  fetchMySchedule,
  workSignIn,
} from "../util/workOperations";

const CREDS_KEY = "tiWorkCreds";

const money = (n: number) => (Number.isInteger(n) ? `$${n}` : `$${n.toFixed(2)}`);

const fmtDay = (key: string) => {
  try {
    return format(parseISO(key.slice(0, 10)), "EEE, MMM d");
  } catch {
    return key;
  }
};

const STATUS_STYLE: Record<string, string> = {
  submitted: "bg-amber-50 text-amber-700 border-amber-200",
  approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
  rejected: "bg-rose-50 text-rose-700 border-rose-200",
};

const STATUS_LABEL: Record<string, string> = {
  submitted: "Waiting",
  approved: "Approved",
  rejected: "Not counted",
};

/**
 * TiWork — where the team logs the hours they worked and says what they did.
 *
 * Its own route rather than a corner of TiMag: a staff member is not a host and
 * must never see the calendar, the money, or anyone else's hours. They see their
 * own work and nothing else, which is also why every request carries their
 * credentials instead of trusting an id in the page.
 */
const TiWork = () => {
  useEffect(() => {
    document.title = "TiWork";
  }, []);
  // Point the installable app at TiWork's own manifest, and put it back on the
  // way out — the same swap TiBook does, so a phone that installs from here
  // pins TiWork rather than TiMag.
  useEffect(() => {
    const link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    const prev = link?.getAttribute("href") ?? null;
    link?.setAttribute("href", "/tiworkmanifest.webmanifest");
    return () => {
      if (link && prev) link.setAttribute("href", prev);
    };
  }, []);

  const todayKey = format(startOfToday(), "yyyy-MM-dd");

  // Remembered so the team is not made to sign in every visit. It is a low-value
  // secret on their own device, and the alternative is a barrier in front of a
  // chore they already have little reason to do promptly.
  const [creds, setCreds] = useState<WorkCreds | null>(() => {
    try {
      const raw = localStorage.getItem(CREDS_KEY);
      return raw ? (JSON.parse(raw) as WorkCreds) : null;
    } catch {
      return null;
    }
  });
  const [me, setMe] = useState<WorkMe | null>(null);
  const [entries, setEntries] = useState<WorkEntryType[]>([]);
  const [shifts, setShifts] = useState<WorkShift[]>([]);
  // Per-shift hour boxes, so a cleaner can fill in several turnovers before
  // sending any of them.
  const [shiftDraft, setShiftDraft] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({ identifier: "", code: "" });
  const [draft, setDraft] = useState({ date: todayKey, hours: "", report: "" });
  const [editingId, setEditingId] = useState<string | null>(null);
  // True when a code that USED to work has just been rejected — almost always
  // because the host regenerated it. Worth distinguishing: to someone who has
  // signed in fine for weeks, "doesn't match" reads as their own typo, and they
  // retype it rather than asking for the new one.
  const [wasRevoked, setWasRevoked] = useState(false);

  // Sign in from remembered credentials on arrival. A failure here means the
  // host changed the code, so the stored copy is cleared rather than left to
  // fail silently on every action afterwards.
  useEffect(() => {
    if (!creds) return;
    setLoading(true);
    workSignIn(creds)
      .then((who) => {
        setMe(who);
        return fetchMyEntries(creds);
      })
      .then((list) => {
        setEntries(list ?? []);
        return loadSchedule(creds);
      })
      .catch((msg) => {
        setError(String(msg));
        setWasRevoked(true);
        setCreds(null);
        localStorage.removeItem(CREDS_KEY);
      })
      .finally(() => setLoading(false));
  }, [creds]);

  const handleSignIn = () => {
    const next = { identifier: form.identifier.trim(), code: form.code.trim() };
    if (!next.identifier || !next.code) {
      setError("Enter your email or phone, and your code.");
      return;
    }
    setError("");
    setWasRevoked(false);
    setLoading(true);
    workSignIn(next)
      .then((who) => {
        setMe(who);
        localStorage.setItem(CREDS_KEY, JSON.stringify(next));
        setCreds(next);
      })
      .catch((msg) => setError(String(msg)))
      .finally(() => setLoading(false));
  };

  const signOut = () => {
    localStorage.removeItem(CREDS_KEY);
    setCreds(null);
    setMe(null);
    setEntries([]);
    setForm({ identifier: "", code: "" });
  };

  // Three weeks back, two ahead: far enough to catch up on last week and see
  // what is coming, without a year of history to scroll past.
  const loadSchedule = (c: WorkCreds) =>
    fetchMySchedule(c, {
      from: format(addDays(startOfToday(), -21), "yyyy-MM-dd"),
      to: format(addDays(startOfToday(), 14), "yyyy-MM-dd"),
    })
      .then(setShifts)
      .catch(() => {});

  const reload = (c: WorkCreds) =>
    Promise.all([
      fetchMyEntries(c).then(setEntries).catch(() => {}),
      loadSchedule(c),
    ]);

  const submitShift = (shift: WorkShift) => {
    if (!creds) return;
    const hours = parseFloat(shiftDraft[shift.id] ?? "");
    if (!Number.isFinite(hours) || hours <= 0) {
      setError("How many hours? A number above zero.");
      return;
    }
    setError("");
    addMyEntry(creds, {
      date: shift.date,
      hours,
      report: "",
      assignmentId: shift.id,
    })
      .then(() => {
        setShiftDraft((d) => ({ ...d, [shift.id]: "" }));
        return reload(creds);
      })
      .catch((msg) => setError(String(msg)));
  };

  const submit = () => {
    if (!creds) return;
    const hours = parseFloat(draft.hours);
    if (!Number.isFinite(hours) || hours <= 0) {
      setError("How many hours? A number above zero.");
      return;
    }
    setError("");
    const action = editingId
      ? editMyEntry(creds, { id: editingId, date: draft.date, hours, report: draft.report })
      : addMyEntry(creds, { date: draft.date, hours, report: draft.report });
    action
      .then(() => {
        setDraft({ date: todayKey, hours: "", report: "" });
        setEditingId(null);
        return reload(creds);
      })
      .catch((msg) => setError(String(msg)));
  };

  const remove = (id: string) => {
    if (!creds) return;
    deleteMyEntry(creds, id)
      .then(() => reload(creds))
      .catch((msg) => setError(String(msg)));
  };

  // This month, split by what has actually been settled. "Waiting" is deliberately
  // shown apart from "approved": telling someone they have earned money that has
  // not been agreed yet would be the app making a promise on the host's behalf.
  const totals = useMemo(() => {
    const month = todayKey.slice(0, 7);
    const mine = entries.filter((e) => e.date.slice(0, 7) === month);
    const approved = mine.filter((e) => e.status === "approved");
    const waiting = mine.filter((e) => e.status === "submitted");
    return {
      approvedHours: approved.reduce((s, e) => s + e.hours, 0),
      approvedPay: approved.reduce((s, e) => s + e.hours * (e.approvedRate || 0), 0),
      waitingHours: waiting.reduce((s, e) => s + e.hours, 0),
    };
  }, [entries, todayKey]);

  // ── Signed out ────────────────────────────────────────────────────────────
  if (!me) {
    return (
      <div className="tibook-type flex min-h-[100dvh] flex-col items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <img src="/TiMagLogo.svg" alt="TT House" className="h-10 w-10 shrink-0" />
            <div className="min-w-0">
              <h1 className="text-xl font-bold leading-tight text-gray-900">TiWork</h1>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                TT House
              </p>
            </div>
          </div>
          {/* The house motto, in the same voice TiBook shows guests. The team
              read this screen more often than any guest reads theirs, so it is
              the one place the promise is worth repeating daily. */}
          <p className="mt-3 border-l-2 border-amber-300 pl-2 text-sm font-semibold italic leading-tight text-amber-700">
            Your comfort. Our mission.
          </p>
          <p className="mt-2.5 text-sm text-gray-500">
            Log your hours and tell us what you worked on.
          </p>

          <label className="mt-4 block text-xs font-semibold uppercase tracking-wide text-gray-400">
            Email or phone
          </label>
          <input
            value={form.identifier}
            onChange={(e) => setForm((f) => ({ ...f, identifier: e.target.value }))}
            placeholder="you@example.com"
            autoComplete="username"
            className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-gray-400 focus:outline-none"
          />

          <label className="mt-3 block text-xs font-semibold uppercase tracking-wide text-gray-400">
            Access code
          </label>
          <input
            value={form.code}
            onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
            onKeyDown={(e) => e.key === "Enter" && handleSignIn()}
            placeholder="from Anh-Tuan"
            autoComplete="one-time-code"
            className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-gray-400 focus:outline-none"
          />

          {error && <p className="mt-3 text-sm font-semibold text-red-500">{error}</p>}
          {wasRevoked && (
            <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm leading-relaxed text-amber-800">
              Your saved code stopped working — it was probably replaced. Ask Anh-Tuan
              for the new one. Your logged hours are safe.
            </p>
          )}

          <button
            type="button"
            onClick={handleSignIn}
            disabled={loading}
            className="mt-4 w-full rounded-xl bg-gray-900 py-3 text-base font-semibold text-white disabled:opacity-50"
          >
            {loading ? "…" : "Sign in"}
          </button>
        </div>
      </div>
    );
  }

  // ── Signed in ─────────────────────────────────────────────────────────────
  return (
    <div className="tibook-type flex min-h-[100dvh] flex-col bg-gray-50">
      <header className="flex shrink-0 items-center gap-2.5 border-b border-gray-200 bg-white px-4 py-3">
        <img src="/TiMagLogo.svg" alt="TT House" className="h-9 w-9 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-bold text-gray-900">Hi {me.name.split(" ")[0]}</p>
          <p className="truncate text-xs text-gray-400">
            {me.title || "Team"}
            {me.payType === "hourly" && ` · ${money(me.payRate)}/hr`}
          </p>
        </div>
        <button
          type="button"
          onClick={signOut}
          className="shrink-0 rounded-full border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-500"
        >
          Sign out
        </button>
      </header>

      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-3 px-4 py-3">
        {/* This month */}
        <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
            This month
          </p>
          <p className="mt-1 text-2xl font-bold leading-none text-emerald-600">
            {totals.approvedHours}h
            {me.payType === "hourly" && totals.approvedPay > 0 && (
              <span className="ml-2 text-base font-semibold text-gray-500">
                {money(Math.round(totals.approvedPay * 100) / 100)}
              </span>
            )}
          </p>
          <p className="mt-1 text-xs text-gray-400">
            approved
            {totals.waitingHours > 0 && ` · ${totals.waitingHours}h still waiting`}
          </p>
        </div>

        {/* A cleaner's rota. Hours go against a turnover rather than a bare date:
            the host already knows which room was cleaned that morning, and
            asking someone to retype it invites a mismatch nobody can resolve
            afterwards. */}
        {me.kind === "cleaner" && (
          <div className="rounded-2xl border border-gray-200 bg-white p-3">
            <p className="mb-2 text-sm font-bold text-gray-800">Your cleanings</p>
            {shifts.length === 0 ? (
              <p className="py-3 text-center text-sm text-gray-400">
                Nothing scheduled in the last few weeks.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {shifts.map((sh) => {
                  const claim = sh.claim;
                  const upcoming = sh.date > todayKey;
                  return (
                    <div
                      key={sh.id}
                      className="flex flex-wrap items-center gap-2 border-b border-gray-100 pb-2 last:border-0 last:pb-0"
                    >
                      <span className="text-sm font-semibold text-gray-800">
                        {fmtDay(sh.date)}
                      </span>
                      <span className="rounded-md bg-gray-100 px-2 py-0.5 text-xs font-bold text-gray-700">
                        {sh.roomName}
                      </span>
                      {claim ? (
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${STATUS_STYLE[claim.status]}`}
                        >
                          {claim.hours}h · {STATUS_LABEL[claim.status]}
                        </span>
                      ) : upcoming ? (
                        <span className="text-xs text-gray-400">coming up</span>
                      ) : (
                        <>
                          <input
                            type="number"
                            inputMode="decimal"
                            min={0}
                            step={0.25}
                            placeholder="hrs"
                            value={shiftDraft[sh.id] ?? ""}
                            onChange={(e) =>
                              setShiftDraft((d) => ({ ...d, [sh.id]: e.target.value }))
                            }
                            className="w-20 rounded-lg border border-gray-200 px-2 py-1.5 text-sm focus:border-gray-400 focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => submitShift(sh)}
                            disabled={!shiftDraft[sh.id]}
                            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
                          >
                            Send
                          </button>
                        </>
                      )}
                      {claim?.hostNote && (
                        <span className="w-full text-xs text-gray-500">
                          Note from Anh-Tuan: {claim.hostNote}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Paid to date — the question anyone doing this work actually has. */}
        {(me.paidAmount > 0 || me.payments.length > 0) && (
          <div className="rounded-2xl border border-gray-200 bg-white p-3">
            <p className="text-sm font-bold text-gray-800">
              Paid to date{" "}
              <span className="text-emerald-600">{money(me.paidAmount)}</span>
            </p>
            {me.payments.length > 0 && (
              <div className="mt-1.5 flex flex-col gap-1">
                {me.payments.slice(0, 6).map((p, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <span className="text-gray-500">{fmtDay(p.paidOn)}</span>
                    <span className="font-semibold text-gray-800">{money(p.amount)}</span>
                    {p.note && <span className="truncate text-xs text-gray-400">{p.note}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Add / edit — office staff log a day; a cleaner's hours belong to a
            turnover above, so this form would be a second, conflicting path. */}
        {me.kind === "staff" && (
        <div className="rounded-2xl border border-gray-200 bg-white p-3">
          <p className="mb-2 text-sm font-bold text-gray-800">
            {editingId ? "Edit this day" : "Log a day"}
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                Day
              </span>
              <input
                type="date"
                value={draft.date}
                max={todayKey}
                onChange={(e) => setDraft((d) => ({ ...d, date: e.target.value }))}
                className="rounded-xl border border-gray-200 px-2 py-2 text-sm focus:border-gray-400 focus:outline-none"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                Hours
              </span>
              <input
                type="number"
                inputMode="decimal"
                min={0}
                step={0.25}
                placeholder="0"
                value={draft.hours}
                onChange={(e) => setDraft((d) => ({ ...d, hours: e.target.value }))}
                className="w-24 rounded-xl border border-gray-200 px-2 py-2 text-sm focus:border-gray-400 focus:outline-none"
              />
            </label>
          </div>
          <textarea
            rows={3}
            placeholder="What did you work on? A couple of lines is plenty."
            value={draft.report}
            onChange={(e) => setDraft((d) => ({ ...d, report: e.target.value }))}
            className="mt-2 w-full resize-y rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none"
          />
          {error && <p className="mt-2 text-sm font-semibold text-red-500">{error}</p>}
          <div className="mt-2 flex justify-end gap-2">
            {editingId && (
              <button
                type="button"
                onClick={() => {
                  setEditingId(null);
                  setDraft({ date: todayKey, hours: "", report: "" });
                }}
                className="rounded-xl px-3 py-2 text-sm font-semibold text-gray-500"
              >
                Cancel
              </button>
            )}
            <button
              type="button"
              onClick={submit}
              className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white"
            >
              {editingId ? "Save" : "Submit"}
            </button>
          </div>
        </div>
        )}

        {/* History */}
        <div className="flex flex-col gap-2 pb-6">
          {loading && entries.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-400">Loading…</p>
          ) : entries.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-400">
              Nothing logged yet — your first day goes above.
            </p>
          ) : (
            entries.map((e) => (
              <div key={e.id} className="rounded-2xl border border-gray-200 bg-white p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-bold text-gray-900">{fmtDay(e.date)}</span>
                  <span className="text-sm font-semibold text-gray-600">{e.hours}h</span>
                  <span
                    className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-bold ${STATUS_STYLE[e.status]}`}
                  >
                    {STATUS_LABEL[e.status]}
                  </span>
                  {e.status === "approved" && e.approvedRate > 0 && (
                    <span className="ml-auto text-sm font-bold text-emerald-600">
                      {money(Math.round(e.hours * e.approvedRate * 100) / 100)}
                    </span>
                  )}
                </div>
                {e.report && (
                  <p className="mt-1.5 whitespace-pre-line text-sm text-gray-600">{e.report}</p>
                )}
                {e.hostNote && (
                  <p className="mt-1.5 rounded-lg bg-gray-50 px-2 py-1.5 text-xs text-gray-500">
                    Note from Anh-Tuan: {e.hostNote}
                  </p>
                )}
                {/* Only an unreviewed day can be changed. Once it is approved the
                    figure has been counted, and editing it would quietly move
                    what is owed. */}
                {e.status === "submitted" && (
                  <div className="mt-2 flex gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(e.id);
                        setDraft({ date: e.date, hours: String(e.hours), report: e.report });
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                      className="text-xs font-semibold text-gray-500 hover:text-gray-700"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(e.id)}
                      className="text-xs font-semibold text-red-400 hover:text-red-600"
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        <p className="pb-6 text-center text-xs font-semibold italic text-amber-700/80">
          Your comfort. Our mission.
        </p>
      </div>
    </div>
  );
};

export default TiWork;
