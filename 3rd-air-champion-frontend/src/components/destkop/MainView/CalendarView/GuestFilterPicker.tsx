import { useMemo, useState } from "react";
import { FaChevronDown, FaUser } from "react-icons/fa";
import PickerModal, { PickerOption } from "../../../shared/PickerModal";
import { dayType } from "../../../../util/types/dayType";
import { guestType } from "../../../../util/types/guestType";
import { format, startOfToday } from "date-fns";

interface GuestFilterPickerProps {
  guests: guestType[];
  monthMap: Map<string, dayType>;
  // The filtered guest's id, or null for everyone.
  value: string | null;
  onChange: (guestId: string | null) => void;
}

const ANYONE = "__anyone__";

// Filtering the calendar to one guest, without having to find them on it first.
//
// The only way in used to be: spot one of their bookings by eye, tap it, open
// the card, press Filter. That asks the host to do the searching the app is
// holding the data for — and it cannot be done at all for a guest whose stay is
// in a month not currently on screen.
//
// The name in the header IS this control once a guest is picked, so switching
// to another or going back to everyone is one tap from where the filter is
// already announced.
const GuestFilterPicker = ({ guests, monthMap, value, onChange }: GuestFilterPickerProps) => {
  const [open, setOpen] = useState(false);

  // Each guest's NEXT night from today, and their most recent one before it.
  // Sorting on this is what makes the list useful: the guest a host wants is
  // almost always one who is here soon, not the alphabetically first of eighty.
  const stayInfo = useMemo(() => {
    const todayKey = format(startOfToday(), "yyyy-MM-dd");
    const next = new Map<string, string>();
    const last = new Map<string, string>();
    monthMap.forEach((day, dateKey) => {
      day.bookings.forEach((b) => {
        const id = b.guest?.id;
        if (!id || !b.room) return;
        if (dateKey >= todayKey) {
          const seen = next.get(id);
          if (!seen || dateKey < seen) next.set(id, dateKey);
        } else {
          const seen = last.get(id);
          if (!seen || dateKey > seen) last.set(id, dateKey);
        }
      });
    });
    return { next, last };
  }, [monthMap]);

  const options: PickerOption<string>[] = useMemo(() => {
    const real = guests.filter((g) => g.name !== "AirBnB");
    const withInfo = real.map((g) => ({
      g,
      next: stayInfo.next.get(g.id),
      last: stayInfo.last.get(g.id),
    }));
    // Coming up first, soonest at the top; then guests with only past stays,
    // most recent first; then everybody else, by name.
    withInfo.sort((a, b) => {
      if (a.next && b.next) return a.next < b.next ? -1 : 1;
      if (a.next) return -1;
      if (b.next) return 1;
      if (a.last && b.last) return a.last > b.last ? -1 : 1;
      if (a.last) return -1;
      if (b.last) return 1;
      return a.g.name.localeCompare(b.g.name);
    });

    return [
      {
        value: ANYONE,
        label: "Everyone",
        hint: "No guest filter — the whole house",
        Icon: FaUser,
        accent: "bg-gray-500",
        rowActive: "bg-gray-100 text-gray-900",
      },
      ...withInfo.map(({ g, next, last }) => ({
        value: g.id,
        label: g.alias || g.name,
        hint: next
          ? `Next stay ${format(new Date(next + "T00:00:00"), "EEE MMM d")}`
          : last
            ? `Last stayed ${format(new Date(last + "T00:00:00"), "MMM d, yyyy")}`
            : "No stays on the calendar",
        Icon: FaUser,
        accent: next ? "bg-emerald-600" : "bg-gray-400",
        rowActive: "bg-emerald-50 text-emerald-900",
      })),
    ];
  }, [guests, stayInfo]);

  const current = guests.find((g) => g.id === value) ?? null;
  const label = current ? current.alias || current.name : "Find guest";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Filter the calendar to one guest"
        className={`flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors ${
          current
            ? "border-emerald-600 bg-emerald-600 text-white"
            : "border-gray-300 bg-white text-gray-600 hover:border-gray-400"
        }`}
      >
        <FaUser size={11} className="shrink-0" />
        <span className="max-w-[9rem] truncate">{label}</span>
        <FaChevronDown size={9} className="shrink-0 opacity-70" />
      </button>

      <PickerModal
        open={open}
        title="Filter to a guest"
        subtitle="The calendar shows only their stays"
        options={options}
        value={value ?? ANYONE}
        searchable
        searchPlaceholder="Type a name…"
        onChange={(v) => onChange(v === ANYONE ? null : v)}
        onClose={() => setOpen(false)}
      />
    </>
  );
};

export default GuestFilterPicker;
