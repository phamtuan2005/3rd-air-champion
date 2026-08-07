import { format } from "date-fns";
import { MdCleaningServices } from "react-icons/md";
import { dayType } from "../../../util/types/dayType";
import { roomType } from "../../../util/types/roomType";
import { CleaningAssignmentType } from "../../../util/cleanerOperations";
import { getCheckoutsOn } from "../../../util/cleaningTasks";
import RoomBadge from "../../shared/RoomBadge";

interface CleanDaySheetProps {
  dateKey: string; // yyyy-MM-dd — the cleaning MORNING
  monthMap: Map<string, dayType>;
  assignments: CleaningAssignmentType[];
  rooms: roomType[];
  onClose: () => void;
}

// What a day looks like through the cleaning lens. Opened by tapping a date
// while the calendar is in Clean mode, so the tap answers the question the mode
// put in your head — previously it returned the guest's booking and billing,
// which belongs to the Guest view.
//
// Read-only on purpose: the calendar reports the plan, the Cleaners modal owns
// changing it. Unlike the Plan tab this works for ANY date, including past
// months, which the Cleaners modal cannot currently reach.
const CleanDaySheet = ({ dateKey, monthMap, assignments, rooms, onClose }: CleanDaySheetProps) => {
  const roomById = new Map(rooms.map((r) => [r.id, r]));

  // Rooms that genuinely turned over — the same rule the Plan tab forecasts from.
  const turnedOver = getCheckoutsOn(monthMap, dateKey)
    .map((b) => b.room?.id)
    .filter((id): id is string => !!id);

  const forDate = assignments.filter((a) => a.date === dateKey && a.room);

  // Group by cleaner. A day's hours sit on ONE of its rooms with 0 on the rest,
  // so the total is summed per cleaner and shown once — never per room, which
  // would read as though one room took the whole morning.
  const byCleaner = new Map<
    string,
    { name: string; rooms: roomType[]; hours: number; recorded: boolean }
  >();
  const assignedRoomIds = new Set<string>();
  forDate.forEach((a) => {
    if (!a.room) return;
    assignedRoomIds.add(a.room.id);
    const key = a.cleaner?.id ?? "none";
    const g = byCleaner.get(key) ?? {
      name: a.cleaner?.name?.trim() ?? "Unassigned",
      rooms: [],
      hours: 0,
      recorded: false,
    };
    const room = roomById.get(a.room.id);
    if (room) g.rooms.push(room);
    if (a.hours != null) {
      g.hours += a.hours;
      g.recorded = true;
    }
    byCleaner.set(key, g);
  });

  // Turnovers nobody was put on at all — the gaps worth seeing.
  const unassigned = turnedOver
    .filter((id) => !assignedRoomIds.has(id))
    .map((id) => roomById.get(id))
    .filter((r): r is roomType => !!r);

  const groups = [...byCleaner.values()].sort((a, b) => a.name.localeCompare(b.name));
  const nothing = groups.length === 0 && unassigned.length === 0;

  const fmtHrs = (h: number) => {
    const mins = Math.round(h * 60);
    const hh = Math.floor(mins / 60);
    const mm = mins % 60;
    return hh > 0 ? `${hh}h${mm ? ` ${mm}m` : ""}` : `${mm}m`;
  };

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          {/* Same icon the Tasks modal uses for Clean, so the two read as one
              feature rather than two things about cleaning. */}
          <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900">
            <MdCleaningServices className="text-teal-600" />
            {format(new Date(dateKey + "T00:00:00"), "EEEE, MMM d")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="px-1 text-2xl leading-none text-gray-400 hover:text-gray-600"
          >
            &times;
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-3">
          {nothing ? (
            <p className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-center text-sm text-gray-400">
              No rooms turned over this morning
            </p>
          ) : (
            <>
              {groups.map((g) => (
                <div
                  key={g.name}
                  className="mb-2 rounded-xl border border-gray-200 p-2.5 last:mb-0"
                >
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <span className="text-base font-bold text-gray-900">{g.name}</span>
                    <span
                      className={`text-sm font-semibold ${
                        g.recorded ? "text-emerald-600" : "text-gray-400"
                      }`}
                    >
                      {g.recorded ? fmtHrs(g.hours) : "hours not recorded"}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {g.rooms.map((r) => (
                      <RoomBadge key={r.id} room={r} />
                    ))}
                  </div>
                </div>
              ))}

              {unassigned.length > 0 && (
                <div className="rounded-xl border border-amber-300 bg-amber-50 p-2.5">
                  <p className="mb-1.5 text-base font-bold text-amber-700">⚠ No cleaner assigned</p>
                  <div className="flex flex-wrap gap-1">
                    {unassigned.map((r) => (
                      <RoomBadge key={r.id} room={r} />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <p className="border-t border-gray-100 px-4 py-2 text-center text-[13px] text-gray-400">
          To change any of this, open Clean → Plan
        </p>
      </div>
    </div>
  );
};

export default CleanDaySheet;
