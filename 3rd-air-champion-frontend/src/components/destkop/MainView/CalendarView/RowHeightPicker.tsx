import { useState } from "react";
import { FaChevronDown, FaTextHeight } from "react-icons/fa";
import PickerModal, { PickerOption } from "../../../shared/PickerModal";

// How tall each room's lane is, in pixels.
//
// The colour bar fills its lane (top/bottom pinned 1px inside it) and the guest
// name scales with it, so this one number controls how readable a night is —
// which matters more on a phone held at arm's length than any other calendar
// setting. 26 is the long-standing default and stays the middle option.
export const ROW_HEIGHTS = [20, 26, 32, 40] as const;

const OPTIONS: PickerOption<number>[] = [
  {
    value: 20,
    label: "Compact",
    hint: "Most nights on screen · small text",
    Icon: FaTextHeight,
    accent: "bg-slate-400",
    rowActive: "bg-slate-50 text-slate-800",
  },
  {
    value: 26,
    label: "Normal",
    hint: "The usual balance",
    Icon: FaTextHeight,
    accent: "bg-slate-500",
    rowActive: "bg-slate-50 text-slate-800",
  },
  {
    value: 32,
    label: "Large",
    hint: "Easier to read across the room",
    Icon: FaTextHeight,
    accent: "bg-slate-600",
    rowActive: "bg-slate-100 text-slate-900",
  },
  {
    value: 40,
    label: "Extra large",
    hint: "Biggest names · fewest weeks per page",
    Icon: FaTextHeight,
    accent: "bg-slate-800",
    rowActive: "bg-slate-100 text-slate-900",
  },
];

interface RowHeightPickerProps {
  value: number;
  onChange: (value: number) => void;
}

const RowHeightPicker = ({ value, onChange }: RowHeightPickerProps) => {
  const [open, setOpen] = useState(false);
  const current = OPTIONS.find((o) => o.value === value) ?? OPTIONS[1];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Row height"
        className="flex shrink-0 items-center gap-1 rounded-lg border border-gray-300 px-2 py-1 text-sm font-semibold text-gray-500 transition-colors hover:text-gray-700"
      >
        <FaTextHeight size={11} className="shrink-0" />
        <FaChevronDown size={9} className="shrink-0" />
      </button>

      <PickerModal
        open={open}
        title="Row height"
        subtitle={`Currently ${current.label.toLowerCase()} — taller rows mean bigger names`}
        options={OPTIONS}
        value={value}
        onChange={onChange}
        onClose={() => setOpen(false)}
      />
    </>
  );
};

export default RowHeightPicker;