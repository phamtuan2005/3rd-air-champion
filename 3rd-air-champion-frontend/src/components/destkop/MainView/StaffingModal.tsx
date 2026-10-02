import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { entriesFor, monthLabel, peopleFromEntries, startsMonth, totalsByMonth } from "../../../util/hoursByPerson";
import { format, parseISO, startOfToday } from "date-fns";
import CleanerAvatar from "../../shared/CleanerAvatar";
import GuestFigures from "../../shared/GuestFigures";
import SofaBedTag from "../../shared/SofaBedTag";
import RoomBadge from "../../shared/RoomBadge";
import { MdCleaningServices } from "react-icons/md";
import { GUEST_AVATAR_PRESETS } from "../../../util/guestAvatars";
import { formatHrMin } from "../../../util/hoursFormat";
import {
  CleanerSummaryType,
  CleanerType,
  fetchCleanerSummary,
  fetchCleaners,
  rateOn as cleanerRateOn,
  updateCleaner,
} from "../../../util/cleanerOperations";
import { payLines, payrollByMonth, shiftMonth } from "../../../util/payrollByMonth";
import { staffPayMessage } from "../../../util/staffPayMessage";
import WorkerPicker from "./WorkerPicker";
import {
  HostWorkEntry,
  StaffType,
  addStaffReview,
  createStaff,
  deleteStaff,
  editWorkEntry,
  fetchStaff,
  fetchWorkEntries,

  payStaff,
  rateOn,
  reviewWorkEntry,
  updateStaff,
} from "../../../util/staffOperations";

interface StaffingModalProps {
  hostId: string;
  token: string;
  onClose: () => void;
  // Who signs the pay text: the host, or the cohost who is logged in.
  senderName?: string;
  // Opened from the search on one staff member: their Team card is open and
  // in view, and Hours and Payroll are already on them, so whichever tab the
  // host turns to next is about the person they searched for.
  focusId?: string;
}

const money = (n: number) =>
  Number.isInteger(n) ? `$${n.toLocaleString()}` : `$${n.toFixed(2)}`;

const fmtDate = (key: string) => {
  try {
    return format(parseISO(key.slice(0, 10)), "MMM d, yyyy");
  } catch {
    return key;
  }
};

const inputCls =
  "rounded-lg border border-gray-200 px-2 py-1.5 text-sm focus:border-gray-400 focus:outline-none";

// Six characters, no 0/O or 1/I/L: this gets read off one screen and typed into
// another, often by someone in another country on a phone keyboard.
const newCode = () => {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () =>
    alphabet[Math.floor(Math.random() * alphabet.length)],
  ).join("");
};

const Stars = ({ value }: { value: number }) => (
  <span className="shrink-0 text-sm leading-none text-amber-400" title={`${value} of 5`}>
    {"★".repeat(Math.max(0, Math.min(5, value)))}
    <span className="text-gray-200">{"★".repeat(Math.max(0, 5 - value))}</span>
  </span>
);

/**
 * The people hired to help run the business, and what they cost.
 *
 * Deliberately separate from Cleaners. A cleaner is paid per turnover, from
 * hours recorded against a room on a date; staff are paid for a POST — hourly or
 * a fixed biweekly salary — whether or not a room changed hands that week. Same
 * shape of record, a different question, so a shared screen would have had to
 * hide half its fields for whichever kind you were looking at.
 */
