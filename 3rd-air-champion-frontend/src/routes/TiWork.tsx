import { useEffect, useMemo, useState } from "react";
import { addDays, format, parseISO, startOfToday } from "date-fns";
import {
  FaRegCalendarAlt,
  FaRegCalendarCheck,
  FaRegCheckCircle,
  FaRegClock,
  FaRegUser,
  FaRegMoneyBillAlt,
} from "react-icons/fa";
import CleanerAvatar from "../components/shared/CleanerAvatar";
import RoomBadge from "../components/shared/RoomBadge";
import { decimalToHm, formatHrMin, hmToDecimal } from "../util/hoursFormat";
import {
  WorkCreds,
  WorkEntryType,
  PaySummary,
  WorkMe,
  WorkShift,
  addMyEntry,
  deleteMyEntry,
  editMyEntry,
  fetchMyEntries,
  fetchMyPay,
  fetchMySchedule,
  workSignIn,
} from "../util/workOperations";

const CREDS_KEY = "tiWorkCreds";

// The house mark and the promise, as ONE thing.
//
// Apart, each is weaker: the logo alone is decoration, and the promise alone is
// a line of text easy to read past — or, worse, to read as a promise about the
// reader's own comfort. Together they say whose house this is and what it owes
// the guest. Named as a promise TO THE GUEST, the same way the cleaner texts
// name it, so the words on the screen match the words in the message.
const PromiseMark = ({
  showApp = false,
  className = "",
}: {
  showApp?: boolean;
  className?: string;
}) => (
  <div className={`flex items-center gap-2.5 ${className}`}>
    <img src="/TiMagLogo.svg" alt="TT House" className="h-10 w-10 shrink-0" />
    <div className="min-w-0">
      {/* The house is NAMED, not just pictured. A logo alone leaves "who am I
          working for" to be inferred from a small drawing, and the answer to
          that question should never need inferring on a payroll screen. */}
      {showApp ? (
        <p className="text-xl font-bold leading-tight text-gray-900">
          TiWork <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">· TT House</span>
        </p>
      ) : (
        <p className="text-sm font-bold leading-tight text-gray-900">TT House</p>
      )}
      <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-600/80">
        Our promise to every guest
      </p>
      <p className="text-sm font-semibold italic leading-tight text-amber-700">
        "Your comfort. Our mission."
      </p>
    </div>
  </div>
);

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
  const [shiftDraft, setShiftDraft] = useState<Record<string, { h: string; m: string }>>({});
  // Two different questions, two orders. "What have I done and did it go in"
  // reads backwards from today; "what am I doing next" reads forwards. One list
  // in one order answers whichever question it was not sorted for.
  const [shiftTab, setShiftTab] = useState<"tolog" | "done" | "upcoming">("tolog");
  // Two screens, not one long page. Work and money are separate questions asked
  // at separate moments — a balance sitting under the rota is read every time
  // someone checks tomorrow's rooms, whether or not they wanted to think about
  // pay. TiMag's Clean modal keeps Pay a peer tab for the same reason.
  const [view, setView] = useState<"work" | "pay">("work");
  const [pay, setPay] = useState<PaySummary | null>(null);
  // How far back the history reaches. Not all time by default: someone two years
  // in would load hundreds of rows to check last week. Not three weeks either —
  // this is the tab people check their pay against, and a pay cycle is longer
  // than that. Eight weeks covers a couple of cycles, and "Show earlier" widens
  // it a season at a time for anyone reconciling further back.
  const [daysBack, setDaysBack] = useState(56);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({ identifier: "", code: "" });
  const [draft, setDraft] = useState({ date: todayKey, h: "", m: "", report: "", rooms: "" });
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
        // Pay too. It was only fetched by reload(), which runs after LOGGING
        // something — so arriving at the screen showed the payments list with no
        // "still to come" or year to date above it, and the two figures people
        // actually open TiWork for appeared only once they had typed hours.
        return Promise.all([loadSchedule(creds), fetchMyPay(creds).then(setPay)]);
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

  // Two weeks ahead is all the plan worth showing; the past reaches back as far
  // as daysBack, which the guest can widen.
  const loadSchedule = (c: WorkCreds, back: number = daysBack) =>
    fetchMySchedule(c, {
      from: format(addDays(startOfToday(), -back), "yyyy-MM-dd"),
      to: format(addDays(startOfToday(), 14), "yyyy-MM-dd"),
    })
      .then(setShifts)
      .catch(() => {});

  const showEarlier = () => {
    if (!creds) return;
    const next = daysBack + 120;
    setDaysBack(next);
    loadSchedule(creds, next);
  };

  const reload = (c: WorkCreds) =>
    Promise.all([
      fetchMyEntries(c).then(setEntries).catch(() => {}),
      loadSchedule(c),
      fetchMyPay(c).then(setPay).catch(() => {}),
    ]);

  const submitShift = (shift: WorkShift) => {
    if (!creds) return;
    const hm = shiftDraft[shift.date] ?? { h: "", m: "" };
    const hours = hmToDecimal(hm.h, hm.m);
    if (!Number.isFinite(hours) || hours <= 0) {
      setError("How many hours? A number above zero.");
      return;
    }
    setError("");
    addMyEntry(creds, { date: shift.date, hours, report: "" })
      .then(() => {
        setShiftDraft((d) => ({ ...d, [shift.date]: { h: "", m: "" } }));
        return reload(creds);
      })
      .catch((msg) => setError(String(msg)));
  };

  const submit = () => {
    if (!creds) return;
    const hours = hmToDecimal(draft.h, draft.m);
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
        setDraft({ date: todayKey, h: "", m: "", report: "", rooms: "" });
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

  // "Done" must mean it HAPPENED, not that the date has passed. A visit is only
  // evidence of work once there are hours against it — recorded by the host or
  // claimed by the cleaner. A past assignment with neither is a plan that may
  // never have taken place: Henry was scheduled for the Cozy room on a day he
  // never came, and calling that "done" told him he had cleaned it.
  // Done means it HAPPENED — hours recorded by the host or claimed by the
  // cleaner. A past assignment with neither is not history, it is a rota entry
  // that may have come to nothing, which is how Henry ended up credited with a
  // room he never cleaned.
  const happened = (sh: WorkShift) => sh.recordedHours != null || sh.claim != null;

  const shiftsDone = useMemo(
    () =>
      shifts
        .filter((sh) => sh.date <= todayKey && happened(sh))
        .sort((a, b) => b.date.localeCompare(a.date)),
    [shifts, todayKey],
  );
  // Assigned, the day has passed, nothing logged. These are the ONLY days a
  // cleaner can put hours against — a claim has to name a day the business
  // scheduled, so there is no way to invent one. Leaving one alone is how you
  // say it never happened.
  // Two weeks, then it is dropped. An unlogged day is usually a plan that came
  // to nothing; keeping it forever means every cleaner accumulates phantoms.
  const logCutoff = format(addDays(startOfToday(), -14), "yyyy-MM-dd");
  const shiftsToLog = useMemo(
    () =>
      shifts
        .filter((sh) => sh.date <= todayKey && sh.date >= logCutoff && !happened(sh))
        .sort((a, b) => b.date.localeCompare(a.date)),
    [shifts, todayKey, logCutoff],
  );
  const shiftsUpcoming = useMemo(
    () => shifts.filter((sh) => sh.date > todayKey).sort((a, b) => a.date.localeCompare(b.date)),
    [shifts, todayKey],
  );

  const shiftsFor = (tab: "tolog" | "done" | "upcoming") =>
    tab === "done" ? shiftsDone : tab === "upcoming" ? shiftsUpcoming : shiftsToLog;

  // ── Signed out ────────────────────────────────────────────────────────────
  if (!me) {
    return (
      <div className="tibook-type flex min-h-[100dvh] flex-col items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <PromiseMark showApp />
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
        {/* Their own face, the one the host picked for them in TiMag — the same
            avatar on both screens, so the person and the record are visibly the
            same person. */}
        <CleanerAvatar
          name={me.name}
          character={me.character}
          photo={me.photo}
          sizeClass="h-10 w-10"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-bold text-gray-900">Hi {me.name.split(" ")[0]}</p>
          <p className="truncate text-xs text-gray-400">{me.title || "Team"}</p>
        </div>
        <button
          type="button"
          onClick={signOut}
          className="shrink-0 rounded-full border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-500"
        >
          Sign out
        </button>
      </header>

      {/* The promise sits ABOVE the hours and the pay, not only on the login
          screen a returning worker skips past with a saved code. Someone who
          stays signed in for months would otherwise never see it again. */}
      <div className="mx-auto w-full max-w-lg shrink-0 px-4 pt-3">
        <PromiseMark className="rounded-2xl border border-amber-200 bg-amber-50/60 px-3 py-2" />
      </div>

      <div className="mx-auto flex w-full max-w-lg shrink-0 gap-1 px-4 pt-3">
        {(["work", "pay"] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setView(v)}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-base font-semibold transition-colors ${
              view === v
                ? "bg-gray-900 text-white shadow-sm"
                : "border border-gray-200 bg-white text-gray-500"
            }`}
          >
            {/* The calendar-check is the same mark TiMag's booking cards use for
                "on the calendar", so the two apps name the same idea the same
                way. */}
            {v === "work" ? (
              <FaRegCalendarCheck size={16} className="shrink-0" />
            ) : (
              <FaRegMoneyBillAlt size={17} className="shrink-0" />
            )}
            {/* "Your", not "My". Every other word on this screen speaks TO the
                person — "Your cleanings", "Your saved code stopped working",
                "what's coming to you" — and the house motto they read here daily
                is "Your comfort. Our mission." Two labels in the other voice made
                the tabs read as a different app's, which is exactly the kind of
                small wrongness that makes someone doubt they are in the right
                place. */}
            {v === "work" ? "Your work" : "Your pay"}
          </button>
        ))}
      </div>

      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-3 px-4 py-3">
        {/* A cleaner's rota. Hours go against a turnover rather than a bare date:
            the host already knows which room was cleaned that morning, and
            asking someone to retype it invites a mismatch nobody can resolve
            afterwards. */}
        {view === "work" && me.kind === "cleaner" && (
          <div className="rounded-2xl border border-gray-200 bg-white p-3">
            {/* Title on its own line, tabs on the next. Sharing one row left the
                three tabs a sliver of a phone screen to fit in, so they either
                truncated or scrolled — and the title has nothing to gain from
                the space it was taking from them. */}
            <p className="mb-1.5 text-lg font-bold text-gray-800">Your cleanings</p>
            <div className="mb-2">
              <div className="flex gap-1 overflow-x-auto rounded-lg bg-gray-100 p-0.5">
                {(["tolog", "done", "upcoming"] as const).map((k) => {
                  const n = shiftsFor(k).length;
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setShiftTab(k)}
                      className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-semibold transition-colors ${
                        shiftTab === k ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
                      }`}
                    >
                      {/* Waiting on you, already settled, not yet certain —
                          the shapes carry the same three states the words do. */}
                      {k === "tolog" ? (
                        <FaRegClock size={14} className="shrink-0" />
                      ) : k === "done" ? (
                        <FaRegCheckCircle size={14} className="shrink-0" />
                      ) : (
                        <FaRegCalendarAlt size={14} className="shrink-0" />
                      )}
                      {k === "tolog" ? "To log" : k === "done" ? "Done" : "Planned"}
                      {n > 0 && (
                        <span
                          className={`rounded-full px-1.5 text-[11px] font-bold ${
                            k === "tolog"
                              ? "bg-amber-200 text-amber-800"
                              : "bg-gray-200 text-gray-600"
                          }`}
                        >
                          {n}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
            {shiftsFor(shiftTab).length === 0 ? (
              <p className="py-3 text-center text-sm text-gray-400">
                {shiftTab === "tolog"
                  ? "Nothing waiting — every visit has its hours in."
                  : shiftTab === "done"
                    ? "No cleanings recorded in the last few weeks."
                    : "No plan yet — Anh-Tuan will share one."}
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {/* Said before the rows, not after: a cleaner who reads these as
                    fixed will not expect the change when it comes. Cindy or
                    Anh-Tuan rearrange the week and share it later, so this is a
                    plan being shown, not a commitment being made. */}
                {shiftTab === "upcoming" && (
                  <p className="rounded-lg border border-dashed border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium leading-relaxed text-amber-800">
                    A plan, not a promise — it can still change. Anh-Tuan or Cindy will let
                    you know if it does.
                  </p>
                )}
                {shiftsFor(shiftTab).map((sh) => {
                  const claim = sh.claim;
                  const upcoming = sh.date > todayKey;
                  return (
                    <div
                      key={sh.date}
                      className={
                        upcoming
                          ? "flex flex-col gap-1.5 rounded-lg border border-dashed border-gray-300 bg-gray-50/60 px-2 py-1.5"
                          : "flex flex-col gap-1.5 border-b border-gray-100 pb-2 last:border-0 last:pb-0"
                      }
                    >
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-base font-semibold text-gray-800">
                          {fmtDay(sh.date)}
                        </span>
                        {/* Every room in that visit. The hours are for the trip,
                            not for any one room.

                            RoomBadge, not a chip of our own: a room is the same
                            colour everywhere in TiMag and TiBook, and a cleaner
                            who reads "Queen" as yellow on the calendar should
                            not meet a grey one here. */}
                        {sh.rooms.map((r, i) => (
                          <span key={`${r.name}-${i}`} className="inline-flex items-center gap-1">
                            <RoomBadge room={{ name: r.name, color: r.color }} />
                            {/* How many people arrive after this clean — asked
                                for by a cleaner, who sets out beds and towels
                                for a headcount and was otherwise texting to ask.
                                Spelled out rather than TiMag's bare "(2)": the
                                host reads that number beside a hundred others
                                and knows what it means, a cleaner meets it once
                                a week on a phone. Absent when nothing is booked
                                yet, which is not the same as nobody coming. */}
                            {r.guests ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-bold text-gray-600">
                                <FaRegUser size={10} />
                                {r.guests} {r.guests === 1 ? "guest" : "guests"}
                              </span>
                            ) : null}
                          </span>
                        ))}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {claim ? (
                          <span
                            className={`rounded-full border px-2.5 py-0.5 text-xs font-bold ${STATUS_STYLE[claim.status]}`}
                          >
                            {formatHrMin(claim.hours)} · {STATUS_LABEL[claim.status]}
                          </span>
                        ) : sh.recordedHours != null ? (
                          /* Already entered by Anh-Tuan in TiMag. Shown, not
                             editable: two people typing the same day is how the
                             two screens end up disagreeing. */
                          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700">
                            {formatHrMin(sh.recordedHours)} · recorded
                          </span>
                        ) : upcoming ? (
                          <span className="text-sm italic text-gray-400">planned</span>
                        ) : (
                          <>
                            {/* Hours and minutes, never a decimal. Nobody
                                works 1.58 hours. */}
                            <input
                              type="number"
                              inputMode="numeric"
                              min={0}
                              placeholder="hrs"
                              value={(shiftDraft[sh.date] ?? { h: "", m: "" }).h}
                              onChange={(ev) =>
                                setShiftDraft((d) => ({
                                  ...d,
                                  [sh.date]: {
                                    ...(d[sh.date] ?? { h: "", m: "" }),
                                    h: ev.target.value,
                                  },
                                }))
                              }
                              className="w-16 rounded-lg border border-gray-200 px-2 py-1.5 text-sm focus:border-gray-400 focus:outline-none"
                            />
                            <span className="text-sm text-gray-400">h</span>
                            <input
                              type="number"
                              inputMode="numeric"
                              min={0}
                              max={59}
                              placeholder="min"
                              value={(shiftDraft[sh.date] ?? { h: "", m: "" }).m}
                              onChange={(ev) =>
                                setShiftDraft((d) => ({
                                  ...d,
                                  [sh.date]: {
                                    ...(d[sh.date] ?? { h: "", m: "" }),
                                    m: ev.target.value,
                                  },
                                }))
                              }
                              className="w-16 rounded-lg border border-gray-200 px-2 py-1.5 text-sm focus:border-gray-400 focus:outline-none"
                            />
                            <span className="text-sm text-gray-400">m</span>
                            <button
                              type="button"
                              onClick={() => submitShift(sh)}
                              disabled={
                                !(shiftDraft[sh.date]?.h || shiftDraft[sh.date]?.m)
                              }
                              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
                            >
                              Send
                            </button>
                          </>
                        )}
                        {shiftTab === "tolog" && (
                          <span className="w-full text-sm text-gray-500">
                            Didn't work this day? Leave it — Anh-Tuan will clear it.
                          </span>
                        )}
                        {claim?.hostNote && (
                          <span className="w-full text-xs text-gray-500">
                            Note from Anh-Tuan: {claim.hostNote}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {shiftTab === "done" && shiftsDone.length > 0 && (
              <button
                type="button"
                onClick={showEarlier}
                className="mt-2 w-full rounded-xl border border-dashed border-gray-300 py-2 text-xs font-semibold text-gray-500 hover:bg-gray-50"
              >
                Show earlier — currently the last {Math.round(daysBack / 7)} weeks
              </button>
            )}
          </div>
        )}

        {/* Pay — the host's Pay tab, from the worker's side.
            Deliberately the same layout and the same words: the two of them read
            these numbers to each other, and a figure that looks different on the
            two screens turns a two-minute conversation into an argument. */}
        {view === "pay" && pay && (() => {
          const days = pay.days ?? [];
          const payments = pay.payments ?? [];
          const opening = pay.openingPaid ?? 0;
          return (
          <div className="rounded-2xl border border-gray-200 bg-white p-3">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
              <div className="flex items-center justify-between gap-2">
                {/* "Owed" says nothing about direction — on the host's screen
                    it means "I owe them", and read from this side it can mean
                    the opposite. "Earned" would collide with the two earnings
                    figures below; what is distinct about this number is that it
                    has not been paid yet. */}
                <span className="text-sm font-semibold text-emerald-700">To be paid to you</span>
                <span className="text-2xl font-bold text-emerald-700">
                  ${pay.owed.toFixed(2)}
                </span>
              </div>
              {/* What the money BUYS, not a lifetime subtraction — the same
                  sentence the host reads. */}
              <p className="mt-0.5 text-[13px] text-emerald-600">
                {pay.owed > 0.5
                  ? `${formatHrMin(pay.unpaidHours ?? 0)} worked${
                      pay.unpaidSince
                        ? ` since ${format(parseISO(pay.unpaidSince), "MMM d")}`
                        : ""
                    }`
                  : "All paid up"}
              </p>
            </div>

            {/* Beside the hours it prices, not in the greeting at the top: a
                rate only means something next to the work it is multiplied by. */}
            <div className="mb-1 mt-3 flex items-baseline justify-between gap-2">
              <p className="text-[12px] font-semibold uppercase tracking-wide text-gray-400">
                {(() => {
                  try {
                    return format(parseISO(pay.monthLabel + "-01"), "MMMM");
                  } catch {
                    return pay.monthLabel;
                  }
                })()}{" "}
                — hours by date
              </p>
              <span className="shrink-0 text-[13px] text-gray-500">
                <span className="font-bold text-gray-800">{money(me.payRate)}</span>
                {me.payType === "hourly" ? "/hr" : "/2wk"}
              </span>
            </div>
            <div className="max-h-48 overflow-y-auto rounded-lg bg-gray-50 p-2">
              {days.length === 0 ? (
                <p className="py-1 text-center text-[13px] text-gray-400">
                  No recorded hours this month
                </p>
              ) : (
                days.map((d) => (
                  <div key={d.date} className="flex items-center gap-2 py-0.5 text-sm">
                    <span className="flex-1 text-gray-600">
                      {format(parseISO(d.date), "EEE M/d")}
                    </span>
                    <span className="text-gray-500">{formatHrMin(d.hours)}</span>
                    <span className="w-16 text-right font-semibold text-gray-800">
                      ${d.earned.toFixed(2)}
                    </span>
                  </div>
                ))
              )}
            </div>
            <div className="mt-1 flex items-center justify-between px-1 text-[13px] text-gray-400">
              <span>This month's work (gross)</span>
              <span className="font-semibold">${(pay.monthGross ?? 0).toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between px-1 text-[13px] text-gray-400">
              <span>{pay.year} so far</span>
              <span className="font-semibold">${(pay.earned ?? 0).toFixed(2)}</span>
            </div>

            {(payments.length > 0 || opening > 0.005) && (
              <>
                <p className="mb-1 mt-3 text-[12px] font-semibold uppercase tracking-wide text-gray-400">
                  Payments
                </p>
                <div className="max-h-40 overflow-y-auto rounded-lg bg-gray-50 p-2">
                  {payments.map((pmt) => (
                    <div key={pmt.id} className="flex items-center gap-2 py-0.5 text-sm">
                      <span className="flex-1 text-gray-600">
                        {format(parseISO(pmt.paidOn), "EEE M/d")}
                      </span>
                      {pmt.note && (
                        <span className="truncate text-xs text-gray-400">{pmt.note}</span>
                      )}
                      <span className="w-20 text-right font-semibold text-emerald-600">
                        ${pmt.amount.toFixed(2)}
                      </span>
                    </div>
                  ))}
                  {/* Paid before itemised records began. Shown rather than
                      dropped: without it the payments listed add up to less than
                      what was really paid, and the balance looks wrong. */}
                  {opening > 0.005 && (
                    <div className="flex items-center gap-2 py-0.5 text-sm">
                      <span className="flex-1 text-gray-500">earlier</span>
                      <span className="text-xs text-gray-400">not itemised</span>
                      <span className="w-20 text-right font-semibold text-gray-500">
                        ${opening.toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>
              </>
            )}

            <p className="mt-2 text-[11px] leading-relaxed text-gray-400">
              A record of your work — not the amount due. What's coming to you is the
              figure above, already net of everything paid.
            </p>
          </div>
          );
        })()}

        {/* Office staff only. A cleaner's hours attach to a day the business
            scheduled, in the list above — a free date box would let a cleaning
            be invented that was never on any rota. */}
        {view === "work" && me.kind === "staff" && (
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
                Time worked
              </span>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  placeholder="0"
                  value={draft.h}
                  onChange={(e) => setDraft((d) => ({ ...d, h: e.target.value }))}
                  className="w-16 rounded-xl border border-gray-200 px-2 py-2 text-sm focus:border-gray-400 focus:outline-none"
                />
                <span className="text-sm text-gray-400">h</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={59}
                  placeholder="0"
                  value={draft.m}
                  onChange={(e) => setDraft((d) => ({ ...d, m: e.target.value }))}
                  className="w-16 rounded-xl border border-gray-200 px-2 py-2 text-sm focus:border-gray-400 focus:outline-none"
                />
                <span className="text-sm text-gray-400">m</span>
              </div>
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
                  setDraft({ date: todayKey, h: "", m: "", report: "", rooms: "" });
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

        {/* History — a staff member's own submissions. A cleaner's work is the
            rota above, so this would repeat it. */}
        {view === "work" && me.kind === "staff" && (
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
                  <span className="text-sm font-semibold text-gray-600">
                    {formatHrMin(e.hours)}
                  </span>
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
                        const hm = decimalToHm(e.hours);
                        setDraft({ date: e.date, h: hm.h, m: hm.m, report: e.report, rooms: "" });
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
        )}

        {/* The worker's half of the promise, which the mark at the top states.
            Repeating the motto itself here would make it wallpaper. */}
        <p className="pb-6 text-center text-xs leading-relaxed text-gray-400">
          Every room you leave ready is how we keep that promise. Thank you.
        </p>
      </div>
    </div>
  );
};

export default TiWork;
