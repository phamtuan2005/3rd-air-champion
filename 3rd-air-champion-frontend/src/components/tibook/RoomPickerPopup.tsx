import { format } from "date-fns";
import { roomType } from "../../util/types/roomType";
import { useTiBookTheme } from "../../contexts/TiBookThemeContext";
import RoomBadge from "../shared/RoomBadge";

interface RoomPickerPopupProps {
  date: Date;
  rooms: roomType[]; // rooms actually available on this date
  onPick: (roomId: string) => void;
  onAny: () => void; // guest is flexible — let the host assign any available room
  onClose: () => void;
}

// Shown the moment a guest taps an open date: it discloses exactly which room(s)
// are free that night and lets them pick right away — especially valuable when
// only one is left.
const RoomPickerPopup = ({ date, rooms, onPick, onAny, onClose }: RoomPickerPopupProps) => {
  const { theme } = useTiBookTheme();
  const only = rooms.length === 1;

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-xs overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 px-4 pb-1 pt-3">
          <div className="min-w-0">
            <p className={`text-sm font-bold ${theme.textPrimary}`}>
              {only ? "Only 1 room left" : "Pick your room"}
            </p>
            <p className="text-xs text-gray-500">{format(date, "EEEE, MMM d")}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xl leading-none text-gray-400 hover:bg-gray-100"
          >
            &times;
          </button>
        </div>

        <div className="flex flex-col gap-1.5 px-4 pb-4 pt-1">
          {rooms.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => onPick(r.id)}
              className="flex items-center justify-between gap-2 rounded-xl border border-gray-200 px-2.5 py-2 hover:bg-gray-50"
            >
              <RoomBadge room={r} rooms={rooms} className="text-sm" />
              <span className={`shrink-0 text-xs font-bold ${theme.textPrimary}`}>Select ›</span>
            </button>
          ))}
          {/* Flexible guest — no preference; the host picks any free room. Only
              meaningful when there's more than one to choose from. */}
          {!only && (
            <button
              type="button"
              onClick={onAny}
              className="flex items-center justify-between gap-2 rounded-xl border border-dashed border-gray-300 px-2.5 py-2 hover:bg-gray-50"
            >
              <span className="text-sm font-semibold text-gray-600">Any available room</span>
              <span className={`shrink-0 text-xs font-bold ${theme.textPrimary}`}>Select ›</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default RoomPickerPopup;
