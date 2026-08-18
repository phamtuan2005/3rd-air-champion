import { useEffect, useMemo, useState } from "react";
import { format, parseISO, startOfToday } from "date-fns";
import CleanerAvatar from "../../shared/CleanerAvatar";
import {
  HostWorkEntry,
  StaffType,
  addStaffReview,
  createStaff,
  deleteStaff,
  fetchStaff,
  fetchWorkEntries,
  monthlyRunRate,
  payStaff,
  rateOn,
  reviewWorkEntry,
  updateStaff,
} from "../../../util/staffOperations";

interface StaffingModalProps {
  hostId: string;
  token: string;
  onClose: () => void;
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
const StaffingModal = ({ hostId, token, onClose }: StaffingModalProps) => {
  const [staff, setStaff] = useState<StaffType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [tab, setTab] = useState<"team" | "hours">("team");
  const [workEntries, setWorkEntries] = useState<HostWorkEntry[]>([]);

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
  const [payDraft, setPayDraft] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchStaff(hostId, token)
      .then(setStaff)
      .catch(() => setError("Could not load the team."))
      .finally(() => setLoading(false));
    fetchWorkEntries(hostId, token)
      .then(setWorkEntries)
      .catch(() => {
        /* hours are a separate concern; a failure here must not blank the team */
      });
  }, [hostId, token]);

  const patch = (updated: StaffType) =>
    setStaff((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));

  const runRate = useMemo(() => monthlyRunRate(staff, todayKey), [staff, todayKey]);

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
    // Earned from APPROVED hours only, each at the rate frozen when it was
    // approved. A submitted entry is a claim, not yet money.
    const earned = workEntries
      .filter((w) => w.staffId === s.id && w.status === "approved")
      .reduce((sum, w) => sum + w.hours * (w.approvedRate || 0), 0);
    const owed = Math.max(0, earned - (s.paidAmount ?? 0));
    const latest = [...(s.reviews ?? [])].sort((a, b) => b.date.localeCompare(a.date))[0];
    const rd = reviewDraft[s.id] ?? { rating: "", note: "" };

    return (
      <div key={s.id} className="rounded-xl border border-gray-200 bg-white">
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

            {/* Paid out */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-gray-500">
                Paid to date{" "}
                <span className="font-bold text-gray-800">{money(s.paidAmount ?? 0)}</span>
              </span>
              <div className="relative ml-auto w-28">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                  $
                </span>
                <input
                  type="number"
                  min={0}
                  placeholder="0"
                  value={payDraft[s.id] ?? ""}
                  onChange={(e) => setPayDraft((d) => ({ ...d, [s.id]: e.target.value }))}
                  className={`${inputCls} w-full pl-5`}
                />
              </div>
              <button
                type="button"
                disabled={!payDraft[s.id]}
                onClick={() =>
                  payStaff(
                    { id: s.id, amount: parseFloat(payDraft[s.id]), paidOn: todayKey },
                    token,
                  )
                    .then((u) => {
                      patch(u);
                      setPayDraft((d) => ({ ...d, [s.id]: "" }));
                    })
                    .catch(() => setError("Could not record the payment."))
                }
                className="shrink-0 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
              >
                Record pay
              </button>
              {earned > 0 && (
                <span className="w-full text-xs text-gray-400">
                  Earned {money(Math.round(earned * 100) / 100)} from approved hours
                  {owed > 0 && (
                    <span className="font-bold text-rose-600"> · {money(Math.round(owed * 100) / 100)} owed</span>
                  )}
                </span>
              )}
            </div>

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
          {(["team", "hours"] as const).map((k) => {
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
                {k === "team" ? "Team" : "Hours"}
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

        {tab === "hours" ? (
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
            {/* The gate between what someone typed and what the business owes.
                Nothing counts toward pay until it is approved here. */}
            {workEntries.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-400">
                No hours submitted yet. They arrive here from TiWork.
              </p>
            ) : (
              <div className="flex flex-col gap-2.5">
                {workEntries.map((w) => (
                  <div key={w.id} className="rounded-xl border border-gray-200 bg-white p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold text-gray-900">{w.staffName}</span>
                      <span className="text-sm text-gray-500">{fmtDate(w.date)}</span>
                      <span className="text-sm font-semibold text-gray-700">{w.hours}h</span>
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
                    </div>
                    {w.report && (
                      <p className="mt-1.5 whitespace-pre-line text-sm text-gray-600">{w.report}</p>
                    )}
                    {w.status === "submitted" && (
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
                ))}
              </div>
            )}
          </div>
        ) : (
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {/* Operating cost. Biweekly salaries are known now; hourly cost is
              rate × hours and hours arrive from TiWork, so those are named
              rather than folded in at zero — a payroll that is quietly too
              small is worse than one that says what it does not yet know. */}
          <div className="mb-3 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
              Monthly payroll
            </p>
            <p className="mt-1 text-2xl font-bold leading-none text-rose-600">
              {money(Math.round(runRate.biweeklyMonthly))}
            </p>
            <p className="mt-1 text-xs text-gray-400">
              Salaried staff, at 26 pay periods a year.
              {runRate.hourly.length > 0 && (
                <>
                  {" "}
                  Plus {runRate.hourly.length} hourly
                  {runRate.hourly.length === 1 ? " person" : " people"} — their cost needs hours
                  from TiWork.
                </>
              )}
            </p>
          </div>

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
          {tab === "hours"
            ? "Only approved hours count toward pay. Nothing here is computed from a claim."
            : "Hours and work reports arrive from TiWork, where each person enters their own."}
        </p>
      </div>
    </div>
  );
};

export default StaffingModal;
