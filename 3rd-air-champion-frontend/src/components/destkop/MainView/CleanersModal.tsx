import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { addDays, format, startOfToday, startOfWeek } from "date-fns";
import { FaBroom, FaDollarSign, FaRegClock } from "react-icons/fa";
import { dayType } from "../../../util/types/dayType";
import { getRoomColor } from "../../../util/getRoomColor";
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
// Solid variants of the same identity colors (Text buttons match avatars)
const SOLID_COLORS = ["bg-emerald-600", "bg-blue-600", "bg-violet-600", "bg-amber-600", "bg-rose-600"];

const initials = (name: string) =>
  name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

// Decimal hours between two "HH:MM" clock times (2dp), or null if either is
// missing/invalid or the leave time isn't after the arrival time. Cleaning is
// daytime, so no midnight wrap.
const hoursBetween = (inStr?: string, outStr?: string): number | null => {
  if (!inStr || !outStr) return null;
  const [ih, im] = inStr.split(":").map(Number);
  const [oh, om] = outStr.split(":").map(Number);
  if ([ih, im, oh, om].some((n) => Number.isNaN(n))) return null;
  const mins = oh * 60 + om - (ih * 60 + im);
  if (mins <= 0) return null;
  return Math.round((mins / 60) * 100) / 100;
};

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
  // Pay / Hours / Week / Team tabs — everything in one scroll was overcrowded
  const [activeTab, setActiveTab] = useState<"roster" | "hours" | "pay" | "week">("pay");
  const autoTabDone = useRef(false);
  // The cleaner-facing schedule is a FIXED Mon–Sun week (unlike the rolling
  // Upcoming forecast) — texted schedules must not shift under the cleaner's
  // feet as days pass. 0 = this week, 1 = next week.
  const [weekOffset, setWeekOffset] = useState<0 | 1>(0);

  // Floating window: draggable via the header, resizable via the corner grip,
  // no backdrop — the calendar stays visible behind it.
  const [pos, setPos] = useState(() => ({
    x: Math.max(8, Math.round(window.innerWidth / 2 - Math.min(384, window.innerWidth - 16) / 2)),
    y: 60,
  }));
  const [size, setSize] = useState(() => ({
    w: Math.min(384, window.innerWidth - 16),
    h: Math.min(Math.round(window.innerHeight * 0.75), 640),
  }));
  const dragOffset = useRef<{ dx: number; dy: number } | null>(null);
  const resizeStart = useRef<{ pointerY: number; top: number; h: number } | null>(null);

  const onDragStart = (e: React.PointerEvent) => {
    dragOffset.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onDragMove = (e: React.PointerEvent) => {
    if (!dragOffset.current) return;
    setPos({
      x: Math.min(Math.max(4, e.clientX - dragOffset.current.dx), window.innerWidth - 120),
      y: Math.min(Math.max(4, e.clientY - dragOffset.current.dy), window.innerHeight - 80),
    });
  };
  const onDragEnd = () => {
    dragOffset.current = null;
  };

  // Handle-bar resize, mirroring the ToDo sheet: drag the bar vertically to
  // change height. The window's bottom edge stays anchored — the top edge
  // follows the pointer (drag up = taller, drag down = shorter).
  const onBarStart = (e: React.PointerEvent) => {
    resizeStart.current = { pointerY: e.clientY, top: pos.y, h: size.h };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onBarMove = (e: React.PointerEvent) => {
    if (!resizeStart.current) return;
    const start = resizeStart.current;
    const bottom = start.top + start.h;
    const newH = Math.min(
      Math.max(280, start.h - (e.clientY - start.pointerY)),
      Math.min(window.innerHeight - 24, bottom - 4),
    );
    setSize((s) => ({ ...s, h: newH }));
    setPos((p) => ({ ...p, y: bottom - newH }));
  };
  const onBarEnd = () => {
    resizeStart.current = null;
  };

  const [newCleaner, setNewCleaner] = useState({ name: "", phone: "", payRate: "" });
  // Add form hidden behind a button at the end of the roster
  const [addOpen, setAddOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [edit, setEdit] = useState({ name: "", phone: "", payRate: "", baselineHours: "" });
  const [hoursDraft, setHoursDraft] = useState<Record<string, string>>({});
  // Which already-recorded cleaner-day is currently open for correction
  const [editingDayKey, setEditingDayKey] = useState<string | null>(null);
  // Some cleaners report a decimal total, others report arrival/leave times.
  // Per-card mode; In–Out computes the total we save (backend still stores hrs).
  const [hoursMode, setHoursMode] = useState<Record<string, "total" | "inout">>({});
  const [timeDraft, setTimeDraft] = useState<Record<string, { in: string; out: string }>>({});
  // Pay tab: which cleaner's per-date hours breakdown is expanded, plus an
  // optional tip added to the texted payment statement.
  const [breakdownId, setBreakdownId] = useState<string | null>(null);
  const [tipDraft, setTipDraft] = useState<Record<string, string>>({});
  const [payingId, setPayingId] = useState<string | null>(null);
  const [payDraft, setPayDraft] = useState("");
  // Payout adds to paid, Undo subtracts — phone number pads have no minus key,
  // so direction is a toggle and the typed amount is always positive.
  const [payMode, setPayMode] = useState<"payout" | "undo">("payout");
  // Two-tap confirm rendered in-design — no browser confirm() popup
  const [payConfirmArmed, setPayConfirmArmed] = useState(false);
  const [error, setError] = useState("");

  const todayKey = format(startOfToday(), "yyyy-MM-dd");
  const monthKey = format(startOfToday(), "yyyy-MM");

  const reloadSummary = () =>
    fetchCleanerSummary(hostId, token)
      .then(setSummary)
      .catch((err) => console.error("Error fetching cleaner summary:", err));

  // Selected fixed week (Mon–Sun)
  const weekMonday = addDays(startOfWeek(startOfToday(), { weekStartsOn: 1 }), weekOffset * 7);
  const weekDates = Array.from({ length: 7 }, (_, i) =>
    format(addDays(weekMonday, i), "yyyy-MM-dd"),
  );
  const weekAssignments = assignments.filter(
    (a) => a.date >= weekDates[0] && a.date <= weekDates[6] && a.cleaner && a.room,
  );

  // Custom room colors live on booking.room in monthMap (assignments only
  // carry id+name) — recover them so Week chips match the Upcoming chips.
  const roomColorById = new Map<string, string>();
  monthMap.forEach((day) =>
    day.bookings.forEach((b) => {
      if (b.room?.id && b.room.color) roomColorById.set(b.room.id, b.room.color);
    }),
  );

  useEffect(() => {
    if (!hostId || !token) return;
    // Cover this month (hours + pay) AND this week + next week (fixed schedule),
    // whichever starts/ends wider.
    const thisMonday = format(startOfWeek(startOfToday(), { weekStartsOn: 1 }), "yyyy-MM-dd");
    const start = thisMonday < `${monthKey}-01` ? thisMonday : `${monthKey}-01`;
    const end = format(
      addDays(startOfWeek(startOfToday(), { weekStartsOn: 1 }), 13),
      "yyyy-MM-dd",
    );
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

  // A cleaner reports ONE daily total, not a figure per room — group the
  // finished cleanings by cleaner + date so the host enters a single number.
  const needHoursGroups = (() => {
    const map = new Map<
      string,
      { key: string; cleaner: CleanerType; date: string; assignments: CleaningAssignmentType[] }
    >();
    needHours
      .slice()
      .sort((a, b) => a.date.localeCompare(b.date))
      .forEach((a) => {
        const key = `${a.cleaner!.id}|${a.date}`;
        const g = map.get(key) ?? { key, cleaner: a.cleaner!, date: a.date, assignments: [] };
        g.assignments.push(a);
        map.set(key, g);
      });
    return [...map.values()];
  })();

  // Already-recorded cleaner-days this month — kept editable so a mistyped
  // total can be corrected. Total = Σ of the day's assignment hours (the whole
  // total sits on the first room, 0 on the rest, so the sum is the total).
  const recordedGroups = (() => {
    const map = new Map<
      string,
      {
        key: string;
        cleaner: CleanerType;
        date: string;
        hours: number;
        assignments: CleaningAssignmentType[];
      }
    >();
    assignments
      .filter((a) => a.date.startsWith(monthKey) && a.hours != null && a.cleaner)
      .forEach((a) => {
        const key = `${a.cleaner!.id}|${a.date}`;
        const g =
          map.get(key) ?? { key, cleaner: a.cleaner!, date: a.date, hours: 0, assignments: [] };
        g.hours += a.hours!;
        g.assignments.push(a);
        map.set(key, g);
      });
    return [...map.values()].sort((a, b) => b.date.localeCompare(a.date));
  })();

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
        setAddOpen(false);
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

  // Swipe-to-remove: dragging a roster row to the right reveals the red
  // Remove button underneath — deliberate by construction, no accidental taps.
  const [swipeOpenId, setSwipeOpenId] = useState<string | null>(null);
  const swipeStart = useRef<{ id: string; x: number; y: number } | null>(null);
  // Tapping the revealed Remove swaps the row for an in-design confirm strip
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);

  const handleDelete = (cleaner: CleanerType) => {
    setSwipeOpenId(null);
    setConfirmRemoveId(null);
    deleteCleaner(cleaner.id, token)
      .then(() => {
        setCleaners((prev) => prev.filter((c) => c.id !== cleaner.id));
        setAssignments((prev) => prev.filter((a) => a.cleaner?.id !== cleaner.id));
        setEditingId(null);
        setError("");
        reloadSummary();
      })
      .catch((err) => setError(err.response?.data?.error ?? "Could not remove cleaner"));
  };

  // Save one cleaner's total for a day. The backend keeps hours per
  // assignment, but only the SUM is ever used (pay, summary, monthly), so put
  // the whole daily total on the day's first room and 0 on the rest — the sum
  // equals exactly what the cleaner reported, no per-room figure invented.
  const handleSaveDayHours = (group: {
    key: string;
    assignments: CleaningAssignmentType[];
  }) => {
    // In–Out mode derives the total from the arrival/leave times; Total mode
    // takes the typed number. Both save the same resulting hours.
    const mode = hoursMode[group.key] ?? "total";
    const hours =
      mode === "inout"
        ? hoursBetween(timeDraft[group.key]?.in, timeDraft[group.key]?.out)
        : parseFloat(hoursDraft[group.key]);
    if (hours == null || !(hours >= 0)) return;
    // 0 = the cleaner didn't work that day: clear every room back to null so
    // the day returns to the amber pending card, rather than storing "0 hr".
    const clearing = hours === 0;
    Promise.all(
      group.assignments.map((a, i) =>
        updateAssignmentHours(a.id, clearing ? null : i === 0 ? hours : 0, token),
      ),
    )
      .then((updatedList) => {
        setAssignments((prev) => prev.map((a) => updatedList.find((u) => u.id === a.id) ?? a));
        setEditingDayKey(null);
        setHoursDraft((p) => {
          const next = { ...p };
          delete next[group.key];
          return next;
        });
        setTimeDraft((p) => {
          const next = { ...p };
          delete next[group.key];
          return next;
        });
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

  // One SMS per cleaner, bound to the FIXED selected week — the message a
  // cleaner receives never depends on which day the host happens to send it.
  const textSchedule = (cleaner: CleanerType) => {
    if (!cleaner.phone) return;
    const mine = weekAssignments
      .filter((a) => a.cleaner!.id === cleaner.id)
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
    const weekLabel = `${format(weekMonday, "MMM d")} – ${format(addDays(weekMonday, 6), "MMM d")}`;
    const message = `Hi ${cleaner.name}, your cleaning schedule for ${weekLabel}:\n${lines.join("\n")}\n(numbers = guests arriving)\nThank you! — Anh-Tuan`;
    window.location.href = `sms:${cleaner.phone}?&body=${encodeURIComponent(message)}`;
  };

  // A cleaner's recorded hours per date this month — the transparent breakdown
  // behind the pay total (sums the day's assignment hours per date).
  const cleanerDayHours = (cleanerId: string): [string, number][] => {
    const map = new Map<string, number>();
    assignments
      .filter((a) => a.cleaner?.id === cleanerId && a.date.startsWith(monthKey) && a.hours != null)
      .forEach((a) => map.set(a.date, (map.get(a.date) ?? 0) + a.hours!));
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  };

  // Texted pay statement: this month's dates × hours × rate, plus any tip.
  const textPayment = (entry: CleanerSummaryType) => {
    const cleaner = cleaners.find((c) => c.id === entry.id);
    if (!cleaner?.phone) return;
    const rate = cleaner.payRate;
    const days = cleanerDayHours(entry.id);
    const tip = parseFloat(tipDraft[entry.id]) || 0;
    const lines = days.map(
      ([date, hrs]) =>
        `* ${format(new Date(date + "T00:00:00"), "EEE M/d")}: ${hrs} hr = $${(hrs * rate).toFixed(2)}`,
    );
    const subtotal = days.reduce((s, [, h]) => s + h * rate, 0);
    const monthLabel = format(startOfToday(), "MMMM");
    const body = [
      `Hi ${cleaner.name}, your cleaning pay for ${monthLabel}:`,
      ...lines,
      `Hours: ${days.reduce((s, [, h]) => s + h, 0)} · Subtotal: $${subtotal.toFixed(2)}`,
      ...(tip > 0 ? [`Tip: $${tip.toFixed(2)}`] : []),
      `Total: $${(subtotal + tip).toFixed(2)}`,
      `Thank you! — Anh-Tuan`,
    ].join("\n");
    window.location.href = `sms:${cleaner.phone}?&body=${encodeURIComponent(body)}`;
  };

  const handlePay = (entry: CleanerSummaryType) => {
    const amount = parseFloat(payDraft);
    if (!(amount > 0) || !isFinite(amount)) return;
    // Payouts change money records — never on a single tap. First tap arms the
    // button into an explicit "Confirm $X"; second tap commits.
    if (!payConfirmArmed) {
      setPayConfirmArmed(true);
      return;
    }
    const signed = payMode === "undo" ? -amount : amount;
    recordCleanerPayment(entry.id, signed, token)
      .then(() => {
        setPayingId(null);
        setPayConfirmArmed(false);
        setError("");
        reloadSummary();
      })
      .catch((err) => setError(err.response?.data?.error ?? "Could not record payment"));
  };

  return createPortal(
      <div
        className="fixed z-[110] flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl"
        style={{ left: pos.x, top: pos.y, width: size.w, height: size.h }}
      >
        {/* Bright brand bar */}
        <div className="h-1.5 shrink-0 bg-gradient-to-r from-emerald-400 via-blue-400 to-violet-400" />
        {/* Handle bar — drag vertically to resize, like the ToDo sheet */}
        <div
          className="flex shrink-0 cursor-row-resize touch-none select-none items-center justify-center pb-1 pt-2"
          onPointerDown={onBarStart}
          onPointerMove={onBarMove}
          onPointerUp={onBarEnd}
        >
          <div className="h-1 w-10 rounded-full bg-gray-300" />
        </div>
        {/* Header doubles as the move handle */}
        <div
          className="flex cursor-move touch-none items-center justify-between px-4 pb-1 pt-0"
          onPointerDown={onDragStart}
          onPointerMove={onDragMove}
          onPointerUp={onDragEnd}
        >
          <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900">
            <FaBroom className="text-emerald-600" />
            Clean
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

        <div className="mx-4 mb-2 grid shrink-0 grid-cols-4 gap-1 rounded-xl bg-gray-100 p-1">
          {(
            [
              { key: "pay", label: "Pay", count: summary.filter((s) => s.balance > 0.5).length },
              { key: "hours", label: "Hours", count: needHoursGroups.length },
              { key: "week", label: "Week", count: weekAssignments.length },
              { key: "roster", label: "Team", count: cleaners.length },
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
          {/* Roster */}
          {cleaners.length === 0 && !addOpen && (
            <p className="py-4 text-center text-sm text-gray-400">No cleaners yet — add one below</p>
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
                  <button
                    type="button"
                    className={pillNeutral}
                    onClick={() => setEditingId(null)}
                  >
                    Cancel
                  </button>
                  <button type="button" className={pillDark} onClick={() => handleSaveEdit(cleaner.id)}>
                    Save
                  </button>
                </div>
              </div>
            ) : (
              confirmRemoveId === cleaner.id ? (
              <div
                key={cleaner.id}
                className="mb-2 flex items-center justify-between gap-2 rounded-xl border border-red-300 bg-red-50 p-2.5"
              >
                <p className="min-w-0 flex-1 text-xs font-semibold text-red-700">
                  Are you sure to remove {cleaner.name} from the team?
                </p>
                <button
                  type="button"
                  className={pillNeutral}
                  onClick={() => setConfirmRemoveId(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="rounded-lg bg-red-600 px-2.5 py-1.5 text-xs font-bold text-white"
                  onClick={() => handleDelete(cleaner)}
                >
                  Remove
                </button>
              </div>
              ) : (
              <div key={cleaner.id} className="relative mb-2 overflow-hidden rounded-xl">
                {/* Revealed by swiping the row to the left (iOS convention) */}
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 flex w-20 items-center justify-center bg-red-600 text-xs font-bold text-white"
                  onClick={() => {
                    setSwipeOpenId(null);
                    setConfirmRemoveId(cleaner.id);
                  }}
                >
                  Remove
                </button>
                <div
                  className={`relative flex items-center gap-2 rounded-xl border border-gray-200 bg-white p-2.5 transition-transform duration-200 ${
                    swipeOpenId === cleaner.id ? "-translate-x-20" : ""
                  }`}
                  style={{ touchAction: "pan-y" }}
                  onPointerDown={(e) =>
                    (swipeStart.current = { id: cleaner.id, x: e.clientX, y: e.clientY })
                  }
                  onPointerUp={(e) => {
                    const s = swipeStart.current;
                    swipeStart.current = null;
                    if (!s || s.id !== cleaner.id) return;
                    const dx = e.clientX - s.x;
                    const dy = Math.abs(e.clientY - s.y);
                    if (dx < -40 && -dx > dy) setSwipeOpenId(cleaner.id);
                    else if (dx > 20 || swipeOpenId === cleaner.id) setSwipeOpenId(null);
                  }}
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
                {/* Texting lives only in the Week tab, bound to the visible
                    week — a Text here couldn't say WHICH week it sends */}
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
                </div>
              </div>
              )
            ),
          )}

          {/* Add cleaner — hidden behind a button at the end of the roster */}
          {!addOpen ? (
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-gray-300 py-2.5 text-sm font-semibold text-gray-500"
            >
              + Add Cleaner
            </button>
          ) : (
            <div className="mt-1 rounded-xl border border-gray-200 p-2">
              <div className="flex items-center gap-1.5">
                <input
                  className={`${inputCls} min-w-0 flex-1`}
                  placeholder="Name"
                  autoFocus
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
              </div>
              <div className="mt-1.5 flex justify-end gap-1.5">
                <button type="button" className={pillNeutral} onClick={() => setAddOpen(false)}>
                  Cancel
                </button>
                <button type="button" className={pillDark} onClick={handleAdd}>
                  Add
                </button>
              </div>
            </div>
          )}
          </>
          )}

          {activeTab === "week" && (
          <>
          {/* Fixed Mon–Sun schedule — the frame all cleaner-facing actions
              (like the texted schedule) bind to, unlike the rolling Upcoming */}
          <div className="mb-2 grid grid-cols-2 gap-1 rounded-lg bg-gray-100 p-0.5">
            {(
              [
                { off: 0, label: "This week" },
                { off: 1, label: "Next week" },
              ] as const
            ).map(({ off, label }) => (
              <button
                key={off}
                type="button"
                onClick={() => setWeekOffset(off)}
                className={`rounded-md py-1 text-[11px] font-semibold ${
                  weekOffset === off
                    ? off === 0
                      ? "bg-white text-blue-700 shadow-sm"
                      : "bg-white text-violet-700 shadow-sm"
                    : "text-gray-500"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {weekDates.map((dateKey) => {
            const dayDate = new Date(dateKey + "T00:00:00");
            const dayAssignments = weekAssignments.filter((a) => a.date === dateKey);
            const groups = new Map<string, { id: string; name: string }[]>();
            dayAssignments.forEach((a) => {
              groups.set(a.cleaner!.name, [...(groups.get(a.cleaner!.name) ?? []), a.room!]);
            });
            const isToday = dateKey === todayKey;
            return (
              <div
                key={dateKey}
                className={`mb-1 flex items-center gap-2.5 rounded-lg border px-2.5 py-1.5 ${
                  isToday ? "border-emerald-300 bg-emerald-50" : "border-gray-200 bg-white"
                }`}
              >
                <div className="flex w-16 shrink-0 items-baseline gap-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                    {format(dayDate, "EEE")}
                  </span>
                  <span className="text-xs font-bold text-gray-900">{format(dayDate, "M/d")}</span>
                </div>
                <div className="min-w-0 flex-1">
                  {dayAssignments.length === 0 ? (
                    <span className="text-xs text-gray-300">—</span>
                  ) : (
                    [...groups.entries()].map(([name, rooms]) => (
                      <p
                        key={name}
                        className="mb-0.5 flex flex-wrap items-center gap-1 last:mb-0"
                      >
                        <span className="text-[10px] font-bold text-gray-500">{name}</span>
                        {rooms.map((room, i) => {
                          // Same headcount the SMS carries — beds/towels to prep
                          const count = nextGuestCount(room.id, dateKey);
                          return (
                            <span
                              key={`${room.id}-${i}`}
                              className={`${getRoomColor(room.name, roomColorById.get(room.id))} rounded px-1.5 py-0.5 text-[11px] font-semibold text-black`}
                            >
                              {room.name}
                              {count ? ` (${count})` : ""}
                            </span>
                          );
                        })}
                      </p>
                    ))
                  )}
                </div>
              </div>
            );
          })}

          {/* Text actions bound to this exact week */}
          {(() => {
            const withWork = cleaners.filter(
              (c) => c.phone && weekAssignments.some((a) => a.cleaner!.id === c.id),
            );
            return withWork.length > 0 ? (
              <div className="mt-2">
                {/* The week being sent, spelled out and week-colored */}
                <p
                  className={`mb-1.5 text-center text-xs font-semibold ${
                    weekOffset === 0 ? "text-blue-700" : "text-violet-700"
                  }`}
                >
                  Sends {weekOffset === 0 ? "this week" : "NEXT week"} ·{" "}
                  {format(weekMonday, "MMM d")} – {format(addDays(weekMonday, 6), "MMM d")}
                </p>
                <div className="flex flex-wrap items-center justify-center gap-1.5">
                  {/* Button color = the cleaner's identity color (same as their
                      Team avatar); the week is marked above and in the label */}
                  {withWork.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold text-white ${
                        SOLID_COLORS[Math.max(0, cleaners.indexOf(c)) % SOLID_COLORS.length]
                      }`}
                      onClick={() => textSchedule(c)}
                    >
                      Text {c.name.split(" ")[0]}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <p className="mt-2 text-center text-xs text-gray-400">
                Assign rooms in the ToDo Upcoming tab — they land here by date
              </p>
            );
          })()}
          </>
          )}

          {activeTab === "hours" && (
          <>
          {/* Hours to record for finished cleanings */}
          <SectionHeader
            icon={<FaRegClock className="text-amber-500" />}
            title="Record hours"
            hint="Enter a daily total, or the arrival/leave times — pay is hours × rate"
          />
          {needHoursGroups.length === 0 ? (
            <p className="mb-2 rounded-xl border border-gray-200 bg-gray-50 p-2.5 text-center text-xs text-gray-400">
              Nothing to record yet — cleanings appear here once their day arrives
            </p>
          ) : (
            needHoursGroups.map((group) => (
              <div
                key={group.key}
                className="mb-2 rounded-xl border border-amber-200 bg-amber-50 p-2.5"
              >
                <div className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-900">{group.cleaner.name}</p>
                    <p className="text-xs text-gray-500">
                      {format(new Date(group.date + "T00:00:00"), "EEEE M/d")}
                    </p>
                  </div>
                  {/* How this cleaner reports: a decimal total, or come/leave times */}
                  <div className="flex shrink-0 rounded-lg bg-gray-100 p-0.5 text-[10px] font-semibold">
                    {(["total", "inout"] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setHoursMode((p) => ({ ...p, [group.key]: m }))}
                        className={`rounded-md px-2 py-1 ${
                          (hoursMode[group.key] ?? "total") === m
                            ? "bg-white text-gray-900 shadow-sm"
                            : "text-gray-500"
                        }`}
                      >
                        {m === "total" ? "Total" : "In–Out"}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap items-center justify-end gap-1.5">
                  {(hoursMode[group.key] ?? "total") === "total" ? (
                    <input
                      className={`${inputCls} w-16`}
                      type="number"
                      step="0.5"
                      min="0"
                      placeholder="hrs"
                      value={hoursDraft[group.key] ?? ""}
                      onChange={(e) =>
                        setHoursDraft((p) => ({ ...p, [group.key]: e.target.value }))
                      }
                    />
                  ) : (
                    <>
                      <label className="text-[10px] font-semibold text-gray-500">In</label>
                      <input
                        className={`${inputCls} w-[92px]`}
                        type="time"
                        value={timeDraft[group.key]?.in ?? ""}
                        onChange={(e) =>
                          setTimeDraft((p) => ({
                            ...p,
                            [group.key]: { in: e.target.value, out: p[group.key]?.out ?? "" },
                          }))
                        }
                      />
                      <label className="text-[10px] font-semibold text-gray-500">Out</label>
                      <input
                        className={`${inputCls} w-[92px]`}
                        type="time"
                        value={timeDraft[group.key]?.out ?? ""}
                        onChange={(e) =>
                          setTimeDraft((p) => ({
                            ...p,
                            [group.key]: { in: p[group.key]?.in ?? "", out: e.target.value },
                          }))
                        }
                      />
                      {hoursBetween(timeDraft[group.key]?.in, timeDraft[group.key]?.out) != null && (
                        <span className="text-xs font-bold text-emerald-600">
                          = {hoursBetween(timeDraft[group.key]?.in, timeDraft[group.key]?.out)} hr
                        </span>
                      )}
                    </>
                  )}
                  <button
                    type="button"
                    className={pillDark}
                    onClick={() => handleSaveDayHours(group)}
                  >
                    Save
                  </button>
                </div>
                {/* Rooms cleaned that day, for context — the total covers them all */}
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {group.assignments.map((a) => (
                    <span
                      key={a.id}
                      className={`${getRoomColor(a.room?.name ?? "", a.room ? roomColorById.get(a.room.id) : undefined)} rounded px-1.5 py-0.5 text-[11px] font-semibold text-black`}
                    >
                      {a.room?.name}
                    </span>
                  ))}
                </div>
              </div>
            ))
          )}

          {/* Already-recorded days — tap Edit to fix a mistyped total */}
          {recordedGroups.length > 0 && (
            <>
              <SectionHeader
                icon={<FaRegClock className="text-blue-500" />}
                title={`Recorded this month — ${format(startOfToday(), "MMMM")}`}
                hint="Tap Edit to correct a total"
              />
              {recordedGroups.map((group) => (
                <div key={group.key} className="mb-1.5 rounded-xl border border-gray-200 p-2.5">
                  <div className="flex items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-gray-900">
                        {group.cleaner.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {format(new Date(group.date + "T00:00:00"), "EEE M/d")} ·{" "}
                        {group.assignments.map((a) => a.room?.name).join(", ")}
                      </p>
                    </div>
                    {editingDayKey === group.key ? (
                      <>
                        <input
                          className={`${inputCls} w-16`}
                          type="number"
                          step="0.5"
                          min="0"
                          placeholder="hrs"
                          autoFocus
                          value={hoursDraft[group.key] ?? ""}
                          onChange={(e) =>
                            setHoursDraft((p) => ({ ...p, [group.key]: e.target.value }))
                          }
                        />
                        <button
                          type="button"
                          className={pillDark}
                          onClick={() => handleSaveDayHours(group)}
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          className={pillNeutral}
                          onClick={() => setEditingDayKey(null)}
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="shrink-0 text-sm font-bold text-gray-900">
                          {group.hours} hr
                        </span>
                        <button
                          type="button"
                          className={pillNeutral}
                          onClick={() => {
                            setEditingDayKey(group.key);
                            setHoursDraft((p) => ({ ...p, [group.key]: String(group.hours) }));
                          }}
                        >
                          Edit
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </>
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
            hint="Owed = earned − paid. Tap a name for the hours-by-date breakdown & tip"
          />
          {/* Grand total across the whole team */}
          {summary.length > 0 &&
            (() => {
              const totals = summary.reduce(
                (acc, s) => ({
                  earned: acc.earned + s.earned,
                  paid: acc.paid + s.paid,
                  balance: acc.balance + s.balance,
                }),
                { earned: 0, paid: 0, balance: 0 },
              );
              return (
                <div className="mb-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                  <div className="flex items-baseline justify-between">
                    <p className="text-xs font-semibold text-emerald-700">
                      Total cleaning fees so far
                    </p>
                    <p className="text-xl font-bold text-emerald-700">
                      ${Math.round(totals.earned).toLocaleString()}
                    </p>
                  </div>
                  <p className="mt-0.5 text-xs text-emerald-600">
                    paid ${Math.round(totals.paid).toLocaleString()} · still owed $
                    {Math.round(totals.balance).toLocaleString()}
                  </p>
                </div>
              );
            })()}
          {summary.length === 0 ? (
            <p className="mb-2 rounded-xl border border-gray-200 bg-gray-50 p-2.5 text-center text-xs text-gray-400">
              No earnings yet
            </p>
          ) : (
            summary.map((entry) => (
              <div key={entry.id} className="mb-1.5 rounded-xl border border-gray-200 p-2.5">
                <div className="flex items-center gap-2">
                  {/* Tap the name to reveal the transparent hours-by-date breakdown */}
                  <button
                    type="button"
                    onClick={() => setBreakdownId((id) => (id === entry.id ? null : entry.id))}
                    className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
                  >
                    <span className="text-[10px] text-gray-400">
                      {breakdownId === entry.id ? "▾" : "▸"}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-gray-900">
                        {entry.name}
                      </span>
                      <span className="block text-xs text-gray-500">
                        {entry.hours} hr · earned ${Math.round(entry.earned).toLocaleString()} · paid $
                        {Math.round(entry.paid).toLocaleString()}
                      </span>
                    </span>
                  </button>
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
                      // Never disabled: at $0 owed the input is still needed to
                      // enter a negative correction for a mis-recorded payout
                      onClick={() => {
                        setPayingId(entry.id);
                        setPayMode("payout");
                        setPayConfirmArmed(false);
                        setPayDraft(
                          entry.balance > 0.5 ? String(Math.round(entry.balance * 100) / 100) : "",
                        );
                      }}
                    >
                      Pay
                    </button>
                  )}
                </div>
                {payingId === entry.id && (
                  <div className="mt-2">
                    <div className="mb-1.5 grid grid-cols-2 gap-1 rounded-lg bg-gray-100 p-0.5">
                      {(
                        [
                          { key: "payout", label: "Payout" },
                          { key: "undo", label: "Undo mistake" },
                        ] as const
                      ).map(({ key, label }) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => {
                            setPayMode(key);
                            setPayConfirmArmed(false);
                          }}
                          className={`rounded-md py-1 text-[11px] font-semibold ${
                            payMode === key
                              ? key === "undo"
                                ? "bg-white text-red-600 shadow-sm"
                                : "bg-white text-gray-900 shadow-sm"
                              : "text-gray-500"
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <label className="text-xs text-gray-500">
                        {payMode === "payout" ? "Pay $" : "Undo $"}
                      </label>
                      <input
                        className={`${inputCls} w-20`}
                        type="number"
                        step="0.01"
                        min="0"
                        value={payDraft}
                        onChange={(e) => {
                          setPayDraft(e.target.value);
                          setPayConfirmArmed(false);
                        }}
                      />
                      <button
                        type="button"
                        className={
                          payConfirmArmed
                            ? `rounded-lg px-2.5 py-1.5 text-xs font-bold text-white ${
                                payMode === "undo" ? "bg-red-600" : "bg-emerald-700"
                              }`
                            : pillEmerald
                        }
                        onClick={() => handlePay(entry)}
                      >
                        {payConfirmArmed
                          ? `Confirm $${parseFloat(payDraft) || 0}`
                          : "Save"}
                      </button>
                      <button
                        type="button"
                        className={pillNeutral}
                        onClick={() => {
                          setPayingId(null);
                          setPayConfirmArmed(false);
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                    <p className="mt-1 text-[10px] text-gray-400">
                      {payMode === "payout"
                        ? "Adds to this cleaner's paid total"
                        : "Subtracts a mis-recorded payout from the paid total"}
                    </p>
                  </div>
                )}
                {breakdownId === entry.id &&
                  (() => {
                    const cleaner = cleaners.find((c) => c.id === entry.id);
                    const rate = cleaner?.payRate ?? 0;
                    const days = cleanerDayHours(entry.id);
                    const subtotal = days.reduce((s, [, h]) => s + h * rate, 0);
                    const tip = parseFloat(tipDraft[entry.id]) || 0;
                    return (
                      <div className="mt-2 rounded-lg bg-gray-50 p-2">
                        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                          {format(startOfToday(), "MMMM")} — hours by date
                        </p>
                        {days.length === 0 ? (
                          <p className="py-1 text-center text-[11px] text-gray-400">
                            No recorded hours this month
                          </p>
                        ) : (
                          days.map(([date, hrs]) => (
                            <div key={date} className="flex items-center gap-2 py-0.5 text-xs">
                              <span className="flex-1 text-gray-600">
                                {format(new Date(date + "T00:00:00"), "EEE M/d")}
                              </span>
                              <span className="text-gray-500">{hrs} hr</span>
                              <span className="w-16 text-right font-semibold text-gray-800">
                                ${(hrs * rate).toFixed(2)}
                              </span>
                            </div>
                          ))
                        )}
                        <div className="mt-1 flex items-center justify-between border-t border-gray-200 pt-1 text-xs">
                          <span className="font-semibold text-gray-700">Subtotal</span>
                          <span className="font-bold text-gray-900">${subtotal.toFixed(2)}</span>
                        </div>
                        <div className="mt-1.5 flex items-center justify-between gap-2">
                          <label className="text-xs text-gray-600">Tip $</label>
                          <input
                            className={`${inputCls} w-24`}
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                            value={tipDraft[entry.id] ?? ""}
                            onChange={(e) =>
                              setTipDraft((p) => ({ ...p, [entry.id]: e.target.value }))
                            }
                          />
                        </div>
                        <div className="mt-1 flex items-center justify-between text-sm">
                          <span className="font-semibold text-gray-700">Total</span>
                          <span className="font-bold text-emerald-600">
                            ${(subtotal + tip).toFixed(2)}
                          </span>
                        </div>
                        <button
                          type="button"
                          disabled={!cleaner?.phone}
                          onClick={() => textPayment(entry)}
                          className={`mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold text-white ${
                            cleaner?.phone ? "bg-blue-500" : "cursor-not-allowed bg-gray-300"
                          }`}
                        >
                          Text {entry.name.split(" ")[0]}
                        </button>
                        {!cleaner?.phone && (
                          <p className="mt-1 text-center text-[10px] text-gray-400">
                            Add a phone number in Team to text
                          </p>
                        )}
                      </div>
                    );
                  })()}
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
      </div>,
    document.body,
  );
};

export default CleanersModal;
