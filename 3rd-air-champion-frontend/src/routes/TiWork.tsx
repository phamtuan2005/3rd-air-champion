import { useEffect, useMemo, useRef, useState } from "react";
import { addDays, format, parseISO, startOfToday } from "date-fns";
import {
  FaChevronDown,
  FaRegCalendarAlt,
  FaRegCalendarCheck,
  FaRegCheckCircle,
  FaRegClock,
  FaRegMoneyBillAlt,
} from "react-icons/fa";
import CleanerAvatar from "../components/shared/CleanerAvatar";
import RoomBadge from "../components/shared/RoomBadge";
import GuestFigures from "../components/shared/GuestFigures";
import SofaBedTag from "../components/shared/SofaBedTag";
import { decimalToHm, formatHrMin, hmToDecimal } from "../util/hoursFormat";
import {
  WorkCreds,
  WorkEntryType,
  WorkSignInFailure,
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
//
// The app's own name is deliberately NOT part of it. TiWork is a tool; TT House
// is the business making the promise, and running the two together as
// "TiWork · TT House" read as one odd compound name rather than as a tool
// belonging to a house. Identical on every screen, so the mark is a mark.
const PromiseMark = ({ className = "" }: { className?: string }) => (
  <div className={`flex items-center gap-2.5 ${className}`}>
    <img src="/TiMagLogo.svg" alt="TT House" className="h-10 w-10 shrink-0" />
    <div className="min-w-0">
      {/* The house is NAMED, not just pictured. A logo alone leaves "who am I
          working for" to be inferred from a small drawing, and the answer to
          that question should never need inferring on a payroll screen. */}
      <p className="text-sm font-bold leading-tight text-gray-900">TT House</p>
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

// "August 2026" from a yyyy-MM key.
const fmtMonth = (key: string) => {
  try {
    return format(parseISO(key + "-01"), "MMMM yyyy");
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
  // "To log" is the right tab to open on when something is waiting there, and a
  // dead end when nothing is — a cleaner who is up to date was landing on an
  // empty list and had to find their way to the schedule themselves.
  //
  // Runs ONCE, on the first schedule that arrives. Re-running it would move the
  // tab under someone who had just chosen it, and logging your last outstanding
  // day would throw you onto a different screen as a reward.
  const autoTabbedRef = useRef(false);
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
  // Signing out of TiMag costs a password you know. Signing out of HERE costs a
  // code Anh-Tuan issues — and the code is remembered precisely so nobody has to
  // keep it. One stray tap on a header pill therefore strands somebody until a
  // human answers a text, which is worth a question first.
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  // Bumped to re-run the auto sign-in with credentials we chose to KEEP after a
  // connection failure. Without it the effect, keyed only on `creds`, would never
  // fire again — leaving somebody holding a valid code on a screen with no way
  // to use it short of reloading the browser, which is not an instinct anyone
  // has on a phone.
  const [retryTick, setRetryTick] = useState(0);
  // In flight right now. Submitting hours had no busy state at all, and the row
  // it creates lands BELOW the fold on a phone — so on a slow connection the
  // screen looked identical before and after the tap, and the natural response
  // was to tap again. For a cleaner the database refuses the second one (a
  // cleaner's claims are unique per day); for office staff it does not, because
  // that index is partial on `cleaner`. So the duplicate was real, and it landed
  // in Anh-Tuan's queue for him to work out which of the two was meant.
  const [saving, setSaving] = useState(false);
  const [savingDate, setSavingDate] = useState<string | null>(null);
  // Said where the person is already looking, rather than left to be inferred
  // from a card further down the page. A new object each time so re-submitting
  // restarts the timer instead of silently reusing the old one.
  const [saved, setSaved] = useState<{ text: string } | null>(null);

  useEffect(() => {
    if (!saved) return;
    const t = setTimeout(() => setSaved(null), 5000);
    return () => clearTimeout(t);
  }, [saved]);

  // Sign in from remembered credentials on arrival.
  //
  // ONLY workSignIn failing is evidence the code was revoked. The three fetches
  // after it used to share this chain's catch, so any one of them hiccupping —
  // a 500, a dropped connection, a phone with one bar — cleared the saved
  // credentials and told the worker their access code had been replaced. It had
  // not, and they went and asked Anh-Tuan for a new one that did not exist.
  //
  // That misfires hardest where this app is actually used: TiWork installs to
  // the home screen and precaches its shell, so the icon opens instantly inside
  // a house with no signal — the exact moment the follow-up fetches fail.
  useEffect(() => {
    if (!creds) return;
    setLoading(true);
    workSignIn(creds)
      .then((who) => {
        setMe(who);
        // Each fetch owns its own failure now. A missing list is a gap on the
        // screen; it is not grounds for throwing away a working session.
        return Promise.all([
          fetchMyEntries(creds)
            .then((list) => setEntries(list ?? []))
            .catch(() => {}),
          loadSchedule(creds),
          // Pay too. It was only fetched by reload(), which runs after LOGGING
          // something — so arriving at the screen showed the payments list with no
          // "still to come" or year to date above it, and the two figures people
          // actually open TiWork for appeared only once they had typed hours.
          fetchMyPay(creds).then(setPay).catch(() => {}),
        ]);
      })
      .catch((err) => {
        const f = err as WorkSignInFailure;
        setError(f?.message ?? String(err));
        // Only an ANSWER from the server is evidence about the code. If we never
        // reached it, the saved credentials stay exactly where they are — see
        // WorkSignInFailure. Throwing them away on a dropped connection is how a
        // cleaner standing in the house with no bars ended up locked out of an
        // account that was never actually closed.
        if (f?.refused) {
          // 401 means the code itself was replaced — worth saying so, and worth
          // saying only then. A 403 (account ended, or on leave) is a different
          // conversation and the server already worded it.
          setWasRevoked(!!f.codeRejected);
          setCreds(null);
          localStorage.removeItem(CREDS_KEY);
        }
      })
      .finally(() => setLoading(false));
  }, [creds, retryTick]);

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
      .catch((err) => setError((err as WorkSignInFailure)?.message ?? String(err)))
      .finally(() => setLoading(false));
  };

  // Sign out exists for ONE reason: a shared phone. That is also the case it
  // used to handle worst — it cleared creds, me and entries and left `pay` and
  // `shifts` sitting in state. Signing in is two setState calls in one batch
  // (setMe, then setCreds), so the next person's name and avatar render
  // immediately while the previous person's rota and BALANCE are still on
  // screen, until the refetches land a second or two later. Cindy signs out,
  // Henry signs in, and Henry reads Cindy's wages under his own name.
  //
  // So everything belonging to a person goes, not just the credentials.
  const signOut = () => {
    localStorage.removeItem(CREDS_KEY);
    setCreds(null);
    setMe(null);
    setEntries([]);
    setShifts([]);
    setPay(null);
    setShiftDraft({});
    setDraft({ date: todayKey, h: "", m: "", report: "", rooms: "" });
    setEditingId(null);
    setDaysBack(56);
    // Back to the screens a first arrival gets, so nothing about the last
    // person's session — which tab they were reading, how far back they had
    // widened their history — carries into the next.
    setView("work");
    setShiftTab("tolog");
    setError("");
    // The next person gets the same "open on a tab with something in it" pass
    // the first one did.
    autoTabbedRef.current = false;
    setShowSignOutConfirm(false);
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
    if (savingDate) return;
    setSavingDate(shift.date);
    addMyEntry(creds, { date: shift.date, hours, report: "" })
      .then(() => {
        setShiftDraft((d) => ({ ...d, [shift.date]: { h: "", m: "" } }));
        setSaved({ text: `Sent — ${fmtDay(shift.date)}, ${formatHrMin(hours)}.` });
        return reload(creds);
      })
      .catch((msg) => setError(String(msg)))
      .finally(() => setSavingDate(null));
  };

  const submit = () => {
    if (!creds) return;
    const hours = hmToDecimal(draft.h, draft.m);
    if (!Number.isFinite(hours) || hours <= 0) {
      setError("How many hours? A number above zero.");
      return;
    }
    setError("");
    // The guard that matters most for office staff: the unique index protecting
    // cleaners from a double-tap is partial on `cleaner`, so it does not cover
    // them and nothing else would.
    if (saving) return;
    setSaving(true);
    const wasEditing = !!editingId;
    const action = editingId
      ? editMyEntry(creds, { id: editingId, date: draft.date, hours, report: draft.report })
      : addMyEntry(creds, { date: draft.date, hours, report: draft.report });
    action
      .then(() => {
        setSaved({
          text: `${wasEditing ? "Saved" : "Logged"} — ${fmtDay(draft.date)}, ${formatHrMin(hours)}. Waiting on Anh-Tuan.`,
        });
        setDraft({ date: todayKey, h: "", m: "", report: "", rooms: "" });
        setEditingId(null);
        return reload(creds);
      })
      .catch((msg) => setError(String(msg)))
      .finally(() => setSaving(false));
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

  // Hours submitted and not yet ruled on.
  //
  // The Pay tab is built entirely from APPROVED work — /work/pay-summary filters
  // status: "approved" for both kinds, correctly, because nothing should be
  // counted as money until the host has agreed to it. But the consequence was
  // that logging a day changed nothing on the one screen that answers "where is
  // my money": same balance, same month, same year, until approval. The work
  // existed only as an amber pill on the other tab.
  //
  // Counted from `entries`, which /work/entries already returns UNWINDOWED for
  // both staff and cleaners, and which TiWork already fetches on sign-in
  // regardless of kind — for cleaners it was fetched and then thrown away, since
  // only the office-staff history rendered it.
  //
  // Hours, never dollars. approvedRate is frozen at approval and a cleaner's
  // work is billed at the rate in force on its own date, so pricing this from
  // today's me.payRate could quote a figure the host's screen contradicts — the
  // exact disagreement the pay-summary route goes out of its way to avoid. Hours
  // are a fact both sides already agree on.
  const pending = useMemo(() => {
    const subs = entries.filter((e) => e.status === "submitted");
    return {
      count: subs.length,
      hours: subs.reduce((sum, e) => sum + (e.hours || 0), 0),
      oldest: subs.reduce<string | null>(
        (min, e) => (!min || e.date < min ? e.date : min),
        null,
      ),
    };
  }, [entries]);

  // The history, in months.
  //
  // /work/entries returns EVERYTHING, unwindowed, so this list only ever grows —
  // a year in, checking last week meant scrolling past a hundred cards. Months
  // are the unit people already think in here: the Pay tab is organised by
  // month, and "how much did I do in July" is the question a long list makes
  // hardest to answer.
  //
  // Entries arrive sorted date-descending from the route, so each month's rows
  // are already newest-first and need no second sort — the same direction the
  // hours-by-date list now reads.
  const entriesByMonth = useMemo(() => {
    const map = new Map<string, WorkEntryType[]>();
    for (const e of entries) {
      const key = (e.date || "").slice(0, 7);
      const list = map.get(key);
      if (list) list.push(e);
      else map.set(key, [e]);
    }
    return [...map.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([month, items]) => ({
        month,
        items,
        hours: items.reduce((sum, e) => sum + (e.hours || 0), 0),
        // Collapsing must never bury something that still needs attention. A
        // waiting claim or one that was declined — with a note from Anh-Tuan
        // explaining why — would otherwise be invisible behind a folded header,
        // and the whole point of the header is that you can trust it.
        waiting: items.filter((e) => e.status === "submitted").length,
        rejected: items.filter((e) => e.status === "rejected").length,
      }));
  }, [entries]);

  // Only the newest month starts open. Kept as an override map rather than
  // seeded state so it needs no effect and cannot fight with entries arriving:
  // an untouched month simply falls back to the rule.
  const [openMonths, setOpenMonths] = useState<Record<string, boolean>>({});
  const isMonthOpen = (month: string, index: number) => openMonths[month] ?? index === 0;

  const shiftsFor = (tab: "tolog" | "done" | "upcoming") =>
    tab === "done" ? shiftsDone : tab === "upcoming" ? shiftsUpcoming : shiftsToLog;

  useEffect(() => {
    if (autoTabbedRef.current || shifts.length === 0) return;
    autoTabbedRef.current = true;
    if (shiftsToLog.length > 0) return;
    // What is coming before what is finished: a cleaner with nothing to log is
    // asking "when am I next in", not "what did I already do".
    if (shiftsUpcoming.length > 0) setShiftTab("upcoming");
    else if (shiftsDone.length > 0) setShiftTab("done");
  }, [shifts, shiftsToLog, shiftsUpcoming, shiftsDone]);

  // ── Signed out ────────────────────────────────────────────────────────────
  if (!me) {
    return (
      <div className="tibook-type flex min-h-[100dvh] flex-col items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          {/* The tool names itself first — this is the screen where somebody
              checks they opened the right app. The house and its promise follow
              as their own block. */}
          <h1 className="text-xl font-bold leading-tight text-gray-900">TiWork</h1>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
            Hours &amp; pay for the team
          </p>
          <PromiseMark className="mt-3 rounded-xl border border-amber-200 bg-amber-50/60 px-3 py-2" />
          <p className="mt-2.5 text-sm text-gray-500">
            Log your hours and tell us what you worked on.
          </p>

          {/* Credentials we KEPT because the server never answered. Without this
              the screen was indistinguishable from being signed out — same empty
              boxes — so somebody holding a perfectly good code would conclude it
              had stopped working and go asking for another. The whole point of
              keeping the code is lost if we don't say we kept it. */}
          {creds && (
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
              <p className="text-sm leading-relaxed text-amber-800">
                Your saved code is still here — this is the connection, not your code.
                Nothing to re-enter.
              </p>
              <button
                type="button"
                onClick={() => {
                  setError("");
                  setRetryTick((t) => t + 1);
                }}
                disabled={loading}
                className="mt-2 w-full rounded-lg bg-amber-600 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {loading ? "Trying…" : "Try again"}
              </button>
            </div>
          )}

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
          onClick={() => setShowSignOutConfirm(true)}
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
            {/* A cleaner could not see errors at all. Every setError in
                submitShift — the zero-hours guard, and the server's "You weren't
                scheduled that day" — was written to a string rendered only on the
                signed-out screen and inside the office-staff form. So Send simply
                did nothing, with no reason given, on the one screen a cleaner
                uses. Same for the confirmation. */}
            {error && <p className="mb-2 text-sm font-semibold text-red-500">{error}</p>}
            {saved && (
              <p className="mb-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
                {saved.text}
              </p>
            )}
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
                      {/* One line that answers the whole day: when, how big, and
                          where the hours stand. The size was left to be counted
                          off the rows below, and the hours sat under them — so
                          the two things somebody scanning the list actually wants
                          were the two things they had to hunt for. */}
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                        <span className="text-base font-semibold text-gray-800">
                          {fmtDay(sh.date)}
                        </span>
                        <span className="text-gray-300">&middot;</span>
                        <span className="text-sm font-semibold text-gray-500">
                          {sh.rooms.length} {sh.rooms.length === 1 ? "room" : "rooms"}
                        </span>
                        {claim ? (
                          <>
                            <span className="text-gray-300">&middot;</span>
                            <span
                              className={`rounded-full border px-2.5 py-0.5 text-xs font-bold ${STATUS_STYLE[claim.status]}`}
                            >
                              {formatHrMin(claim.hours)} {STATUS_LABEL[claim.status].toLowerCase()}
                            </span>
                          </>
                        ) : sh.recordedHours != null ? (
                          <>
                            <span className="text-gray-300">&middot;</span>
                            {/* Already entered by Anh-Tuan in TiMag. Shown, not
                                editable: two people typing the same day is how
                                the two screens end up disagreeing. */}
                            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700">
                              {formatHrMin(sh.recordedHours)} recorded
                            </span>
                          </>
                        ) : upcoming ? (
                          <>
                            <span className="text-gray-300">&middot;</span>
                            <span className="text-sm italic text-gray-400">planned</span>
                          </>
                        ) : null}
                      </div>
                      {/* One room per LINE, each with its own headcount.
                          Laid out in a row, the rooms and their counts sat in a
                          single band — badge, number, badge, number — and a
                          cleaner could not tell which room the number in the
                          middle belonged to. Two rooms expecting different
                          numbers of people is exactly when this matters, so the
                          pairing has to be unmistakable.

                          RoomBadge, not a chip of our own: a room is the same
                          colour everywhere in TiMag and TiBook, and a cleaner
                          who reads "Queen" as yellow on the calendar should not
                          meet a grey one here. */}
                      <div className="flex flex-col gap-1">
                        {sh.rooms.map((r, i) => (
                          <div key={`${r.name}-${i}`} className="flex items-center gap-2">
                            <RoomBadge room={{ name: r.name, color: r.color }} rooms={sh.rooms} />
                            {/* How many people arrive after this clean — asked
                                for by a cleaner, who sets out beds and towels for
                                a headcount and was otherwise texting to ask.
                                Spelled out rather than TiMag's bare "(2)": the
                                host reads that number beside a hundred others and
                                knows what it means, a cleaner meets it once a week
                                on a phone. Silent when nothing is booked yet,
                                which is not the same as nobody coming. */}
                            <GuestFigures n={r.guests ?? 0} />
                            <SofaBedTag on={r.sofaBed} />
                          </div>
                        ))}
                      </div>
                      {/* Only what is still to be DONE about the day lives down
                          here — the boxes for hours not yet sent, and anything
                          Anh-Tuan wrote back. A day already settled says so on
                          the line above and needs no second row. */}
                      <div className="flex flex-wrap items-center gap-2 empty:hidden">
                        {!claim && sh.recordedHours == null && !upcoming && (
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
                                !!savingDate ||
                                !(shiftDraft[sh.date]?.h || shiftDraft[sh.date]?.m)
                              }
                              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
                            >
                              {savingDate === sh.date ? "Sending…" : "Send"}
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
          // Newest at the top. The route hands these over oldest-first, which put
          // the day you most likely came to check at the BOTTOM of a box that
          // scrolls — and left this list the only one on the page reading that
          // way, since Payments already arrives newest-first from cleanerPay.
          //
          // Same expression, same name as the host's panel in CleanersModal, which
          // has always shown them newest-first. The two of them read these rows to
          // each other, so scanning in opposite directions was one more way for
          // the same figures to feel like different figures.
          const daysNewestFirst = [...days].reverse();
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

            {/* Directly under the balance, and deliberately NOT part of it. The
                green block is money the house has committed to; this is work it
                has not agreed to yet. Blending the two would overstate what is
                owed, which is the one number on this screen nobody may get
                wrong. */}
            {pending.count > 0 && (
              <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-amber-800">
                    Waiting on Anh-Tuan
                  </span>
                  <span className="text-lg font-bold text-amber-800">
                    {formatHrMin(pending.hours)}
                  </span>
                </div>
                <p className="mt-0.5 text-[13px] text-amber-700">
                  {pending.count} {pending.count === 1 ? "day" : "days"}
                  {pending.oldest
                    ? `, oldest ${format(parseISO(pending.oldest), "MMM d")}`
                    : ""}{" "}
                  — counted here once approved
                </p>
              </div>
            )}

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
                daysNewestFirst.map((d) => (
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
          {/* Confirmation lives HERE, next to the button, not in the list below —
              on a phone that list starts past the fold, so the only proof the tap
              worked was a card you had to scroll to find. */}
          {saved && (
            <p className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
              {saved.text}
            </p>
          )}
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
              disabled={saving}
              className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {saving ? "Saving…" : editingId ? "Save" : "Submit"}
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
            entriesByMonth.map((g, gi) => {
              const open = isMonthOpen(g.month, gi);
              return (
                <div key={g.month} className="flex flex-col gap-2">
                  {/* The header answers the month on its own, so a folded one is
                      still informative: how many days, how long, and whether
                      anything in there is unsettled. */}
                  <button
                    type="button"
                    onClick={() =>
                      setOpenMonths((m) => ({ ...m, [g.month]: !open }))
                    }
                    aria-expanded={open}
                    className="flex w-full items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-left"
                  >
                    <FaChevronDown
                      size={12}
                      className={`shrink-0 text-gray-400 transition-transform ${
                        open ? "" : "-rotate-90"
                      }`}
                    />
                    <span className="text-sm font-bold text-gray-900">
                      {fmtMonth(g.month)}
                    </span>
                    <span className="text-xs text-gray-400">
                      {g.items.length} {g.items.length === 1 ? "day" : "days"} &middot;{" "}
                      {formatHrMin(g.hours)}
                    </span>
                    <span className="ml-auto flex shrink-0 items-center gap-1">
                      {g.waiting > 0 && (
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${STATUS_STYLE.submitted}`}
                        >
                          {g.waiting} waiting
                        </span>
                      )}
                      {g.rejected > 0 && (
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${STATUS_STYLE.rejected}`}
                        >
                          {g.rejected} not counted
                        </span>
                      )}
                    </span>
                  </button>

                  {open &&
                    g.items.map((e) => (
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
                    ))}
                </div>
              );
            })
          )}
        </div>
        )}

        {/* The worker's half of the promise, which the mark at the top states.
            Repeating the motto itself here would make it wallpaper.

            Said in terms of the work the reader ACTUALLY does. Office staff were
            being thanked for rooms they never clean — this line sat outside every
            me.kind branch — and a personal thank-you for somebody else's job is
            worse than no thank-you at all. */}
        <p className="pb-6 text-center text-xs leading-relaxed text-gray-400">
          {me.kind === "cleaner"
            ? "Every room you leave ready is how we keep that promise. Thank you."
            : "The work you do behind the scenes is how we keep that promise. Thank you."}
        </p>
      </div>

      {/* Same shape as TiMag's log-out confirm, so the two apps ask the same
          question the same way — but it NAMES the cost instead of only asking.
          "Are you sure?" stops the stray tap and nothing else; the person who
          taps deliberately, tidying up at the end of a shift, says yes and is
          locked out just the same. What they do not know is that getting back
          in needs a code somebody else has to send them.

          The second line answers the question anyone hovering here is really
          asking. Until now the only place TiWork promised the hours survive was
          the revoked-code warning on the way back IN — which is too late to
          reassure the person deciding whether to leave. */}
      {showSignOutConfirm && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 px-4">
          <div className="flex w-80 max-w-full flex-col gap-5 rounded-2xl bg-white px-6 py-6 shadow-2xl">
            <div className="flex flex-col gap-1.5">
              <span className="text-xl font-bold text-gray-900">Sign out?</span>
              <span className="text-sm leading-relaxed text-gray-500">
                You'll need your access code from Anh-Tuan to get back in. Your logged
                hours are safe either way.
              </span>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowSignOutConfirm(false)}
                className="flex-1 rounded-xl border border-gray-200 py-3 text-base font-semibold text-gray-600 transition-colors hover:bg-gray-50 active:bg-gray-100"
              >
                Stay signed in
              </button>
              <button
                type="button"
                onClick={signOut}
                className="flex-1 rounded-xl bg-red-500 py-3 text-base font-semibold text-white transition-colors hover:bg-red-600 active:bg-red-700"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TiWork;
