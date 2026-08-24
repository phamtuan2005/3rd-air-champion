import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { addDays, endOfMonth, format, startOfToday, startOfWeek } from "date-fns";
import { FaDollarSign, FaRedo, FaRegClock } from "react-icons/fa";
import { MdCleaningServices } from "react-icons/md";
import { dayType } from "../../../util/types/dayType";
import { roomType } from "../../../util/types/roomType";
import RoomBadge from "../../shared/RoomBadge";
import { getRoomColor } from "../../../util/getRoomColor";
import { decimalToHm, formatHrMin, hmToDecimal } from "../../../util/hoursFormat";
import {
  CLEANING_FORECAST_DAYS,
  getCheckoutsOn,
  getCleaningForecast,
  isStaleCleaning as isStale,
} from "../../../util/cleaningTasks";
import { generateAvatar } from "../../../util/avatarGen";
import CleanerAvatarBase from "../../shared/CleanerAvatar";
import { cleanerSignoff, ttPromiseLine } from "../../../util/cleanerMessage";
import { formatPhone } from "../../../util/formatPhone";
import {
  CleanerType,
  CleanerSummaryType,
  CleaningAssignmentType,
  RateChange,
  assignCleaner,
  autoPlanCleanings,
  createCleaner,
  deleteCleaner,
  fetchAssignments,
  fetchCleaners,
  fetchCleanerSummary,
  fetchSentSchedules,
  recordScheduleSent,
  recordCleanerPayment,
  removeCleanerPayment,
  rateOn,
  unassignCleaner,
  updateAssignmentHours,
  updateCleaner,
} from "../../../util/cleanerOperations";

interface CleanersModalProps {
  hostId: string;
  token: string;
  monthMap: Map<string, dayType>; // for arriving-guest counts in the schedule SMS
  rooms: roomType[]; // the live roster — the only source carrying `active`
  // Tab to land on. Set when opened from somewhere with intent (the calendar's
  // day sheet wants Plan); otherwise the modal picks for itself.
  initialTab?: "roster" | "hours" | "pay" | "week" | "upcoming";
  cleaningRules?: string; // host's private note to the cleaning team (texted, not shown to guests)
  senderName?: string; // who's logged in (Anh-Tuan or a cohost like Cindy) — signs the texts
  // Mornings past today the Plan tab forecasts, owned and persisted by MainView
  // so the Clean button's "unassigned" badge counts the same window.
  planDays?: number;
  onPlanDaysChange?: (n: number) => void;
  onClose: () => void;
}

const inputCls =
  "rounded-lg border border-gray-200 px-2 py-1.5 text-sm focus:border-gray-400 focus:outline-none";
const pillDark = "rounded-lg bg-gray-900 px-2.5 py-1.5 text-sm font-semibold text-white";
const pillNeutral =
  "rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm font-semibold text-gray-700";
const pillEmerald = "rounded-lg bg-emerald-600 px-2.5 py-1.5 text-sm font-semibold text-white";

// Weekday toggles (0=Sun…6=Sat) for a cleaner's available days. Empty = the
// auto-planner infers availability from history instead of enforcing it.
const DAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const Toggle = ({
  on,
  onClick,
  color = "amber",
}: {
  on: boolean;
  onClick: () => void;
  color?: "amber" | "emerald";
}) => (
  <button
    type="button"
    onClick={onClick}
    className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
      on ? (color === "emerald" ? "bg-emerald-500" : "bg-amber-500") : "bg-gray-300"
    }`}
  >
    <span
      className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
        on ? "translate-x-5" : "translate-x-0.5"
      }`}
    />
  </button>
);

