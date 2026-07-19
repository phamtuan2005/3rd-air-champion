import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { addDays, format, startOfToday } from "date-fns";
import { FaBroom, FaDollarSign, FaRegClock } from "react-icons/fa";
import { dayType } from "../../../util/types/dayType";
import {
  CleanerType,
  CleanerSummaryType,
  CleaningAssignmentType,
  createCleaner,
  deleteCleaner,
  fetchAssignments,
  fetchCleaners,
  fetchCleanerSummary,
  recordCleanerPayment,
  updateAssignmentHours,
  updateCleaner,
} from "../../../util/cleanerOperations";

interface CleanersModalProps {
  hostId: string;
  token: string;
  monthMap: Map<string, dayType>; // for arriving-guest counts in the schedule SMS
  onClose: () => void;
}

const inputCls =
  "rounded-lg border border-gray-200 px-2 py-1.5 text-xs focus:border-gray-400 focus:outline-none";
const pillDark = "rounded-lg bg-gray-900 px-2.5 py-1.5 text-xs font-semibold text-white";
const pillNeutral =
  "rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-700";
const pillEmerald = "rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white";

// Bright identity colors for cleaner avatars, cycled by roster position
const AVATAR_COLORS = [
  "bg-emerald-100 text-emerald-700",
  "bg-blue-100 text-blue-700",
  "bg-violet-100 text-violet-700",
  "bg-amber-100 text-amber-700",
  "bg-rose-100 text-rose-700",
];

const initials = (name: string) =>
  name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

const SectionHeader = ({
  icon,
  title,
  hint,
}: {
  icon: React.ReactNode;
  title: string;
  hint?: string;
}) => (
  <div className="mb-2 mt-5 first:mt-0">
    <h3 className="flex items-center gap-2 text-sm font-bold text-gray-900">
      {icon}
      {title}
    </h3>
    {hint && <p className="mt-0.5 text-xs text-gray-400">{hint}</p>}
  </div>
);

