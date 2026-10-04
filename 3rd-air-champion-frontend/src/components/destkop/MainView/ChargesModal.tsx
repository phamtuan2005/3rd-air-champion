import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { addMonths, format, subMonths } from "date-fns";
import { FaChevronLeft, FaChevronRight, FaPlus, FaTrash } from "react-icons/fa";
import {
  CHARGE_LABELS,
  ChargeType,
  createCharge,
  deleteCharge,
  fetchCharges,
  isChargeInMonth,
  updateCharge,
} from "../../../util/chargeOperations";
import { guestType } from "../../../util/types/guestType";
import { dayType } from "../../../util/types/dayType";
import { airbnbGuestList } from "../../../util/airbnbGuestList";
import { DANGER_BUTTON } from "../../shared/dangerButton";

interface ChargesModalProps {
  hostId: string;
  token: string;
  currentMonth?: Date;
  // Needed to charge somebody whose stay is already gone — a fee remembered
  // after the cancellation, or damage found during a clean.
  guests?: guestType[];
  // The calendar, for the AirBnB guests on it: they are found by the name
  // AirBnB gives them, which lives on their stays and nowhere else.
  monthMap?: Map<string, dayType>;
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
const ChargesModal = ({ hostId, token, currentMonth, guests = [], monthMap, onClose }: ChargesModalProps) => {
  const [month, setMonth] = useState<Date>(currentMonth ?? new Date());
  const [charges, setCharges] = useState<ChargeType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Which charge is open for editing, and the draft being typed into it. Held
  // apart from the list so an abandoned edit never touches what is on screen.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ amount: string; label: string; note: string; date: string }>({
    amount: "",
    label: "Other",
    note: "",
    date: "",
  });
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  // The "add by hand" composer. Every other card here is derived from a
  // cancellation; this is the way in for a fee whose stay is already gone —
  // Eddie's, for one, cancelled before charges existed.
  const [adding, setAdding] = useState(false);
  // The day a charge belongs to. It used to be set silently to whatever day
  // the calendar was on, and the host could neither see it nor change it —
  // then went looking for the fee in another day's Profit tab, where it is
  // not, because a charge is counted on the ONE day it is dated to. Anh-Tuan,
  // 2026-10-04: "Why in the profit tab of bookings card, the guests charge is
  // not included?" So the date is on the form, and defaults to today.
  const todayKey = format(new Date(), "yyyy-MM-dd");
  const [newDraft, setNewDraft] = useState({
    guest: "",
    // The AirBnB guest's name, when it is one of theirs; "" for a house guest.
    alias: "",
    date: todayKey,
    amount: "",
    label: "Cancellation" as string,
    note: "",
    paid: false,
  });
  const [savingNew, setSavingNew] = useState(false);
  // Who owes it, chosen by typing rather than by scrolling. This was a <select>
  // of every guest the house has ever had, and a native dropdown cannot be
  // searched -- finding somebody meant reading the whole list.
  const [guestQuery, setGuestQuery] = useState("");
  const [guestOpen, setGuestOpen] = useState(false);

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

  // The house's own guests. AirBnB's placeholder record is not among them: it
  // is one record for every AirBnB stay, not a person — those are listed next,
  // by name.
  const chargeableGuests = useMemo(
    () =>
      [...guests]
        .filter((g) => g.name !== "AirBnB")
        .sort((a, b) => a.name.localeCompare(b.name)),
    [guests],
  );
  // AirBnB guests, by the name AirBnB gives them. Until 2026-10-03 they could
  // not be charged at all — "AirBnB settles its own fees" — which is true of
  // the stay but not of a cancellation: when an AirBnB guest cancels, AirBnB
  // pays the house a cancellation fee, and that is money to write down like
  // any other. The charge hangs off the placeholder record with the alias
  // saying who.
  //
  // The calendar's AirBnB guests are offered for a fee found after a stay
  // (damage, a late checkout). For a CANCELLATION they are the wrong place to
  // look: the sync removes a cancelled AirBnB stay, so by the time the fee is
  // recorded the name is gone from the calendar. Anh-Tuan, 2026-10-03: "when
  // they cancel, their book is already removed from TiMag. Therefore, if you
  // keep chasing their name, you are wrong." So the name TYPED is enough —
  // see the last row of the list below.
  const airbnbRecord = guests.find((g) => g.name === "AirBnB");
  const airbnbRows = useMemo(
    () => (monthMap && airbnbRecord ? airbnbGuestList(monthMap, format(new Date(), "yyyy-MM-dd")) : []),
    [monthMap, airbnbRecord],
  );

  // Empty query lists everyone, so the picker still browses the way the old
  // dropdown did. Name AND phone, because a charge is often being entered from
  // a text message where the number is the only thing to hand — digits are
  // compared stripped, so "4085551234" finds "(408) 555-1234".
  const guestMatches = useMemo(() => {
    const q = guestQuery.trim().toLowerCase();
    if (!q) return chargeableGuests;
    const digits = q.replace(/\D/g, "");
    return chargeableGuests.filter((g) => {
      const name = `${g.name} ${g.alias ?? ""}`.toLowerCase();
      if (name.includes(q)) return true;
      return digits.length >= 2 && (g.phone ?? "").replace(/\D/g, "").includes(digits);
    });
  }, [chargeableGuests, guestQuery]);
  // AirBnB guests only once something is typed: the house's own guests are
  // the shorter list and lead when browsing, and an AirBnB name is always
  // typed from the cancellation notice in hand.
  const airbnbMatches = useMemo(() => {
    const q = guestQuery.trim().toLowerCase();
    if (!q) return [];
    return airbnbRows.filter((r) => r.alias.toLowerCase().includes(q)).slice(0, 8);
  }, [airbnbRows, guestQuery]);

  // The typed name, offered as an AirBnB guest in its own right — unless a
  // calendar row already carries exactly that name, in which case that row
  // is the same offer with more on it.
  const typedName = guestQuery.trim();
  const typedIsNew =
    !!airbnbRecord &&
    typedName.length >= 2 &&
    !airbnbMatches.some((r) => r.alias.toLowerCase() === typedName.toLowerCase());
  const pickAirBnB = (alias: string) => {
    setNewDraft((d) => ({
      ...d,
      guest: airbnbRecord?.id ?? "",
      alias,
      // AirBnB pays a cancellation fee out with the next payout; the host is
      // writing down money that has come, or is coming, on its own.
      paid: true,
    }));
    setGuestQuery("");
    setGuestOpen(false);
  };

  const chosenGuest = chargeableGuests.find((g) => g.id === newDraft.guest);
  const chosenName = newDraft.alias || (chosenGuest ? chosenGuest.alias || chosenGuest.name : "");

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
    setDraft({ amount: String(c.amount), label: c.label, note: c.note, date: c.date });
  };

  const saveEdit = async (c: ChargeType) => {
    const amount = Number(draft.amount);
    // The backend rejects a non-positive amount; saying so here saves a
    // round-trip and an error the host cannot act on.
    if (!(amount > 0)) {
      setError("A charge has to be more than $0. Delete it instead to remove it.");
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.date)) {
      setError("Pick the day the charge belongs to.");
      return;
    }
    if (await patch(c.id, { id: c.id, amount, label: draft.label, note: draft.note, date: draft.date }))
      setEditingId(null);
  };

  const saveNew = async () => {
    const amount = Number(newDraft.amount);
    if (!newDraft.guest) {
      setError("Choose who owes it — a charge nobody is named on cannot be chased.");
      return;
    }
    if (!(amount > 0)) {
      setError("A charge has to be more than $0.");
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(newDraft.date)) {
      setError("Pick the day the charge belongs to.");
      return;
    }
    setSavingNew(true);
    try {
      const created = await createCharge(
        {
          host: hostId,
          guest: newDraft.guest,
          alias: newDraft.alias,
          label: newDraft.label,
          amount,
          paid: newDraft.paid,
          date: newDraft.date,
          note: newDraft.note,
        },
        token,
      );
      setCharges((prev) => [created, ...prev]);
      setAdding(false);
      // And the list turns to the month it landed in, so it is seen to land.
      setMonth(new Date(created.date + "T00:00:00"));
      setNewDraft({ guest: "", alias: "", date: todayKey, amount: "", label: "Cancellation", note: "", paid: false });
      setError(null);
    } catch {
      setError("That charge could not be saved.");
    } finally {
      setSavingNew(false);
    }
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
          {/* Add by hand — for a fee whose stay is already gone. Sits above the
              list because an empty month is exactly when it is wanted. */}
          {adding ? (
            <div className="mb-3 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2.5">
              <p className="text-sm font-bold text-amber-800">New charge</p>
              <div className="mt-2 flex flex-col gap-2">
                {/* Once somebody is chosen the search disappears and only they
                    are on screen: this is a form about charging THAT person, and
                    a list still sitting under it is a list you can misfire on.
                    The x is how you change your mind. */}
                {chosenName ? (
                  <div className={`${inputCls} flex w-full items-center justify-between gap-2 font-semibold`}>
                    <span className="truncate text-gray-900">
                      {chosenName}
                      {newDraft.alias && <span className="ml-1.5 text-xs font-bold text-rose-500">AirBnB</span>}
                    </span>
                    <button
                      type="button"
                      aria-label="Choose someone else"
                      onClick={() => {
                        setNewDraft((d) => ({ ...d, guest: "", alias: "" }));
                        setGuestQuery("");
                        setGuestOpen(true);
                      }}
                      className="shrink-0 rounded px-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                    >
                      &times;
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <input
                      type="text"
                      value={guestQuery}
                      onChange={(e) => {
                        setGuestQuery(e.target.value);
                        setGuestOpen(true);
                      }}
                      onFocus={() => setGuestOpen(true)}
                      // Late, so the click that picks a guest lands before the
                      // list is taken away. Same delay GuestSearch uses.
                      onBlur={() => setTimeout(() => setGuestOpen(false), 150)}
                      placeholder="Who owes it? Type a name or number…"
                      className={`${inputCls} w-full font-semibold`}
                    />
                    {guestOpen && (
                      <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-60 overflow-y-auto rounded-xl border border-gray-100 bg-white shadow-xl">
                        {guestMatches.length === 0 && airbnbMatches.length === 0 && !typedIsNew ? (
                          <p className="px-3 py-2 text-sm text-gray-400">
                            {chargeableGuests.length === 0
                              ? "No guests to charge yet."
                              : "Nobody by that name or number."}
                          </p>
                        ) : (
                          <>
                          {guestMatches.map((g) => (
                            <button
                              key={g.id}
                              type="button"
                              // onMouseDown, not onClick: the input's blur fires
                              // first and would close the list before a click
                              // could land.
                              onMouseDown={() => {
                                setNewDraft((d) => ({ ...d, guest: g.id }));
                                setGuestQuery("");
                                setGuestOpen(false);
                              }}
                              className="block w-full truncate border-b border-gray-50 px-3 py-2 text-left text-sm text-gray-800 last:border-0 hover:bg-amber-50"
                            >
                              {g.alias || g.name}
                            </button>
                          ))}
                          {airbnbMatches.map((r) => (
                            <button
                              key={`airbnb-${r.alias}`}
                              type="button"
                              onMouseDown={() => pickAirBnB(r.alias)}
                              className="flex w-full items-center justify-between gap-2 border-b border-gray-50 px-3 py-2 text-left text-sm text-gray-800 last:border-0 hover:bg-amber-50"
                            >
                              <span className="truncate">
                                {r.alias}
                                <span className="ml-1.5 text-xs text-gray-400">
                                  {r.room}
                                  {(r.next ?? r.last) ? ` · ${format(new Date((r.next ?? r.last) + "T00:00:00"), "MMM d")}` : ""}
                                </span>
                              </span>
                              <span className="shrink-0 text-xs font-bold text-rose-500">AirBnB</span>
                            </button>
                          ))}
                          {/* The name as typed. A cancelled AirBnB stay is
                              gone from the calendar, so this is the row a
                              cancellation fee is recorded from. */}
                          {typedIsNew && (
                            <button
                              type="button"
                              onMouseDown={() => pickAirBnB(typedName)}
                              className="flex w-full items-center justify-between gap-2 border-t border-gray-100 px-3 py-2 text-left text-sm text-gray-800 hover:bg-amber-50"
                            >
                              <span className="truncate">
                                “{typedName}”
                                <span className="ml-1.5 text-xs text-gray-400">
                                  an AirBnB guest no longer on the calendar
                                </span>
                              </span>
                              <span className="shrink-0 text-xs font-bold text-rose-500">AirBnB</span>
                            </button>
                          )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}
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
                      value={newDraft.amount}
                      onChange={(e) => setNewDraft((d) => ({ ...d, amount: e.target.value }))}
                      placeholder="0"
                      className={`${inputCls} w-28 pl-5 font-semibold`}
                    />
                  </div>
                  <select
                    value={newDraft.label}
                    onChange={(e) => setNewDraft((d) => ({ ...d, label: e.target.value }))}
                    className={`${inputCls} font-semibold`}
                  >
                    {CHARGE_LABELS.map((l) => (
                      <option key={l} value={l}>
                        {l}
                      </option>
                    ))}
                  </select>
                </div>
                {/* The day it belongs to: the one day whose Profit tab will
                    carry it, and the month whose total it joins. */}
                <label className="flex items-center gap-2 text-xs font-semibold text-amber-800">
                  On
                  <input
                    type="date"
                    value={newDraft.date}
                    onChange={(e) => setNewDraft((d) => ({ ...d, date: e.target.value }))}
                    className={`${inputCls} font-semibold text-gray-900`}
                  />
                </label>
                <input
                  type="text"
                  value={newDraft.note}
                  onChange={(e) => setNewDraft((d) => ({ ...d, note: e.target.value }))}
                  placeholder="What it was for"
                  className={`${inputCls} w-full`}
                />
                {/* A fee entered by hand is usually being recorded BECAUSE the
                    money arrived — the stay it belonged to is long gone. */}
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={newDraft.paid}
                    onChange={(e) => setNewDraft((d) => ({ ...d, paid: e.target.checked }))}
                    className="h-4 w-4 rounded border-amber-300 accent-emerald-600"
                  />
                  <span className="text-xs font-semibold text-amber-800">Already paid</span>
                </label>
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setAdding(false);
                      setGuestQuery("");
                      setGuestOpen(false);
                    }}
                    className="rounded-lg px-3 py-1.5 text-sm font-semibold text-gray-500 hover:bg-gray-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={savingNew}
                    onClick={saveNew}
                    className="rounded-lg bg-gray-900 px-3 py-1.5 text-sm font-bold text-white disabled:bg-gray-300"
                  >
                    {savingNew
                      ? "Saving…"
                      : /^\d{4}-\d{2}-\d{2}$/.test(newDraft.date)
                        ? `Add to ${format(new Date(newDraft.date + "T00:00:00"), "MMM d")}`
                        : "Add"}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setAdding(true);
                setGuestQuery("");
                setGuestOpen(false);
              }}
              className="mb-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-gray-300 py-2 text-sm font-semibold text-gray-500 hover:border-gray-400 hover:bg-gray-50"
            >
              <FaPlus size={11} /> Add a charge
            </button>
          )}

          {loading ? (
            <p className="py-8 text-center text-sm text-gray-400">Loading…</p>
          ) : monthCharges.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm font-semibold text-gray-500">
                No charges in {format(month, "MMMM")}.
              </p>
              <p className="mt-1 text-xs text-gray-400">
                Fees are added when you unbook a stay, or with "Add a charge" above.
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
                        <p className="truncate text-sm font-bold text-gray-900">
                          {c.alias || c.guest.name}
                          {c.alias && <span className="ml-1.5 text-xs font-bold text-rose-500">AirBnB</span>}
                        </p>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                              LABEL_STYLE[c.label] ?? LABEL_STYLE.Other
                            }`}
                          >
                            {c.label}
                          </span>
                          <span className="text-[11px] text-gray-500">
                            {format(new Date(c.date + "T00:00:00"), "EEE MMM d")}
                          </span>
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
                        <label className="flex items-center gap-2 text-xs font-semibold text-gray-600">
                          On
                          <input
                            type="date"
                            value={draft.date}
                            onChange={(e) => setDraft((d) => ({ ...d, date: e.target.value }))}
                            className={`${inputCls} font-semibold text-gray-900`}
                          />
                        </label>
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
                            className={DANGER_BUTTON}
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
                        {c.guest.phone && !c.alias && (
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
