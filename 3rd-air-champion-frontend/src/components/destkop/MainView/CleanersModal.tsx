import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { addDays, format, startOfToday, startOfWeek } from "date-fns";
import { FaBroom, FaDollarSign, FaRegClock } from "react-icons/fa";
import { dayType } from "../../../util/types/dayType";
import { getRoomColor } from "../../../util/getRoomColor";
import { getCleaningForecast } from "../../../util/cleaningTasks";
import { generateAvatar } from "../../../util/avatarGen";
import { formatPhone } from "../../../util/formatPhone";
import {
  CleanerType,
  CleanerSummaryType,
  CleaningAssignmentType,
  assignCleaner,
  autoPlanCleanings,
  createCleaner,
  deleteCleaner,
  fetchAssignments,
  fetchCleaners,
  fetchCleanerSummary,
  recordCleanerPayment,
  unassignCleaner,
  updateAssignmentHours,
  updateCleaner,
} from "../../../util/cleanerOperations";

interface CleanersModalProps {
  hostId: string;
  token: string;
  monthMap: Map<string, dayType>; // for arriving-guest counts in the schedule SMS
  cleaningRules?: string; // host's private note to the cleaning team (texted, not shown to guests)
  onClose: () => void;
}

const inputCls =
  "rounded-lg border border-gray-200 px-2 py-1.5 text-xs focus:border-gray-400 focus:outline-none";
const pillDark = "rounded-lg bg-gray-900 px-2.5 py-1.5 text-xs font-semibold text-white";
const pillNeutral =
  "rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-700";
const pillEmerald = "rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white";

// Weekday toggles (0=Sun…6=Sat) for a cleaner's available days. Empty = the
// auto-planner infers availability from history instead of enforcing it.
const DAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DayPicker = ({ days, onChange }: { days: number[]; onChange: (d: number[]) => void }) => (
  <div className="flex gap-1">
    {DAY_LETTERS.map((letter, i) => {
      const on = days.includes(i);
      return (
        <button
          key={i}
          type="button"
          title={DAY_NAMES[i]}
          onClick={() =>
            onChange(on ? days.filter((d) => d !== i) : [...days, i].sort((a, b) => a - b))
          }
          className={`h-7 w-7 rounded-full text-[11px] font-bold ${
            on ? "bg-violet-600 text-white" : "bg-gray-100 text-gray-400 hover:bg-gray-200"
          }`}
        >
          {letter}
        </button>
      );
    })}
  </div>
);

// Bright identity colors for cleaner avatars, cycled by roster position
const AVATAR_COLORS = [
  "bg-emerald-100 text-emerald-700",
  "bg-blue-100 text-blue-700",
  "bg-violet-100 text-violet-700",
  "bg-amber-100 text-amber-700",
  "bg-rose-100 text-rose-700",
];
// Solid variants of the same identity colors (Text buttons match avatars)

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

// People report time as hours + minutes, not decimals. These convert between
// the human "3h 15m" and the decimal hours the backend stores.
const hmToDecimal = (h?: string, m?: string) =>
  (parseFloat(h ?? "") || 0) + (parseFloat(m ?? "") || 0) / 60;
const decimalToHm = (dec: number) => {
  const total = Math.round(dec * 60);
  return { h: String(Math.floor(total / 60)), m: String(total % 60) };
};
const formatHrMin = (dec: number) => {
  const total = Math.round(dec * 60);
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
};

// Two small inputs (hours + minutes) — the natural way to record worked time.
const HrMinInput = ({
  hm,
  onChange,
  autoFocus,
}: {
  hm?: { h: string; m: string };
  onChange: (hm: { h: string; m: string }) => void;
  autoFocus?: boolean;
}) => (
  <div className="flex items-center gap-1">
    <input
      className={`${inputCls} w-12`}
      type="number"
      min="0"
      placeholder="0"
      autoFocus={autoFocus}
      value={hm?.h ?? ""}
      onChange={(e) => onChange({ h: e.target.value, m: hm?.m ?? "" })}
    />
    <span className="text-xs text-gray-500">hr</span>
    <input
      className={`${inputCls} w-12`}
      type="number"
      min="0"
      max="59"
      placeholder="0"
      value={hm?.m ?? ""}
      onChange={(e) => onChange({ h: hm?.h ?? "", m: e.target.value })}
    />
    <span className="text-xs text-gray-500">min</span>
  </div>
);

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

