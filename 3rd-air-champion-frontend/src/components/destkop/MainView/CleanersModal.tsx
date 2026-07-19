import { useState } from "react";
import { createPortal } from "react-dom";
import { format, startOfToday } from "date-fns";
import {
  CleanerType,
  CleaningAssignmentType,
  createCleaner,
  deleteCleaner,
  updateAssignmentHours,
  updateCleaner,
} from "../../../util/cleanerOperations";

interface CleanersModalProps {
  hostId: string;
  token: string;
  cleaners: CleanerType[];
  setCleaners: React.Dispatch<React.SetStateAction<CleanerType[]>>;
  assignments: CleaningAssignmentType[];
  setAssignments: React.Dispatch<React.SetStateAction<CleaningAssignmentType[]>>;
  // Sends the cleaner their whole week's schedule as one SMS
  onTextSchedule: (cleaner: CleanerType) => void;
  onClose: () => void;
}

const inputCls =
  "rounded-lg border border-gray-200 px-2 py-1.5 text-xs focus:border-gray-400 focus:outline-none";
const pillDark = "rounded-lg bg-gray-900 px-2.5 py-1.5 text-xs font-semibold text-white";
const pillNeutral =
  "rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-700";

const CleanersModal = ({
  hostId,
  token,
  cleaners,
  setCleaners,
  assignments,
  setAssignments,
  onTextSchedule,
  onClose,
}: CleanersModalProps) => {
  const [newCleaner, setNewCleaner] = useState({ name: "", phone: "", payRate: "" });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [edit, setEdit] = useState({ name: "", phone: "", payRate: "", baselineHours: "" });
  const [hoursDraft, setHoursDraft] = useState<Record<string, string>>({});
  const [error, setError] = useState("");

  const todayKey = format(startOfToday(), "yyyy-MM-dd");
  const monthKey = format(startOfToday(), "yyyy-MM");

  // Past (or today's) cleanings whose hours haven't been recorded yet
  const needHours = assignments.filter((a) => a.date <= todayKey && a.hours == null && a.cleaner);

  // Pay owed this month per cleaner = baseline (pre-tracking hours entered for
  // this month) + Σ recorded assignment hours, all × rate
  const monthlyPay = new Map<string, { name: string; hours: number; pay: number }>();
  cleaners.forEach((c) => {
    if (c.baselineMonth === monthKey && c.baselineHours > 0) {
      monthlyPay.set(c.id, {
        name: c.name,
        hours: c.baselineHours,
        pay: c.baselineHours * c.payRate,
      });
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
      })
      .catch((err) => setError(err.response?.data?.error ?? "Could not save hours"));
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
        <div className="flex items-center justify-between px-4 pb-1 pt-3">
          <h2 className="text-lg font-bold text-gray-900">Cleaners</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-xl leading-none text-gray-400"
          >
            &times;
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
          {error && <p className="mb-2 text-xs font-semibold text-red-500">{error}</p>}

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
          {cleaners.map((cleaner) =>
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
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-gray-900">{cleaner.name}</p>
                  {cleaner.phone && <p className="text-xs text-gray-500">{cleaner.phone}</p>}
                </div>
                <span className="shrink-0 text-sm font-bold text-emerald-600">
                  ${cleaner.payRate}/hr
                </span>
                {cleaner.phone && (
                  <button
                    type="button"
                    className="rounded-lg bg-blue-600 px-2.5 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
                    disabled={
                      !assignments.some((a) => a.cleaner?.id === cleaner.id && a.date >= todayKey)
                    }
                    onClick={() => onTextSchedule(cleaner)}
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

          {/* Hours to record for finished cleanings — header always visible so
              the flow is discoverable before the first cleaning day arrives */}
          <h3 className="mb-1 mt-4 text-sm font-bold text-gray-900">Record hours</h3>
          <p className="mb-2 text-xs text-gray-400">
            Finished cleanings waiting for worked hours — pay is hours × rate
          </p>
          {needHours.length === 0 ? (
            <p className="mb-2 rounded-xl border border-gray-200 bg-gray-50 p-2.5 text-center text-xs text-gray-400">
              Nothing to record yet — cleanings appear here once their day arrives
            </p>
          ) : (
            <>
              {needHours.map((a) => (
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
              ))}
            </>
          )}

          {/* Pay owed this month per cleaner */}
          <h3 className="mb-1 mt-4 text-sm font-bold text-gray-900">
            Pay — {format(startOfToday(), "MMMM")}
          </h3>
          {monthlyPay.size === 0 ? (
            <p className="rounded-xl border border-gray-200 bg-gray-50 p-2.5 text-center text-xs text-gray-400">
              No hours recorded this month yet
            </p>
          ) : (
            <>
              {[...monthlyPay.values()].map((entry) => (
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
              ))}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default CleanersModal;