const CleanersModal = ({ hostId, token, monthMap, onClose }: CleanersModalProps) => {
  // Self-sufficient: fetches its own data so it can be opened from anywhere
  // (NavBar dropdown or the Upcoming assign popover).
  const [cleaners, setCleaners] = useState<CleanerType[]>([]);
  const [assignments, setAssignments] = useState<CleaningAssignmentType[]>([]);
  const [summary, setSummary] = useState<CleanerSummaryType[]>([]);
  // Roster / Hours / Pay tabs — everything in one scroll was overcrowded
  const [activeTab, setActiveTab] = useState<"roster" | "hours" | "pay">("roster");
  const autoTabDone = useRef(false);

  const [newCleaner, setNewCleaner] = useState({ name: "", phone: "", payRate: "" });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [edit, setEdit] = useState({ name: "", phone: "", payRate: "", baselineHours: "" });
  const [hoursDraft, setHoursDraft] = useState<Record<string, string>>({});
  const [payingId, setPayingId] = useState<string | null>(null);
  const [payDraft, setPayDraft] = useState("");
  const [error, setError] = useState("");

  const todayKey = format(startOfToday(), "yyyy-MM-dd");
  const monthKey = format(startOfToday(), "yyyy-MM");

  const reloadSummary = () =>
    fetchCleanerSummary(hostId, token)
      .then(setSummary)
      .catch((err) => console.error("Error fetching cleaner summary:", err));

  useEffect(() => {
    if (!hostId || !token) return;
    const start = `${monthKey}-01`;
    const end = format(addDays(startOfToday(), 7), "yyyy-MM-dd");
    fetchCleaners(hostId, token)
      .then(setCleaners)
      .catch((err) => console.error("Error fetching cleaners:", err));
    fetchAssignments(hostId, start, end, token)
      .then(setAssignments)
      .catch((err) => console.error("Error fetching assignments:", err));
    reloadSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hostId, token]);

  // Past (or today's) cleanings whose hours haven't been recorded yet
  const needHours = assignments.filter((a) => a.date <= todayKey && a.hours == null && a.cleaner);

  // Once data arrives, land on Hours if recordings are waiting — the most
  // time-sensitive job in this modal. Never overrides a user-tapped tab.
  useEffect(() => {
    if (autoTabDone.current || assignments.length === 0) return;
    autoTabDone.current = true;
    if (needHours.length > 0) setActiveTab("hours");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignments]);

  // Pay owed this month per cleaner = baseline (pre-tracking hours entered for
  // this month) + Σ recorded assignment hours, all × rate
  const monthlyPay = new Map<string, { name: string; hours: number; pay: number }>();
  cleaners.forEach((c) => {
    if (c.baselineMonth === monthKey && c.baselineHours > 0) {
      monthlyPay.set(c.id, { name: c.name, hours: c.baselineHours, pay: c.baselineHours * c.payRate });
    }
  });
  assignments
    .filter((a) => a.date.startsWith(monthKey) && a.hours != null && a.cleaner)
    .forEach((a) => {
      const entry = monthlyPay.get(a.cleaner!.id) ?? { name: a.cleaner!.name, hours: 0, pay: 0 };
      entry.hours += a.hours!;
      entry.pay += a.hours! * a.cleaner!.payRate;
      monthlyPay.set(a.cleaner!.id, entry);
    });

  const handleAdd = () => {
    if (!newCleaner.name.trim()) return;
    createCleaner(
      {
        host: hostId,
        name: newCleaner.name.trim(),
        phone: newCleaner.phone.trim(),
        payRate: parseFloat(newCleaner.payRate) || 0,
      },
      token,
    )
      .then((created) => {
        setCleaners((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
        setNewCleaner({ name: "", phone: "", payRate: "" });
        setError("");
        reloadSummary();
      })
      .catch((err) => setError(err.response?.data?.error ?? "Could not add cleaner"));
  };

  const handleSaveEdit = (id: string) => {
    updateCleaner(
      {
        id,
        name: edit.name.trim(),
        phone: edit.phone.trim(),
        payRate: parseFloat(edit.payRate) || 0,
        // Baseline is anchored to the month it was entered — it counts toward
        // this month's pay and expires on its own.
        baselineHours: parseFloat(edit.baselineHours) || 0,
        baselineMonth: monthKey,
      },
      token,
    )
      .then((updated) => {
        setCleaners((prev) => prev.map((c) => (c.id === id ? updated : c)));
        setEditingId(null);
        setError("");
        reloadSummary();
      })
      .catch((err) => setError(err.response?.data?.error ?? "Could not update cleaner"));
  };

  const handleDelete = (cleaner: CleanerType) => {
    if (!window.confirm(`Remove ${cleaner.name}? Their assignments will be removed too.`)) return;
    deleteCleaner(cleaner.id, token)
      .then(() => {
        setCleaners((prev) => prev.filter((c) => c.id !== cleaner.id));
        setAssignments((prev) => prev.filter((a) => a.cleaner?.id !== cleaner.id));
        setError("");
        reloadSummary();
      })
      .catch((err) => setError(err.response?.data?.error ?? "Could not remove cleaner"));
  };

  const handleSaveHours = (assignment: CleaningAssignmentType) => {
    const hours = parseFloat(hoursDraft[assignment.id]);
    if (!(hours >= 0)) return;
    updateAssignmentHours(assignment.id, hours, token)
      .then((updated) => {
        setAssignments((prev) => prev.map((a) => (a.id === assignment.id ? updated : a)));
        setError("");
        reloadSummary();
      })
      .catch((err) => setError(err.response?.data?.error ?? "Could not save hours"));
  };

  // Guests arriving after a cleaning — the cleaner needs the headcount to set
  // up beds and towels. First check-in for the room on/after the morning.
  const nextGuestCount = (roomId: string, morningKey: string): number | null => {
    for (let i = 0; i <= 30; i++) {
      const key = format(addDays(new Date(morningKey + "T00:00:00"), i), "yyyy-MM-dd");
      const found = monthMap
        .get(key)
        ?.bookings.find((b) => b.room?.id === roomId && b.startDate.split("T")[0] === key);
      if (found) return found.numberOfGuests || 1;
    }
    return null;
  };

  // One SMS per cleaner with their whole week: "* Monday 7/21: Cozy (1), Chill (2)"
  const textSchedule = (cleaner: CleanerType) => {
    if (!cleaner.phone) return;
    const mine = assignments
      .filter((a) => a.cleaner?.id === cleaner.id && a.date >= todayKey && a.room)
      .sort((a, b) => a.date.localeCompare(b.date));
    if (mine.length === 0) return;

    const byDay = new Map<string, string[]>();
    mine.forEach((a) => {
      const count = nextGuestCount(a.room!.id, a.date);
      const label = `${a.room!.name}${count ? ` (${count})` : ""}`;
      byDay.set(a.date, [...(byDay.get(a.date) ?? []), label]);
    });
    const lines = [...byDay.entries()].map(
      ([date, rooms]) =>
        `* ${format(new Date(date + "T00:00:00"), "EEEE M/d")}: ${rooms.join(", ")}`,
    );
    const message = `Hi ${cleaner.name}, your cleaning schedule:\n${lines.join("\n")}\n(numbers = guests arriving)\nThank you! — Anh-Tuan`;
    window.location.href = `sms:${cleaner.phone}?&body=${encodeURIComponent(message)}`;
  };

  const handlePay = (entry: CleanerSummaryType) => {
    const amount = parseFloat(payDraft);
    if (!(amount > 0)) return;
    recordCleanerPayment(entry.id, amount, token)
      .then(() => {
        setPayingId(null);
        setError("");
        reloadSummary();
      })
      .catch((err) => setError(err.response?.data?.error ?? "Could not record payment"));
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[110] flex items-end justify-center bg-black/40 p-4 sm:items-center"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-sm flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Bright brand bar */}
        <div className="h-1.5 shrink-0 bg-gradient-to-r from-emerald-400 via-blue-400 to-violet-400" />
        <div className="flex items-center justify-between px-4 pb-1 pt-3">
          <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900">
            <FaBroom className="text-emerald-600" />
            Cleaners
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-xl leading-none text-gray-400"
          >
            &times;
          </button>
        </div>

        <div className="mx-4 mb-2 grid shrink-0 grid-cols-3 gap-1 rounded-xl bg-gray-100 p-1">
          {(
            [
              { key: "roster", label: "Roster", count: cleaners.length },
              { key: "hours", label: "Hours", count: needHours.length },
              { key: "pay", label: "Pay", count: summary.filter((s) => s.balance > 0.5).length },
            ] as const
          ).map(({ key, label, count }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold transition-colors ${
                activeTab === key ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
              }`}
            >
              {label}
              {count > 0 && (
                <span
                  className={`min-w-[1.25rem] rounded-full px-1 py-0.5 text-center text-[10px] font-bold leading-none ${
                    activeTab === key ? "bg-gray-900 text-white" : "bg-gray-200 text-gray-600"
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
          {error && <p className="mb-2 text-xs font-semibold text-red-500">{error}</p>}

          {activeTab === "roster" && (
          <>
          {/* Add cleaner */}
          <div className="mb-3 flex items-center gap-1.5">
            <input
              className={`${inputCls} min-w-0 flex-1`}
              placeholder="Name"
              value={newCleaner.name}
              onChange={(e) => setNewCleaner((p) => ({ ...p, name: e.target.value }))}
            />
            <input
              className={`${inputCls} w-24`}
              placeholder="Phone"
              type="tel"
              value={newCleaner.phone}
              onChange={(e) => setNewCleaner((p) => ({ ...p, phone: e.target.value }))}
            />
            <input
              className={`${inputCls} w-14`}
              placeholder="$/hr"
              type="number"
              value={newCleaner.payRate}
              onChange={(e) => setNewCleaner((p) => ({ ...p, payRate: e.target.value }))}
            />
            <button type="button" className={pillDark} onClick={handleAdd}>
              Add
            </button>
          </div>

          {/* Roster */}
          {cleaners.length === 0 && (
            <p className="py-4 text-center text-sm text-gray-400">No cleaners yet — add one above</p>
          )}
          {cleaners.map((cleaner, index) =>
            editingId === cleaner.id ? (
              <div key={cleaner.id} className="mb-2 rounded-xl border border-gray-200 p-2">
                <div className="mb-1.5 flex items-center gap-1.5">
                  <input
                    className={`${inputCls} min-w-0 flex-1`}
                    placeholder="Name"
                    value={edit.name}
                    onChange={(e) => setEdit((p) => ({ ...p, name: e.target.value }))}
                  />
                  <input
                    className={`${inputCls} w-24`}
                    placeholder="Phone"
                    type="tel"
                    value={edit.phone}
                    onChange={(e) => setEdit((p) => ({ ...p, phone: e.target.value }))}
                  />
                  <input
                    className={`${inputCls} w-14`}
                    placeholder="$/hr"
                    type="number"
                    value={edit.payRate}
                    onChange={(e) => setEdit((p) => ({ ...p, payRate: e.target.value }))}
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <label className="flex-1 text-xs text-gray-500">
                    Baseline hrs already worked this month
                  </label>
                  <input
                    className={`${inputCls} w-16`}
                    placeholder="hrs"
                    type="number"
                    step="0.5"
                    min="0"
                    value={edit.baselineHours}
                    onChange={(e) => setEdit((p) => ({ ...p, baselineHours: e.target.value }))}
                  />
                  <button type="button" className={pillDark} onClick={() => handleSaveEdit(cleaner.id)}>
                    Save
                  </button>
                </div>
              </div>
            ) : (
              <div
                key={cleaner.id}
                className="mb-2 flex items-center gap-2 rounded-xl border border-gray-200 p-2.5"
              >
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${AVATAR_COLORS[index % AVATAR_COLORS.length]}`}
                >
                  {initials(cleaner.name)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-gray-900">{cleaner.name}</p>
                  <p className="text-xs text-gray-500">
                    {cleaner.phone && <span>{cleaner.phone} · </span>}
                    <span className="font-bold text-emerald-600">${cleaner.payRate}/hr</span>
                  </p>
                </div>
                {cleaner.phone && (
                  <button
                    type="button"
                    className="rounded-lg bg-blue-600 px-2.5 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
                    disabled={
                      !assignments.some((a) => a.cleaner?.id === cleaner.id && a.date >= todayKey)
                    }
                    onClick={() => textSchedule(cleaner)}
                  >
                    Text
                  </button>
                )}
                <button
                  type="button"
                  className={pillNeutral}
                  onClick={() => {
                    setEditingId(cleaner.id);
                    setEdit({
                      name: cleaner.name,
                      phone: cleaner.phone,
                      payRate: String(cleaner.payRate),
                      // Only surface a baseline that belongs to this month —
                      // an old month's baseline has already expired
                      baselineHours:
                        cleaner.baselineMonth === monthKey && cleaner.baselineHours > 0
                          ? String(cleaner.baselineHours)
                          : "",
                    });
                  }}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-semibold text-red-600"
                  onClick={() => handleDelete(cleaner)}
                >
                  Remove
                </button>
              </div>
            ),
          )}

          </>
          )}

          {activeTab === "hours" && (
          <>
          {/* Hours to record for finished cleanings */}
          <SectionHeader
            icon={<FaRegClock className="text-amber-500" />}
            title="Record hours"
            hint="Finished cleanings waiting for worked hours — pay is hours × rate"
          />
          {needHours.length === 0 ? (
            <p className="mb-2 rounded-xl border border-gray-200 bg-gray-50 p-2.5 text-center text-xs text-gray-400">
              Nothing to record yet — cleanings appear here once their day arrives
            </p>
          ) : (
            needHours.map((a) => (
              <div
                key={a.id}
                className="mb-2 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-2.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-900">
                    {format(new Date(a.date + "T00:00:00"), "M/d")} · {a.room?.name}
                  </p>
                  <p className="text-xs text-gray-500">{a.cleaner?.name}</p>
                </div>
                <input
                  className={`${inputCls} w-16`}
                  type="number"
                  step="0.5"
                  min="0"
                  placeholder="hrs"
                  value={hoursDraft[a.id] ?? ""}
                  onChange={(e) => setHoursDraft((p) => ({ ...p, [a.id]: e.target.value }))}
                />
                <button type="button" className={pillDark} onClick={() => handleSaveHours(a)}>
                  Save
                </button>
              </div>
            ))
          )}

          </>
          )}

          {activeTab === "pay" && (
          <>
          {/* All-time balance per cleaner — cleaners claim on their own schedule
              (right away / bi-weekly / at a threshold), so owed spans months */}
          <SectionHeader
            icon={<FaDollarSign className="text-emerald-600" />}
            title="Balance & payouts"
            hint="Owed = everything earned so far minus what you've already paid"
          />
          {summary.length === 0 ? (
            <p className="mb-2 rounded-xl border border-gray-200 bg-gray-50 p-2.5 text-center text-xs text-gray-400">
              No earnings yet
            </p>
          ) : (
            summary.map((entry) => (
              <div key={entry.id} className="mb-1.5 rounded-xl border border-gray-200 p-2.5">
                <div className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-gray-900">{entry.name}</p>
                    <p className="text-xs text-gray-500">
                      {entry.hours} hr · earned ${Math.round(entry.earned).toLocaleString()} · paid $
                      {Math.round(entry.paid).toLocaleString()}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 text-lg font-bold ${
                      entry.balance > 0.5 ? "text-emerald-600" : "text-gray-300"
                    }`}
                  >
                    ${Math.round(entry.balance).toLocaleString()}
                  </span>
                  {payingId !== entry.id && (
                    <button
                      type="button"
                      className={pillEmerald}
                      disabled={entry.balance <= 0}
                      onClick={() => {
                        setPayingId(entry.id);
                        setPayDraft(String(Math.round(entry.balance * 100) / 100));
                      }}
                    >
                      Pay
                    </button>
                  )}
                </div>
                {payingId === entry.id && (
                  <div className="mt-2 flex items-center gap-1.5">
                    <label className="text-xs text-gray-500">Record payout $</label>
                    <input
                      className={`${inputCls} w-20`}
                      type="number"
                      step="0.01"
                      min="0"
                      value={payDraft}
                      onChange={(e) => setPayDraft(e.target.value)}
                    />
                    <button type="button" className={pillEmerald} onClick={() => handlePay(entry)}>
                      Save
                    </button>
                    <button
                      type="button"
                      className={pillNeutral}
                      onClick={() => setPayingId(null)}
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            ))
          )}

          {/* Pay accrued this month per cleaner */}
          <SectionHeader
            icon={<FaRegClock className="text-blue-500" />}
            title={`This month — ${format(startOfToday(), "MMMM")}`}
          />
          {monthlyPay.size === 0 ? (
            <p className="rounded-xl border border-gray-200 bg-gray-50 p-2.5 text-center text-xs text-gray-400">
              No hours recorded this month yet
            </p>
          ) : (
            [...monthlyPay.values()].map((entry) => (
              <div
                key={entry.name}
                className="mb-1.5 flex items-center justify-between rounded-xl border border-gray-200 p-2.5"
              >
                <p className="text-sm font-semibold text-gray-900">{entry.name}</p>
                <p className="text-xs text-gray-500">
                  {entry.hours} hr ·{" "}
                  <span className="text-sm font-bold text-emerald-600">
                    ${Math.round(entry.pay).toLocaleString()}
                  </span>
                </p>
              </div>
            ))
          )}
          </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default CleanersModal;