const StaffingModal = ({ hostId, token, onClose, senderName, focusId }: StaffingModalProps) => {
  const [staff, setStaff] = useState<StaffType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(focusId ?? null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [tab, setTab] = useState<"team" | "hours" | "payroll">("team");
  // Which person's face grid is open. One at a time: eighteen options is the
  // largest thing on the card, and the card is mostly opened to fix a rate.
  const [avatarFor, setAvatarFor] = useState<string | null>(null);
  const [workEntries, setWorkEntries] = useState<HostWorkEntry[]>([]);
  // The Hours tab narrowed to one person, or everyone (null). See
  // util/hoursByPerson for why the tab is narrowed at all.
  const [hoursFor, setHoursFor] = useState<string | null>(focusId ?? null);
  const people = useMemo(() => peopleFromEntries(workEntries), [workEntries]);
  // A pick that no longer matches anyone (their last claim declined and gone
  // from the fetch) falls back to everyone rather than an empty list.
  const person = people.find((p) => p.staffId === hoursFor) ?? null;
  const shownEntries = useMemo(() => entriesFor(workEntries, person ? person.staffId : null), [workEntries, person]);
  const shownMonths = useMemo(() => totalsByMonth(shownEntries), [shownEntries]);
  // Cleaners are staff too — they are paid by this business and log hours in the
  // same TiWork. They keep their own record because every CleaningAssignment
  // points at it and the auto-planner needs fields an office role has no use
  // for, so this screen SHOWS them rather than owning them: their rota and pay
  // stay in Clean, and what belongs here is the one thing both kinds share —
  // a way into TiWork.
  const [cleaners, setCleaners] = useState<CleanerType[]>([]);
  // Their payouts, itemised, for the Payroll tab. The cleaner list above has
  // no payments on it; the summary route is where Clean reads them from too.
  const [cleanerPay, setCleanerPay] = useState<CleanerSummaryType[]>([]);

  const todayKey = format(startOfToday(), "yyyy-MM-dd");

  const [draft, setDraft] = useState({
    name: "",
    title: "",
    hiredOn: todayKey,
    payType: "hourly" as "hourly" | "biweekly",
    payRate: "",
  });

  // Per-person scratch state for the two append-only actions.
  const [reviewDraft, setReviewDraft] = useState<Record<string, { rating: string; note: string }>>({});
  // Recording a staff payout — on the Payroll tab, where the ledger is. It
  // was on the Team card, an amount box beside "Paid to date"; Anh-Tuan found
  // the team list no place for money to change hands (2026-09-30), and asked
  // for a tip and a text to the worker with it, as the cleaner payout has.
  const [payAmount, setPayAmount] = useState("");
  const [payTip, setPayTip] = useState("");
  const [payDate, setPayDate] = useState(todayKey);
  const [payNote, setPayNote] = useState("");
  // Two taps to move money, and a ref so the second cannot post twice while
  // the first is in flight ([[guard-writes-in-flight]]).
  const [payArmed, setPayArmed] = useState(false);
  const [paying, setPaying] = useState(false);
  const payingRef = useRef(false);
  // The pay text on the clipboard, for a worker with no phone on file:
  // SyTien is reached on WhatsApp, which an sms: link cannot open, so the
  // message is copied and pasted there instead (Anh-Tuan, 2026-10-01).
  // "Copied" shows for a moment so the tap is seen to have done something.
  const [payCopied, setPayCopied] = useState(false);
  const [payPreview, setPayPreview] = useState(false);

  // Correcting an entry from the Hours tab: its day, its hours, or what was
  // written. A staff member can fix their own in TiWork only while it waits;
  // once approved it locks for them, and the host had no edit at all — so a
  // wrong date that had been approved could be fixed by nobody. Anh-Tuan asked
  // for the chance to correct it here (2026-10-01).
  //
  // One entry at a time, edited in its own card. Hours as h and m, the way
  // TiWork takes them, so both sides type the same thing.
  const [editEntry, setEditEntry] = useState<{
    id: string;
    date: string;
    h: string;
    m: string;
    report: string;
  } | null>(null);
  const [editError, setEditError] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  // A ref as well as the flag: the flag disables the button a render later,
  // and a second tap can land in between ([[guard-writes-in-flight]]).
  const editSavingRef = useRef(false);

  const openEdit = (w: HostWorkEntry) => {
    let h = Math.floor(w.hours);
    let m = Math.round((w.hours - h) * 60);
    if (m === 60) {
      h += 1;
      m = 0;
    }
    setEditError("");
    setEditEntry({ id: w.id, date: w.date, h: String(h), m: String(m), report: w.report ?? "" });
  };

  const saveEdit = () => {
    if (!editEntry || editSavingRef.current) return;
    const hours = (parseInt(editEntry.h || "0", 10) || 0) + (parseInt(editEntry.m || "0", 10) || 0) / 60;
    if (hours <= 0) {
      setEditError("Enter how long they worked.");
      return;
    }
    editSavingRef.current = true;
    setEditSaving(true);
    setEditError("");
    editWorkEntry(
      { id: editEntry.id, date: editEntry.date, hours: Math.round(hours * 10000) / 10000, report: editEntry.report },
      token,
    )
      .then(() => fetchWorkEntries(hostId, token).then(setWorkEntries))
      .then(() => setEditEntry(null))
      // The server says why in a sentence the host can act on: a day before
      // the hire date, a cleaner's unscheduled day.
      .catch((err) => setEditError(err?.response?.data?.error ?? "Could not save that."))
      .finally(() => {
        editSavingRef.current = false;
        setEditSaving(false);
      });
  };

  useEffect(() => {
    fetchStaff(hostId, token)
      .then(setStaff)
      .catch(() => setError("Could not load the team."))
      .finally(() => setLoading(false));
    fetchCleaners(hostId, token)
      .then(setCleaners)
      .catch(() => {
        /* the team list must survive a cleaner fetch failing */
      });
    fetchCleanerSummary(hostId, token)
      .then(setCleanerPay)
      .catch(() => {
        /* payroll then shows staff paychecks only; the rest of the modal stands */
      });
    fetchWorkEntries(hostId, token)
      .then(setWorkEntries)
      .catch(() => {
        /* hours are a separate concern; a failure here must not blank the team */
      });
  }, [hostId, token]);

  const patch = (updated: StaffType) =>
    setStaff((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));

  // Opened on one person from the search: once the team has loaded, bring
  // their card into view. Open is not enough on a long team — an open card
  // below the fold is a search that seems to have found nothing.
  useEffect(() => {
    if (!focusId || loading) return;
    document.querySelector(`[data-staff-card="${focusId}"]`)?.scrollIntoView({ block: "center" });
  }, [focusId, loading]);


  const payroll = useMemo(
    () => payrollByMonth(staff, cleanerPay, workEntries, todayKey),
    [staff, cleanerPay, workEntries, todayKey],
  );
  // The Payroll tab's pick and month. Everyone is read a month at a time;
  // one worker is read across all their months — see the tab for why.
  const [payrollFor, setPayrollFor] = useState<string | null>(focusId ?? null);
  const [payrollMonth, setPayrollMonth] = useState(todayKey.slice(0, 7));
  // Which person's paychecks are unfolded in the everyone view.
  const [openPay, setOpenPay] = useState<string | null>(null);
  // The same face as on the Team tab, beside a name on the Hours and Payroll
  // tabs: a cleaner's photo or drawn avatar, a staff member's drawn one. Asked
  // for so a person reads the same in all three tabs (2026-09-30).
  const avatarOf = (id: string, name: string, sizeClass = "h-7 w-7") => {
    const c = cleaners.find((x) => x.id === id);
    const s = c ? undefined : staff.find((x) => x.id === id);
    return <CleanerAvatar name={name} photo={c?.photo} character={c?.character ?? s?.character} sizeClass={sizeClass} />;
  };
  // What a person does, for the tag after their name on Payroll: "cleaner",
  // or a staff member's own title. "" when a staff member has none yet.
  const roleOf = (id: string, kind: "staff" | "cleaner") =>
    kind === "cleaner" ? "cleaner" : (staff.find((s) => s.id === id)?.title ?? "");
  const payrollPeople = useMemo(() => {
    const seen = new Map<string, { id: string; name: string; hint?: string; avatar?: React.ReactNode }>();
    // Everyone on the books first, paid yet or not: a new hire has a first
    // payout to record here, so they must be pickable before any payment exists.
    staff.forEach((s) => seen.set(s.id, { id: s.id, name: s.name, hint: s.title || undefined, avatar: avatarOf(s.id, s.name) }));
    cleaners.forEach((c) => seen.set(c.id, { id: c.id, name: c.name, hint: "cleaner", avatar: avatarOf(c.id, c.name) }));
    payroll.forEach((m) =>
      m.people.forEach((p) => {
        if (seen.has(p.id)) return;
        seen.set(p.id, {
          id: p.id,
          name: p.name,
          hint: p.kind === "cleaner" ? "cleaner" : staff.find((s) => s.id === p.id)?.title || undefined,
          avatar: avatarOf(p.id, p.name),
        });
      }),
    );
    return [...seen.values()];
  }, [payroll, staff, cleaners]); // eslint-disable-line react-hooks/exhaustive-deps
  const payrollPerson = payrollPeople.find((p) => p.id === payrollFor) ?? null;
  // The pay panel is for staff. A cleaner is paid in Clean, which knows
  // their balance and their hours.
  const payStaffMember = payrollPerson ? staff.find((s) => s.id === payrollPerson.id) ?? null : null;
  const shownPayroll = useMemo(
    () =>
      payrollPerson
        ? payroll
            .map((m) => {
              const mine = m.people.filter((p) => p.id === payrollPerson.id);
              return {
                key: m.key,
                paid: mine.reduce((s, p) => s + p.paid, 0),
                tips: mine.reduce((s, p) => s + p.tips, 0),
                people: mine,
              };
            })
            .filter((m) => m.people.length > 0)
        : [payroll.find((m) => m.key === payrollMonth) ?? { key: payrollMonth, paid: 0, tips: 0, people: [] }],
    [payroll, payrollPerson, payrollMonth],
  );

  const active = staff.filter((s) => !s.endedOn || s.endedOn >= todayKey);
  const former = staff.filter((s) => s.endedOn && s.endedOn < todayKey);

  const handleAdd = () => {
    if (!draft.name.trim()) {
      setError("A name is required.");
      return;
    }
    setError("");
    createStaff(
      {
        host: hostId,
        name: draft.name.trim(),
        title: draft.title.trim(),
        hiredOn: draft.hiredOn,
        payType: draft.payType,
        payRate: parseFloat(draft.payRate) || 0,
      },
      token,
    )
      .then((created) => {
        setStaff((prev) => [created, ...prev]);
        setAdding(false);
        setDraft({ name: "", title: "", hiredOn: todayKey, payType: "hourly", payRate: "" });
      })
      .catch((err) =>
        setError(err?.response?.data?.error ?? "Could not add them to the team."),
      );
  };

  const renderCard = (s: StaffType) => {
    const open = expandedId === s.id;
    const rate = rateOn(s, todayKey);

    const latest = [...(s.reviews ?? [])].sort((a, b) => b.date.localeCompare(a.date))[0];
    const rd = reviewDraft[s.id] ?? { rating: "", note: "" };

    return (
      <div key={s.id} data-staff-card={s.id} className="rounded-xl border border-gray-200 bg-white">
        <button
          type="button"
          onClick={() => setExpandedId(open ? null : s.id)}
          className="flex w-full items-center gap-2.5 p-3 text-left"
        >
          <CleanerAvatar name={s.name} character={s.character} sizeClass="h-10 w-10" />
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-1.5">
              <span className="text-base font-bold text-gray-900">{s.name}</span>
              {s.endedOn && s.endedOn < todayKey && (
                <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-bold uppercase text-gray-500">
                  Former
                </span>
              )}
            </p>
            <p className="mt-0.5 text-sm text-gray-500">
              {s.title || "No title yet"}
              <span className="text-gray-400"> · since {fmtDate(s.hiredOn)}</span>
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-sm font-bold text-emerald-600">
              {money(rate)}
              <span className="font-normal text-gray-400">
                {s.payType === "hourly" ? "/hr" : "/2wk"}
              </span>
            </p>
            {latest && <Stars value={latest.rating} />}
          </div>
        </button>

        {open && (
          <div className="flex flex-col gap-3 border-t border-gray-100 px-3 pb-3 pt-2.5">
            {/* Pay terms */}
            <div className="flex flex-wrap items-end gap-2">
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Paid
                </span>
                <select
                  value={s.payType}
                  onChange={(e) =>
                    updateStaff({ id: s.id, payType: e.target.value as "hourly" | "biweekly" }, token)
                      .then(patch)
                      .catch(() => setError("Could not save the pay type."))
                  }
                  className={inputCls}
                >
                  <option value="hourly">Hourly</option>
                  <option value="biweekly">Biweekly</option>
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                  {s.payType === "hourly" ? "Per hour" : "Per 2 weeks"}
                </span>
                <input
                  type="number"
                  min={0}
                  defaultValue={s.payRate}
                  onBlur={(e) => {
                    const v = parseFloat(e.target.value);
                    if (!Number.isFinite(v) || v === s.payRate) return;
                    updateStaff({ id: s.id, payRate: v }, token)
                      .then(patch)
                      .catch(() => setError("Could not save the rate."));
                  }}
                  className={`${inputCls} w-24`}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Hired
                </span>
                <input
                  type="date"
                  defaultValue={s.hiredOn}
                  onBlur={(e) =>
                    e.target.value !== s.hiredOn &&
                    updateStaff({ id: s.id, hiredOn: e.target.value }, token)
                      .then(patch)
                      .catch(() => setError("Could not save the hiring date."))
                  }
                  className={inputCls}
                />
              </label>
            </div>

            {/* The face. Same eighteen presets Manage Guests offers, drawn with
                THIS person's name as the seed so the grid shows what they will
                actually look like — two people picking the same look still get
                different faces. Nothing is uploaded; only the choice is stored. */}
            <div className="rounded-lg border border-gray-100 bg-gray-50 p-2.5">
              <div className="flex items-center gap-2">
                <CleanerAvatar name={s.name} character={s.character} sizeClass="h-9 w-9" />
                <span className="flex-1 text-xs text-gray-500">
                  {GUEST_AVATAR_PRESETS.find((pr) => pr.character === s.character)?.label ??
                    (s.character ? "Custom" : "Plain initials")}
                </span>
                <button
                  type="button"
                  onClick={() => setAvatarFor(avatarFor === s.id ? null : s.id)}
                  className="rounded-lg bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700"
                >
                  {avatarFor === s.id ? "Done" : "Change"}
                </button>
              </div>
              {avatarFor === s.id && (
                <>
                  <div className="mt-1.5 grid grid-cols-6 gap-1.5 rounded-xl border border-gray-200 bg-white p-2">
                    {GUEST_AVATAR_PRESETS.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        title={preset.label}
                        onClick={() =>
                          updateStaff({ id: s.id, character: preset.character }, token)
                            .then(patch)
                            .catch(() => setError("Could not save the avatar."))
                        }
                        className={`flex items-center justify-center rounded-lg p-0.5 transition-all ${
                          s.character === preset.character
                            ? "ring-2 ring-gray-900"
                            : "ring-1 ring-transparent hover:ring-gray-300"
                        }`}
                      >
                        <CleanerAvatar
                          name={s.name}
                          character={preset.character}
                          sizeClass="h-9 w-9"
                        />
                      </button>
                    ))}
                  </div>
                  <p className="mt-1 text-[11px] leading-tight text-gray-400">
                    Drawn, not uploaded — nothing is stored but the choice. The first option
                    returns to plain initials. They see this in TiWork.
                  </p>
                </>
              )}
            </div>

            {/* TiWork sign-in. Email carries the weight for anyone working from
                abroad — the first hire is in Germany, where a US phone number is
                not something she has. Either identifier works with the code. */}
            <div className="flex flex-wrap items-end gap-2 rounded-lg border border-gray-100 bg-gray-50 p-2.5">
              <label className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Email
                </span>
                <input
                  type="email"
                  placeholder="them@example.com"
                  defaultValue={s.email}
                  onBlur={(e) =>
                    e.target.value !== s.email &&
                    updateStaff({ id: s.id, email: e.target.value.trim() }, token)
                      .then(patch)
                      .catch(() => setError("Could not save the email."))
                  }
                  className={`${inputCls} w-full`}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                  TiWork code
                </span>
                <div className="flex items-center gap-1">
                  <input
                    placeholder="not set"
                    defaultValue={s.accessCode}
                    key={s.accessCode}
                    onBlur={(e) =>
                      e.target.value !== s.accessCode &&
                      updateStaff({ id: s.id, accessCode: e.target.value.trim() }, token)
                        .then(patch)
                        .catch(() => setError("Could not save the code."))
                    }
                    className={`${inputCls} w-24 font-mono tracking-wider`}
                  />
                  <button
                    type="button"
                    title="Generate a new code — the old one stops working"
                    onClick={() =>
                      updateStaff({ id: s.id, accessCode: newCode() }, token)
                        .then(patch)
                        .catch(() => setError("Could not generate a code."))
                    }
                    className="shrink-0 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm text-gray-500 hover:bg-gray-50"
                  >
                    ↻
                  </button>
                </div>
              </label>
              <p className="w-full text-[11px] leading-relaxed text-gray-400">
                Send them the code however suits — WhatsApp, email, a call. Nothing here
                sends it for you. Regenerating revokes the old one.
              </p>
            </div>

            {/* Performance — a dated history, not a single score */}
            <div className="rounded-lg border border-gray-100 bg-gray-50 p-2.5">
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">
                Performance
              </p>
              {(s.reviews ?? []).length === 0 ? (
                <p className="mb-2 text-sm text-gray-400">No reviews yet.</p>
              ) : (
                <div className="mb-2 flex flex-col gap-1.5">
                  {[...s.reviews]
                    .sort((a, b) => b.date.localeCompare(a.date))
                    .map((r) => (
                      <div key={r.id} className="flex items-start gap-2">
                        <Stars value={r.rating} />
                        <div className="min-w-0 flex-1">
                          <span className="text-xs text-gray-400">{fmtDate(r.date)}</span>
                          {r.note && <p className="text-sm text-gray-600">{r.note}</p>}
                        </div>
                      </div>
                    ))}
                </div>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={rd.rating}
                  onChange={(e) =>
                    setReviewDraft((d) => ({ ...d, [s.id]: { ...rd, rating: e.target.value } }))
                  }
                  className={`${inputCls} w-20`}
                >
                  <option value="">Rate</option>
                  {[5, 4, 3, 2, 1].map((n) => (
                    <option key={n} value={n}>
                      {n} ★
                    </option>
                  ))}
                </select>
                <input
                  placeholder="What stood out?"
                  value={rd.note}
                  onChange={(e) =>
                    setReviewDraft((d) => ({ ...d, [s.id]: { ...rd, note: e.target.value } }))
                  }
                  className={`${inputCls} min-w-0 flex-1`}
                />
                <button
                  type="button"
                  disabled={!rd.rating}
                  onClick={() =>
                    addStaffReview(
                      { id: s.id, date: todayKey, rating: parseInt(rd.rating, 10), note: rd.note },
                      token,
                    )
                      .then((u) => {
                        patch(u);
                        setReviewDraft((d) => ({ ...d, [s.id]: { rating: "", note: "" } }));
                      })
                      .catch(() => setError("Could not save the review."))
                  }
                  className="shrink-0 rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
                >
                  Add
                </button>
              </div>
            </div>

            {/* No money on the team card. "Paid to date", an amount box to
                record a payout, then a button to Payroll, then an earned/owed
                line all sat here in turn; Anh-Tuan wanted none of it on the
                team list (2026-10-01). Hours, pay and what is owed are the
                Hours and Payroll tabs. */}

            <div className="flex items-center gap-2 border-t border-gray-100 pt-2">
              {!s.endedOn && (
                <button
                  type="button"
                  onClick={() =>
                    updateStaff({ id: s.id, endedOn: todayKey }, token)
                      .then(patch)
                      .catch(() => setError("Could not close their record."))
                  }
                  className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600"
                >
                  Mark as left
                </button>
              )}
              {confirmDelete === s.id ? (
                <>
                  <span className="text-xs text-gray-500">Delete permanently?</span>
                  <button
                    type="button"
                    onClick={() =>
                      deleteStaff(s.id, token)
                        .then(() => {
                          setStaff((prev) => prev.filter((x) => x.id !== s.id));
                          setConfirmDelete(null);
                        })
                        .catch(() => setError("Could not delete."))
                    }
                    className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white"
                  >
                    Yes, delete
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(null)}
                    className="text-xs font-semibold text-gray-500"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(s.id)}
                  className="ml-auto text-xs font-semibold text-red-400 hover:text-red-600"
                >
                  Delete
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      className="modal-type fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-2 border-b border-gray-100 px-4 py-3">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-gray-800">Staffing</h2>
            <p className="mt-0.5 text-xs text-gray-400">
              The people helping run TT House, and what they cost
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

        {error && <p className="shrink-0 px-4 pt-2 text-sm font-semibold text-red-500">{error}</p>}

        {/* Two questions: who is on the team, and what have they claimed. */}
        <div className="mx-4 mb-1 mt-2 flex shrink-0 gap-1 overflow-x-auto rounded-xl bg-gray-100 p-1">
          {(["team", "hours", "payroll"] as const).map((k) => {
            const pending = workEntries.filter((w) => w.status === "submitted").length;
            return (
              <button
                key={k}
                type="button"
                onClick={() => setTab(k)}
                className={`flex min-w-fit flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-2 py-1.5 text-sm font-semibold transition-colors ${
                  tab === k ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
                }`}
              >
                {k === "team" ? "Team" : k === "hours" ? "Hours" : "Payroll"}
                {k === "hours" && pending > 0 && (
                  <span
                    className={`min-w-[1.25rem] shrink-0 rounded-full px-1 py-0.5 text-center text-[12px] font-bold leading-none ${
                      tab === k ? "bg-gray-900 text-white" : "bg-amber-200 text-amber-800"
                    }`}
                  >
                    {pending}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {tab === "payroll" ? (
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
            {/* The ledger: each month, every paycheck, beside what each person
                earned in it. Nothing is recorded here. A staff payout is still
                recorded on the Team tab and a cleaner payout in Clean, so this
                tab can never disagree with either; it only reads them.
                See util/payrollByMonth for why it exists. */}
            {/* Who, then when. Everyone: one month at a time, with a switcher,
                because every month stacked under the last was a list with no
                end (Anh-Tuan, 2026-09-30). One worker: all of their months,
                newest first. The question is then "what have I paid this
                person", and that has an end, their history. */}
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <WorkerPicker title="Whose payroll" people={payrollPeople} value={payrollPerson?.id ?? null} onChange={setPayrollFor} />
              {!payrollPerson && (
                <div className="ml-auto flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setPayrollMonth((k) => shiftMonth(k, -1))}
                    aria-label="Earlier month"
                    className="rounded-lg border border-gray-200 px-2.5 py-1 text-sm text-gray-600"
                  >
                    ‹
                  </button>
                  <span className="min-w-[8.5rem] text-center text-sm font-bold text-gray-900">{monthLabel(`${payrollMonth}-01`)}</span>
                  {/* No later than this month: nothing is paid in a month that has not come. */}
                  <button
                    type="button"
                    onClick={() => setPayrollMonth((k) => shiftMonth(k, 1))}
                    disabled={payrollMonth >= todayKey.slice(0, 7)}
                    aria-label="Later month"
                    className="rounded-lg border border-gray-200 px-2.5 py-1 text-sm text-gray-600 disabled:opacity-30"
                  >
                    ›
                  </button>
                </div>
              )}
            </div>
            {/* Said once, above the list: where recording a payout lives. The
                list alone never said it. */}
            {!payrollPerson && (
              <p className="-mt-1.5 mb-2.5 text-[11px] text-gray-400">
                Tap a name to see only that person, and to record a staff payout.
              </p>
            )}
            {payStaffMember &&
              (() => {
                const amount = parseFloat(payAmount) || 0;
                const tip = parseFloat(payTip) || 0;
                const monthKey = payDate.slice(0, 7);
                const monthName = monthLabel(`${monthKey}-01`).split(" ")[0];
                const body = staffPayMessage({
                  name: payStaffMember.name,
                  staffId: payStaffMember.id,
                  entries: workEntries,
                  monthKey,
                  monthName,
                  paid: amount,
                  tip,
                  sender: senderName,
                });
                const text = () => {
                  if (!payStaffMember.phone) return;
                  window.location.href = `sms:${payStaffMember.phone}?&body=${encodeURIComponent(body)}`;
                };
                const copy = () => {
                  // The clipboard API needs a secure page; TiMag is served over
                  // https, but if it is ever not, the preview below is the way
                  // to select the text by hand.
                  navigator.clipboard?.writeText(body).then(
                    () => {
                      setPayCopied(true);
                      setTimeout(() => setPayCopied(false), 1500);
                    },
                    () => setPayPreview(true),
                  );
                };
                const record = () => {
                  if (!payArmed) {
                    setPayArmed(true);
                    return;
                  }
                  if (payingRef.current) return;
                  payingRef.current = true;
                  setPaying(true);
                  // The tip is a second payment, posted once the wages are in:
                  // two writes to one record raced would lose one, and the
                  // wages must not be the casualty — as the cleaner payout does it.
                  payStaff({ id: payStaffMember.id, amount, paidOn: payDate, note: payNote }, token)
                    .then((u) =>
                      tip > 0
                        ? payStaff({ id: payStaffMember.id, amount: tip, paidOn: payDate, note: "Tip", tip: true }, token)
                        : u,
                    )
                    .then((u) => {
                      patch(u);
                      setPayAmount("");
                      setPayTip("");
                      setPayNote("");
                      setPayArmed(false);
                      setError("");
                    })
                    .catch(() => setError("Could not record the payment."))
                    .finally(() => {
                      payingRef.current = false;
                      setPaying(false);
                    });
                };
                const field = (label: string, input: React.ReactNode) => (
                  <label className="flex min-w-0 flex-col gap-1">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{label}</span>
                    {input}
                  </label>
                );
                const dollars = (value: string, set: (v: string) => void) => (
                  <div className="relative">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-sm text-gray-400">$</span>
                    <input
                      type="number"
                      min={0}
                      placeholder="0"
                      value={value}
                      onChange={(e) => {
                        set(e.target.value);
                        setPayArmed(false);
                      }}
                      className={`${inputCls} w-full pl-5`}
                    />
                  </div>
                );
                return (
                  <div className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50/50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                      Record pay for {payStaffMember.name}
                      {/* The same tag as on their row below. */}
                      {payStaffMember.title && (
                        <span className="ml-1.5 text-[11px] font-semibold text-teal-600">{payStaffMember.title}</span>
                      )}
                    </p>
                    <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {field("Amount", dollars(payAmount, setPayAmount))}
                      {/* A tip on top of wages, recorded apart from them, as a
                          cleaner tip is: it settles nothing and must not read
                          as an overpayment on the ledger. */}
                      {field("Tip", dollars(payTip, setPayTip))}
                      {field(
                        "Paid on",
                        <input
                          type="date"
                          value={payDate}
                          onChange={(e) => {
                            setPayDate(e.target.value);
                            setPayArmed(false);
                          }}
                          className={inputCls}
                        />,
                      )}
                      {field(
                        "Note",
                        <input
                          type="text"
                          value={payNote}
                          placeholder={`${monthName} pay`}
                          onChange={(e) => setPayNote(e.target.value)}
                          className={inputCls}
                        />,
                      )}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        disabled={amount <= 0 || paying}
                        onClick={record}
                        className={`rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40 ${
                          payArmed ? "bg-emerald-700" : "bg-emerald-600"
                        }`}
                      >
                        {paying ? "Recording…" : payArmed ? `Confirm ${money(amount + tip)}` : "Record pay"}
                      </button>
                      {payArmed && !paying && (
                        <button type="button" onClick={() => setPayArmed(false)} className="text-xs text-gray-400">
                          Cancel
                        </button>
                      )}
                      {payStaffMember.phone && (
                        <button
                          type="button"
                          disabled={amount <= 0}
                          onClick={text}
                          className="rounded-lg border border-blue-300 px-3 py-1.5 text-xs font-semibold text-blue-700 disabled:opacity-40"
                        >
                          💬 Text {payStaffMember.name.split(" ")[0]}
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={amount <= 0}
                        onClick={copy}
                        className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 disabled:opacity-40"
                      >
                        {payCopied ? "Copied ✓" : "📋 Copy message"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setPayPreview((v) => !v)}
                        className="text-xs text-gray-400"
                      >
                        {payPreview ? "Hide" : "Show"} message
                      </button>
                    </div>
                    {payPreview && (
                      <textarea
                        readOnly
                        value={body}
                        rows={8}
                        onFocus={(e) => e.target.select()}
                        className="mt-2 w-full rounded-lg border border-gray-200 bg-white p-2 text-xs text-gray-700"
                      />
                    )}
                    <p className="mt-1.5 text-[11px] text-gray-400">
                      The message lists the approved days of {monthName} and what was paid today, tip included.
                      {!payStaffMember.phone && " No phone on file, so copy it and paste it into WhatsApp."}
                    </p>
                  </div>
                );
              })()}
            <div className="flex flex-col gap-3">
              {payrollPerson && shownPayroll.length === 0 && (
                <p className="py-6 text-center text-sm text-gray-400">Nothing paid to {payrollPerson.name} yet.</p>
              )}
              {shownPayroll.map((m) => (
                <section key={m.key} className="rounded-xl border border-gray-200 bg-white">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 border-b border-gray-100 px-3 py-2">
                    <p className="text-sm font-bold text-gray-900">{monthLabel(`${m.key}-01`)}</p>
                    {/* The month's total is the figure this tab exists for, so
                        it is the largest thing on the row — the size the old
                        Monthly payroll card gave its number. Rose: money out. */}
                    <p className="flex items-baseline gap-1.5 text-sm text-gray-700">
                      <span className="text-2xl font-bold leading-none text-rose-600">{money(m.paid)}</span> paid
                      {m.tips > 0 && <span className="text-gray-500"> · {money(m.tips)} in tips</span>}
                    </p>
                  </div>
                  {m.people.length === 0 ? (
                    <p className="px-3 py-3 text-sm text-gray-400">Nothing paid yet this month.</p>
                  ) : (
                    <div className="flex flex-col divide-y divide-gray-100">
                      {m.people.map((p) => {
                        // One worker's view unfolds every month; everyone's
                        // keeps each person to a line until tapped, so a month
                        // with many names stays one screen.
                        const open = !!payrollPerson || openPay === p.id;
                        return (
                          <div key={p.id} className="px-3 py-2">
                            {/* Two taps in one line. The NAME (or the face) goes to
                                that person's own Payroll: all their months, and
                                for staff the Record pay panel. The amounts unfold
                                the month's paychecks in place.

                                The whole line used to be the unfold. Recording
                                a payout meant picking the person from the
                                dropdown first, which nothing on this list said
                                — Anh-Tuan took it for a bug, "I cannot record
                                the payout", before finding the dropdown
                                (2026-10-02). The name is what one reaches for,
                                so the name is the way in. */}
                            <div className="flex w-full flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                              <button
                                type="button"
                                // Already on this person: nothing to switch to.
                                disabled={!!payrollPerson}
                                title={payrollPerson ? undefined : `Show only ${p.name}`}
                                onClick={(e) => {
                                  setPayrollFor(p.id);
                                  setOpenPay(null);
                                  // Their view opens at its top, where the pay
                                  // panel is, not wherever this row was.
                                  e.currentTarget.closest(".overflow-y-auto")?.scrollTo({ top: 0 });
                                }}
                                className="flex items-center gap-2 text-left text-sm font-bold text-gray-900 disabled:cursor-default"
                              >
                                {avatarOf(p.id, p.name)}
                                {p.name}
                                {/* What they do, after the name: "cleaner", or a
                                    staff member's own title. Only cleaners had
                                    the tag at first, so "AI prompt intern" was a
                                    bare name in a list where everyone else was
                                    labelled (Anh-Tuan, 2026-10-02). A staff
                                    member with no title yet shows none. */}
                                {roleOf(p.id, p.kind) && (
                                  <span className="ml-1.5 text-[11px] font-semibold uppercase text-teal-600">{roleOf(p.id, p.kind)}</span>
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={() => { if (!payrollPerson) setOpenPay(open ? null : p.id); }}
                                className={`text-right text-sm text-gray-700 ${payrollPerson ? "cursor-default" : ""}`}
                              >
                                <span className="font-bold">{money(p.paid)}</span> paid
                                {p.tips > 0 && <span className="text-gray-500"> · {money(p.tips)} tip</span>}
                                {/* Earned beside paid, for hourly people. Amber
                                    when the month's wages are not yet covered. A
                                    payout can lag into the next month, so it is
                                    a flag to look, not a debt. */}
                                {p.earned !== null && (
                                  <span className={p.earned > p.paid ? "text-amber-700" : "text-gray-500"}>
                                    {" · "}earned {money(p.earned)}
                                  </span>
                                )}
                                {!payrollPerson && p.paychecks.length > 0 && (
                                  <span className="ml-1.5 text-xs text-gray-400">{open ? "▾" : "›"}</span>
                                )}
                              </button>
                            </div>
                            {/* One line per payout date, pay and tip as two
                                columns — a tip is its own record underneath,
                                and as its own row it read as a second
                                paycheck. See payLines. */}
                            {open && p.paychecks.length > 0 && (
                              <table className="mt-1.5 w-full text-xs">
                                <thead>
                                  <tr className="text-left text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                                    <th className="w-24 whitespace-nowrap py-0.5 font-semibold">Date</th>
                                    <th className="w-20 py-0.5 text-right font-semibold">Pay</th>
                                    <th className="w-16 py-0.5 text-right font-semibold">Tip</th>
                                    <th className="py-0.5 pl-3 font-semibold">Note</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {payLines(p.paychecks).map((ln) => (
                                    <tr key={ln.paidOn} className="text-gray-500">
                                      <td className="whitespace-nowrap py-0.5">{fmtDate(ln.paidOn)}</td>
                                      <td className="py-0.5 text-right font-semibold text-gray-700">
                                        {ln.wages > 0 ? money(ln.wages) : "—"}
                                      </td>
                                      <td className="py-0.5 text-right font-semibold text-amber-700">
                                        {ln.tip > 0 ? money(ln.tip) : ""}
                                      </td>
                                      <td className="max-w-0 truncate py-0.5 pl-3">{ln.note}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>
              ))}
            </div>
          </div>
        ) : tab === "hours" ? (
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
            {/* The gate between what someone typed and what the business owes.
                Nothing counts toward pay until it is approved here. */}
            {workEntries.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-400">
                No hours submitted yet. They arrive here from TiWork.
              </p>
            ) : (
              <div className="flex flex-col gap-2.5">
                {/* Who to read: everyone, or one person, found by typing. This
                    was a row of chips, one per worker — see WorkerPicker for
                    why it is a searchable list now. A badge says that person
                    has a claim waiting, so the host can go straight to it. */}
                <div>
                  <WorkerPicker
                    title="Whose hours"
                    people={people.map((p) => ({ id: p.staffId, name: p.name, hint: p.title || undefined, badge: p.pending, avatar: avatarOf(p.staffId, p.name) }))}
                    value={person?.staffId ?? null}
                    onChange={setHoursFor}
                  />
                </div>
                {shownEntries.map((w, i) => (
                  <Fragment key={w.id}>
                  {/* Month headings only for one person: "over time" needs the
                      months named, while everyone's list is read for what is
                      waiting today and the headings would only push it down.
                      Each heading carries ITS month's figures — hours and pay
                      at the rates each claim was approved at, and what is
                      still waiting on the host. There was an all-time total
                      above the list first; see totalsByMonth for why not. */}
                  {person && startsMonth(shownEntries, i) && (() => {
                    const t = shownMonths.get(w.date.slice(0, 7));
                    return (
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 pt-1">
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                          {monthLabel(w.date)}
                        </p>
                        {t && (
                          <p className="text-sm text-gray-700">
                            <span className="font-bold text-gray-900">{formatHrMin(t.approvedHours)}</span> approved ·{" "}
                            <span className="font-bold text-emerald-700">{money(t.approvedPay)}</span>
                            {t.waitingHours > 0 && (
                              <>
                                {" · "}
                                <span className="font-semibold text-amber-700">{formatHrMin(t.waitingHours)} waiting on you</span>
                              </>
                            )}
                          </p>
                        )}
                      </div>
                    );
                  })()}
                  <div className="rounded-xl border border-gray-200 bg-white p-3">
                    {/* Who, when, what the visit was, and how long — the line
                        TiWork shows the cleaner for the same day, so a claim and
                        the claimant's own screen read alike. */}
                    <div className="flex flex-wrap items-center gap-2">
                      {avatarOf(w.staffId, w.staffName)}
                      <span className="text-sm font-bold text-gray-900">{w.staffName}</span>
                      <span className="text-sm text-gray-500">{fmtDate(w.date)}</span>
                      {w.kind === "cleaner" && (w.rooms?.length ?? 0) > 0 && (
                        <span className="inline-flex items-center gap-1.5 text-sm text-gray-500">
                          <MdCleaningServices className="shrink-0 text-teal-600" size={14} />
                          <span className="font-semibold">
                            {w.rooms!.length} {w.rooms!.length === 1 ? "room" : "rooms"}
                          </span>
                        </span>
                      )}
                      {/* Rooms the cleaner typed in for a day nothing was
                          scheduled — kept, because then it is the only record of
                          what they say they cleaned. */}
                      {w.roomName && (w.rooms?.length ?? 0) === 0 && (
                        <span className="rounded-md bg-gray-100 px-2 py-0.5 text-xs font-bold text-gray-700">
                          {w.roomName}
                        </span>
                      )}
                      <span className="text-sm font-semibold text-gray-700">{formatHrMin(w.hours)}</span>
                      <span
                        className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-bold ${
                          w.status === "approved"
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : w.status === "rejected"
                              ? "border-rose-200 bg-rose-50 text-rose-700"
                              : "border-amber-200 bg-amber-50 text-amber-700"
                        }`}
                      >
                        {w.status === "approved"
                          ? `Approved · ${money(Math.round(w.hours * (w.approvedRate || 0) * 100) / 100)}`
                          : w.status === "rejected"
                            ? "Not counted"
                            : "Waiting on you"}
                      </span>
                      {/* Quiet, and at the far end of the line: it is the rare
                          action on a card whose everyday ones are Approve and
                          Decline. */}
                      {editEntry?.id !== w.id && (
                        <button
                          type="button"
                          onClick={() => openEdit(w)}
                          className="ml-auto shrink-0 text-xs font-semibold text-gray-400 hover:text-gray-700"
                        >
                          Edit
                        </button>
                      )}
                    </div>
                    {/* What the day actually consisted of. Reviewing an hours
                        claim used to mean opening the Clean panel to remember
                        what was being paid for; the rooms and their headcounts
                        are the answer, and they are the same ones the cleaner
                        was shown in TiWork. */}
                    {(w.rooms?.length ?? 0) > 0 && (
                      <div className="mt-1.5 flex flex-col gap-1">
                        {w.rooms!.map((r, i) => (
                          <div key={`${r.name}-${i}`} className="flex items-center gap-2">
                            <RoomBadge room={{ name: r.name, color: r.color }} rooms={w.rooms!} />
                            <GuestFigures n={r.guests ?? 0} />
                            <SofaBedTag on={r.sofaBed} />
                          </div>
                        ))}
                      </div>
                    )}
                    {editEntry?.id === w.id && (
                      <div className="mt-2 rounded-xl border border-gray-200 bg-gray-50 p-2.5">
                        <div className="flex flex-wrap items-end gap-2">
                          <label className="flex flex-col gap-1">
                            <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Day worked</span>
                            <input
                              type="date"
                              max={todayKey}
                              value={editEntry.date}
                              onChange={(e) => setEditEntry((d) => (d ? { ...d, date: e.target.value } : d))}
                              className={inputCls}
                            />
                          </label>
                          <label className="flex flex-col gap-1">
                            <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">How long</span>
                            <span className="flex items-center gap-1">
                              <input
                                type="number"
                                inputMode="numeric"
                                min={0}
                                value={editEntry.h}
                                onChange={(e) => setEditEntry((d) => (d ? { ...d, h: e.target.value } : d))}
                                className={`${inputCls} w-14 text-center`}
                              />
                              <span className="text-sm text-gray-400">h</span>
                              <input
                                type="number"
                                inputMode="numeric"
                                min={0}
                                max={59}
                                value={editEntry.m}
                                onChange={(e) => setEditEntry((d) => (d ? { ...d, m: e.target.value } : d))}
                                className={`${inputCls} w-14 text-center`}
                              />
                              <span className="text-sm text-gray-400">m</span>
                            </span>
                          </label>
                        </div>
                        <label className="mt-2 flex flex-col gap-1">
                          <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">What they did</span>
                          <textarea
                            rows={3}
                            value={editEntry.report}
                            onChange={(e) => setEditEntry((d) => (d ? { ...d, report: e.target.value } : d))}
                            className={`${inputCls} w-full`}
                          />
                        </label>
                        {/* Said before Save, not discovered after: on an
                            approved entry the correction changes what is owed. */}
                        <p className="mt-1.5 text-[11px] text-gray-400">
                          {w.status === "approved"
                            ? "Already approved: pay follows the corrected day and hours, at the rate in force that day."
                            : "Stays as it is until you approve or decline it."}
                          {w.kind === "cleaner" && " A cleaner can only be moved to a day they were scheduled."}
                        </p>
                        {editError && <p className="mt-1.5 text-xs font-semibold text-red-500">{editError}</p>}
                        <div className="mt-2 flex gap-2">
                          <button
                            type="button"
                            onClick={saveEdit}
                            disabled={editSaving}
                            className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
                          >
                            {editSaving ? "Saving…" : "Save"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditEntry(null)}
                            disabled={editSaving}
                            className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                    {/* While an entry is being corrected, its old report and
                        its Approve and Decline step aside: approving the
                        figure on screen while a different one is being typed
                        would approve the wrong thing. */}
                    {editEntry?.id !== w.id && w.report && (
                      <p className="mt-1.5 whitespace-pre-line text-sm text-gray-600">{w.report}</p>
                    )}
                    {editEntry?.id !== w.id && w.status === "submitted" && (
                      <div className="mt-2 flex gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            reviewWorkEntry(
                              { id: w.id, status: "approved", reviewedOn: todayKey },
                              token,
                            )
                              .then(() => fetchWorkEntries(hostId, token).then(setWorkEntries))
                              .catch(() => setError("Could not approve that."))
                          }
                          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            reviewWorkEntry({ id: w.id, status: "rejected" }, token)
                              .then(() => fetchWorkEntries(hostId, token).then(setWorkEntries))
                              .catch(() => setError("Could not decline that."))
                          }
                          className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600"
                        >
                          Decline
                        </button>
                      </div>
                    )}
                  </div>
                  </Fragment>
                ))}
              </div>
            )}
          </div>
        ) : (
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {/* There was a "Monthly payroll" card here: biweekly salaries at 26
              periods a year, hourly people named but not counted because
              TiWork did not exist yet. With one hourly intern and the cleaners
              paid through Clean it read $0 — Anh-Tuan asked why (2026-09-30)
              and then that it go. What the house pays out, by month and by
              person, is the Payroll tab now. */}
          {loading ? (
            <p className="py-8 text-center text-sm text-gray-400">Loading…</p>
          ) : (
            <div className="flex flex-col gap-2.5">
              {active.length === 0 && former.length === 0 && !adding && (
                <p className="py-6 text-center text-sm text-gray-400">
                  Nobody on the team yet.
                </p>
              )}
              {active.map(renderCard)}

              {/* Cleaners, listed but not owned. Their rota, rates and payments
                  live in Clean; what this screen adds is the TiWork door, which
                  is the one thing every paid person now shares. */}
              {cleaners.length > 0 && (
                <>
                  <p className="pt-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                    Cleaners
                  </p>
                  {cleaners.map((c) => (
                    <div key={c.id} className="rounded-xl border border-gray-200 bg-white p-3">
                      <div className="flex items-center gap-2.5">
                        <CleanerAvatar
                          name={c.name}
                          photo={c.photo}
                          character={c.character}
                          sizeClass="h-10 w-10"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="flex flex-wrap items-center gap-1.5">
                            <span className="text-base font-bold text-gray-900">{c.name}</span>
                            {c.paused && (
                              <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold uppercase text-amber-700">
                                On leave
                              </span>
                            )}
                          </p>
                          <p className="mt-0.5 text-sm text-gray-500">
                            Cleaner
                            <span className="text-gray-400"> · paid in Clean</span>
                          </p>
                        </div>
                        {/* The rate in force TODAY, not the base one. payRate is
                            what they started on; a raise lives in rateHistory,
                            so showing payRate reported the old figure for
                            everyone who has ever had one. Same resolver the
                            Clean panel uses, so the two agree. */}
                        <p className="shrink-0 text-sm font-bold text-emerald-600">
                          {money(cleanerRateOn(c, todayKey))}
                          <span className="font-normal text-gray-400">/hr</span>
                        </p>
                      </div>
                      <div className="mt-2.5 flex flex-wrap items-end gap-2 rounded-lg border border-gray-100 bg-gray-50 p-2.5">
                        <label className="flex flex-col gap-1">
                          <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                            TiWork code
                          </span>
                          <div className="flex items-center gap-1">
                            <input
                              placeholder="not set"
                              key={c.accessCode}
                              defaultValue={c.accessCode ?? ""}
                              onBlur={(e) =>
                                e.target.value !== (c.accessCode ?? "") &&
                                updateCleaner({ id: c.id, accessCode: e.target.value.trim() }, token)
                                  .then((u) =>
                                    setCleaners((prev) =>
                                      prev.map((x) => (x.id === u.id ? u : x)),
                                    ),
                                  )
                                  .catch(() => setError("Could not save the code."))
                              }
                              className={`${inputCls} w-24 font-mono tracking-wider`}
                            />
                            <button
                              type="button"
                              title="Generate a new code — the old one stops working"
                              onClick={() =>
                                updateCleaner({ id: c.id, accessCode: newCode() }, token)
                                  .then((u) =>
                                    setCleaners((prev) =>
                                      prev.map((x) => (x.id === u.id ? u : x)),
                                    ),
                                  )
                                  .catch(() => setError("Could not generate a code."))
                              }
                              className="shrink-0 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm text-gray-500 hover:bg-gray-50"
                            >
                              ↻
                            </button>
                          </div>
                        </label>
                        <p className="min-w-0 flex-1 text-[11px] leading-relaxed text-gray-400">
                          They sign into TiWork with their phone number and this code, and log
                          hours against the cleanings you scheduled.
                        </p>
                      </div>
                    </div>
                  ))}
                </>
              )}

              {former.length > 0 && (
                <>
                  <p className="pt-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                    Former
                  </p>
                  {former.map(renderCard)}
                </>
              )}

              {adding ? (
                <div className="flex flex-col gap-2 rounded-xl border border-gray-300 bg-gray-50 p-3">
                  <input
                    autoFocus
                    placeholder="Name"
                    value={draft.name}
                    onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                    className={inputCls}
                  />
                  <input
                    placeholder="Position title — e.g. AI prompt intern"
                    value={draft.title}
                    onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                    className={inputCls}
                  />
                  <div className="flex flex-wrap items-end gap-2">
                    <label className="flex flex-col gap-1">
                      <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                        Hired
                      </span>
                      <input
                        type="date"
                        value={draft.hiredOn}
                        onChange={(e) => setDraft((d) => ({ ...d, hiredOn: e.target.value }))}
                        className={inputCls}
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                        Paid
                      </span>
                      <select
                        value={draft.payType}
                        onChange={(e) =>
                          setDraft((d) => ({
                            ...d,
                            payType: e.target.value as "hourly" | "biweekly",
                          }))
                        }
                        className={inputCls}
                      >
                        <option value="hourly">Hourly</option>
                        <option value="biweekly">Biweekly</option>
                      </select>
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                        {draft.payType === "hourly" ? "Per hour" : "Per 2 weeks"}
                      </span>
                      <input
                        type="number"
                        min={0}
                        placeholder="0"
                        value={draft.payRate}
                        onChange={(e) => setDraft((d) => ({ ...d, payRate: e.target.value }))}
                        className={`${inputCls} w-24`}
                      />
                    </label>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setAdding(false)}
                      className="rounded-lg px-3 py-1.5 text-sm font-semibold text-gray-500"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleAdd}
                      className="rounded-lg bg-gray-900 px-3 py-1.5 text-sm font-semibold text-white"
                    >
                      Add to team
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setAdding(true)}
                  className="rounded-xl border border-dashed border-gray-300 px-3 py-2.5 text-sm font-semibold text-gray-500 hover:bg-gray-50"
                >
                  + Hire someone
                </button>
              )}
            </div>
          )}
        </div>
        )}

        <p className="shrink-0 border-t border-gray-100 px-4 py-2 text-[11px] leading-relaxed text-gray-400">
          {tab === "payroll"
            ? "Every payout, by the month it was paid in. Staff pay is recorded here, in a person's own view. Cleaner pay is recorded in Clean."
            : tab === "hours"
            ? "Only approved hours count toward pay. Nothing here is computed from a claim."
            : "Hours and work reports arrive from TiWork, where each person enters their own."}
        </p>
      </div>
    </div>
  );
};

export default StaffingModal;
