import { useEffect, useRef, useState } from "react";
import { MdCleaningServices } from "react-icons/md";
import { FaUserFriends, FaDoorOpen, FaChevronDown, FaCheck } from "react-icons/fa";

export type CalendarMode = "book" | "gaps" | "clean";

// The three lenses the calendar can be read through. Each re-reads the same
// month, so they were never combinable — one picker, one answer.
//
// The description matters more than the name: "Gaps" and "Clean" say nothing
// about what you will actually see, and a native <select> has nowhere to put
// that. Cindy uses Clean daily and had to learn it by trying it.
const MODES: {
  value: CalendarMode;
  label: string;
  hint: string;
  Icon: React.ComponentType<{ size?: number; className?: string }>;
  // Kept as whole class strings, not interpolated fragments — Tailwind only
  // ships classes it can see written out.
  dot: string;
  activeTrigger: string;
  activeRow: string;
}[] = [
  {
    value: "book",
    label: "Guest",
    hint: "Who is staying, room by room",
    Icon: FaUserFriends,
    dot: "bg-gray-400",
    activeTrigger: "border-gray-300 bg-white text-gray-700",
    activeRow: "bg-gray-50 text-gray-900",
  },
  {
    value: "gaps",
    label: "Gaps",
    hint: "Open nights still to sell",
    Icon: FaDoorOpen,
    dot: "bg-green-500",
    activeTrigger: "border-green-500 bg-green-500 text-white",
    activeRow: "bg-green-50 text-green-800",
  },
  {
    value: "clean",
    label: "Clean",
    hint: "Turnovers and who is on them",
    Icon: MdCleaningServices,
    dot: "bg-teal-600",
    activeTrigger: "border-teal-600 bg-teal-600 text-white",
    activeRow: "bg-teal-50 text-teal-800",
  },
];

interface CalendarModePickerProps {
  mode: CalendarMode;
  onChange: (mode: CalendarMode) => void;
}

const CalendarModePicker = ({ mode, onChange }: CalendarModePickerProps) => {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const current = MODES.find((m) => m.value === mode) ?? MODES[0];

  // Close on outside tap or Escape. The calendar beneath is the whole screen on
  // a phone, so a stray tap must dismiss rather than fall through to a date.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="What the calendar bars show"
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`flex items-center gap-1 rounded-lg border px-2 py-1 text-sm font-semibold transition-colors ${current.activeTrigger}`}
      >
        <current.Icon size={13} className="shrink-0" />
        {current.label}
        <FaChevronDown
          size={9}
          className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        // Right-aligned: this sits near the right edge of a phone header, and a
        // left-aligned panel would run off screen.
        <div
          role="listbox"
          className="absolute right-0 z-50 mt-1 w-60 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg"
        >
          {MODES.map((m) => {
            const selected = m.value === mode;
            return (
              <button
                key={m.value}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => {
                  onChange(m.value);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors ${
                  selected ? m.activeRow : "text-gray-700 hover:bg-gray-50"
                }`}
              >
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white ${m.dot}`}
                >
                  <m.Icon size={13} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold leading-tight">{m.label}</span>
                  <span className="block text-[11px] leading-tight text-gray-500">{m.hint}</span>
                </span>
                {selected && <FaCheck size={11} className="shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CalendarModePicker;