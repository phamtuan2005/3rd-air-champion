import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { addMonths, format, subMonths } from "date-fns";
import { FaChevronLeft, FaChevronRight, FaTrash } from "react-icons/fa";
import {
  CHARGE_LABELS,
  ChargeType,
  deleteCharge,
  fetchCharges,
  isChargeInMonth,
  updateCharge,
} from "../../../util/chargeOperations";

interface ChargesModalProps {
  hostId: string;
  token: string;
  currentMonth?: Date;
  onClose: () => void;
}

const LABEL_STYLE: Record<string, string> = {
  Cancellation: "bg-rose-100 text-rose-700",
  Damage: "bg-amber-100 text-amber-700",
  "Late checkout": "bg-violet-100 text-violet-700",
  Other: "bg-gray-100 text-gray-700",
};

const money = (n: number) =>
  n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const inputCls =
  "rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm focus:border-gray-400 focus:outline-none";

// Money a guest owes with no stay behind it — a cancellation fee above all.
// Charges are CREATED at the moment of unbooking (the only moment the room, the
// dates and the guest are all still known); this is where they are corrected,
// marked paid, or removed afterwards. Without it a mistyped fee was permanent.
const ChargesModal = ({ hostId, token, currentMonth, onClose }: ChargesModalProps) => {
  const [month, setMonth] = useState<Date>(currentMonth ?? new Date());
  const [charges, setCharges] = useState<ChargeType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Which charge is open for editing, and the draft being typed into it. Held
  // apart from the list so an abandoned edit never touches what is on screen.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ amount: string; label: string; note: string }>({
    amount: "",
    label: "Other",
    note: "",
  });
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const monthKey = format(month, "yyyy-MM");

  useEffect(() => {
    setLoading(true);
    fetchCharges(hostId, token)
      .then((items) => {
        setCharges(items);
        setError(null);
      })
      .catch(() => setError("Could not load charges."))
      .finally(() => setLoading(false));
  }, [hostId, token]);

  const monthCharges = useMemo(
    () =>
      charges
        .filter((c) => isChargeInMonth(c, monthKey))
        .sort((a, b) => (a.date === b.date ? 0 : a.date < b.date ? 1 : -1)),
    [charges, monthKey],
  );

  const total = monthCharges.reduce((s, c) => s + c.amount, 0);
  const unpaid = monthCharges.filter((c) => !c.paid);
  const unpaidTotal = unpaid.reduce((s, c) => s + c.amount, 0);

  const patch = async (id: string, data: Parameters<typeof updateCharge>[0]) => {
    setBusyId(id);
    try {
      const updated = await updateCharge(data, token);
      setCharges((prev) => prev.map((c) => (c.id === id ? updated : c)));
      setError(null);
      return true;
    } catch {
      setError("That change could not be saved.");
      return false;
    } finally {
      setBusyId(null);
    }
  };

  const startEdit = (c: ChargeType) => {
    setEditingId(c.id);
    setDraft({ amount: String(c.amount), label: c.label, note: c.note });
  };

  const saveEdit = async (c: ChargeType) => {
    const amount = Number(draft.amount);
    // The backend rejects a non-positive amount; saying so here saves a
    // round-trip and an error the host cannot act on.
    if (!(amount > 0)) {
      setError("A charge has to be more than $0. Delete it instead to remove it.");
      return;
    }
    if (await patch(c.id, { id: c.id, amount, label: draft.label, note: draft.note }))
      setEditingId(null);
  };

  const remove = async (id: string) => {
    setBusyId(id);
    try {
      await deleteCharge(id, token);
      setCharges((prev) => prev.filter((c) => c.id !== id));
      setConfirmDelete(null);
      setError(null);
    } catch {
      setError("That charge could not be removed.");
    } finally {
      setBusyId(null);
    }
  };

  return createPortal(
    <div
      className="modal-type fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-3"
      onClick={onClose}
    >
      <div
        className="flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header + month stepper */}
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <div>
            <h2 className="text-base font-bold text-gray-900">💸 Guest charges</h2>
            <p className="text-xs text-gray-500">Fees owed with no stay behind them</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-xl leading-none text-gray-400 hover:bg-gray-100"
          >
            &times;
          </button>
        </div>

        <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-4 py-2">
          <button
            type="button"
            onClick={() => setMonth((m) => subMonths(m, 1))}
            aria-label="Previous month"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-200"
          >
            <FaChevronLeft size={12} />
          </button>
          <span className="text-sm font-bold text-gray-800">{format(month, "MMMM yyyy")}</span>
          <button
            type="button"
            onClick={() => setMonth((m) => addMonths(m, 1))}
            aria-label="Next month"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-200"
          >
            <FaChevronRight size={12} />
          </button>
        </div>

        {error && (
          <p className="border-b border-red-100 bg-red-50 px-4 py-2 text-xs font-semibold text-red-600">
            {error}
          </p>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {loading ? (
            <p className="py-8 text-center text-sm text-gray-400">Loading…</p>
          ) : monthCharges.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm font-semibold text-gray-500">
                No charges in {format(month, "MMMM")}.
              </p>
              <p className="mt-1 text-xs text-gray-400">
                A fee is added when you unbook a stay — there's a "Fee still owed" box on that
                screen.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {monthCharges.map((c) => {
                const editing = editingId === c.id;
                const busy = busyId === c.id;
                return (
                  <div
                    key={c.id}
                    className={`rounded-xl border px-3 py-2.5 ${
                      c.paid ? "border-gray-200 bg-white" : "border-amber-200 bg-amber-50/40"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-gray-900">{c.guest.name}</p>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                              LABEL_STYLE[c.label] ?? LABEL_STYLE.Other
                            }`}
                          >
                            {c.label}
                          </span>
                          <span className="text-[11px] text-gray-500">{c.date}</span>
                          {!c.paid && (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-700">
                              Unpaid
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="shrink-0 text-lg font-bold tabular-nums text-emerald-600">
                        ${money(c.amount)}
                      </span>
                    </div>

                    {/* What the fee was for. The stay is deleted by the time this
                        is read, so this note and roomName are all that is left
                        of it — worth the room. */}
                    {(c.note || c.roomName) && !editing && (
                      <p className="mt-1.5 text-xs leading-relaxed text-gray-500">
                        {c.note || `${c.roomName} · ${c.stayNights} night(s)`}
                      </p>
                    )}

                    {editing ? (
                      <div className="mt-2 flex flex-col gap-2 border-t border-gray-200 pt-2">
                        <div className="flex items-center gap-2">
                          <div className="relative">
                            <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-400">
                              $
                            </span>
                            <input
                              type="number"
                              min="0"
                              step="1"
                              inputMode="decimal"
                              value={draft.amount}
                              onChange={(e) => setDraft((d) => ({ ...d, amount: e.target.value }))}
                              className={`${inputCls} w-28 pl-5 font-semibold`}
                            />
                          </div>
                          <select
                            value={draft.label}
                            onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))}
                            className={`${inputCls} font-semibold`}
                          >
                            {CHARGE_LABELS.map((l) => (
                              <option key={l} value={l}>
                                {l}
                              </option>
                            ))}
                          </select>
                        </div>
                        <input
                          type="text"
                          value={draft.note}
                          onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))}
                          placeholder="What it was for"
                          className={`${inputCls} w-full`}
                        />
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="rounded-lg px-3 py-1.5 text-sm font-semibold text-gray-500 hover:bg-gray-100"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => saveEdit(c)}
                            className="rounded-lg bg-gray-900 px-3 py-1.5 text-sm font-bold text-white disabled:bg-gray-300"
                          >
                            {busy ? "Saving…" : "Save"}
                          </button>
                        </div>
                      </div>
                    ) : confirmDelete === c.id ? (
                      <div className="mt-2 flex items-center justify-between gap-2 border-t border-gray-200 pt-2">
                        <span className="text-xs font-semibold text-red-600">
                          Remove this charge for good?
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setConfirmDelete(null)}
                            className="rounded-lg px-3 py-1.5 text-sm font-semibold text-gray-500 hover:bg-gray-100"
                          >
                            Keep
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => remove(c.id)}
                            className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-bold text-white disabled:bg-gray-300"
                          >
                            {busy ? "Removing…" : "Remove"}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-2 flex items-center gap-2 border-t border-gray-100 pt-2">
                        {/* Paid is the action the host reaches for most, so it
                            leads and says what will happen, not what is true. */}
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => patch(c.id, { id: c.id, paid: !c.paid })}
                          className={`rounded-lg px-3 py-1.5 text-sm font-bold disabled:opacity-50 ${
                            c.paid
                              ? "bg-gray-100 text-gray-600 hover:bg-gray-200"
                              : "bg-emerald-600 text-white hover:bg-emerald-700"
                          }`}
                        >
                          {busy ? "…" : c.paid ? "Mark unpaid" : "Mark paid"}
                        </button>
                        <button
                          type="button"
                          onClick={() => startEdit(c)}
                          className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-semibold text-gray-600 hover:bg-gray-50"
                        >
                          Edit
                        </button>
                        {c.guest.phone && (
                          <a
                            href={`sms:${c.guest.phone}?&body=${encodeURIComponent(
                              `Hi ${c.guest.name.split(" ")[0]}, just a note about the ${c.label.toLowerCase()} fee of $${money(c.amount)}. Thank you! — Anh-Tuan`,
                            )}`}
                            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-semibold text-gray-600 hover:bg-gray-50"
                          >
                            💬 Text
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={() => setConfirmDelete(c.id)}
                          aria-label="Remove charge"
                          className="ml-auto flex h-8 w-8 items-center justify-center rounded-lg text-gray-300 hover:bg-red-50 hover:text-red-500"
                        >
                          <FaTrash size={12} />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {monthCharges.length > 0 && (
          <div className="border-t border-gray-100 bg-gray-50 px-4 py-2.5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-gray-700">
                {format(month, "MMMM")} total
              </span>
              <span className="text-lg font-bold tabular-nums text-emerald-600">
                ${money(total)}
              </span>
            </div>
            {unpaid.length > 0 && (
              <div className="mt-0.5 flex items-center justify-between">
                <span className="text-xs font-semibold text-amber-600">
                  {unpaid.length} still to collect
                </span>
                <span className="text-sm font-bold tabular-nums text-amber-600">
                  ${money(unpaidTotal)}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
};

export default ChargesModal;
