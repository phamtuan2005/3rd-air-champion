import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { addMonths, format, subMonths } from "date-fns";
import { FaReceipt, FaChevronLeft, FaChevronRight, FaTrash, FaPen } from "react-icons/fa";
import {
  MiscExpenseType,
  createMiscExpense,
  deleteMiscExpense,
  fetchMiscExpenses,
  isExpenseInMonth,
  updateMiscExpense,
} from "../../../util/miscOperations";

interface MiscModalProps {
  hostId: string;
  token: string;
  currentMonth?: Date; // defaults the view to the month you're looking at
  onClose: () => void;
}

const CATEGORIES = ["Supplies", "Utilities", "Maintenance", "Other"] as const;
type Cat = (typeof CATEGORIES)[number];

const CAT_STYLE: Record<string, { badge: string; dot: string; pick: string }> = {
  Supplies: {
    badge: "bg-blue-100 text-blue-700",
    dot: "bg-blue-500",
    pick: "bg-blue-600 text-white",
  },
  Utilities: {
    badge: "bg-amber-100 text-amber-700",
    dot: "bg-amber-500",
    pick: "bg-amber-500 text-white",
  },
  Maintenance: {
    badge: "bg-violet-100 text-violet-700",
    dot: "bg-violet-500",
    pick: "bg-violet-600 text-white",
  },
  Other: { badge: "bg-gray-100 text-gray-700", dot: "bg-gray-400", pick: "bg-gray-700 text-white" },
};

const money = (n: number) =>
  n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const inputCls =
  "rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm focus:border-gray-400 focus:outline-none";

const emptyDraft = (monthDate: Date) => ({
  category: "Supplies" as Cat | string,
  label: "",
  amount: "",
  date: format(monthDate, "yyyy-MM-dd"),
  recurring: false,
  endMonth: "",
  note: "",
});

