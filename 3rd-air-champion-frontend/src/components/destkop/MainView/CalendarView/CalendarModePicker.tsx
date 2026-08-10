import { useState } from "react";
import { MdCleaningServices } from "react-icons/md";
import { FaUserFriends, FaDoorOpen, FaChevronDown } from "react-icons/fa";
import PickerModal, { PickerOption } from "../../../shared/PickerModal";

export type CalendarMode = "book" | "gaps" | "clean";

// The three lenses the calendar can be read through. Each re-reads the same
// month, so they were never combinable — one picker, one answer.
//
// The hint matters more than the name: "Gaps" and "Clean" say nothing about
// what you will actually see, and the old <select> had nowhere to put that.
const MODES: (PickerOption<CalendarMode> & { trigger: string })[] = [
  {
    value: "book",
    label: "Guest",
    hint: "Who is staying, room by room",
    Icon: FaUserFriends,
    accent: "bg-gray-400",
    rowActive: "bg-gray-50 text-gray-900",
    trigger: "border-gray-300 bg-white text-gray-700",
  },
  {
    value: "gaps",
    label: "Gaps",
    hint: "Open nights still to sell",
    Icon: FaDoorOpen,
    accent: "bg-green-500",
    rowActive: "bg-green-50 text-green-800",
    trigger: "border-green-500 bg-green-500 text-white",
  },
  {
    value: "clean",
    label: "Clean",
    hint: "Turnovers and who is on them",
    Icon: MdCleaningServices,
    accent: "bg-teal-600",
    rowActive: "bg-teal-50 text-teal-800",
    trigger: "border-teal-600 bg-teal-600 text-white",
  },
];

interface CalendarModePickerProps {
  mode: CalendarMode;
  onChange: (mode: CalendarMode) => void;
}

const CalendarModePicker = ({ mode, onChange }: CalendarModePickerProps) => {
  const [open, setOpen] = useState(false);
  const current = MODES.find((m) => m.value === mode) ?? MODES[0];
  const Icon = current.Icon!;

  return (
    <>
      {/* The trigger keeps the mode's colour, so what the calendar is showing is
          readable without opening anything. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="What the calendar bars show"
        className={`flex shrink-0 items-center gap-1 rounded-lg border px-2 py-1 text-sm font-semibold transition-colors ${current.trigger}`}
      >
        <Icon size={13} className="shrink-0" />
        {current.label}
        <FaChevronDown size={9} className="shrink-0" />
      </button>

      <PickerModal
        open={open}
        title="Calendar view"
        subtitle="What the bars on the calendar show"
        options={MODES}
        value={mode}
        onChange={onChange}
        onClose={() => setOpen(false)}
      />
    </>
  );
};

export default CalendarModePicker;