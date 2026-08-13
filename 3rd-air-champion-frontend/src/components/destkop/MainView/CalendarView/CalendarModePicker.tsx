import { useState } from "react";
import { MdCleaningServices } from "react-icons/md";
import { FaUserFriends, FaDoorOpen, FaChevronDown, FaHourglassHalf } from "react-icons/fa";
import PickerModal, { PickerOption } from "../../../shared/PickerModal";

export type CalendarMode = "book" | "gaps" | "clean" | "reserved";

// The three lenses the calendar can be read through. Each re-reads the same
// month, so they were never combinable — one picker, one answer.
//
// The hint matters more than the name: "Gaps" and "Clean" say nothing about
// what you will actually see, and the old <select> had nowhere to put that.
const MODES: (PickerOption<CalendarMode> & { trigger: string })[] = [
  // Colour carries meaning here, so it has to agree with the business.
  //
  // Guest was grey, which in every other part of the UI means disabled or
  // finished — a poor thing to say about the paying occupants of the house.
  // Emerald is the money colour already used for gross and net in Stats, and a
  // full house is exactly what it stands for. The trigger keeps a white fill so
  // the default view does not shout from the header all day; the outline and
  // icon carry the colour.
  {
    value: "book",
    label: "Guest",
    hint: "Who is staying, room by room",
    Icon: FaUserFriends,
    accent: "bg-emerald-600",
    rowActive: "bg-emerald-50 text-emerald-900",
    trigger: "border-emerald-600 bg-white text-emerald-700",
  },
  // Gaps was green, which reads as "good". An unsold night is the opposite: it
  // is revenue that will never be recovered, since a Tuesday cannot be sold on
  // Wednesday. Rose is what Stats already uses for a losing month, so the two
  // surfaces now agree about what an empty night costs.
  {
    value: "gaps",
    label: "Gaps",
    hint: "Nights not earning yet",
    Icon: FaDoorOpen,
    accent: "bg-rose-500",
    rowActive: "bg-rose-50 text-rose-800",
    trigger: "border-rose-500 bg-rose-500 text-white",
  },
  {
    value: "reserved",
    label: "Reserved",
    hint: "Nights held but not yet paid",
    Icon: FaHourglassHalf,
    accent: "bg-amber-500",
    rowActive: "bg-amber-50 text-amber-800",
    trigger: "border-amber-500 bg-amber-500 text-white",
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