const MiscModal = ({ hostId, token, currentMonth, onClose }: MiscModalProps) => {
  const [monthDate, setMonthDate] = useState(() => currentMonth ?? new Date());
  const monthKey = format(monthDate, "yyyy-MM");

  // ── Draggable + resizable floating panel ──────────────────────────────────
  const initW = Math.min(512, window.innerWidth - 24);
  const initH = Math.min(640, window.innerHeight - 24);
  const [size, setSize] = useState({ w: initW, h: initH });
  const [pos, setPos] = useState({
    x: Math.max(12, (window.innerWidth - initW) / 2),
    y: Math.max(12, (window.innerHeight - initH) / 2),
  });
  const dragRef = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const resizeRef = useRef<{ x: number; y: number; w: number; h: number } | null>(null);

  const onDragStart = (e: React.PointerEvent) => {
    dragRef.current = { x: e.clientX, y: e.clientY, px: pos.x, py: pos.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onDragMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    setPos({
      x: Math.min(window.innerWidth - 60, Math.max(0, d.px + (e.clientX - d.x))),
      y: Math.min(window.innerHeight - 40, Math.max(0, d.py + (e.clientY - d.y))),
    });
  };
  const onDragEnd = () => {
    dragRef.current = null;
  };

  const onResizeStart = (e: React.PointerEvent) => {
    e.stopPropagation();
    resizeRef.current = { x: e.clientX, y: e.clientY, w: size.w, h: size.h };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onResizeMove = (e: React.PointerEvent) => {
    const r = resizeRef.current;
    if (!r) return;
    setSize({
      w: Math.min(window.innerWidth - 24, Math.max(340, r.w + (e.clientX - r.x))),
      h: Math.min(window.innerHeight - 24, Math.max(380, r.h + (e.clientY - r.y))),
    });
  };
  const onResizeEnd = () => {
    resizeRef.current = null;
  };

  const [expenses, setExpenses] = useState<MiscExpenseType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState(() => emptyDraft(monthDate));

  const reload = () => {
    setLoading(true);
    fetchMiscExpenses(hostId, token)
      .then((list) => {
        setExpenses(list);
        setError("");
      })
      .catch((err) => setError(err.response?.data?.error ?? "Could not load expenses"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hostId, token]);

  // Expenses that apply to the viewed month (one-offs in this month + recurring
  // ones active this month), newest first.
  const monthItems = useMemo(
    () =>
      expenses
        .filter((e) => isExpenseInMonth(e, monthKey))
        .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)),
    [expenses, monthKey],
  );

  const perCategory = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const e of monthItems) totals[e.category] = (totals[e.category] ?? 0) + e.amount;
    return totals;
  }, [monthItems]);

  const grandTotal = useMemo(
    () => monthItems.reduce((sum, e) => sum + e.amount, 0),
    [monthItems],
  );

  const resetForm = () => {
    setEditingId(null);
    setDraft(emptyDraft(monthDate));
  };

  const startEdit = (e: MiscExpenseType) => {
    setEditingId(e.id);
    setDraft({
      category: e.category,
      label: e.label,
      amount: String(e.amount),
      date: e.date,
      recurring: e.recurring,
      endMonth: e.endMonth,
      note: e.note,
    });
  };

  const save = async () => {
    const amount = parseFloat(draft.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Enter an amount greater than 0");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        category: draft.category,
        label: draft.label.trim(),
        amount,
        date: draft.date,
        recurring: draft.recurring,
        endMonth: draft.recurring ? draft.endMonth : "",
        note: draft.note.trim(),
      };
      if (editingId) {
        await updateMiscExpense({ id: editingId, ...payload }, token);
      } else {
        await createMiscExpense({ host: hostId, ...payload }, token);
      }
      resetForm();
      setError("");
      reload();
    } catch (err: any) {
      setError(err.response?.data?.error ?? "Could not save expense");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (e: MiscExpenseType) => {
    const msg = e.recurring
      ? "Delete this recurring expense for ALL months?"
      : "Delete this expense?";
    if (!window.confirm(msg)) return;
    try {
      await deleteMiscExpense(e.id, token);
      if (editingId === e.id) resetForm();
      reload();
    } catch (err: any) {
      setError(err.response?.data?.error ?? "Could not delete expense");
    }
  };

  return createPortal(
    <>
      {/* Dimmed backdrop — click to close */}
      <div className="fixed inset-0 z-[105] bg-black/40" onClick={onClose} />
      {/* Floating panel — drag the header to move, drag the corner grip to resize */}
      <div
        className="fixed z-[110] flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl"
        style={{ left: pos.x, top: pos.y, width: size.w, height: size.h }}
      >
        {/* Brand bar */}
        <div className="h-1.5 shrink-0 bg-gradient-to-r from-emerald-400 via-blue-400 to-violet-400" />

        {/* Header doubles as the move handle */}
        <div
          className="flex shrink-0 cursor-move touch-none select-none items-center justify-between px-4 pb-2 pt-3"
          onPointerDown={onDragStart}
          onPointerMove={onDragMove}
          onPointerUp={onDragEnd}
        >
          <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900">
            <FaReceipt className="text-emerald-600" />
            Misc Expenses
          </h2>
          <button
            type="button"
            onClick={onClose}
            onPointerDown={(ev) => ev.stopPropagation()}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-xl leading-none text-gray-400 hover:bg-gray-100"
          >
            &times;
          </button>
        </div>

        {/* Month nav + grand total */}
        <div className="mx-4 mb-3 flex shrink-0 items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMonthDate((d) => subMonths(d, 1))}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-200"
              aria-label="Previous month"
            >
              <FaChevronLeft size={12} />
            </button>
            <span className="min-w-[120px] text-center text-sm font-semibold text-gray-900">
              {format(monthDate, "MMMM yyyy")}
            </span>
            <button
              type="button"
              onClick={() => setMonthDate((d) => addMonths(d, 1))}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-200"
              aria-label="Next month"
            >
              <FaChevronRight size={12} />
            </button>
          </div>
          <div className="text-right">
            <div className="text-[10px] font-medium uppercase tracking-wide text-gray-400">
              Month total
            </div>
            <div className="text-lg font-bold text-gray-900">${money(grandTotal)}</div>
          </div>
        </div>

        {/* Per-category chips */}
        {monthItems.length > 0 && (
          <div className="mx-4 mb-3 flex shrink-0 flex-wrap gap-1.5">
            {CATEGORIES.filter((c) => perCategory[c]).map((c) => (
              <span
                key={c}
                className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${CAT_STYLE[c].badge}`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${CAT_STYLE[c].dot}`} />
                {c} ${money(perCategory[c])}
              </span>
            ))}
          </div>
        )}

        {/* Expense list */}
        <div className="min-h-0 flex-1 overflow-y-auto px-4">
          {loading ? (
            <div className="py-8 text-center text-sm text-gray-400">Loading…</div>
          ) : monthItems.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-400">
              No expenses recorded for {format(monthDate, "MMMM")}. Add one below.
            </div>
          ) : (
            <ul className="space-y-1.5 pb-2">
              {monthItems.map((e) => {
                const style = CAT_STYLE[e.category] ?? CAT_STYLE.Other;
                return (
                  <li
                    key={e.id}
                    className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2"
                  >
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${style.dot}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-sm font-semibold text-gray-900">
                          {e.label || e.category}
                        </span>
                        {e.recurring && (
                          <span className="shrink-0 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-700">
                            Monthly
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-gray-400">
                        {e.category}
                        {e.recurring
                          ? ` · since ${format(new Date(`${e.date}T00:00:00`), "MMM yyyy")}`
                          : ` · ${format(new Date(`${e.date}T00:00:00`), "MMM d")}`}
                        {e.note ? ` · ${e.note}` : ""}
                      </div>
                    </div>
                    <span className="shrink-0 text-sm font-bold text-gray-900">
                      ${money(e.amount)}
                    </span>
                    <button
                      type="button"
                      onClick={() => startEdit(e)}
                      className="shrink-0 p-1 text-gray-300 hover:text-gray-600"
                      aria-label="Edit"
                    >
                      <FaPen size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(e)}
                      className="shrink-0 p-1 text-gray-300 hover:text-rose-500"
                      aria-label="Delete"
                    >
                      <FaTrash size={12} />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Entry form */}
        <div className="shrink-0 border-t border-gray-200 bg-gray-50 px-4 py-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              {editingId ? "Edit expense" : "Add expense"}
            </span>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="text-[11px] font-medium text-gray-400 hover:text-gray-600"
              >
                Cancel edit
              </button>
            )}
          </div>

          {/* Category quick-pick */}
          <div className="mb-2 grid grid-cols-4 gap-1">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setDraft((d) => ({ ...d, category: c }))}
                className={`rounded-lg py-1.5 text-xs font-semibold transition-colors ${
                  draft.category === c ? CAT_STYLE[c].pick : "bg-white text-gray-500 border border-gray-200"
                }`}
              >
                {c}
              </button>
            ))}
          </div>

          <div className="mb-2 flex gap-2">
            <div className="relative flex-1">
              <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                $
              </span>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={draft.amount}
                onChange={(ev) => setDraft((d) => ({ ...d, amount: ev.target.value }))}
                className={`${inputCls} w-full pl-6`}
              />
            </div>
            <input
              type="date"
              value={draft.date}
              onChange={(ev) => setDraft((d) => ({ ...d, date: ev.target.value }))}
              className={`${inputCls} flex-1`}
            />
          </div>

          <input
            type="text"
            placeholder={
              draft.category === "Other" ? "Describe it (e.g. HOA dues)" : "Label (e.g. paper towels)"
            }
            value={draft.label}
            onChange={(ev) => setDraft((d) => ({ ...d, label: ev.target.value }))}
            className={`${inputCls} mb-2 w-full`}
          />

          {/* Recurring */}
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setDraft((d) => ({ ...d, recurring: !d.recurring }))}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold ${
                draft.recurring
                  ? "bg-emerald-600 text-white"
                  : "border border-gray-200 bg-white text-gray-600"
              }`}
            >
              <span
                className={`h-3.5 w-3.5 rounded-full border-2 ${
                  draft.recurring ? "border-white bg-white/30" : "border-gray-300"
                }`}
              />
              Repeats monthly
            </button>
            {draft.recurring && (
              <label className="flex items-center gap-1 text-[11px] text-gray-500">
                until
                <input
                  type="month"
                  value={draft.endMonth}
                  onChange={(ev) => setDraft((d) => ({ ...d, endMonth: ev.target.value }))}
                  className={`${inputCls} py-1`}
                />
                <span className="text-gray-400">(blank = ongoing)</span>
              </label>
            )}
          </div>

          {error && <div className="mb-2 text-xs font-medium text-rose-500">{error}</div>}

          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="w-full rounded-lg bg-gray-900 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {saving ? "Saving…" : editingId ? "Update expense" : "Add expense"}
          </button>
        </div>

        {/* Resize grip — drag the bottom-right corner */}
        <div
          onPointerDown={onResizeStart}
          onPointerMove={onResizeMove}
          onPointerUp={onResizeEnd}
          className="absolute bottom-0 right-0 flex h-5 w-5 cursor-nwse-resize touch-none items-end justify-end p-1"
          aria-label="Resize"
        >
          <span className="h-2.5 w-2.5 rounded-br-md border-b-2 border-r-2 border-gray-300" />
        </div>
      </div>
    </>,
    document.body,
  );
};

export default MiscModal;