const CleanersModal = ({ hostId, token, monthMap, cleaningRules = "", onClose }: CleanersModalProps) => {
  // Self-sufficient: fetches its own data so it can be opened from anywhere
  // (NavBar dropdown or the Upcoming assign popover).
  const [cleaners, setCleaners] = useState<CleanerType[]>([]);
  const [assignments, setAssignments] = useState<CleaningAssignmentType[]>([]);
  const [summary, setSummary] = useState<CleanerSummaryType[]>([]);
  // Pay / Hours / Week / Upcoming / Team tabs — everything in one scroll was overcrowded
  const [activeTab, setActiveTab] = useState<
    "roster" | "hours" | "pay" | "week" | "upcoming"
  >("pay");
  // Upcoming tab: tapping a forecast room chip opens this assign-cleaner popover
  const [assignTarget, setAssignTarget] = useState<{
    morningKey: string;
    roomId: string;
    roomName: string;
    sameDay: boolean;
  } | null>(null);
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

  const [newCleaner, setNewCleaner] = useState({
    name: "",
    phone: "",
    payRate: "",
    character: "",
    availableDays: [] as number[],
  });
  // Add form hidden behind a button at the end of the roster
  const [addOpen, setAddOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  // Which cleaner's "Message" menu is open on the Team tab (one home for every
  // text we send a cleaner — schedule, earnings, cleaning rules, and future ones)
  const [msgMenuId, setMsgMenuId] = useState<string | null>(null);
  // Which cleaners' recorded-days accordions are expanded (Hours tab). Collapsed
  // by default so 5 cleaners × 15–20 records stays a short, scannable list.
  const [expandedRecord, setExpandedRecord] = useState<Set<string>>(new Set());
  const [edit, setEdit] = useState({
    name: "",
    phone: "",
    payRate: "",
    baselineHours: "",
    character: "",
    availableDays: [] as number[],
    paused: false,
  });
  const [hmDraft, setHmDraft] = useState<Record<string, { h: string; m: string }>>({});
  // Which already-recorded cleaner-day is currently open for correction
  const [editingDayKey, setEditingDayKey] = useState<string | null>(null);
  // Some cleaners report a decimal total, others report arrival/leave times.
  // Per-card mode; In–Out computes the total we save (backend still stores hrs).
  const [hoursMode, setHoursMode] = useState<Record<string, "total" | "inout">>({});
  const [timeDraft, setTimeDraft] = useState<Record<string, { in: string; out: string }>>({});
  // Pay tab: tapping a cleaner row opens a focused detail modal holding the
  // breakdown, tip, text, and payout/undo controls — keeps the list itself
  // clean no matter how many recorded days a cleaner has.
  const [detailId, setDetailId] = useState<string | null>(null);
  const [tipDraft, setTipDraft] = useState<Record<string, string>>({});
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

  // Fixed Monday of this/next week. The Team-tab Message menu offers both
  // explicitly, so a schedule text never depends on which week the Week tab
  // happens to be showing — each item spells out its own dates.
  const thisMonday = startOfWeek(startOfToday(), { weekStartsOn: 1 });
  const nextMonday = addDays(thisMonday, 7);
  const weekAssignmentCount = (cleanerId: string, monday: Date) => {
    const d0 = format(monday, "yyyy-MM-dd");
    const d6 = format(addDays(monday, 6), "yyyy-MM-dd");
    return assignments.filter(
      (a) => a.cleaner?.id === cleanerId && a.room && a.date >= d0 && a.date <= d6,
    ).length;
  };

  // The cleaner whose focused Message screen is open. When set, the Team tab
  // takes over to show ONLY this person — so a text can never be aimed at the
  // wrong cleaner by mistake.
  const msgCleaner = msgMenuId ? cleaners.find((c) => c.id === msgMenuId) ?? null : null;

  // One consistent initials-avatar color per team member across EVERY view
  // (keyed by their position in the team), so a person looks the same
  // everywhere — Team, Message, records, Hours, Pay.
  const avatarClass = (id: string) =>
    AVATAR_COLORS[Math.max(0, cleaners.findIndex((c) => c.id === id)) % AVATAR_COLORS.length];

  // The owner photos already shipped in the app — used automatically for these
  // two, so they need no setup.
  const builtInPhoto = (name: string) => {
    const n = name.trim().toLowerCase();
    if (n.startsWith("anh-tuan") || n.startsWith("anh tuan") || n === "tuan") return "Anh-Tuan.jpg";
    if (n.startsWith("cindy")) return "Cindy.jpg";
    return "";
  };

  // One avatar for a team member everywhere: an explicit photo (owner jpg) wins,
  // else the illustrated avatar generated from their "character" note, else the
  // colored initials fallback. Looks the person up in `cleaners` for freshness.
  const CleanerAvatar = ({
    id,
    name,
    sizeClass = "h-8 w-8",
    textClass = "text-xs",
  }: {
    id: string;
    name: string;
    sizeClass?: string;
    textClass?: string;
  }) => {
    const c = cleaners.find((x) => x.id === id);
    const photo = c?.photo || builtInPhoto(name);
    if (photo)
      return <img src={photo} alt={name} className={`${sizeClass} shrink-0 rounded-full object-cover`} />;
    if (c?.character)
      return (
        <img
          src={generateAvatar(name, c.character)}
          alt={name}
          className={`${sizeClass} shrink-0 rounded-full object-cover`}
        />
      );
    return (
      <span
        className={`flex ${sizeClass} shrink-0 items-center justify-center rounded-full font-bold ${textClass} ${avatarClass(id)}`}
      >
        {initials(name)}
      </span>
    );
  };

  // Upcoming tab — the rolling 7-morning cleaning forecast (migrated from the
  // ToDo modal). Assignments/cleaners/monthMap already live here.
  const cleaningForecast = getCleaningForecast(monthMap);
  const forecastTotal = cleaningForecast.reduce((sum, d) => sum + d.entries.length, 0);
  const assignmentFor = (morningKey: string, roomId: string) =>
    assignments.find((a) => a.date === morningKey && a.room?.id === roomId);
  // Who cleans how many rooms across the forecast — the workload overview
  const weekTotals = (() => {
    const totals = new Map<string, number>();
    let unassignedCount = 0;
    cleaningForecast.forEach((day) =>
      day.entries.forEach((e) => {
        const a = assignmentFor(day.morningKey, e.checkoutBooking.room.id);
        if (a?.cleaner) totals.set(a.cleaner.name, (totals.get(a.cleaner.name) ?? 0) + 1);
        else unassignedCount++;
      }),
    );
    return { assigned: [...totals.entries()].sort((x, y) => y[1] - x[1]), unassignedCount };
  })();

  // Every unassigned room across the 7-morning forecast — the auto-planner's
  // targets. Existing assignments are left untouched.
  const unassignedTargets = () => {
    const targets: { date: string; room: string }[] = [];
    cleaningForecast.forEach((day) =>
      day.entries.forEach((e) => {
        const a = assignmentFor(day.morningKey, e.checkoutBooking.room.id);
        if (!a?.cleaner) targets.push({ date: day.morningKey, room: e.checkoutBooking.room.id });
      }),
    );
    return targets;
  };

  const [autoPlanning, setAutoPlanning] = useState(false);
  const handleAutoPlan = () => {
    const targets = unassignedTargets();
    if (targets.length === 0 || autoPlanning) return;
    setAutoPlanning(true);
    autoPlanCleanings({ host: hostId, targets }, token)
      .then((created) => {
        // Merge the drafted assignments in; you reassign any from here.
        setAssignments((prev) => [
          ...prev.filter(
            (a) => !created.some((c) => c.date === a.date && c.room?.id === a.room?.id),
          ),
          ...created,
        ]);
        reloadSummary();
      })
      .catch((err) =>
        setError(err.response?.data?.error ?? "Could not auto-plan — please try again"),
      )
      .finally(() => setAutoPlanning(false));
  };

  const handleAssign = (cleaner: CleanerType) => {
    if (!assignTarget) return;
    assignCleaner(
      { host: hostId, date: assignTarget.morningKey, room: assignTarget.roomId, cleaner: cleaner.id },
      token,
    )
      .then((created) => {
        setAssignments((prev) => [
          ...prev.filter((a) => !(a.date === created.date && a.room?.id === created.room?.id)),
          created,
        ]);
        setAssignTarget(null);
      })
      .catch((err) => console.error("Error assigning cleaner:", err));
  };

  const handleUnassign = () => {
    if (!assignTarget) return;
    unassignCleaner(
      { host: hostId, date: assignTarget.morningKey, room: assignTarget.roomId },
      token,
    )
      .then(() => {
        setAssignments((prev) =>
          prev.filter(
            (a) => !(a.date === assignTarget.morningKey && a.room?.id === assignTarget.roomId),
          ),
        );
        setAssignTarget(null);
      })
      .catch((err) => console.error("Error removing assignment:", err));
  };

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
    // Group by cleaner (so all of Henry's days sit together, then Thalia's),
    // then most-recent-first within each cleaner.
    return [...map.values()].sort(
      (a, b) =>
        a.cleaner.name.localeCompare(b.cleaner.name) || b.date.localeCompare(a.date),
    );
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
        character: newCleaner.character.trim(),
        availableDays: newCleaner.availableDays,
      },
      token,
    )
      .then((created) => {
        setCleaners((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
        setNewCleaner({ name: "", phone: "", payRate: "", character: "", availableDays: [] });
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
        character: edit.character.trim(),
        availableDays: edit.availableDays,
        paused: edit.paused,
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
    if (mode !== "inout") {
      // Blank hr AND blank min = nothing typed → do nothing (not a "0 = clear")
      const { h = "", m = "" } = hmDraft[group.key] ?? {};
      if (h.trim() === "" && m.trim() === "") return;
    }
    const hours =
      mode === "inout"
        ? hoursBetween(timeDraft[group.key]?.in, timeDraft[group.key]?.out)
        : hmToDecimal(hmDraft[group.key]?.h, hmDraft[group.key]?.m);
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
        setHmDraft((p) => {
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
  const textSchedule = (cleaner: CleanerType, monday: Date) => {
    if (!cleaner.phone) return;
    const d0 = format(monday, "yyyy-MM-dd");
    const d6 = format(addDays(monday, 6), "yyyy-MM-dd");
    const mine = assignments
      .filter(
        (a) => a.cleaner?.id === cleaner.id && a.room && a.date >= d0 && a.date <= d6,
      )
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
    const weekLabel = `${format(monday, "MMM d")} – ${format(addDays(monday, 6), "MMM d")}`;
    const message = `Hi ${cleaner.name}, your cleaning schedule for ${weekLabel}:\n${lines.join("\n")}\n(numbers = guests arriving)\n\nThank you for your wonderful work! Together, we work hard so our guests always feel comfortable — that is TT House's promise to every guest:\n"Your comfort. Our mission." 🏠 — Anh-Tuan`;
    window.location.href = `sms:${cleaner.phone}?&body=${encodeURIComponent(message)}`;
  };

  // A standing quality reminder (comforter/pillow covers laundered, etc.) the
  // host keeps in Settings → My AirBnB. Not tied to any week — sendable anytime.
  const textCleaningRules = (cleaner: CleanerType) => {
    if (!cleaner.phone || !cleaningRules.trim()) return;
    const message = `Hi ${cleaner.name}, a quick cleaning reminder for TT House:\n\n${cleaningRules.trim()}\n\nThank you for keeping every room guest-ready — that is TT House's promise to every guest:\n"Your comfort. Our mission." 🏠 — Anh-Tuan`;
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

  // Texted progress statement (NOT a payout notice): this month's dates × hours
  // × rate so the cleaner can see their hours and earnings so far. Any tip is
  // shown as an added bonus when present.
  const textPayment = (entry: CleanerSummaryType) => {
    const cleaner = cleaners.find((c) => c.id === entry.id);
    if (!cleaner?.phone) return;
    const rate = cleaner.payRate;
    const days = cleanerDayHours(entry.id);
    const tip = parseFloat(tipDraft[entry.id]) || 0;
    const lines = days.map(
      ([date, hrs]) =>
        `* ${format(new Date(date + "T00:00:00"), "EEE M/d")}: ${formatHrMin(hrs)} = $${(hrs * rate).toFixed(2)}`,
    );
    const subtotal = days.reduce((s, [, h]) => s + h * rate, 0);
    const totalHrs = days.reduce((s, [, h]) => s + h, 0);
    const monthLabel = format(startOfToday(), "MMMM");
    const body = [
      `Hi ${cleaner.name}, here's your cleaning summary so far:`,
      // Recent detail (this month's recorded days)
      ...(lines.length
        ? ["", `This month (${monthLabel}) — ${formatHrMin(totalHrs)}, $${subtotal.toFixed(2)}:`, ...lines]
        : []),
      "",
      // Running totals — the number a cleaner saving toward a target watches
      `Earned so far: $${Math.round(entry.earned).toLocaleString()} (${formatHrMin(entry.hours)})${entry.paid > 0 ? ` · Paid: $${Math.round(entry.paid).toLocaleString()}` : ""}`,
      `Ready to pay whenever you'd like: $${Math.round(entry.balance).toLocaleString()}`,
      ...(tip > 0 ? [`(+ $${tip.toFixed(2)} tip at payout)`] : []),
      "",
      `Thank you for your wonderful work! Together, we work hard so our guests always feel comfortable — that is TT House's promise to every guest:`,
      `"Your comfort. Our mission." 🏠 — Anh-Tuan`,
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
        // Stay in the detail modal so the host sees the updated balance; just
        // reset the input and disarm the confirm.
        setPayConfirmArmed(false);
        setPayDraft("");
        setError("");
        reloadSummary();
      })
      .catch((err) => setError(err.response?.data?.error ?? "Could not record payment"));
  };

  // The cleaner whose focused pay detail modal is open (fresh from summary so
  // the balance reflects payouts recorded while the modal stays open).
  const detailEntry = detailId ? summary.find((s) => s.id === detailId) ?? null : null;
  const closeDetail = () => {
    setDetailId(null);
    setPayConfirmArmed(false);
    setPayDraft("");
    setPayMode("payout");
  };

  return createPortal(
    <>
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

        <div className="mx-4 mb-2 grid shrink-0 grid-cols-5 gap-1 rounded-xl bg-gray-100 p-1">
          {(
            [
              { key: "pay", label: "Pay", count: summary.filter((s) => s.balance > 0.5).length },
              { key: "hours", label: "Hours", count: needHoursGroups.length },
              { key: "week", label: "Week", count: weekAssignments.length },
              { key: "upcoming", label: "Plan", count: forecastTotal },
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

          {/* Focused, single-cleaner message screen — takes over the whole Team
              panel so ONLY the chosen cleaner is on screen while you pick what to
              send. Simple and centralized: one cleaner, one place, no mix-ups. */}
          {activeTab === "roster" && msgCleaner && (
            <div>
              <button
                type="button"
                onClick={() => setMsgMenuId(null)}
                className="mb-3 flex items-center gap-1 text-xs font-semibold text-gray-500 hover:text-gray-700"
              >
                ‹ Back to team
              </button>

              <div className="mb-3 flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 p-3">
                <CleanerAvatar
                  id={msgCleaner.id}
                  name={msgCleaner.name}
                  sizeClass="h-11 w-11"
                  textClass="text-base"
                />
                <div className="min-w-0">
                  <p className="truncate text-base font-bold text-gray-900">{msgCleaner.name}</p>
                  <p className="text-xs text-gray-500">
                    {msgCleaner.phone ? formatPhone(msgCleaner.phone) : "No phone number"}
                  </p>
                </div>
              </div>

              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                Choose a message to send {msgCleaner.name.split(" ")[0]}
              </p>

              {(() => {
                const cleaner = msgCleaner;
                const entry = summary.find((s) => s.id === cleaner.id);
                const thisCount = weekAssignmentCount(cleaner.id, thisMonday);
                const nextCount = weekAssignmentCount(cleaner.id, nextMonday);
                // Each item gets a distinct icon + color. The two schedules are
                // the easy-to-confuse pair, so they wear clearly different colors
                // (this week = blue, next week = violet) not just different words.
                const items = [
                  {
                    key: "rules",
                    icon: "🧹",
                    tint: "bg-emerald-100 text-emerald-700",
                    labelColor: "text-gray-900",
                    accent: "text-emerald-600",
                    label: "Cleaning rules",
                    sub: cleaningRules.trim()
                      ? "Standing quality reminder"
                      : "Set it in My AirBnB → Property first",
                    disabled: !cleaningRules.trim(),
                    run: () => textCleaningRules(cleaner),
                  },
                  {
                    key: "week",
                    icon: "📅",
                    tint: "bg-blue-100 text-blue-700",
                    labelColor: "text-blue-700",
                    accent: "text-blue-600",
                    label: "This week's schedule",
                    sub: `${format(thisMonday, "MMM d")} – ${format(addDays(thisMonday, 6), "MMM d")} · ${thisCount} room${thisCount === 1 ? "" : "s"}`,
                    disabled: thisCount === 0,
                    run: () => textSchedule(cleaner, thisMonday),
                  },
                  {
                    key: "next",
                    icon: "⏭️",
                    tint: "bg-violet-100 text-violet-700",
                    labelColor: "text-violet-700",
                    accent: "text-violet-600",
                    label: "Next week's schedule",
                    sub: `${format(nextMonday, "MMM d")} – ${format(addDays(nextMonday, 6), "MMM d")} · ${nextCount} room${nextCount === 1 ? "" : "s"}`,
                    disabled: nextCount === 0,
                    run: () => textSchedule(cleaner, nextMonday),
                  },
                  {
                    key: "earn",
                    icon: "💵",
                    tint: "bg-amber-100 text-amber-700",
                    labelColor: "text-gray-900",
                    accent: "text-amber-600",
                    label: "Earnings so far",
                    sub: entry
                      ? `Balance $${Math.round(entry.balance).toLocaleString()}`
                      : "No hours recorded yet",
                    disabled: !entry,
                    run: () => entry && textPayment(entry),
                  },
                ];
                return (
                  <div className="flex flex-col gap-2">
                    {items.map((it) => (
                      <button
                        key={it.key}
                        type="button"
                        disabled={it.disabled}
                        onClick={() => {
                          it.run();
                          setMsgMenuId(null);
                        }}
                        className={`flex items-center justify-between gap-2 rounded-xl border px-3.5 py-3 text-left ${
                          it.disabled
                            ? "cursor-not-allowed border-gray-100 bg-gray-50 opacity-60"
                            : "border-gray-200 bg-white hover:border-gray-300"
                        }`}
                      >
                        <span className="flex min-w-0 items-center gap-3">
                          <span
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-base ${it.tint}`}
                          >
                            {it.icon}
                          </span>
                          <span className="min-w-0">
                            <span className={`block text-sm font-semibold ${it.labelColor}`}>
                              {it.label}
                            </span>
                            <span className="block truncate text-[11px] text-gray-400">
                              {it.sub}
                            </span>
                          </span>
                        </span>
                        {!it.disabled && (
                          <span className={`shrink-0 text-xs font-semibold ${it.accent}`}>
                            Text ›
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                );
              })()}
            </div>
          )}
          {activeTab === "roster" && !msgCleaner && (
          <>
          {/* Roster */}
          {cleaners.length === 0 && !addOpen && (
            <p className="py-4 text-center text-sm text-gray-400">No cleaners yet — add one below</p>
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
                {/* Character note → live-generated avatar preview */}
                <div className="mb-1.5 flex items-center gap-2">
                  <img
                    src={generateAvatar(edit.name || "?", edit.character)}
                    alt="avatar preview"
                    className="h-9 w-9 shrink-0 rounded-full object-cover"
                  />
                  <input
                    className={`${inputCls} min-w-0 flex-1`}
                    placeholder="Avatar note — e.g. glasses, long brown hair, beard"
                    value={edit.character}
                    onChange={(e) => setEdit((p) => ({ ...p, character: e.target.value }))}
                  />
                </div>
                {/* Available days — a hard constraint for the auto-planner when set */}
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <label className="text-xs text-gray-500">
                    Available days
                    <span className="block text-[10px] text-gray-400">blank = auto from history</span>
                  </label>
                  <DayPicker
                    days={edit.availableDays}
                    onChange={(d) => setEdit((p) => ({ ...p, availableDays: d }))}
                  />
                </div>
                {/* On leave — kept on the team but skipped by the auto-planner */}
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <label className="text-xs text-gray-500">
                    On leave
                    <span className="block text-[10px] text-gray-400">skip in auto-plan while away</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setEdit((p) => ({ ...p, paused: !p.paused }))}
                    className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                      edit.paused ? "bg-amber-500" : "bg-gray-300"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                        edit.paused ? "translate-x-5" : "translate-x-0.5"
                      }`}
                    />
                  </button>
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
                <CleanerAvatar id={cleaner.id} name={cleaner.name} />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 truncate text-sm font-semibold text-gray-900">
                    {cleaner.name}
                    {cleaner.paused && (
                      <span className="shrink-0 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-amber-700">
                        On leave
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-gray-500">
                    {cleaner.phone && <span>{formatPhone(cleaner.phone)} · </span>}
                    <span className="font-bold text-emerald-600">${cleaner.payRate}/hr</span>
                  </p>
                </div>
                {/* One home for every message we send a cleaner — schedule,
                    earnings, cleaning rules — so no single-purpose button ever
                    reads like TiMag is imposing something on the cleaner */}
                <button
                  type="button"
                  className={`${pillNeutral} ${!cleaner.phone ? "opacity-40" : ""}`}
                  disabled={!cleaner.phone}
                  title={cleaner.phone ? "Message this cleaner" : "Add a phone number to text"}
                  onClick={() => {
                    setSwipeOpenId(null);
                    setMsgMenuId(cleaner.id);
                  }}
                >
                  💬 Message
                </button>
                <button
                  type="button"
                  className={pillNeutral}
                  onClick={() => {
                    setEditingId(cleaner.id);
                    setEdit({
                      name: cleaner.name,
                      phone: cleaner.phone,
                      payRate: String(cleaner.payRate),
                      character: cleaner.character ?? "",
                      availableDays: cleaner.availableDays ?? [],
                      paused: cleaner.paused ?? false,
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
              {/* Character note → live-generated avatar preview */}
              <div className="mt-1.5 flex items-center gap-2">
                <img
                  src={generateAvatar(newCleaner.name || "New", newCleaner.character)}
                  alt="avatar preview"
                  className="h-9 w-9 shrink-0 rounded-full object-cover"
                />
                <input
                  className={`${inputCls} min-w-0 flex-1`}
                  placeholder="Describe them for an avatar — e.g. cheerful 24yo, glasses, short black hair"
                  value={newCleaner.character}
                  onChange={(e) => setNewCleaner((p) => ({ ...p, character: e.target.value }))}
                />
              </div>
              {/* Available days — a hard constraint for the auto-planner when set */}
              <div className="mt-1.5 flex items-center justify-between gap-2">
                <label className="text-xs text-gray-500">
                  Available days
                  <span className="block text-[10px] text-gray-400">blank = auto from history</span>
                </label>
                <DayPicker
                  days={newCleaner.availableDays}
                  onChange={(d) => setNewCleaner((p) => ({ ...p, availableDays: d }))}
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
            const isToday = dateKey === todayKey;
            const groups = new Map<string, { cleaner: CleanerType; rooms: { id: string; name: string }[] }>();
            dayAssignments.forEach((a) => {
              const g = groups.get(a.cleaner!.id) ?? { cleaner: a.cleaner!, rooms: [] };
              g.rooms.push(a.room!);
              groups.set(a.cleaner!.id, g);
            });
            return (
              <div
                key={dateKey}
                className={`mb-2 overflow-hidden rounded-xl border bg-white ${
                  isToday
                    ? "border-violet-400 shadow-sm ring-1 ring-violet-300"
                    : dayAssignments.length
                      ? "border-gray-300 shadow-sm"
                      : "border-gray-200"
                }`}
              >
                {/* Day header — date, Today badge, and the room count */}
                <div
                  className={`flex items-center justify-between px-3 py-1.5 ${
                    dayAssignments.length ? "border-b" : ""
                  } ${isToday ? "border-violet-100 bg-violet-50" : "border-gray-100 bg-gray-50"}`}
                >
                  <div className="flex items-baseline gap-1.5">
                    <span
                      className={`text-[11px] font-bold uppercase tracking-wide ${
                        isToday ? "text-violet-500" : "text-gray-400"
                      }`}
                    >
                      {format(dayDate, "EEE")}
                    </span>
                    <span className="text-sm font-bold text-gray-900">{format(dayDate, "MMM d")}</span>
                    {isToday && (
                      <span className="rounded-full bg-violet-600 px-1.5 py-0.5 text-[9px] font-bold uppercase leading-none text-white">
                        Today
                      </span>
                    )}
                  </div>
                  <span className="text-xs font-semibold text-gray-400">
                    {dayAssignments.length
                      ? `${dayAssignments.length} room${dayAssignments.length === 1 ? "" : "s"}`
                      : "no cleanings"}
                  </span>
                </div>
                {/* One aligned row per cleaner (avatar + fixed-width name → chips line up) */}
                {dayAssignments.length > 0 && (
                  <div className="divide-y divide-gray-100">
                    {[...groups.values()].map(({ cleaner, rooms }) => (
                      <div key={cleaner.id} className="flex items-center gap-2 px-3 py-1.5">
                        <div className="flex w-24 shrink-0 items-center gap-1.5">
                          <CleanerAvatar
                            id={cleaner.id}
                            name={cleaner.name}
                            sizeClass="h-6 w-6"
                            textClass="text-[10px]"
                          />
                          <span className="truncate text-xs font-semibold text-gray-700">
                            {cleaner.name.split(" ")[0]}
                          </span>
                        </div>
                        <div className="flex flex-1 flex-wrap items-center gap-1">
                          {rooms.map((room, i) => {
                            // Same headcount the SMS carries — beds/towels to prep
                            const count = nextGuestCount(room.id, dateKey);
                            return (
                              <span
                                key={`${room.id}-${i}`}
                                className={`${getRoomColor(room.name, roomColorById.get(room.id))} rounded-md px-2 py-1 text-[11px] font-semibold text-black shadow-sm`}
                              >
                                {room.name}
                                {count ? ` (${count})` : ""}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {/* Texting a schedule now lives in the Team tab's per-cleaner Message
              menu (this week + next week offered by explicit dates), so every
              cleaner text — schedule, earnings, cleaning rules — has one home. */}
          <p className="mt-2 text-center text-xs text-gray-400">
            {weekAssignments.length === 0
              ? "Assign rooms in the Plan tab — they land here by date"
              : "To text this schedule, open a cleaner's 💬 Message menu in the Team tab"}
          </p>
          </>
          )}

          {activeTab === "upcoming" && (
          <>
          <SectionHeader
            icon={<FaRegClock className="text-violet-500" />}
            title="Upcoming — next 7 mornings"
            hint="Probable cleanings by day · tap a room to assign a cleaner"
          />
          {cleaningForecast.length === 0 ? (
            <p className="mb-2 rounded-xl border border-gray-200 bg-gray-50 p-2.5 text-center text-xs text-gray-400">
              No checkouts in the next 7 days
            </p>
          ) : (
            <>
              {(weekTotals.assigned.length > 0 || weekTotals.unassignedCount > 0) && (
                <div className="mb-2 flex flex-wrap items-center justify-center gap-1.5">
                  {weekTotals.assigned.map(([name, count]) => {
                    const cl = cleaners.find((c) => c.name === name);
                    return (
                      <span
                        key={name}
                        className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white py-0.5 pl-0.5 pr-2 text-xs font-semibold text-gray-700"
                      >
                        {cl && <CleanerAvatar id={cl.id} name={name} sizeClass="h-5 w-5" textClass="text-[9px]" />}
                        {name.split(" ")[0]}
                        <span className="rounded-full bg-gray-900 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                          {count}
                        </span>
                      </span>
                    );
                  })}
                  {weekTotals.unassignedCount > 0 && (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">
                      Unassigned
                      <span className="rounded-full bg-amber-600 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                        {weekTotals.unassignedCount}
                      </span>
                    </span>
                  )}
                </div>
              )}

              {/* Auto-plan: fill every open room with the cleaner history suggests
                  (frequency + recency + weekday, balanced). You reassign any you'd
                  change — and that feedback sharpens the next draft. */}
              {weekTotals.unassignedCount > 0 && (
                <button
                  type="button"
                  onClick={handleAutoPlan}
                  disabled={autoPlanning}
                  className="mb-2 flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-violet-700 disabled:opacity-60"
                >
                  {autoPlanning
                    ? "Planning…"
                    : `✨ Auto-plan ${weekTotals.unassignedCount} open room${weekTotals.unassignedCount === 1 ? "" : "s"}`}
                </button>
              )}

              {cleaningForecast.map((day) => {
                const morning = new Date(day.morningKey + "T00:00:00");
                const isToday = day.morningKey === format(startOfToday(), "yyyy-MM-dd");
                const groups = new Map<string, { cleaner: CleanerType; entries: typeof day.entries }>();
                const unassigned: typeof day.entries = [];
                day.entries.forEach((entry) => {
                  const a = assignmentFor(day.morningKey, entry.checkoutBooking.room.id);
                  if (a?.cleaner) {
                    const g = groups.get(a.cleaner.id) ?? { cleaner: a.cleaner, entries: [] };
                    g.entries.push(entry);
                    groups.set(a.cleaner.id, g);
                  } else unassigned.push(entry);
                });
                const chip = (entry: (typeof day.entries)[number], i: number) => (
                  <button
                    key={`${entry.checkoutBooking.room.id}-${i}`}
                    type="button"
                    onClick={() =>
                      setAssignTarget({
                        morningKey: day.morningKey,
                        roomId: entry.checkoutBooking.room.id,
                        roomName: entry.checkoutBooking.room.name,
                        sameDay: entry.sameDayCheckIn != null,
                      })
                    }
                    className={`${getRoomColor(entry.checkoutBooking.room.name, entry.checkoutBooking.room.color)} rounded-md px-2 py-1 text-[11px] font-semibold text-black shadow-sm transition-transform hover:scale-105 ${
                      entry.probable
                        ? "outline-2 outline-dashed outline-red-500"
                        : entry.sameDayCheckIn
                          ? "ring-2 ring-red-500"
                          : ""
                    }`}
                  >
                    {entry.checkoutBooking.room.name}
                    {(() => {
                      const count =
                        entry.sameDayCheckIn?.numberOfGuests ||
                        nextGuestCount(entry.checkoutBooking.room.id, day.morningKey);
                      return count ? ` (${count})` : "";
                    })()}
                    {entry.rebookOdds < 0.995 && (
                      <span className="ml-1 opacity-70">{Math.round(entry.rebookOdds * 100)}%</span>
                    )}
                  </button>
                );
                return (
                  <div
                    key={day.morningKey}
                    className={`mb-3 overflow-hidden rounded-xl border bg-white shadow-sm ${
                      isToday ? "border-violet-400 ring-1 ring-violet-300" : "border-gray-300"
                    }`}
                  >
                    {/* Day header — the date, room count, and a nudge if any need a cleaner */}
                    <div
                      className={`flex items-center justify-between border-b px-3 py-1.5 ${
                        isToday ? "border-violet-100 bg-violet-50" : "border-gray-100 bg-gray-50"
                      }`}
                    >
                      <div className="flex items-baseline gap-1.5">
                        <span
                          className={`text-[11px] font-bold uppercase tracking-wide ${
                            isToday ? "text-violet-500" : "text-gray-400"
                          }`}
                        >
                          {format(morning, "EEE")}
                        </span>
                        <span className="text-sm font-bold text-gray-900">
                          {format(morning, "MMM d")}
                        </span>
                        {isToday && (
                          <span className="rounded-full bg-violet-600 px-1.5 py-0.5 text-[9px] font-bold uppercase leading-none text-white">
                            Today
                          </span>
                        )}
                      </div>
                      <span className="text-xs font-semibold text-gray-400">
                        {day.entries.length} room{day.entries.length === 1 ? "" : "s"}
                        {unassigned.length > 0 && (
                          <span className="text-amber-600"> · {unassigned.length} to assign</span>
                        )}
                      </span>
                    </div>
                    {/* One aligned row per cleaner (avatar + fixed-width name → chips line
                        up), unassigned rooms called out in amber at the bottom */}
                    <div className="divide-y divide-gray-100">
                      {[...groups.values()].map(({ cleaner, entries }) => (
                        <div key={cleaner.id} className="flex items-center gap-2 px-3 py-1.5">
                          <div className="flex w-24 shrink-0 items-center gap-1.5">
                            <CleanerAvatar
                              id={cleaner.id}
                              name={cleaner.name}
                              sizeClass="h-6 w-6"
                              textClass="text-[10px]"
                            />
                            <span className="truncate text-xs font-semibold text-gray-700">
                              {cleaner.name.split(" ")[0]}
                            </span>
                          </div>
                          <div className="flex flex-1 flex-wrap items-center gap-1">
                            {entries.map(chip)}
                          </div>
                        </div>
                      ))}
                      {unassigned.length > 0 && (
                        <div className="flex items-center gap-2 bg-amber-50/50 px-3 py-1.5">
                          <div className="flex w-24 shrink-0 items-center gap-1.5">
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-100 text-xs font-bold text-amber-600">
                              !
                            </span>
                            <span className="truncate text-xs font-semibold text-amber-600">
                              Unassigned
                            </span>
                          </div>
                          <div className="flex flex-1 flex-wrap items-center gap-1">
                            {unassigned.map(chip)}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              <p className="mb-1 mt-2 text-center text-xs text-gray-400">
                % = odds · <span className="font-semibold text-red-500">solid red</span> = confirmed
                same-day check-in · <span className="font-semibold text-red-500">dashed red</span> =
                empty night likely sells last-minute (odds shown) · tap to assign a cleaner
              </p>
            </>
          )}
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
                  <CleanerAvatar id={group.cleaner.id} name={group.cleaner.name} />
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
                <div className="mt-2 flex items-center gap-1.5">
                  <div className="flex flex-1 flex-wrap items-center gap-1.5">
                  {(hoursMode[group.key] ?? "total") === "total" ? (
                    <HrMinInput
                      hm={hmDraft[group.key]}
                      onChange={(hm) => setHmDraft((p) => ({ ...p, [group.key]: hm }))}
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
                          = {formatHrMin(hoursBetween(timeDraft[group.key]?.in, timeDraft[group.key]?.out)!)}
                        </span>
                      )}
                    </>
                  )}
                  </div>
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
              {(() => {
                // Roll the already-sorted cleaner-days up per cleaner. Each
                // cleaner is one collapsed row (name + day count + total hours);
                // tap to reveal their days. Keeps the list short with many records.
                const byCleaner = new Map<
                  string,
                  { cleaner: CleanerType; days: typeof recordedGroups; totalHours: number }
                >();
                recordedGroups.forEach((g) => {
                  const cur =
                    byCleaner.get(g.cleaner.id) ?? { cleaner: g.cleaner, days: [], totalHours: 0 };
                  cur.days.push(g);
                  cur.totalHours += g.hours;
                  byCleaner.set(g.cleaner.id, cur);
                });
                return [...byCleaner.values()].map(({ cleaner, days, totalHours }) => {
                  const open = expandedRecord.has(cleaner.id);
                  return (
                    <div
                      key={cleaner.id}
                      className="mb-1.5 overflow-hidden rounded-xl border border-gray-200"
                    >
                      {/* Collapsed header — tap to expand this cleaner's days */}
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedRecord((prev) => {
                            const next = new Set(prev);
                            if (next.has(cleaner.id)) next.delete(cleaner.id);
                            else next.add(cleaner.id);
                            return next;
                          })
                        }
                        className="flex w-full items-center gap-2 p-2.5 text-left"
                      >
                        <CleanerAvatar id={cleaner.id} name={cleaner.name} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-gray-900">
                            {cleaner.name}
                          </p>
                          <p className="text-xs text-gray-500">
                            {days.length} day{days.length === 1 ? "" : "s"} ·{" "}
                            {formatHrMin(totalHours)}
                          </p>
                        </div>
                        <span className="shrink-0 text-xs text-gray-400">{open ? "▲" : "▼"}</span>
                      </button>
                      {open && (
                        <div className="space-y-1.5 border-t border-gray-100 p-2">
                          {days.map((group) => (
                            <div
                              key={group.key}
                              className="flex items-center gap-2 rounded-lg bg-gray-50 p-2"
                            >
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-xs text-gray-600">
                                  {format(new Date(group.date + "T00:00:00"), "EEE M/d")} ·{" "}
                                  {group.assignments.map((a) => a.room?.name).join(", ")}
                                </p>
                              </div>
                              {editingDayKey === group.key ? (
                                <>
                                  <HrMinInput
                                    autoFocus
                                    hm={hmDraft[group.key]}
                                    onChange={(hm) =>
                                      setHmDraft((p) => ({ ...p, [group.key]: hm }))
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
                                    {formatHrMin(group.hours)}
                                  </span>
                                  <button
                                    type="button"
                                    className={pillNeutral}
                                    onClick={() => {
                                      setEditingDayKey(group.key);
                                      setHmDraft((p) => ({
                                        ...p,
                                        [group.key]: decimalToHm(group.hours),
                                      }));
                                    }}
                                  >
                                    Edit
                                  </button>
                                </>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                });
              })()}
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
            hint="Owed = earned − paid. Tap a cleaner to pay, tip, or text a breakdown"
          />
          {/* What the host actually acts on: how much is owed right now, and
              this month's cost for budgeting — not a vanity lifetime total */}
          {summary.length > 0 &&
            (() => {
              const owed = summary.reduce((s, c) => s + c.balance, 0);
              const owingCount = summary.filter((s) => s.balance > 0.5).length;
              const thisMonthCost = [...monthlyPay.values()].reduce((s, e) => s + e.pay, 0);
              return (
                <div className="mb-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                  {/* Hero number = this month's cleaning cost — the figure the
                      owners actually watch. Owed-now is the context line. */}
                  <div className="flex items-baseline justify-between">
                    <p className="text-xs font-semibold text-emerald-700">
                      Cleaning cost — {format(startOfToday(), "MMMM")}
                    </p>
                    <p className="text-2xl font-bold text-emerald-700">
                      ${Math.round(thisMonthCost).toLocaleString()}
                    </p>
                  </div>
                  <p className="mt-0.5 text-xs text-emerald-600">
                    {owingCount > 0
                      ? `$${Math.round(owed).toLocaleString()} owed now · ${owingCount} cleaner${owingCount === 1 ? "" : "s"} waiting`
                      : "all settled up 🎉"}
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
              <button
                key={entry.id}
                type="button"
                onClick={() => {
                  setDetailId(entry.id);
                  setPayMode("payout");
                  setPayConfirmArmed(false);
                  setPayDraft(
                    entry.balance > 0.5 ? String(Math.round(entry.balance * 100) / 100) : "",
                  );
                }}
                className="mb-1.5 flex w-full items-center gap-2 rounded-xl border border-gray-200 p-2.5 text-left transition-colors hover:bg-gray-50"
              >
                <CleanerAvatar id={entry.id} name={entry.name} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-gray-900">{entry.name}</p>
                  <p className="text-xs text-gray-500">
                    {formatHrMin(entry.hours)} · earned ${Math.round(entry.earned).toLocaleString()} · paid $
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
                <span className="shrink-0 text-gray-300">›</span>
              </button>
            ))
          )}

          {/* Pay accrued this month per cleaner */}
          <SectionHeader
            icon={<FaRegClock className="text-blue-500" />}
            title={`This month — ${format(startOfToday(), "MMMM")}`}
          />
          {(() => {
            // Only cleaners who actually logged time this month — a 0m row is
            // noise in a monthly cost breakdown.
            const worked = [...monthlyPay.entries()].filter(([, e]) => e.hours > 0);
            return worked.length === 0 ? (
              <p className="rounded-xl border border-gray-200 bg-gray-50 p-2.5 text-center text-xs text-gray-400">
                No hours recorded this month yet
              </p>
            ) : (
              worked.map(([id, entry]) => (
                <div
                  key={id}
                  className="mb-1.5 flex items-center justify-between gap-2 rounded-xl border border-gray-200 p-2.5"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <CleanerAvatar id={id} name={entry.name} />
                    <p className="truncate text-sm font-semibold text-gray-900">{entry.name}</p>
                  </div>
                  <p className="shrink-0 text-xs text-gray-500">
                    {formatHrMin(entry.hours)} ·{" "}
                    <span className="text-sm font-bold text-emerald-600">
                      ${Math.round(entry.pay).toLocaleString()}
                    </span>
                  </p>
                </div>
              ))
            );
          })()}
          </>
          )}
        </div>
      </div>

      {/* Focused per-cleaner pay detail — keeps the Pay list clean no matter
          how many recorded days a cleaner has. Tapping a row opens this. */}
      {detailEntry &&
        (() => {
          const entry = detailEntry;
          const cleaner = cleaners.find((c) => c.id === entry.id);
          const rate = cleaner?.payRate ?? 0;
          const days = cleanerDayHours(entry.id);
          const subtotal = days.reduce((s, [, h]) => s + h * rate, 0);
          const tip = parseFloat(tipDraft[entry.id]) || 0;
          return (
            <div
              className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 p-4"
              onClick={closeDetail}
            >
              <div
                className="flex max-h-[85vh] w-full max-w-sm flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-2 border-b border-gray-100 p-4">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <CleanerAvatar
                      id={entry.id}
                      name={entry.name}
                      sizeClass="h-10 w-10"
                      textClass="text-sm"
                    />
                    <div className="min-w-0">
                      <h3 className="truncate text-lg font-bold text-gray-900">{entry.name}</h3>
                      <p className="text-xs text-gray-500">
                        {formatHrMin(entry.hours)} · earned ${Math.round(entry.earned).toLocaleString()} · paid $
                        {Math.round(entry.paid).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={closeDetail}
                    aria-label="Close"
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xl leading-none text-gray-400"
                  >
                    &times;
                  </button>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto p-4">
                  {error && <p className="mb-2 text-xs font-semibold text-red-500">{error}</p>}
                  {/* Balance owed */}
                  <div className="mb-3 flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                    <span className="text-sm font-semibold text-emerald-700">Balance owed</span>
                    <span className="text-2xl font-bold text-emerald-700">
                      ${Math.round(entry.balance).toLocaleString()}
                    </span>
                  </div>

                  {/* Hours by date — scrolls so a heavy month never runs long */}
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                    {format(startOfToday(), "MMMM")} — hours by date
                  </p>
                  <div className="max-h-48 overflow-y-auto rounded-lg bg-gray-50 p-2">
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
                          <span className="text-gray-500">{formatHrMin(hrs)}</span>
                          <span className="w-16 text-right font-semibold text-gray-800">
                            ${(hrs * rate).toFixed(2)}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="mt-1 flex items-center justify-between px-1 text-xs">
                    <span className="font-semibold text-gray-700">Subtotal</span>
                    <span className="font-bold text-gray-900">${subtotal.toFixed(2)}</span>
                  </div>

                  {/* Tip + statement total */}
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <label className="text-sm text-gray-600">Tip $</label>
                    <input
                      className={`${inputCls} w-24`}
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={tipDraft[entry.id] ?? ""}
                      onChange={(e) => setTipDraft((p) => ({ ...p, [entry.id]: e.target.value }))}
                    />
                  </div>
                  <div className="mt-1 flex items-center justify-between text-sm">
                    <span className="font-semibold text-gray-700">Statement total</span>
                    <span className="font-bold text-emerald-600">
                      ${(subtotal + tip).toFixed(2)}
                    </span>
                  </div>

                  {/* Texting the earnings summary now lives in the Team tab's
                      per-cleaner Message menu ("Earnings so far") */}

                  {/* Payout / Undo mistake */}
                  <div className="mt-4 border-t border-gray-100 pt-3">
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
                        className={`${inputCls} w-24`}
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
                            ? `flex-1 rounded-lg px-2.5 py-1.5 text-xs font-bold text-white ${
                                payMode === "undo" ? "bg-red-600" : "bg-emerald-700"
                              }`
                            : `flex-1 ${pillEmerald}`
                        }
                        onClick={() => handlePay(entry)}
                      >
                        {payConfirmArmed
                          ? `Confirm $${parseFloat(payDraft) || 0}`
                          : payMode === "payout"
                            ? "Record payout"
                            : "Record undo"}
                      </button>
                    </div>
                    <p className="mt-1 text-[10px] text-gray-400">
                      {payMode === "payout"
                        ? "Adds to this cleaner's paid total"
                        : "Subtracts a mis-recorded payout from the paid total"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

      {/* Assign-cleaner popover for one room+morning (Plan tab) */}
      {assignTarget && (
        <div
          className="fixed inset-0 z-[120] flex items-end justify-center bg-black/40 p-4 sm:items-center"
          onClick={() => setAssignTarget(null)}
        >
          <div
            className="w-full max-w-xs overflow-hidden rounded-2xl bg-white p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm font-bold text-gray-900">{assignTarget.roomName}</p>
            <p className="mb-3 text-xs text-gray-500">
              Cleaning {format(new Date(assignTarget.morningKey + "T00:00:00"), "EEE, MMM d")}
              {assignTarget.sameDay && (
                <span className="font-semibold text-red-500"> · same-day check-in</span>
              )}
            </p>

            {cleaners.length === 0 && (
              <p className="mb-2 py-2 text-center text-sm text-gray-400">
                No cleaners yet — add one in Team
              </p>
            )}
            {cleaners.map((cleaner) => {
              const isAssigned =
                assignmentFor(assignTarget.morningKey, assignTarget.roomId)?.cleaner?.id ===
                cleaner.id;
              return (
                <button
                  key={cleaner.id}
                  type="button"
                  onClick={() => handleAssign(cleaner)}
                  className={`mb-1.5 flex w-full items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold ${
                    isAssigned
                      ? "border-gray-900 bg-gray-900 text-white"
                      : "border-gray-200 bg-white text-gray-800"
                  }`}
                >
                  <CleanerAvatar
                    id={cleaner.id}
                    name={cleaner.name}
                    sizeClass="h-7 w-7"
                    textClass="text-[11px]"
                  />
                  <span className="min-w-0 flex-1 truncate text-left">{cleaner.name}</span>
                  <span className={`text-xs ${isAssigned ? "text-gray-300" : "text-emerald-600"}`}>
                    ${cleaner.payRate}/hr
                  </span>
                  {isAssigned && <span className="text-xs font-bold">✓</span>}
                </button>
              );
            })}

            {assignmentFor(assignTarget.morningKey, assignTarget.roomId) && (
              <button
                type="button"
                onClick={handleUnassign}
                className="mb-1.5 w-full rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-semibold text-red-600"
              >
                Remove assignment
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setAssignTarget(null);
                setActiveTab("roster");
              }}
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-semibold text-gray-700"
            >
              Manage cleaners…
            </button>
          </div>
        </div>
      )}
    </>,
    document.body,
  );
};

export default CleanersModal;