// Favorability 1–5 (3 = normal). The auto-planner gently prefers higher-priority
// cleaners and gives them first claim on high-stakes same-day turnovers.
const StarPicker = ({ value, onChange }: { value: number; onChange: (v: number) => void }) => (
  <div className="flex gap-0.5">
    {[1, 2, 3, 4, 5].map((n) => (
      <button
        key={n}
        type="button"
        title={`${n} / 5`}
        onClick={() => onChange(n)}
        className={`text-lg leading-none ${n <= value ? "text-amber-400" : "text-gray-300"}`}
      >
        ★
      </button>
    ))}
  </div>
);

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
          className={`h-7 w-7 rounded-full text-[13px] font-bold ${
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

// People report time as hours + minutes, not decimals. Shared with TiWork so a
// figure cannot render one way here and another there — see util/hoursFormat.

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
    <span className="text-sm text-gray-500">hr</span>
    <input
      className={`${inputCls} w-12`}
      type="number"
      min="0"
      max="59"
      placeholder="0"
      value={hm?.m ?? ""}
      onChange={(e) => onChange({ h: hm?.h ?? "", m: e.target.value })}
    />
    <span className="text-sm text-gray-500">min</span>
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
    {hint && <p className="mt-0.5 text-sm text-gray-400">{hint}</p>}
  </div>
);

// "This cleaner was texted a schedule and it has since drifted." A bare dot was
// too easy to miss on a dense day — this reads as a word, carries a pulsing
// halo, and appears everywhere the drift is actionable (Plan, Week, Team).
const ResendBadge = ({ className = "" }: { className?: string }) => (
  <span
    className={`relative inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-amber-400 bg-amber-100 text-amber-700 shadow-sm ${className}`}
    title="Schedule changed since you last texted it — tap the cleaner to re-send"
    aria-label="Schedule changed — re-send"
  >
    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-60" />
    <FaRedo className="relative text-[11px]" />
  </span>
);

const CleanersModal = ({ hostId, token, monthMap, rooms, initialTab, cleaningRules = "", senderName, planDays = CLEANING_FORECAST_DAYS, onPlanDaysChange, onClose }: CleanersModalProps) => {
  // Self-sufficient: fetches its own data so it can be opened from anywhere
  // (NavBar dropdown or the Upcoming assign popover).
  const [cleaners, setCleaners] = useState<CleanerType[]>([]);
  const [assignments, setAssignments] = useState<CleaningAssignmentType[]>([]);
  const [summary, setSummary] = useState<CleanerSummaryType[]>([]);
  // Signature of the schedule last TEXTED per cleaner+week (from the backend,
  // shared with cohosts) — compared to the live schedule to flag drift.
  const [sentSchedules, setSentSchedules] = useState<Record<string, { signature: string; sentAt: string }>>({});
  // Pay / Hours / Week / Upcoming / Team tabs — everything in one scroll was overcrowded
  const [activeTab, setActiveTab] = useState<
    "roster" | "hours" | "pay" | "week" | "upcoming"
  >(initialTab ?? "pay");
  // Once the tab strip can scroll, the selected tab is not necessarily in view —
  // the day sheet's Change button opens straight onto Plan, the fourth of five.
  // "nearest" so this nudges the strip only, never the modal behind it.
  const activeTabRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    activeTabRef.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [activeTab]);
  // Hours tab: which cleaner-day has its "+ Room" picker open (group key)
  const [addRoomFor, setAddRoomFor] = useState<string | null>(null);
  // Hours tab: which day has its "+ Cleaner" picker open (yyyy-MM-dd)
  const [addCleanerFor, setAddCleanerFor] = useState<string | null>(null);
  // Hours tab: the "unplanned cleaning" composer, when open. Every other card on
  // this tab is derived from an assignment, so a cleaning TiMag never knew about
  // (outage, AWS down, a swap agreed by phone) has no way in without this.
  const [unplanned, setUnplanned] = useState<{ date: string; cleanerId: string } | null>(null);
  // A second cleaner brought onto a day by hand. Assignments are per room, so a
  // cleaner with no rooms yet has nothing in the database to derive a card from
  // — this holds the empty card open until rooms are moved onto it.
  const [extraGroups, setExtraGroups] = useState<{ cleanerId: string; date: string }[]>([]);
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
    priority: 3,
    isOwner: false,
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
  // Baseline hours as loaded into the edit form — compared on save to tell an
  // untouched baseline from one the host actually changed.
  const editOriginalBaseline = useRef<number>(0);
  // The cleaner's BASE payRate as loaded. Never overwritten on save — a new
  // figure becomes a dated change instead, so history cannot be re-priced.
  const editOriginalRate = useRef<number>(0);
  const [edit, setEdit] = useState({
    name: "",
    phone: "",
    payRate: "",
    rateHistory: [] as RateChange[],
    baselineHours: "",
    // The month the loaded baseline belongs to. Preserved on save unless the
    // hours themselves change, so editing an unrelated field can't re-anchor a
    // baseline to the current month.
    baselineMonth: "",
    character: "",
    availableDays: [] as number[],
    paused: false,
    priority: 3,
    isOwner: false,
    minRooms: "1",
    maxRooms: "0",
  });
  // Draft for the "add a raise" row in the edit modal.
  const [raiseDraft, setRaiseDraft] = useState({ rate: "", from: "" });
  // Rate changes save IMMEDIATELY (partial update, only rateHistory) — a raise is
  // money and must never be lost to a forgotten Save. Other edit fields aren't
  // touched by this write, so it's safe even mid-edit.
  const persistRateHistory = (rateHistory: RateChange[]) => {
    setEdit((p) => ({ ...p, rateHistory }));
    if (!editingId) return;
    updateCleaner({ id: editingId, rateHistory }, token)
      .then((updated) => setCleaners((prev) => prev.map((c) => (c.id === editingId ? updated : c))))
      .catch((err) => setError(err.response?.data?.error ?? "Could not save the rate change"));
  };
  const addRaise = () => {
    const rate = parseFloat(raiseDraft.rate);
    if (!Number.isFinite(rate) || rate <= 0 || !raiseDraft.from) return;
    persistRateHistory([...edit.rateHistory, { rate, effectiveFrom: raiseDraft.from }]);
    setRaiseDraft({ rate: "", from: "" });
  };
  // Share the good news: a warm appreciation text announcing the new rate. Even a
  // small raise, delivered with thanks, means a lot to a cleaner.
  const textRaise = (name: string, phone: string, change: RateChange) => {
    if (!phone) return;
    const from = format(new Date(`${change.effectiveFrom}T00:00:00`), "MMMM d, yyyy");
    const body = [
      `Hi ${name}! 🎉`,
      ``,
      `Thank you so much for your wonderful work — your care and reliability mean a great deal to us and to our guests.`,
      ``,
      `As a token of our appreciation, your pay is going up to $${change.rate}/hr, effective ${from}. You've earned it.`,
      ``,
      `We're so grateful to have you on the team. Together, we work hard so our guests always feel comfortable — that is TT House's promise to every guest:`,
      ttPromiseLine(senderName),
    ].join("\n");
    window.location.href = `sms:${phone}?&body=${encodeURIComponent(body)}`;
  };
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
  // Which logged payout is armed for removal (id) — removal takes two taps.
  const [removeArmed, setRemoveArmed] = useState<string | null>(null);
  // Payout adds to paid, Undo subtracts — phone number pads have no minus key,
  // so direction is a toggle and the typed amount is always positive.
  // A tip is its own kind of payment, not a payout with a note on it. Recorded
  // as a payout it settles wages — so tipping somebody $11 quietly took $11 off
  // what they were still owed, and made the tab report hours missing.
  const [payMode, setPayMode] = useState<"payout" | "tip" | "undo">("payout");
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
  // A cleaning morning is real only if a stay actually checked out the night
  // before. If the room is mid-continuous-stay that morning (a guest slept there
  // the prior night and is NOT leaving), there was no turnover — so an assignment
  // for it is STALE (e.g. a probable clean a later multi-night booking absorbed).
  // Self-heals: cancel the booking and the assignment shows again.
  const isStaleCleaning = (roomId: string, morningKey: string) =>
    isStale(monthMap, roomId, morningKey);
  const weekAssignments = assignments.filter(
    (a) =>
      a.date >= weekDates[0] &&
      a.date <= weekDates[6] &&
      a.cleaner &&
      a.room &&
      !isStaleCleaning(a.room.id, a.date),
  );

  // How many rooms each cleaner has this week — the same overview the Plan tab
  // carries, so the two tabs answer the workload question the same way.
  //
  // Derived from weekAssignments, the exact list the day cards below render
  // from, so the chips and the cards can never disagree — including about stale
  // cleanings, which that list already drops.
  //
  // No "unassigned" chip here, unlike Plan. Plan forecasts rooms that WILL need
  // cleaning and has a gap to fill; this tab shows what is actually booked in,
  // where an unassigned room simply does not exist yet.
  const weekTabTotals = (() => {
    const totals = new Map<string, number>();
    weekAssignments.forEach((a) => {
      const name = a.cleaner!.name;
      totals.set(name, (totals.get(name) ?? 0) + 1);
    });
    return [...totals.entries()].sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0]));
  })();

  // Fixed Monday of this/next week. The Team-tab Message menu offers both
  // explicitly, so a schedule text never depends on which week the Week tab
  // happens to be showing — each item spells out its own dates.
  const thisMonday = startOfWeek(startOfToday(), { weekStartsOn: 1 });
  const nextMonday = addDays(thisMonday, 7);
  const weekAssignmentCount = (cleanerId: string, monday: Date) => {
    const d0 = format(monday, "yyyy-MM-dd");
    const d6 = format(addDays(monday, 6), "yyyy-MM-dd");
    return assignments.filter(
      (a) =>
        a.cleaner?.id === cleanerId &&
        a.room &&
        a.date >= d0 &&
        a.date <= d6 &&
        !isStaleCleaning(a.room.id, a.date),
    ).length;
  };

  // The cleaner whose focused Message screen is open. When set, the Team tab
  // takes over to show ONLY this person — so a text can never be aimed at the
  // wrong cleaner by mistake.
  const msgCleaner = msgMenuId ? cleaners.find((c) => c.id === msgMenuId) ?? null : null;
  // The cleaner whose focused edit modal is open (centralized on that one person).
  const editCleaner = editingId ? cleaners.find((c) => c.id === editingId) ?? null : null;

  // One consistent initials-avatar color per team member across EVERY view
  // (keyed by their position in the team), so a person looks the same
  // everywhere — Team, Message, records, Hours, Pay.
  const avatarClass = (id: string) =>
    AVATAR_COLORS[Math.max(0, cleaners.findIndex((c) => c.id === id)) % AVATAR_COLORS.length];

  // One avatar for a team member everywhere: an explicit photo (owner jpg) wins,
  // else the illustrated avatar generated from their "character" note, else the
  // colored initials fallback. Looks the person up in `cleaners` for freshness,
  // then renders through the shared CleanerAvatar so it matches every other view.
  const CleanerAvatar = ({
    id,
    name,
    sizeClass = "h-8 w-8",
    textClass = "text-sm",
  }: {
    id: string;
    name: string;
    sizeClass?: string;
    textClass?: string;
  }) => {
    const c = cleaners.find((x) => x.id === id);
    return (
      <CleanerAvatarBase
        name={name}
        photo={c?.photo}
        character={c?.character}
        colorClass={avatarClass(id)}
        sizeClass={sizeClass}
        textClass={textClass}
      />
    );
  };

  // Upcoming tab — the rolling cleaning forecast over the host's own window
  // (migrated from the ToDo modal). Assignments/cleaners/monthMap already live here.
  const cleaningForecast = getCleaningForecast(monthMap, planDays);
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
    const targets: { date: string; room: string; critical: boolean }[] = [];
    cleaningForecast.forEach((day) =>
      day.entries.forEach((e) => {
        const a = assignmentFor(day.morningKey, e.checkoutBooking.room.id);
        if (!a?.cleaner)
          targets.push({
            date: day.morningKey,
            room: e.checkoutBooking.room.id,
            // High-stakes = a confirmed same-day check-in (must be spotless by 2pm)
            critical: e.sameDayCheckIn != null,
          });
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

  // Rooms that genuinely turned over on a morning. Uses getCheckoutsOn — the same
  // function the Plan tab forecasts from — so the two screens can never disagree
  // about what counted as a cleaning. Anything outside this set had no checkout,
  // and recording it would invent a cleaning, and the pay that follows from it.
  const checkoutRoomsOn = (day: string) =>
    new Set(getCheckoutsOn(monthMap, day).map((b) => b.room!.id));

  // "This room definitely did NOT turn over that morning." Only answerable when
  // the previous night is actually loaded — monthMap holds one month, so a July
  // date viewed in August has no bookings to judge by, and absence of evidence
  // must not delete a real cleaning from the list.
  const knownNoCheckout = (day: string, roomId: string) => {
    const prevNight = format(addDays(new Date(day + "T00:00:00"), -1), "yyyy-MM-dd");
    if (!monthMap.has(prevNight)) return false; // can't tell — keep it
    return !checkoutRoomsOn(day).has(roomId);
  };

  // ── Correcting what was actually cleaned ──
  // The plan is not always what happened: an outage, a phone left at home, or a
  // swap agreed in person means a cleaner did a room TiMag never assigned them.
  // These edit the day's rooms straight from the Hours tab, where the host is
  // already reconciling reality against the record.
  const handleAddRoomToDay = (
    group: { cleaner: CleanerType; date: string },
    roomId: string,
  ) => {
    assignCleaner(
      { host: hostId, date: group.date, room: roomId, cleaner: group.cleaner.id },
      token,
    )
      .then(async (created) => {
        // Assignments are unique per host+date+room, so this REPLACES any other
        // cleaner holding that room that day — which is exactly the correction
        // being made ("it was Maria on the King, not Ana").
        //
        // If the day is already recorded, join it at 0 rather than null: the
        // day's total already covers this room, and a stray null row makes the
        // day read as pending and recorded at once.
        let row = created;
        if (recordedDayKeys.has(`${group.cleaner.id}|${group.date}`)) {
          row = await updateAssignmentHours(created.id, 0, token).catch(() => created);
        }
        setAssignments((prev) => [
          ...prev.filter((a) => !(a.date === row.date && a.room?.id === row.room?.id)),
          row,
        ]);
        setAddRoomFor(null);
      })
      .catch((err) => setError(err.response?.data?.error ?? "Could not add that room"));
  };

  const handleRemoveRoomFromDay = (date: string, roomId: string) => {
    unassignCleaner({ host: hostId, date, room: roomId }, token)
      .then(() =>
        setAssignments((prev) => prev.filter((a) => !(a.date === date && a.room?.id === roomId))),
      )
      .catch((err) => setError(err.response?.data?.error ?? "Could not remove that room"));
  };

  // Custom room colors live on booking.room in monthMap (assignments only
  // carry id+name) — recover them so Week chips match the Upcoming chips.
  const roomColorById = new Map<string, string>();
  monthMap.forEach((day) =>
    day.bookings.forEach((b) => {
      if (b.room?.id && b.room.color) roomColorById.set(b.room.id, b.room.color);
    }),
  );

  // Rooms offerable in the Hours tab's add-a-room picker. ACTIVE only: a retired
  // room cannot have been cleaned, so offering it just invites a wrong record.
  // Comes from the rooms prop because monthMap's booking.room has no `active`
  // (the GraphQL selection stops at id/name/price/roomCode/color). Rooms already
  // on a day still show their chip regardless, so an inactive one can be removed.
  const addableRooms = rooms
    .filter((r) => r.active)
    .slice()
    .sort((x, y) => x.name.localeCompare(y.name));

  useEffect(() => {
    if (!hostId || !token) return;
    // The window has to cover everything this modal can SHOW, or an assignment
    // saves and then disappears.
    //
    // It used to end at "this week + next week". The Plan tab reaches further —
    // planDays mornings from today, host-tunable — so a cleaner assigned beyond
    // that fortnight was written to the server correctly and never fetched
    // back. Reopening the modal showed the room unassigned again, which reads
    // exactly like a save that failed. It did not; the question did.
    //
    // Three horizons, and the window is the widest of them: the month for hours
    // and pay, the fortnight for the fixed schedule, and the plan for whatever
    // the host has set it to.
    const thisMonday = format(startOfWeek(startOfToday(), { weekStartsOn: 1 }), "yyyy-MM-dd");
    const start = thisMonday < `${monthKey}-01` ? thisMonday : `${monthKey}-01`;
    const fortnightEnd = format(
      addDays(startOfWeek(startOfToday(), { weekStartsOn: 1 }), 13),
      "yyyy-MM-dd",
    );
    const planEnd = format(addDays(startOfToday(), planDays), "yyyy-MM-dd");
    const monthEnd = format(endOfMonth(new Date(`${monthKey}-01T00:00:00`)), "yyyy-MM-dd");
    // yyyy-MM-dd sorts lexicographically, so the latest string is the latest day.
    const end = [fortnightEnd, planEnd, monthEnd].sort().pop()!;
    fetchCleaners(hostId, token)
      .then(setCleaners)
      .catch((err) => console.error("Error fetching cleaners:", err));
    fetchAssignments(hostId, start, end, token)
      .then(setAssignments)
      .catch((err) => console.error("Error fetching assignments:", err));
    fetchSentSchedules(hostId, token)
      .then((rows) =>
        setSentSchedules(
          Object.fromEntries(
            rows.map((r) => [`${r.cleaner}|${r.weekMonday}`, { signature: r.signature, sentAt: r.sentAt }]),
          ),
        ),
      )
      .catch((err) => console.error("Error fetching sent schedules:", err));
    reloadSummary();
    // planDays is a dependency: widening the Plan horizon has to fetch the
    // assignments that horizon can now reach, or the new mornings all look
    // unassigned.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hostId, token, planDays, monthKey]);

  // Past (or today's) cleanings whose hours haven't been recorded yet — excluding
  // stale ones (a room a continuous stay absorbed still needs no cleaning).
  // Cleaner-days that already carry a recorded total. A day's hours live on ONE
  // of its rooms (the rest hold 0), so "recorded" is a property of the DAY, not
  // of each row — a room added after the day was saved arrives with hours null
  // and must not resurrect the day as pending.
  const recordedDayKeys = new Set(
    assignments
      .filter((a) => a.hours != null && a.hours > 0 && a.cleaner)
      .map((a) => `${a.cleaner!.id}|${a.date}`),
  );

  // Drop assignments the plan has outlived.
  //
  // Auto-plan writes a forecast as a real assignment. When the forecast turns
  // out wrong — the guest never checked out, so no turnover was needed — the row
  // is left behind with no hours, and every screen has to remember to filter it
  // out. TiMag did; TiWork did not, and told Henry he had cleaned a room on a
  // morning nobody cleaned anything.
  //
  // Filtering it in five places is how it leaked in the first place. Deleting it
  // once removes it everywhere, including from anyone reading the database
  // directly. Only ever removes an unworked past morning that is provably
  // needless — anything with hours is real work and is never touched.
  const reapedRef = useRef(false);
  useEffect(() => {
    if (reapedRef.current || assignments.length === 0 || monthMap.size === 0) return;
    reapedRef.current = true;
    const stale = assignments.filter(
      (a) =>
        a.date <= todayKey &&
        a.hours == null &&
        a.room &&
        a.cleaner &&
        isStaleCleaning(a.room.id, a.date),
    );
    if (stale.length === 0) return;
    Promise.all(
      stale.map((a) =>
        unassignCleaner({ host: hostId, date: a.date, room: a.room!.id }, token).catch(
          () => {},
        ),
      ),
    ).then(() =>
      setAssignments((prev) =>
        prev.filter((a) => !stale.some((x) => x.date === a.date && x.room?.id === a.room?.id)),
      ),
    );
  }, [assignments, monthMap, todayKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const needHours = assignments.filter(
    (a) =>
      a.date <= todayKey &&
      a.hours == null &&
      a.cleaner &&
      a.room &&
      !isStaleCleaning(a.room.id, a.date) &&
      // Without this the day showed as pending AND recorded at once, and saving
      // the pending card wrote only the null rows — leaving the existing total
      // in place and inflating the day's pay.
      !recordedDayKeys.has(`${a.cleaner.id}|${a.date}`) &&
      // The auto-planner drafts PROBABLE gap turnovers. When the last-minute
      // sale never happened the assignment survives with no checkout behind it,
      // and asking the host to record hours for a cleaning that never occurred
      // is how invented pay gets entered. Hidden, not deleted — if the booking
      // shows up later the assignment reappears on its own.
      !knownNoCheckout(a.date, a.room.id),
  );

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
    // Hand-added second cleaners. Deduped: the moment one has a room it arrives
    // through needHours like any other group, and this entry stops mattering.
    extraGroups.forEach(({ cleanerId, date }) => {
      const key = `${cleanerId}|${date}`;
      if (map.has(key)) return;
      const cleaner = cleaners.find((c) => c.id === cleanerId);
      if (cleaner) map.set(key, { key, cleaner, date, assignments: [] });
    });
    return [...map.values()].sort(
      (a, b) => a.date.localeCompare(b.date) || a.cleaner.name.localeCompare(b.cleaner.name),
    );
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
    // An explicit initialTab is a deliberate destination — never override it.
    if (initialTab || autoTabDone.current || assignments.length === 0) return;
    autoTabDone.current = true;
    if (needHours.length > 0) setActiveTab("hours");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignments]);

  // Pay owed this month per cleaner = baseline (pre-tracking hours entered for
  // this month) + Σ recorded assignment hours, all × rate
  const monthlyPay = new Map<string, { name: string; hours: number; pay: number }>();
  cleaners.forEach((c) => {
    if (c.baselineMonth === monthKey && c.baselineHours > 0) {
      monthlyPay.set(c.id, {
        name: c.name,
        hours: c.baselineHours,
        pay: c.baselineHours * rateOn(c, `${monthKey}-01`),
      });
    }
  });
  assignments
    .filter((a) => a.date.startsWith(monthKey) && a.hours != null && a.cleaner)
    .forEach((a) => {
      const entry = monthlyPay.get(a.cleaner!.id) ?? { name: a.cleaner!.name, hours: 0, pay: 0 };
      entry.hours += a.hours!;
      entry.pay += a.hours! * rateOn(a.cleaner!, a.date);
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
        priority: newCleaner.priority,
        isOwner: newCleaner.isOwner,
      },
      token,
    )
      .then((created) => {
        setCleaners((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
        setNewCleaner({ name: "", phone: "", payRate: "", character: "", availableDays: [], priority: 3, isOwner: false });
        setAddOpen(false);
        setError("");
        reloadSummary();
      })
      .catch((err) => setError(err.response?.data?.error ?? "Could not add cleaner"));
  };

  const handleSaveEdit = (id: string) => {
    // A raise must never re-price work already done. rateOn falls back to the
    // BASE payRate for any date before the earliest rateHistory entry, so
    // editing the base rewrites every past cleaning. Instead, keep the base as
    // it was and record the new figure as a change effective today — past work
    // keeps the rate it was billed at, by construction.
    const typedRate = parseFloat(edit.payRate) || 0;
    const baseRate = editOriginalRate.current;
    const rateChanged = typedRate !== baseRate;
    const nextHistory = rateChanged
      ? [
          ...edit.rateHistory.filter((h) => h.effectiveFrom !== todayKey),
          { rate: typedRate, effectiveFrom: todayKey },
        ].sort((a, b) => (a.effectiveFrom < b.effectiveFrom ? -1 : 1))
      : edit.rateHistory;

    updateCleaner(
      {
        id,
        name: edit.name.trim(),
        phone: edit.phone.trim(),
        payRate: baseRate,
        rateHistory: nextHistory,
        character: edit.character.trim(),
        availableDays: edit.availableDays,
        paused: edit.paused,
        priority: edit.priority,
        isOwner: edit.isOwner,
        minRooms: Math.max(0, parseInt(edit.minRooms, 10) || 0),
        maxRooms: Math.max(0, parseInt(edit.maxRooms, 10) || 0),
        // Baseline is anchored to the month it was entered. Re-anchor ONLY when
        // the hours actually change — otherwise editing a photo would move an
        // older baseline into this month and distort this month's pay.
        baselineHours: parseFloat(edit.baselineHours) || 0,
        baselineMonth:
          (parseFloat(edit.baselineHours) || 0) === (editOriginalBaseline.current ?? 0) &&
          edit.baselineMonth
            ? edit.baselineMonth
            : monthKey,
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
    cleaner?: CleanerType;
    date?: string;
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
    // Write across EVERY row this cleaner has that day, not just the ones the
    // group happened to carry. A room added after the day was saved is not in
    // the pending group, and skipping it left its old value behind — so the
    // day's sum became "old total + new total" instead of the new total.
    const dayRows =
      group.cleaner && group.date
        ? assignments.filter(
            (a) => a.cleaner?.id === group.cleaner!.id && a.date === group.date && a.room,
          )
        : group.assignments;
    Promise.all(
      dayRows.map((a, i) =>
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

  // What the arriving stay needs — the headcount for beds and towels, and
  // whether there is a sofa bed to make up. First check-in for the room on or
  // after the morning being cleaned.
  //
  // The sofa bed rides with the headcount because it answers the same question:
  // what does this room need doing to it. A bed nobody mentions is a bed nobody
  // makes, and the cleaner finds out from the guest.
  const nextArrival = (
    roomId: string,
    morningKey: string,
  ): { guests: number; sofaBed: boolean } | null => {
    for (let i = 0; i <= 30; i++) {
      const key = format(addDays(new Date(morningKey + "T00:00:00"), i), "yyyy-MM-dd");
      const found = monthMap
        .get(key)
        ?.bookings.find((b) => b.room?.id === roomId && b.startDate.split("T")[0] === key);
      if (found) return { guests: found.numberOfGuests || 1, sofaBed: !!found.sofaBed };
    }
    return null;
  };

  // "(2)" · "(2, 🛋)" · "(🛋)" — whatever the stay actually needs, and nothing
  // when it needs nothing worth saying.
  const arrivalSuffix = (roomId: string, morningKey: string): string => {
    const need = nextArrival(roomId, morningKey);
    if (!need) return "";
    const parts = [need.guests ? String(need.guests) : "", need.sofaBed ? "🛋" : ""].filter(Boolean);
    return parts.length ? ` (${parts.join(", ")})` : "";
  };

  // Explains only what is actually in the message. A legend for a symbol that
  // does not appear is noise; a symbol with no legend is a puzzle.
  const legendFor = (lines: string[]): string => {
    const text = lines.join("\n");
    const parts: string[] = [];
    if (/\(\d/.test(text)) parts.push("numbers = guests arriving");
    if (text.includes("🛋")) parts.push("🛋 = sofa bed to make up");
    return parts.length ? `(${parts.join("; ")})` : "";
  };

  // ── Sent-schedule drift ("re-send" flags) ──
  const sentKey = (cleanerId: string, monday: Date) =>
    `${cleanerId}|${format(monday, "yyyy-MM-dd")}`;
  // Signature of a cleaner's LIVE schedule for a fixed week — date|room|guests
  // per non-stale assignment, matching what the SMS conveys (so a changed guest
  // count also counts as a change worth re-sending).
  const scheduleSignature = (cleanerId: string, monday: Date) => {
    const d0 = format(monday, "yyyy-MM-dd");
    const d6 = format(addDays(monday, 6), "yyyy-MM-dd");
    return assignments
      .filter(
        (a) =>
          a.cleaner?.id === cleanerId &&
          a.room &&
          a.date >= d0 &&
          a.date <= d6 &&
          !isStaleCleaning(a.room.id, a.date),
      )
      .map((a) => `${a.date}:${a.room!.id}:${arrivalSuffix(a.room!.id, a.date)}`)
      .sort()
      .join("|");
  };
  // Only TODAY ONWARD counts as drift. A cleaning that already happened cannot be
  // re-arranged, so re-texting a past day is meaningless — and a fully past week
  // must never ask for one. Both sides are filtered at comparison time (rather
  // than narrowing scheduleSignature itself) so schedules texted before this
  // existed stay comparable: nothing stored in the backend needs migrating.
  const upcomingOnly = (sig: string) =>
    sig
      .split("|")
      .filter((part) => part && part.slice(0, 10) >= todayKey)
      .join("|");
  // "empty" (nothing upcoming) | "unsent" | "sent" (matches) | "changed" (drifted)
  const scheduleStatus = (cleanerId: string, monday: Date) => {
    const sig = upcomingOnly(scheduleSignature(cleanerId, monday));
    if (!sig) return "empty" as const;
    const rec = sentSchedules[sentKey(cleanerId, monday)];
    if (!rec) return "unsent" as const;
    return upcomingOnly(rec.signature) === sig ? ("sent" as const) : ("changed" as const);
  };
  // Owed an updated text: a week already sent has since drifted from the plan.
  const cleanerNeedsResend = (cleanerId: string) =>
    scheduleStatus(cleanerId, thisMonday) === "changed" ||
    scheduleStatus(cleanerId, nextMonday) === "changed";
  // Suffix for a schedule menu item's subtext.
  const scheduleTag = (cleanerId: string, monday: Date) => {
    const st = scheduleStatus(cleanerId, monday);
    return st === "changed" ? " · ⚠️ changed — re-send" : st === "sent" ? " · ✓ sent" : "";
  };

  // One SMS per cleaner, bound to the FIXED selected week — the message a
  // cleaner receives never depends on which day the host happens to send it.
  const textSchedule = (cleaner: CleanerType, monday: Date) => {
    if (!cleaner.phone) return;
    const d0 = format(monday, "yyyy-MM-dd");
    const d6 = format(addDays(monday, 6), "yyyy-MM-dd");
    // Never text a cleaner about days they have already worked. Sending mid-week
    // used to restate Monday onward, which reads as a request to go back and
    // clean the past; a fully past week now sends nothing at all.
    const from = d0 > todayKey ? d0 : todayKey;
    const mine = assignments
      .filter(
        (a) =>
          a.cleaner?.id === cleaner.id &&
          a.room &&
          a.date >= from &&
          a.date <= d6 &&
          !isStaleCleaning(a.room.id, a.date),
      )
      .sort((a, b) => a.date.localeCompare(b.date));
    if (mine.length === 0) return;

    const byDay = new Map<string, string[]>();
    mine.forEach((a) => {
      const label = `${a.room!.name}${arrivalSuffix(a.room!.id, a.date)}`;
      byDay.set(a.date, [...(byDay.get(a.date) ?? []), label]);
    });
    const lines = [...byDay.entries()].map(
      ([date, rooms]) =>
        `* ${format(new Date(date + "T00:00:00"), "EEEE M/d")}: ${rooms.join(", ")}`,
    );
    // Label the range actually listed, not the calendar week — mid-week that is
    // today→Sunday, so the heading matches the days below it.
    const weekLabel = `${format(new Date(from + "T00:00:00"), "MMM d")} – ${format(addDays(monday, 6), "MMM d")}`;
    // Say "updated" when this cleaner has already had a schedule for this week,
    // so a second text is read as replacing the first rather than duplicating
    // it — otherwise a cleaner may act on whichever they happen to scroll to.
    const isResend = !!sentSchedules[sentKey(cleaner.id, monday)];
    const message = isResend
      ? `Hi ${cleaner.name}, here's your UPDATED cleaning schedule for ${weekLabel} — this replaces what I sent before:\n${lines.join("\n")}\n${legendFor(lines)}\n\n${cleanerSignoff(senderName)}`
      : `Hi ${cleaner.name}, your cleaning schedule for ${weekLabel}:\n${lines.join("\n")}\n${legendFor(lines)}\n\n${cleanerSignoff(senderName)}`;
    window.location.href = `sms:${cleaner.phone}?&body=${encodeURIComponent(message)}`;
    // Remember exactly what we sent (shared via backend) so later drift from the
    // live plan flags a re-send — for you and any cohost.
    const sig = scheduleSignature(cleaner.id, monday);
    recordScheduleSent(
      { host: hostId, cleaner: cleaner.id, weekMonday: d0, signature: sig },
      token,
    )
      .then(() =>
        setSentSchedules((p) => ({
          ...p,
          [sentKey(cleaner.id, monday)]: { signature: sig, sentAt: new Date().toISOString() },
        })),
      )
      .catch(() => {});
  };

  // A standing quality reminder (comforter/pillow covers laundered, etc.) the
  // host keeps in Settings → My AirBnB. Not tied to any week — sendable anytime.
  const textCleaningRules = (cleaner: CleanerType) => {
    if (!cleaner.phone || !cleaningRules.trim()) return;
    const message = `Hi ${cleaner.name}, a quick cleaning reminder for TT House:\n\n${cleaningRules.trim()}\n\nThank you for keeping every room guest-ready — that is TT House's promise to every guest:\n${ttPromiseLine(senderName)}`;
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
  // FOLDED INTO the "ready to pay" lump sum (a cleaner should read one happy
  // number, not add earnings + tip themselves) — the tip is just noted inline.
  const textPayment = (entry: CleanerSummaryType) => {
    const cleaner = cleaners.find((c) => c.id === entry.id);
    if (!cleaner?.phone) return;
    const days = cleanerDayHours(entry.id);
    const tip = parseFloat(tipDraft[entry.id]) || 0;
    const lines = days.map(
      ([date, hrs]) =>
        `* ${format(new Date(date + "T00:00:00"), "EEE M/d")}: ${formatHrMin(hrs)} = $${(hrs * rateOn(cleaner, date)).toFixed(2)}`,
    );
    const subtotal = days.reduce((s, [date, h]) => s + h * rateOn(cleaner, date), 0);
    const totalHrs = days.reduce((s, [, h]) => s + h, 0);
    const monthLabel = format(startOfToday(), "MMMM");
    const body = [
      `Hi ${cleaner.name}, here's your cleaning summary:`,
      // Recent detail (this month's recorded days)
      ...(lines.length
        ? ["", `Your work this month (${monthLabel}) — ${formatHrMin(totalHrs)} = $${subtotal.toFixed(2)} gross:`, ...lines]
        : []),
      "",
      // Lifetime "Earned so far" / "Paid" totals were removed deliberately: a
      // cleaner reads them as competing claims about what they are owed. The
      // only number that answers their actual question is the balance below.
      // Cents, not rounded: the day rows and subtotal above are exact, so a
      // rounded total here reads as an arithmetic error to the person checking it.
      `Ready to pay whenever you'd like: $${(entry.balance + tip).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}${tip > 0 ? ` (includes a $${tip.toFixed(2)} tip 🎁)` : ""}`,
      "",
      cleanerSignoff(senderName),
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
    recordCleanerPayment(entry.id, signed, token, todayKey, payMode === "tip")
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

  // Remove one logged payout. Two taps, like recording one — this moves money.
  const handleRemovePayment = (cleanerId: string, paymentId: string) => {
    if (removeArmed !== paymentId) {
      setRemoveArmed(paymentId);
      return;
    }
    removeCleanerPayment(cleanerId, paymentId, token)
      .then(() => {
        setRemoveArmed(null);
        setError("");
        reloadSummary();
      })
      .catch((err) => setError(err.response?.data?.error ?? "Could not remove payment"));
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
        className="modal-type fixed z-[110] flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl"
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
            <MdCleaningServices className="text-emerald-600" />
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

        {/* Five tabs sized to their content, not to a fifth of the modal.
            grid-cols-5 forced each tab into an equal column; once the modal type
            scale grew the labels, "Hours" plus its count no longer fitted one on
            a phone, and a button does not clip — so the label and badge spilled
            across the tab beside it. flex-1 keeps them filling the width when
            there is room, min-w-fit stops any tab shrinking below its own words,
            and the strip scrolls when the sum no longer fits. */}
        <div className="mx-4 mb-2 flex shrink-0 gap-1 overflow-x-auto rounded-xl bg-gray-100 p-1">
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
              ref={activeTab === key ? activeTabRef : undefined}
              onClick={() => setActiveTab(key)}
              className={`flex min-w-fit flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-2 py-1.5 text-sm font-semibold transition-colors ${
                activeTab === key ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
              }`}
            >
              {label}
              {count > 0 && (
                <span
                  className={`min-w-[1.25rem] shrink-0 rounded-full px-1 py-0.5 text-center text-[12px] font-bold leading-none ${
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
          {error && <p className="mb-2 text-sm font-semibold text-red-500">{error}</p>}

          {/* Focused, single-cleaner message screen — takes over the whole Team
              panel so ONLY the chosen cleaner is on screen while you pick what to
              send. Simple and centralized: one cleaner, one place, no mix-ups. */}
          {activeTab === "roster" && msgCleaner && (
            <div>
              <button
                type="button"
                onClick={() => setMsgMenuId(null)}
                className="mb-3 flex items-center gap-1 text-sm font-semibold text-gray-500 hover:text-gray-700"
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
                  <p className="text-sm text-gray-500">
                    {msgCleaner.phone ? formatPhone(msgCleaner.phone) : "No phone number"}
                  </p>
                </div>
              </div>

              <p className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-gray-400">
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
                    icon: "🧽",
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
                    sub: `${format(thisMonday, "MMM d")} – ${format(addDays(thisMonday, 6), "MMM d")} · ${thisCount} room${thisCount === 1 ? "" : "s"}${scheduleTag(cleaner.id, thisMonday)}`,
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
                    sub: `${format(nextMonday, "MMM d")} – ${format(addDays(nextMonday, 6), "MMM d")} · ${nextCount} room${nextCount === 1 ? "" : "s"}${scheduleTag(cleaner.id, nextMonday)}`,
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
                            <span className="block truncate text-[13px] text-gray-400">
                              {it.sub}
                            </span>
                          </span>
                        </span>
                        {!it.disabled && (
                          <span className={`shrink-0 text-sm font-semibold ${it.accent}`}>
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
              // Editing happens in a focused modal (below) centered on this one
              // cleaner; the row hides while it's open.
              null
            ) : (
              confirmRemoveId === cleaner.id ? (
              <div
                key={cleaner.id}
                className="mb-2 flex items-center justify-between gap-2 rounded-xl border border-red-300 bg-red-50 p-2.5"
              >
                <p className="min-w-0 flex-1 text-sm font-semibold text-red-700">
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
                  className="rounded-lg bg-red-600 px-2.5 py-1.5 text-sm font-bold text-white"
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
                  className="absolute inset-y-0 right-0 flex w-20 items-center justify-center bg-red-600 text-sm font-bold text-white"
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
                    {(cleaner.priority ?? 3) >= 4 && (
                      <span className="shrink-0 text-amber-400" title="Preferred cleaner">
                        ★
                      </span>
                    )}
                    {cleaner.isOwner && (
                      <span className="shrink-0 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[12px] font-bold uppercase text-emerald-700">
                        Owner
                      </span>
                    )}
                    {cleaner.paused && (
                      <span className="shrink-0 rounded-full bg-amber-100 px-1.5 py-0.5 text-[12px] font-bold uppercase text-amber-700">
                        On leave
                      </span>
                    )}
                  </p>
                  <p className="text-sm text-gray-500">
                    {cleaner.phone && <span>{formatPhone(cleaner.phone)} · </span>}
                    <span className="font-bold text-emerald-600">${rateOn(cleaner, todayKey)}/hr</span>
                  </p>
                </div>
                {/* Stacked, not side by side: two pills competing for the right
                    edge squeezed the cleaner's name and phone into a narrow
                    column. A column of equal-width buttons gives the name back
                    the width, and the card is the thing being read. */}
                <div className="flex shrink-0 flex-col gap-1.5">
                {/* One home for every message we send a cleaner — schedule,
                    earnings, cleaning rules — so no single-purpose button ever
                    reads like TiMag is imposing something on the cleaner */}
                <button
                  type="button"
                  className={`relative w-full ${pillNeutral} ${!cleaner.phone ? "opacity-40" : ""} ${
                    cleanerNeedsResend(cleaner.id)
                      ? "border-amber-400 bg-amber-50 text-amber-800"
                      : ""
                  }`}
                  disabled={!cleaner.phone}
                  title={
                    cleanerNeedsResend(cleaner.id)
                      ? "Schedule changed since you last sent — re-send"
                      : cleaner.phone
                        ? "Message this cleaner"
                        : "Add a phone number to text"
                  }
                  onClick={() => {
                    setSwipeOpenId(null);
                    setMsgMenuId(cleaner.id);
                  }}
                >
                  💬
                  {cleanerNeedsResend(cleaner.id) && (
                    <span className="absolute -right-1.5 -top-1.5 flex h-3.5 w-3.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-500 opacity-75" />
                      <span className="relative inline-flex h-3.5 w-3.5 rounded-full bg-amber-500 ring-2 ring-white" />
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  className={`w-full ${pillNeutral}`}
                  onClick={() => {
                    setEditingId(cleaner.id);
                    setRaiseDraft({ rate: "", from: "" });
                    setEdit({
                      name: cleaner.name,
                      phone: cleaner.phone,
                      payRate: String(cleaner.payRate),
                      rateHistory: cleaner.rateHistory ?? [],
                      character: cleaner.character ?? "",
                      availableDays: cleaner.availableDays ?? [],
                      paused: cleaner.paused ?? false,
                      priority: cleaner.priority ?? 3,
                      isOwner: cleaner.isOwner ?? false,
                      minRooms: String(cleaner.minRooms ?? 1),
                      maxRooms: String(cleaner.maxRooms ?? 0),
                      // Load the REAL baseline whatever month it belongs to. It
                      // counts toward earned regardless of month, so hiding an
                      // older one made the form save 0 and silently delete money
                      // the cleaner was owed.
                      baselineHours:
                        cleaner.baselineHours > 0 ? String(cleaner.baselineHours) : "",
                      baselineMonth: cleaner.baselineMonth ?? "",
                    });
                    editOriginalBaseline.current = cleaner.baselineHours ?? 0;
                    editOriginalRate.current = cleaner.payRate ?? 0;
                  }}
                >
                  Edit
                </button>
                </div>
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
                <label className="text-sm text-gray-500">
                  Available days
                  <span className="block text-[12px] text-gray-400">blank = auto from history</span>
                </label>
                <DayPicker
                  days={newCleaner.availableDays}
                  onChange={(d) => setNewCleaner((p) => ({ ...p, availableDays: d }))}
                />
              </div>
              {/* Priority — favored in auto-plan */}
              <div className="mt-1.5 flex items-center justify-between gap-2">
                <label className="text-sm text-gray-500">
                  Priority
                  <span className="block text-[12px] text-gray-400">favored in auto-plan · 3 = normal</span>
                </label>
                <StarPicker
                  value={newCleaner.priority}
                  onChange={(v) => setNewCleaner((p) => ({ ...p, priority: v }))}
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
                className={`rounded-md py-1 text-[13px] font-semibold ${
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

          {/* Workload at a glance, above the day-by-day breakdown — the same
              chips as the Plan tab. Cindy cleans as well as co-hosts, so "how
              many rooms am I down for this week" is asked before any individual
              day is. */}
          {weekTabTotals.length > 0 && (
            <div className="mb-2 flex flex-wrap items-center justify-center gap-1.5">
              {weekTabTotals.map(([name, count]) => {
                const cl = cleaners.find((c) => c.name === name);
                return (
                  <span
                    key={name}
                    className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white py-0.5 pl-0.5 pr-2 text-sm font-semibold text-gray-700"
                  >
                    {cl && (
                      <CleanerAvatar id={cl.id} name={name} sizeClass="h-5 w-5" textClass="text-[11px]" />
                    )}
                    {name.split(" ")[0]}
                    <span className="rounded-full bg-gray-900 px-1.5 py-0.5 text-[12px] font-bold leading-none text-white">
                      {count}
                    </span>
                  </span>
                );
              })}
            </div>
          )}

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
                      className={`text-[13px] font-bold uppercase tracking-wide ${
                        isToday ? "text-violet-500" : "text-gray-400"
                      }`}
                    >
                      {format(dayDate, "EEE")}
                    </span>
                    <span className="text-sm font-bold text-gray-900">{format(dayDate, "MMM d")}</span>
                    {isToday && (
                      <span className="rounded-full bg-violet-600 px-1.5 py-0.5 text-[12px] font-bold uppercase leading-none text-white">
                        Today
                      </span>
                    )}
                  </div>
                  <span className="text-sm font-semibold text-gray-400">
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
                        {/* Tap the cleaner to text them THIS displayed week's plan */}
                        <button
                          type="button"
                          disabled={!cleaner.phone}
                          onClick={() => textSchedule(cleaner, weekMonday)}
                          title={
                            !cleaner.phone
                              ? "Add a phone number to text"
                              : `Text ${cleaner.name.split(" ")[0]} the ${format(weekMonday, "MMM d")}–${format(addDays(weekMonday, 6), "MMM d")} schedule`
                          }
                          className={`-mx-1 flex w-24 shrink-0 items-center gap-1.5 rounded-md px-1 py-0.5 text-left transition-colors ${
                            cleaner.phone ? "hover:bg-gray-100" : "opacity-50"
                          }`}
                        >
                          <CleanerAvatar
                            id={cleaner.id}
                            name={cleaner.name}
                            sizeClass="h-6 w-6"
                            textClass="text-[12px]"
                          />
                          <span className="truncate text-sm font-semibold text-gray-700 underline decoration-dotted decoration-gray-300 underline-offset-2">
                            {cleaner.name.split(" ")[0]}
                          </span>
                        </button>
                        {/* Drift flag lives at the ROW'S RIGHT EDGE, never beside the
                            name — inside the fixed-width name button it stole space
                            from the avatar and truncated the name. */}
                        <div className="flex flex-1 flex-wrap items-center gap-1">
                          {rooms.map((room, i) => (
                            // Same headcount the SMS carries — beds/towels to
                            // prep — plus the sofa bed, which is extra work and
                            // must not be discovered on arrival.
                            <span
                              key={`${room.id}-${i}`}
                              className={`${getRoomColor(room.name, roomColorById.get(room.id))} rounded-md px-2 py-1 text-[13px] font-semibold text-black shadow-sm`}
                            >
                              {room.name}
                              {arrivalSuffix(room.id, dateKey)}
                            </span>
                          ))}
                        </div>
                        {scheduleStatus(cleaner.id, weekMonday) === "changed" && <ResendBadge />}
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
          <p className="mt-2 text-center text-sm text-gray-400">
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
            title={`Plan — today and the next ${planDays} morning${planDays === 1 ? "" : "s"}`}
            hint="Cleanings by day · tap a room to assign or change a cleaner"
          />
          {/* How far ahead to plan, set here rather than baked in. How far Cindy
              can usefully look changes with the season and with how full the
              month is, and she is the one who knows — a fixed week was either
              short of the stretch she was arranging or padded with days that
              could still change. Remembered per device. */}
          {onPlanDaysChange && (
            <div className="mb-2 flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
              <span className="text-sm font-semibold text-gray-500">Show</span>
              <button
                type="button"
                aria-label="Fewer days"
                onClick={() => onPlanDaysChange(planDays - 1)}
                disabled={planDays <= 1}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 bg-white text-lg font-bold leading-none text-gray-600 disabled:opacity-40"
              >
                −
              </button>
              <span className="min-w-[4.5rem] text-center text-sm font-bold text-gray-800">
                {planDays + 1} days
              </span>
              <button
                type="button"
                aria-label="More days"
                onClick={() => onPlanDaysChange(planDays + 1)}
                disabled={planDays >= 30}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 bg-white text-lg font-bold leading-none text-gray-600 disabled:opacity-40"
              >
                +
              </button>
            </div>
          )}
          {cleaningForecast.length === 0 ? (
            <p className="mb-2 rounded-xl border border-gray-200 bg-gray-50 p-2.5 text-center text-sm text-gray-400">
              No checkouts today or in the next {planDays} days
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
                        className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white py-0.5 pl-0.5 pr-2 text-sm font-semibold text-gray-700"
                      >
                        {cl && <CleanerAvatar id={cl.id} name={name} sizeClass="h-5 w-5" textClass="text-[11px]" />}
                        {name.split(" ")[0]}
                        <span className="rounded-full bg-gray-900 px-1.5 py-0.5 text-[12px] font-bold leading-none text-white">
                          {count}
                        </span>
                      </span>
                    );
                  })}
                  {weekTotals.unassignedCount > 0 && (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-sm font-semibold text-amber-700">
                      Unassigned
                      <span className="rounded-full bg-amber-600 px-1.5 py-0.5 text-[12px] font-bold leading-none text-white">
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
                    className={`${getRoomColor(entry.checkoutBooking.room.name, entry.checkoutBooking.room.color)} rounded-md px-2 py-1 text-[13px] font-semibold text-black shadow-sm transition-transform hover:scale-105 ${
                      entry.probable
                        ? "outline-2 outline-dashed outline-red-500"
                        : entry.sameDayCheckIn
                          ? "ring-2 ring-red-500"
                          : ""
                    }`}
                  >
                    {entry.checkoutBooking.room.name}
                    {arrivalSuffix(entry.checkoutBooking.room.id, day.morningKey)}
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
                          className={`text-[13px] font-bold uppercase tracking-wide ${
                            isToday ? "text-violet-500" : "text-gray-400"
                          }`}
                        >
                          {format(morning, "EEE")}
                        </span>
                        <span className="text-sm font-bold text-gray-900">
                          {format(morning, "MMM d")}
                        </span>
                        {isToday && (
                          <span className="rounded-full bg-violet-600 px-1.5 py-0.5 text-[12px] font-bold uppercase leading-none text-white">
                            Today
                          </span>
                        )}
                      </div>
                      <span className="text-sm font-semibold text-gray-400">
                        {day.entries.length} room{day.entries.length === 1 ? "" : "s"}
                        {unassigned.length > 0 && (
                          <span className="text-amber-600"> · {unassigned.length} to assign</span>
                        )}
                      </span>
                    </div>
                    {/* One aligned row per cleaner (avatar + fixed-width name → chips line
                        up), unassigned rooms called out in amber at the bottom */}
                    <div className="divide-y divide-gray-100">
                      {/* Cleaners in a stable A→Z order so each person sits in the
                          same spot every day (the Map's insertion order followed
                          the rooms, which shuffled day to day). */}
                      {[...groups.values()]
                        .sort((a, b) => a.cleaner.name.localeCompare(b.cleaner.name))
                        .map(({ cleaner, entries }) => (
                        <div key={cleaner.id} className="flex items-center gap-2 px-3 py-1.5">
                          {/* Tap the cleaner (avatar or name) to text them this
                              week's schedule — same send + drift-tracking as the
                              Team Message menu. */}
                          <button
                            type="button"
                            onClick={() => textSchedule(cleaner, startOfWeek(morning, { weekStartsOn: 1 }))}
                            disabled={!cleaner.phone}
                            title={cleaner.phone ? `Text ${cleaner.name.split(" ")[0]} this week's schedule` : cleaner.name}
                            className="flex w-24 shrink-0 items-center gap-1.5 rounded-lg py-0.5 text-left transition-colors hover:bg-violet-50 disabled:cursor-default disabled:hover:bg-transparent"
                          >
                            <CleanerAvatar
                              id={cleaner.id}
                              name={cleaner.name}
                              sizeClass="h-6 w-6"
                              textClass="text-[12px]"
                            />
                            <span className="truncate text-sm font-semibold text-gray-700">
                              {cleaner.name.split(" ")[0]}
                            </span>
                          </button>
                          <div className="flex flex-1 flex-wrap items-center gap-1">
                            {entries.map(chip)}
                          </div>
                          {/* Right edge, clear of the name and the room chips. Drift
                              is per WEEK, so it flags on every day of the affected
                              week — each row is its own re-send tap. */}
                          {scheduleStatus(
                            cleaner.id,
                            startOfWeek(morning, { weekStartsOn: 1 }),
                          ) === "changed" && <ResendBadge />}
                        </div>
                      ))}
                      {unassigned.length > 0 && (
                        <div className="flex items-center gap-2 bg-amber-50/50 px-3 py-1.5">
                          <div className="flex w-24 shrink-0 items-center gap-1.5">
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-100 text-sm font-bold text-amber-600">
                              !
                            </span>
                            <span className="truncate text-sm font-semibold text-amber-600">
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

              <p className="mb-1 mt-2 text-center text-sm text-gray-400">
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
          {/* Start a day from nothing. Every card below comes from an assignment,
              so a cleaning that was never assigned — the outage case — would
              otherwise leave a cleaner unpaid with no way to enter it. */}
          {unplanned ? (
            <div className="mb-2 rounded-xl border border-violet-200 bg-violet-50 p-2.5">
              <p className="mb-1.5 text-sm font-bold text-gray-900">Cleaning that wasn't planned</p>
              <div className="flex flex-wrap items-center gap-1.5">
                <input
                  type="date"
                  className={inputCls}
                  value={unplanned.date}
                  max={todayKey}
                  onChange={(e) =>
                    setUnplanned((p) => (p ? { ...p, date: e.target.value } : p))
                  }
                />
                <select
                  className={inputCls}
                  value={unplanned.cleanerId}
                  onChange={(e) =>
                    setUnplanned((p) => (p ? { ...p, cleanerId: e.target.value } : p))
                  }
                >
                  <option value="">Who cleaned?</option>
                  {cleaners
                    .filter((c) => !c.paused)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </select>
                <button
                  type="button"
                  className={`${pillDark} ${!unplanned.cleanerId || !unplanned.date ? "opacity-40" : ""}`}
                  disabled={!unplanned.cleanerId || !unplanned.date}
                  onClick={() => {
                    const { cleanerId, date } = unplanned;
                    setExtraGroups((p) =>
                      p.some((e) => e.cleanerId === cleanerId && e.date === date)
                        ? p
                        : [...p, { cleanerId, date }],
                    );
                    setUnplanned(null);
                  }}
                >
                  Add
                </button>
                <button
                  type="button"
                  className={pillNeutral}
                  onClick={() => setUnplanned(null)}
                >
                  Cancel
                </button>
              </div>
              <p className="mt-1.5 text-[13px] text-gray-500">
                Creates the day below — then add the rooms and the hours.
              </p>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setUnplanned({ date: todayKey, cleanerId: "" })}
              className="mb-2 w-full rounded-xl border border-dashed border-violet-300 py-2 text-sm font-semibold text-violet-700 transition-colors hover:border-violet-500 hover:bg-violet-50"
            >
              + Record a cleaning that wasn't planned
            </button>
          )}
          {needHoursGroups.length === 0 ? (
            <p className="mb-2 rounded-xl border border-gray-200 bg-gray-50 p-2.5 text-center text-sm text-gray-400">
              Nothing to record yet — cleanings appear here once their day arrives
            </p>
          ) : (
            // Grouped by DAY. "Who cleaned on this date" is one decision, so the
            // day owns the heading and the + Add cleaner control — repeating that
            // button on every cleaner's panel read as if it were per-cleaner, and
            // the date was restated once per cleaner too.
            [...new Set(needHoursGroups.map((g) => g.date))].map((date) => {
              const dayGroups = needHoursGroups.filter((g) => g.date === date);
              const onDate = new Set(dayGroups.map((g) => g.cleaner.id));
              const addable = cleaners.filter((c) => !onDate.has(c.id) && !c.paused);
              const pickerOpen = addCleanerFor === date;
              return (
              <div
                key={date}
                className="mb-2 rounded-xl border border-amber-200 bg-amber-50 p-2.5"
              >
                <div className="mb-1.5 flex items-center gap-2 border-b border-amber-200/70 pb-1.5">
                  <p className="flex-1 text-sm font-bold text-gray-900">
                    {format(new Date(date + "T00:00:00"), "EEEE M/d")}
                  </p>
                  {addable.length > 0 && (
                    <span className="relative inline-flex shrink-0">
                      <button
                        type="button"
                        onClick={() => setAddCleanerFor(pickerOpen ? null : date)}
                        className="text-[13px] font-semibold text-violet-700 transition-colors hover:text-violet-900"
                      >
                        + Add cleaner
                      </button>
                      {pickerOpen && (
                        <>
                          <span
                            className="fixed inset-0 z-10"
                            onClick={() => setAddCleanerFor(null)}
                          />
                          <span className="absolute right-0 top-full z-20 mt-1 flex w-max flex-col overflow-hidden rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                            {addable.map((c) => (
                              <button
                                key={c.id}
                                type="button"
                                onClick={() => {
                                  setExtraGroups((p) => [...p, { cleanerId: c.id, date }]);
                                  setAddCleanerFor(null);
                                }}
                                className="flex items-center gap-2 px-2.5 py-1.5 text-left text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-100"
                              >
                                <CleanerAvatar id={c.id} name={c.name} sizeClass="h-5 w-5" textClass="text-[11px]" />
                                {c.name}
                              </button>
                            ))}
                          </span>
                        </>
                      )}
                    </span>
                  )}
                </div>
                {dayGroups.map((group) => (
                <div
                  key={group.key}
                  className="border-t border-amber-200/60 pt-2 first:border-t-0 first:pt-0 [&+div]:mt-2"
                >
                <div className="flex items-center gap-2">
                  <CleanerAvatar id={group.cleaner.id} name={group.cleaner.name} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-900">{group.cleaner.name}</p>
                  </div>
                  {/* How this cleaner reports: a decimal total, or come/leave times */}
                  <div className="flex shrink-0 rounded-lg bg-gray-100 p-0.5 text-[12px] font-semibold">
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
                      <label className="text-[12px] font-semibold text-gray-500">In</label>
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
                      <label className="text-[12px] font-semibold text-gray-500">Out</label>
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
                        <span className="text-sm font-bold text-emerald-600">
                          = {formatHrMin(hoursBetween(timeDraft[group.key]?.in, timeDraft[group.key]?.out)!)}
                        </span>
                      )}
                    </>
                  )}
                  </div>
                  <button
                    type="button"
                    className={`${pillDark} ${group.assignments.length === 0 ? "opacity-40" : ""}`}
                    disabled={group.assignments.length === 0}
                    title={
                      group.assignments.length === 0
                        ? "Move at least one room onto this cleaner first"
                        : "Save these hours"
                    }
                    onClick={() => handleSaveDayHours(group)}
                  >
                    Save
                  </button>
                </div>
                {/* Rooms cleaned that day — editable, because the plan is not
                    always what happened. The total hours cover them all. */}
                <div className="mt-1.5 flex flex-wrap items-center gap-1">
                  {group.assignments.map((a) => (
                    <span
                      key={a.id}
                      className={`${getRoomColor(a.room?.name ?? "", a.room ? roomColorById.get(a.room.id) : undefined)} inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[13px] font-semibold text-black`}
                    >
                      {a.room?.name}
                      <button
                        type="button"
                        title={`${group.cleaner.name.split(" ")[0]} did not clean ${a.room?.name} — remove`}
                        onClick={() => a.room && handleRemoveRoomFromDay(group.date, a.room.id)}
                        className="-mr-0.5 flex h-4 w-4 items-center justify-center rounded-full text-black/50 transition-colors hover:bg-black/15 hover:text-black"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                  {/* Add a room this cleaner actually did but was never assigned */}
                  {(() => {
                    // This tab only ever records the PAST, where what checked out
                    // is already known — so offer exactly those rooms. No forecast,
                    // no probable turnovers, nothing to pick by mistake. The Plan
                    // tab owns anything forward-looking.
                    const taken = new Set(group.assignments.map((a) => a.room?.id));
                    const turnedOver = checkoutRoomsOn(group.date);
                    const addable = addableRooms.filter(
                      (r) => !taken.has(r.id) && turnedOver.has(r.id),
                    );
                    if (addable.length === 0) return null;
                    const open = addRoomFor === group.key;
                    return (
                      <span className="relative inline-flex">
                        <button
                          type="button"
                          onClick={() => setAddRoomFor(open ? null : group.key)}
                          title="Add a room this cleaner actually cleaned"
                          className="rounded border border-dashed border-gray-400 px-1.5 py-0.5 text-[13px] font-semibold text-gray-500 transition-colors hover:border-gray-600 hover:text-gray-800"
                        >
                          + Room
                        </button>
                        {open && (
                          <>
                            {/* Click-away catcher, so the list closes without a
                                document listener fighting the button's onClick. */}
                            <span
                              className="fixed inset-0 z-10"
                              onClick={() => setAddRoomFor(null)}
                            />
                            <span className="absolute left-0 top-full z-20 mt-1 flex w-max flex-col overflow-hidden rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                              {addable.map((r) => (
                                <button
                                  key={r.id}
                                  type="button"
                                  onClick={() => handleAddRoomToDay(group, r.id)}
                                  className="px-2 py-1 text-left transition-colors hover:bg-gray-100"
                                >
                                  {/* RoomBadge is the system-wide room chip — same
                                      colour box everywhere a room is named. `rooms`
                                      gives every badge one width so they align. */}
                                  <RoomBadge room={r} rooms={addable} />
                                </button>
                              ))}
                            </span>
                          </>
                        )}
                      </span>
                    );
                  })()}
                </div>
                {/* A cleaner just added to the day has no rooms yet — say what to
                    do next, and let a mis-pick be undone. */}
                {group.assignments.length === 0 && (
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-[13px] text-gray-500">
                      Move a room across with <span className="font-semibold">+ Room</span>
                    </span>
                    <button
                      type="button"
                      title="Remove this cleaner from the day"
                      onClick={() =>
                        setExtraGroups((p) =>
                          p.filter(
                            (e) => !(e.cleanerId === group.cleaner.id && e.date === group.date),
                          ),
                        )
                      }
                      className="ml-auto text-[13px] font-semibold text-gray-400 transition-colors hover:text-gray-700"
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
                          <p className="text-sm text-gray-500">
                            {days.length} day{days.length === 1 ? "" : "s"} ·{" "}
                            {formatHrMin(totalHours)}
                          </p>
                        </div>
                        <span className="shrink-0 text-sm text-gray-400">{open ? "▲" : "▼"}</span>
                      </button>
                      {open && (
                        <div className="space-y-1.5 border-t border-gray-100 p-2">
                          {days.map((group) => (
                            <div
                              key={group.key}
                              className="flex items-center gap-2 rounded-lg bg-gray-50 p-2"
                            >
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm text-gray-600">
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
                    <p className="text-sm font-semibold text-emerald-700">
                      Cleaning cost — {format(startOfToday(), "MMMM")}
                    </p>
                    <p className="text-2xl font-bold text-emerald-700">
                      ${Math.round(thisMonthCost).toLocaleString()}
                    </p>
                  </div>
                  <p className="mt-0.5 text-sm text-emerald-600">
                    {owingCount > 0
                      ? `$${Math.round(owed).toLocaleString()} owed now · ${owingCount} cleaner${owingCount === 1 ? "" : "s"} waiting`
                      : "all settled up 🎉"}
                  </p>
                </div>
              );
            })()}
          {summary.length === 0 ? (
            <p className="mb-2 rounded-xl border border-gray-200 bg-gray-50 p-2.5 text-center text-sm text-gray-400">
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
                  {/* Tap the name to text this cleaner their earnings-so-far;
                      tap elsewhere on the row to open pay/payout detail. */}
                  <p className="truncate text-sm font-semibold text-gray-900">
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        textPayment(entry);
                      }}
                      title={`Text ${entry.name.split(" ")[0]} their earnings so far`}
                      className="cursor-pointer underline decoration-dotted decoration-gray-300 underline-offset-2 hover:text-emerald-600"
                    >
                      {entry.name}
                    </span>
                  </p>
                  {/* Only the work still owed for. Lifetime hours/earned/paid
                      answered a question nobody asks at the moment of paying —
                      and sat beside the balance as if competing with it. */}
                  <p className="text-sm text-gray-500">
                    {entry.balance > 0.5 ? (
                      <>
                        {formatHrMin(entry.unpaidHours ?? 0)} unpaid
                        {entry.unpaidSince
                          ? ` · since ${format(new Date(entry.unpaidSince + "T00:00:00"), "MMM d")}`
                          : ""}
                      </>
                    ) : (
                      // Paid above the hours on record is a tip, not an alarm.
                      // Still shown, because it can also be a cleaning nobody
                      // entered — but entering it moves the money from tip to
                      // wages by itself, so there is nothing to undo.
                      (entry.impliedTip ?? 0) > 0.005 ? (
                        <span className="text-violet-600">
                          All paid up · ${(entry.impliedTip ?? 0).toFixed(2)} tip
                        </span>
                      ) : (
                        "All paid up"
                      )
                    )}
                  </p>
                </div>
                <span
                  className={`shrink-0 text-lg font-bold ${
                    entry.balance > 0.5 ? "text-emerald-600" : "text-gray-300"
                  }`}
                >
                  ${Math.max(0, entry.balance).toFixed(2)}
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
              <p className="rounded-xl border border-gray-200 bg-gray-50 p-2.5 text-center text-sm text-gray-400">
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
                  <p className="shrink-0 text-sm text-gray-500">
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

      {/* Focused edit — a modal centered on ONLY the cleaner being edited, so
          the (now many) settings have room and there's no mixing people up. */}
      {editCleaner && (
        <div
          className="modal-type fixed inset-0 z-[120] flex items-center justify-center bg-black/40 p-4"
          onClick={() => setEditingId(null)}
        >
          <div
            className="flex max-h-[85vh] w-full max-w-sm flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center gap-2.5 border-b border-gray-100 p-4">
              <CleanerAvatar
                id={editCleaner.id}
                name={edit.name || editCleaner.name}
                sizeClass="h-10 w-10"
                textClass="text-sm"
              />
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-lg font-bold text-gray-900">
                  {edit.name || editCleaner.name}
                </h3>
                <p className="text-sm text-gray-500">Edit team member</p>
              </div>
              <button
                type="button"
                onClick={() => setEditingId(null)}
                aria-label="Close"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xl leading-none text-gray-400"
              >
                &times;
              </button>
            </div>
            {/* Body */}
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
              <div className="grid grid-cols-2 gap-2">
                <label className="col-span-2 flex flex-col gap-1 text-[13px] font-semibold uppercase tracking-wide text-gray-400">
                  Name
                  <input
                    className={inputCls}
                    value={edit.name}
                    onChange={(e) => setEdit((p) => ({ ...p, name: e.target.value }))}
                  />
                </label>
                <label className="flex flex-col gap-1 text-[13px] font-semibold uppercase tracking-wide text-gray-400">
                  Phone
                  <input
                    className={inputCls}
                    type="tel"
                    value={edit.phone}
                    onChange={(e) => setEdit((p) => ({ ...p, phone: e.target.value }))}
                  />
                </label>
                <label className="flex flex-col gap-1 text-[13px] font-semibold uppercase tracking-wide text-gray-400">
                  $/hr
                  <input
                    className={inputCls}
                    type="number"
                    value={edit.payRate}
                    onChange={(e) => setEdit((p) => ({ ...p, payRate: e.target.value }))}
                  />
                </label>
              </div>
              {/* Says what saving a different figure actually does, so a raise is
                  never mistaken for a correction of the existing rate. */}
              {(parseFloat(edit.payRate) || 0) !== editOriginalRate.current && (
                <p className="-mt-1 text-[13px] text-amber-700">
                  Saves as a rate change from today (${editOriginalRate.current} → $
                  {parseFloat(edit.payRate) || 0}/hr). Work already recorded keeps
                  ${editOriginalRate.current}/hr.
                </p>
              )}

              {/* Rate changes — raise pay from a date WITHOUT re-pricing past work */}
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-2.5">
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-[13px] font-semibold uppercase tracking-wide text-gray-400">
                    Rate changes
                  </span>
                  <span className="text-[13px] text-gray-500">
                    now{" "}
                    <b className="text-emerald-600">
                      ${rateOn({ payRate: parseFloat(edit.payRate) || 0, rateHistory: edit.rateHistory }, todayKey)}
                      /hr
                    </b>
                  </span>
                </div>
                {edit.rateHistory.length > 0 && (
                  <ul className="mb-1.5 space-y-1">
                    {[...edit.rateHistory]
                      .sort((a, b) => (a.effectiveFrom < b.effectiveFrom ? -1 : 1))
                      .map((h, i) => (
                        <li
                          key={`${h.effectiveFrom}-${i}`}
                          className="flex items-center justify-between rounded-lg bg-white px-2 py-1 text-sm"
                        >
                          <span className="min-w-0 text-gray-700">
                            ${h.rate}/hr from{" "}
                            {format(new Date(`${h.effectiveFrom}T00:00:00`), "MMM d, yyyy")}
                            {h.effectiveFrom > todayKey && (
                              <span className="ml-1 text-[12px] font-semibold text-amber-600">
                                upcoming
                              </span>
                            )}
                            {editCleaner.phone && (
                              <button
                                type="button"
                                className="ml-2 font-semibold text-emerald-600 hover:underline"
                                onClick={() => textRaise(edit.name || editCleaner.name, editCleaner.phone, h)}
                                title="Text the good news to the cleaner"
                              >
                                Text
                              </button>
                            )}
                          </span>
                          <button
                            type="button"
                            aria-label="Remove rate change"
                            className="text-gray-300 hover:text-rose-500"
                            onClick={() =>
                              persistRateHistory(
                                edit.rateHistory.filter(
                                  (x) => !(x.rate === h.rate && x.effectiveFrom === h.effectiveFrom),
                                ),
                              )
                            }
                          >
                            &times;
                          </button>
                        </li>
                      ))}
                  </ul>
                )}
                <div className="flex gap-1.5">
                  <label className="flex min-w-0 flex-1 flex-col gap-0.5 text-[12px] uppercase tracking-wide text-gray-400">
                    New $/hr
                    <input
                      className={`${inputCls} w-full min-w-0`}
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={raiseDraft.rate}
                      onChange={(e) => setRaiseDraft((p) => ({ ...p, rate: e.target.value }))}
                    />
                  </label>
                  <label className="flex min-w-0 flex-1 flex-col gap-0.5 text-[12px] uppercase tracking-wide text-gray-400">
                    From
                    <input
                      className={`${inputCls} w-full min-w-0`}
                      type="date"
                      value={raiseDraft.from}
                      onChange={(e) => setRaiseDraft((p) => ({ ...p, from: e.target.value }))}
                    />
                  </label>
                </div>
                <button
                  type="button"
                  className="mt-1.5 w-full rounded-lg bg-emerald-600 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
                  onClick={addRaise}
                >
                  Add raise
                </button>
                <p className="mt-1 text-[12px] text-gray-400">
                  Saved instantly — no need to press Save. Past cleanings keep their old rate; the new
                  rate applies from the date you pick. (The $/hr field above is the base rate —
                  changing it re-prices past work.)
                </p>
              </div>

              <div>
                <p className="mb-1 text-[13px] font-semibold uppercase tracking-wide text-gray-400">
                  Avatar
                </p>
                <div className="flex items-center gap-2">
                  <img
                    src={generateAvatar(edit.name || "?", edit.character)}
                    alt="avatar preview"
                    className="h-10 w-10 shrink-0 rounded-full object-cover"
                  />
                  <input
                    className={`${inputCls} min-w-0 flex-1`}
                    placeholder="e.g. glasses, long brown hair, beard"
                    value={edit.character}
                    onChange={(e) => setEdit((p) => ({ ...p, character: e.target.value }))}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between gap-2">
                <label className="text-sm text-gray-500">
                  Available days
                  <span className="block text-[12px] text-gray-400">blank = auto from history</span>
                </label>
                <DayPicker
                  days={edit.availableDays}
                  onChange={(d) => setEdit((p) => ({ ...p, availableDays: d }))}
                />
              </div>

              <div className="flex items-center justify-between gap-2">
                <label className="text-sm text-gray-500">
                  Priority
                  <span className="block text-[12px] text-gray-400">favored in auto-plan · 3 = normal</span>
                </label>
                <StarPicker
                  value={edit.priority}
                  onChange={(v) => setEdit((p) => ({ ...p, priority: v }))}
                />
              </div>

              <div className="flex items-center justify-between gap-2">
                <label className="text-sm text-gray-500">
                  Rooms per trip
                  <span className="block text-[12px] text-gray-400">
                    min = won&apos;t come for fewer · max 0 = no cap
                  </span>
                </label>
                <div className="flex items-center gap-1">
                  <div className="flex flex-col items-center">
                    <input
                      type="number"
                      min={0}
                      inputMode="numeric"
                      value={edit.minRooms}
                      onChange={(e) => setEdit((p) => ({ ...p, minRooms: e.target.value }))}
                      className="w-12 rounded-lg border border-gray-300 px-1 py-1 text-center text-sm"
                      aria-label="Minimum rooms"
                    />
                    <span className="text-[12px] uppercase tracking-wide text-gray-400">min</span>
                  </div>
                  <span className="pb-3 text-gray-300">–</span>
                  <div className="flex flex-col items-center">
                    <input
                      type="number"
                      min={0}
                      inputMode="numeric"
                      value={edit.maxRooms}
                      onChange={(e) => setEdit((p) => ({ ...p, maxRooms: e.target.value }))}
                      className="w-12 rounded-lg border border-gray-300 px-1 py-1 text-center text-sm"
                      aria-label="Maximum rooms"
                    />
                    <span className="text-[12px] uppercase tracking-wide text-gray-400">max</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between gap-2">
                <label className="text-sm text-gray-500">
                  Owner
                  <span className="block text-[12px] text-gray-400">
                    you / Cindy — auto-plan uses only as a last resort
                  </span>
                </label>
                <Toggle
                  on={edit.isOwner}
                  color="emerald"
                  onClick={() => setEdit((p) => ({ ...p, isOwner: !p.isOwner }))}
                />
              </div>

              <div className="flex items-center justify-between gap-2">
                <label className="text-sm text-gray-500">
                  On leave
                  <span className="block text-[12px] text-gray-400">skip in auto-plan while away</span>
                </label>
                <Toggle
                  on={edit.paused}
                  color="amber"
                  onClick={() => setEdit((p) => ({ ...p, paused: !p.paused }))}
                />
              </div>

              <div className="flex items-center justify-between gap-2">
                <label className="flex-1 text-sm text-gray-500">
                  Baseline hrs already worked this month
                </label>
                <input
                  className={`${inputCls} w-20`}
                  type="number"
                  step="0.5"
                  min="0"
                  placeholder="hrs"
                  value={edit.baselineHours}
                  onChange={(e) => setEdit((p) => ({ ...p, baselineHours: e.target.value }))}
                />
              </div>
            </div>
            {/* Footer — prominent, full-width Save so it's never missed */}
            <div className="flex shrink-0 items-center gap-2 border-t border-gray-200 bg-white p-3">
              <button
                type="button"
                className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50"
                onClick={() => setEditingId(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="flex-1 rounded-lg bg-emerald-600 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-emerald-700"
                onClick={() => handleSaveEdit(editCleaner.id)}
              >
                Save changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Focused per-cleaner pay detail — keeps the Pay list clean no matter
          how many recorded days a cleaner has. Tapping a row opens this. */}
      {detailEntry &&
        (() => {
          const entry = detailEntry;
          const cleaner = cleaners.find((c) => c.id === entry.id);
          const dayRate = (d: string) => (cleaner ? rateOn(cleaner, d) : 0);
          const days = cleanerDayHours(entry.id);
          const subtotal = days.reduce((s, [date, h]) => s + h * dayRate(date), 0);
          const tip = parseFloat(tipDraft[entry.id]) || 0;
          return (
            <div
              className="modal-type fixed inset-0 z-[120] flex items-center justify-center bg-black/40 p-4"
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
                      <p className="text-sm text-gray-500">
                        {entry.balance > 0.5
                          ? `${formatHrMin(entry.unpaidHours ?? 0)} unpaid`
                          : "All paid up"}
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
                  {error && <p className="mb-2 text-sm font-semibold text-red-500">{error}</p>}
                  {/* Balance owed — with the reconciliation spelled out so it's
                      clear WHY it's less than the gross monthly hours below. */}
                  <div className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-emerald-700">Balance owed</span>
                      <span className="text-2xl font-bold text-emerald-700">
                        ${Math.max(0, entry.balance).toFixed(2)}
                      </span>
                    </div>
                    {/* Says what the money BUYS, not a lifetime subtraction. The
                        old "all-time earned − paid" made the host reconcile two
                        large numbers to trust one small one. */}
                    <p className="mt-0.5 text-[13px] text-emerald-600">
                      {entry.balance > 0.5
                        ? `${formatHrMin(entry.unpaidHours ?? 0)} worked${
                            entry.unpaidSince
                              ? ` since ${format(new Date(entry.unpaidSince + "T00:00:00"), "MMM d")}`
                              : ""
                          }`
                        : (entry.impliedTip ?? 0) > 0.005
                          ? // Paid above the hours on record. Treated as a tip, which is
                            // what it usually is — a few dollars added to a payout as a
                            // thank-you. Said plainly rather than flagged, but said, since
                            // it can also be a cleaning that was never entered: add it in
                            // Record and the surplus becomes wages on its own.
                            `All paid up · $${(entry.impliedTip ?? 0).toFixed(2)} counted as a tip. If a cleaning is missing, add it in Record.`
                          : "All paid up"}
                    </p>
                  </div>

                  {/* Hours by date — scrolls so a heavy month never runs long */}
                  <p className="mb-1 text-[12px] font-semibold uppercase tracking-wide text-gray-400">
                    {format(startOfToday(), "MMMM")} — hours by date
                  </p>
                  <div className="max-h-48 overflow-y-auto rounded-lg bg-gray-50 p-2">
                    {days.length === 0 ? (
                      <p className="py-1 text-center text-[13px] text-gray-400">
                        No recorded hours this month
                      </p>
                    ) : (
                      days.map(([date, hrs]) => (
                        <div key={date} className="flex items-center gap-2 py-0.5 text-sm">
                          <span className="flex-1 text-gray-600">
                            {format(new Date(date + "T00:00:00"), "EEE M/d")}
                          </span>
                          <span className="text-gray-500">{formatHrMin(hrs)}</span>
                          <span className="w-16 text-right font-semibold text-gray-800">
                            ${(hrs * dayRate(date)).toFixed(2)}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="mt-1 flex items-center justify-between px-1 text-[13px] text-gray-400">
                    <span>This month's work (gross)</span>
                    <span className="font-semibold">${subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between px-1 text-[13px] text-gray-400">
                    <span>Paid so far (all-time)</span>
                    <span className="font-semibold">${entry.paid.toFixed(2)}</span>
                  </div>

                  {/* Every payout itemised. A duplicate is obvious here in a way
                      a single running total could never show, and one entry can
                      be undone without guessing an offsetting amount. */}
                  {((entry.payments?.length ?? 0) > 0 || (entry.openingPaid ?? 0) > 0.005) && (
                    <div className="mt-2 rounded-xl border border-gray-200 p-2">
                      <p className="mb-1 text-[12px] font-semibold uppercase tracking-wide text-gray-400">
                        Payments
                      </p>
                      {(entry.payments ?? []).map((p) => (
                        <div
                          key={p.id}
                          className="flex items-center gap-2 border-b border-gray-100 py-1 last:border-b-0"
                        >
                          <span className="w-20 shrink-0 text-[13px] text-gray-500">
                            {format(new Date(p.paidOn + "T00:00:00"), "MMM d")}
                          </span>
                          <span
                            className={`flex-1 text-sm font-semibold ${
                              p.amount < 0 ? "text-red-600" : "text-gray-800"
                            }`}
                          >
                            {p.amount < 0 ? "−" : ""}${Math.abs(p.amount).toFixed(2)}
                          </span>
                          {/* Which money this was. A tip and a payout look the
                              same in a list of amounts, and they mean opposite
                              things for what is still owed. */}
                          {p.tip && (
                            <span className="shrink-0 rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] font-bold text-violet-700">
                              tip
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => handleRemovePayment(entry.id, p.id)}
                            className={`shrink-0 rounded-md px-2 py-0.5 text-[12px] font-semibold transition-colors ${
                              removeArmed === p.id
                                ? "bg-red-600 text-white"
                                : "text-gray-400 hover:text-red-600"
                            }`}
                          >
                            {removeArmed === p.id ? "Confirm" : "Remove"}
                          </button>
                        </div>
                      ))}
                      {(entry.openingPaid ?? 0) > 0.005 && (
                        <div className="flex items-center gap-2 py-1 text-gray-400">
                          <span className="w-20 shrink-0 text-[13px]">earlier</span>
                          <span className="flex-1 text-sm font-semibold">
                            ${entry.openingPaid!.toFixed(2)}
                          </span>
                          <span
                            className="shrink-0 text-[12px]"
                            title="Paid before payouts were logged individually — cannot be removed one by one"
                          >
                            not itemised
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                  <p className="mt-0.5 px-1 text-[12px] text-gray-400">
                    A record of recent work — not the amount due. What you owe is the Balance owed above
                    (already net of everything you've paid).
                  </p>

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
                    <span className="font-semibold text-gray-700">
                      To pay{tip > 0 ? " (incl. tip)" : ""}
                    </span>
                    <span className="font-bold text-emerald-600">
                      ${(Math.max(0, entry.balance) + tip).toFixed(2)}
                    </span>
                  </div>

                  {/* Text the payment/earnings statement right from the Pay detail
                      (Cindy's ask) — also available in the Team Message menu. */}
                  {(() => {
                    const payCleaner = cleaners.find((c) => c.id === entry.id);
                    return payCleaner?.phone ? (
                      <button
                        type="button"
                        onClick={() => textPayment(entry)}
                        className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-gray-200 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                      >
                        💬 Text {payCleaner.name.split(" ")[0]} payment
                      </button>
                    ) : null;
                  })()}

                  {/* Payout / Undo mistake */}
                  <div className="mt-4 border-t border-gray-100 pt-3">
                    <div className="mb-1.5 grid grid-cols-3 gap-1 rounded-lg bg-gray-100 p-0.5">
                      {(
                        [
                          { key: "payout", label: "Payout" },
                          { key: "tip", label: "Tip" },
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
                          className={`rounded-md py-1 text-[13px] font-semibold ${
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
                      <label className="text-sm text-gray-500">
                        {payMode === "payout" ? "Pay $" : payMode === "tip" ? "Tip $" : "Undo $"}
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
                            ? `flex-1 rounded-lg px-2.5 py-1.5 text-sm font-bold text-white ${
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
                            : payMode === "tip"
                              ? "Record tip"
                              : "Record undo"}
                      </button>
                    </div>
                    <p className="mt-1 text-[12px] text-gray-400">
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
          className="modal-type fixed inset-0 z-[120] flex items-end justify-center bg-black/40 p-4 sm:items-center"
          onClick={() => setAssignTarget(null)}
        >
          <div
            className="w-full max-w-xs overflow-hidden rounded-2xl bg-white p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm font-bold text-gray-900">{assignTarget.roomName}</p>
            <p className="mb-3 text-sm text-gray-500">
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
                    textClass="text-[13px]"
                  />
                  <span className="min-w-0 flex-1 truncate text-left">{cleaner.name}</span>
                  <span className={`text-sm ${isAssigned ? "text-gray-300" : "text-emerald-600"}`}>
                    ${rateOn(cleaner, todayKey)}/hr
                  </span>
                  {isAssigned && <span className="text-sm font-bold">✓</span>}
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
