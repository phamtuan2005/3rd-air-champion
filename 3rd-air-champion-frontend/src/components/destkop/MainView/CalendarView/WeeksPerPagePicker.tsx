import { useState } from "react";
import { FaChevronDown, FaRegCalendarAlt } from "react-icons/fa";
import PickerModal, { PickerOption } from "../../../shared/PickerModal";

// How many week-rows fit on one calendar page.
//
// The hints say what actually changes, which the bare "1w / 2w / …" dropdown
// could not: at one or two weeks the calendar becomes a filmstrip you swipe
// sideways, at three and up it scrolls down like a document. That is a real
// difference in how the calendar feels, and it was undiscoverable.
const OPTIONS: PickerOption<number>[] = [
  {
    value: 1,
    label: "1 week",
    hint: "Biggest rows · swipe sideways",
    Icon: FaRegCalendarAlt,
    accent: "bg-indigo-500",
    rowActive: "bg-indigo-50 text-indigo-800",
  },
  {
    value: 2,
    label: "2 weeks",
    hint: "Roomy · swipe sideways",
    Icon: FaRegCalendarAlt,
    accent: "bg-indigo-500",
    rowActive: "bg-indigo-50 text-indigo-800",
  },
  {
    value: 3,
    label: "3 weeks",
    hint: "Balanced · scroll down",
    Icon: FaRegCalendarAlt,
    accent: "bg-indigo-500",
    rowActive: "bg-indigo-50 text-indigo-800",
  },
  {
    value: 4,
    label: "4 weeks",
    hint: "Most of a month · scroll down",
    Icon: FaRegCalendarAlt,
    accent: "bg-indigo-500",
    rowActive: "bg-indigo-50 text-indigo-800",
  },
  {
    value: 5,
    label: "5 weeks",
    hint: "A whole month at once · scroll down",
    Icon: FaRegCalendarAlt,
    accent: "bg-indigo-500",
    rowActive: "bg-indigo-50 text-indigo-800",
  },
];

interface WeeksPerPagePickerProps {
  value: number;
  onChange: (value: number) => void;
}

const WeeksPerPagePicker = ({ value, onChange }: WeeksPerPagePickerProps) => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Weeks visible per screen"
        className="flex shrink-0 items-center gap-1 rounded-lg border border-gray-300 px-2 py-1 text-sm font-semibold text-gray-500 transition-colors hover:text-gray-700"
      >
        {value}w
        <FaChevronDown size={9} className="shrink-0" />
      </button>

      <PickerModal
        open={open}
        title="Weeks on screen"
        subtitle="How much of the month fits on one page"
        options={OPTIONS}
        value={value}
        onChange={onChange}
        onClose={() => setOpen(false)}
      />
    </>
  );
};

export default WeeksPerPagePicker;