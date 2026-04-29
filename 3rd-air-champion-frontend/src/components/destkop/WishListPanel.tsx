import { useRef, useState } from "react";
import {
  updateWishListStatus,
  deleteWishListEntry,
  WishListEntry,
  WishListStatus,
} from "../../util/wishListOperations";
import { dayType } from "../../util/types/dayType";
import { roomType } from "../../util/types/roomType";
import { startOfToday } from "date-fns";

interface WishListPanelProps {
  token: string;
  entries: WishListEntry[];
  loading: boolean;
  monthMap: Map<string, dayType>;
  rooms: roomType[];
  onStatusChange: (id: string, status: WishListStatus) => void;
  onDelete: (id: string) => void;
}

const fmtDate = (d: string) => {
  const date = new Date(`${d}T12:00:00`);
  return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
};

const fmtTimestamp = (iso: string) => {
  const date = new Date(iso);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

const isDateAvailable = (dateKey: string, monthMap: Map<string, dayType>, activeRooms: roomType[]): boolean => {
  const today = startOfToday();
  const date = new Date(`${dateKey}T12:00:00`);
  if (date < today) return false;
  const day = monthMap.get(dateKey);
  if (!day) return true;
  if (day.isBlocked) return false;
  const bookedRoomIds = new Set(day.bookings.map((b) => b.room?.id).filter(Boolean));
  return activeRooms.some((r) => !bookedRoomIds.has(r.id));
};

const STATUS_CYCLE: WishListStatus[] = ["waiting", "notified", "booked"];

const statusStyle: Record<WishListStatus, string> = {
  waiting:  "bg-gray-100 text-gray-500 border-gray-200",
  notified: "bg-amber-50 text-amber-600 border-amber-300",
  booked:   "bg-green-100 text-green-700 border-green-300",
};
const statusLabel: Record<WishListStatus, string> = {
  waiting:  "Waiting",
  notified: "Notified",
  booked:   "Booked",
};

const SNAP_WIDTH = 72;
const SWIPE_THRESHOLD = 32;

interface EntryRowProps {
  entry: WishListEntry;
  availableDates: string[];
  hasAvailable: boolean;
  token: string;
  onStatusChange: (id: string, status: WishListStatus) => void;
  onDelete: (id: string) => void;
}

const EntryRow = ({ entry, availableDates, hasAvailable, token, onStatusChange, onDelete }: EntryRowProps) => {
  const [offset, setOffset] = useState(0);
  const touchStartX = useRef(0);
  const offsetAtStart = useRef(0);
  const didMove = useRef(false);

  const sortedDates = [...entry.dates].sort();
  const availableSet = new Set(availableDates);
  const dateLabels = [...availableDates].sort().map(fmtDate);
  const datePhrase =
    dateLabels.length === 1
      ? dateLabels[0]
      : dateLabels.slice(0, -1).join(", ") + " and " + dateLabels[dateLabels.length - 1];
  const smsBody = encodeURIComponent(
    `Hello ${entry.guestName}, there is a good news: your wish date ${datePhrase} is now available. Please go ahead to submit the booking request ASAP. Thanks!`,
  );

  const cycleStatus = () => {
    const next = STATUS_CYCLE[(STATUS_CYCLE.indexOf(entry.status) + 1) % STATUS_CYCLE.length];
    onStatusChange(entry.id, next);
    updateWishListStatus(entry.id, next, token).catch(() => onStatusChange(entry.id, entry.status));
  };

  const handleContactClick = () => {
    if (entry.status === "waiting") {
      onStatusChange(entry.id, "notified");
      updateWishListStatus(entry.id, "notified", token).catch(() => onStatusChange(entry.id, "waiting"));
    }
  };

  const snapping = offset === 0 || offset === -SNAP_WIDTH;

  return (
    <div className="relative overflow-hidden rounded-lg">
      {/* Delete button revealed on swipe */}
      <div className="absolute right-0 top-0 bottom-0 w-[72px] bg-red-500 flex items-center justify-center rounded-r-lg">
        <button
          type="button"
          className="text-white text-xs font-semibold w-full h-full"
          onClick={() => onDelete(entry.id)}
        >
          Delete
        </button>
      </div>

      {/* Swipeable card */}
      <div
        className={`relative border shadow-sm p-3 flex flex-col gap-2 rounded-lg ${
          hasAvailable ? "bg-green-50 border-green-200" : "bg-white border-gray-100"
        }`}
        style={{
          transform: `translateX(${offset}px)`,
          transition: snapping ? "transform 0.18s ease" : "none",
        }}
        onTouchStart={(e) => {
          touchStartX.current = e.touches[0].clientX;
          offsetAtStart.current = offset;
          didMove.current = false;
        }}
        onTouchMove={(e) => {
          const dx = e.touches[0].clientX - touchStartX.current;
          if (Math.abs(dx) > 5) didMove.current = true;
          setOffset(Math.min(0, Math.max(offsetAtStart.current + dx, -SNAP_WIDTH)));
        }}
        onTouchEnd={() => {
          if (!didMove.current) { setOffset(0); return; }
          setOffset(offset < -SWIPE_THRESHOLD ? -SNAP_WIDTH : 0);
        }}
      >
        {/* Header row */}
        <div className="flex items-center justify-between gap-2">
          <span className="font-semibold text-sm text-gray-800">{entry.guestName}</span>
          <div className="flex items-center gap-2">
            {hasAvailable && (
              <span className="text-[10px] font-semibold bg-green-500 text-white px-2 py-0.5 rounded-full">
                {availableDates.length} available
              </span>
            )}
            {/* Tappable status badge */}
            <button
              type="button"
              onClick={cycleStatus}
              className={`text-[10px] font-semibold border px-2 py-0.5 rounded-full transition-colors ${statusStyle[entry.status]}`}
            >
              {statusLabel[entry.status]}
            </button>
          </div>
        </div>

        {/* Contact button — only when dates are available */}
        {hasAvailable && (
          <a
            href={`sms:${entry.guestPhone}?body=${smsBody}`}
            onClick={handleContactClick}
            className="text-xs font-semibold text-green-700 bg-green-100 border border-green-300 rounded-lg px-3 py-1.5 text-center hover:bg-green-200 transition-colors"
          >
            Contact now →
          </a>
        )}

        {/* Date pills */}
        <div className="flex flex-wrap gap-1.5">
          {sortedDates.map((d) => (
            <span
              key={d}
              className={
                availableSet.has(d)
                  ? "bg-green-100 border border-green-400 text-green-700 text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
                  : "bg-amber-50 border border-amber-200 text-amber-700 text-[11px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap"
              }
            >
              {fmtDate(d)}{availableSet.has(d) ? " ✓" : ""}
            </span>
          ))}
        </div>

        <p className="text-[10px] text-gray-300">Added {fmtTimestamp(entry.createdAt)}</p>
      </div>
    </div>
  );
};

const WishListPanel = ({ token, entries, loading, monthMap, rooms, onStatusChange, onDelete }: WishListPanelProps) => {
  const activeRooms = rooms.filter((r) => r.active);
  const activeEntries = entries.filter((e) => e.dates.length > 0);

  const annotated = activeEntries.map((entry) => {
    const availableDates = entry.dates.filter((d) => isDateAvailable(d, monthMap, activeRooms));
    return { entry, availableDates, hasAvailable: availableDates.length > 0 };
  });

  const sorted = [...annotated].sort((a, b) => Number(b.hasAvailable) - Number(a.hasAvailable));

  const handleDelete = (id: string) => {
    onDelete(id);
    deleteWishListEntry(id, token).catch(() => {});
  };

  const bookedCount = entries.filter((e) => e.status === "booked").length;

  if (loading) return <p className="text-sm text-gray-500 text-center py-8">Loading...</p>;
  if (sorted.length === 0) return <p className="text-sm text-gray-500 text-center py-8">No wish list entries yet.</p>;

  return (
    <div className="flex flex-col gap-3">
      {bookedCount > 0 && (
        <button
          type="button"
          onClick={() => {
            entries.filter((e) => e.status === "booked").forEach((e) => {
              onDelete(e.id);
              deleteWishListEntry(e.id, token).catch(() => {});
            });
          }}
          className="self-end text-[11px] text-red-400 hover:text-red-600 underline"
        >
          Clear {bookedCount} booked
        </button>
      )}
      {sorted.map(({ entry, availableDates, hasAvailable }) => (
        <EntryRow
          key={entry.id}
          entry={entry}
          availableDates={availableDates}
          hasAvailable={hasAvailable}
          token={token}
          onStatusChange={onStatusChange}
          onDelete={handleDelete}
        />
      ))}
    </div>
  );
};

export default WishListPanel;

export const countAvailableWishListEntries = (
  entries: WishListEntry[],
  monthMap: Map<string, dayType>,
  rooms: roomType[],
): number => {
  const activeRooms = rooms.filter((r) => r.active);
  return entries
    .filter((e) => e.dates.length > 0)
    .filter((e) => e.dates.some((d) => isDateAvailable(d, monthMap, activeRooms))).length;
};