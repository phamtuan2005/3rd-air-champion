import { format } from "date-fns";
import { getRoomColor } from "../../util/getRoomColor";
import { roomType } from "../../util/types/roomType";
import { useTiBookTheme } from "../../contexts/TiBookThemeContext";

interface RoomPickerPopupProps {
  date: Date;
  rooms: roomType[]; // rooms actually available on this date
  onPick: (roomId: string) => void;
  onClose: () => void;
}

// Shown the moment a guest taps an open date: it discloses exactly which room(s)
// are free that night and lets them pick right away — especially valuable when
// only one is left.
const RoomPickerPopup = ({ date, rooms, onPick, onClose }: RoomPickerPopupProps) => {
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
              className="flex items-center gap-2 rounded-xl border border-gray-200 px-2.5 py-2 text-left hover:bg-gray-50"
            >
              <span className={`${getRoomColor(r.name, r.color)} h-5 w-5 shrink-0 rounded-md`} />
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-gray-800">{r.name}</span>
              <span className={`shrink-0 text-xs font-bold ${theme.textPrimary}`}>Select ›</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default RoomPickerPopup;
