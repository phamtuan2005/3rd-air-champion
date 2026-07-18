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

const formatPhone = (raw: string): string => {
  const digits = raw.replace(/\D/g, "");
  const local = digits.startsWith("84") ? "0" + digits.slice(2) : digits;
  if (local.length === 10) return `${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`;
  if (local.length === 11) return `${local.slice(0, 4)} ${local.slice(4, 7)} ${local.slice(7)}`;
  return raw;
};

// Strip formatting + country/trunk prefix so numbers stored differently (+84…, 0…, spaced)
// still compare equal.
const normalizePhone = (raw: string): string => {
  const digits = (raw || "").replace(/\D/g, "");
  if (digits.startsWith("84")) return digits.slice(2);
  if (digits.startsWith("0")) return digits.slice(1);
  return digits;
};
const samePhone = (a: string, b: string): boolean => {
  const na = normalizePhone(a);
  return na.length > 0 && na === normalizePhone(b);
};

// A wish date is "fulfilled" once this guest already holds a booking that night — the wish
// is satisfied, so it should never show as available or trigger a "contact now" nudge.
const guestBookedOn = (
  dateKey: string,
  guestPhone: string,
  monthMap: Map<string, dayType>,
): boolean => {
  const day = monthMap.get(dateKey);
  if (!day) return false;
  return day.bookings.some((b) => b.guest?.phone && samePhone(b.guest.phone, guestPhone));
};

interface WishListPanelProps {
  token: string;
  entries: WishListEntry[];
  loading: boolean;
  monthMap: Map<string, dayType>;
  rooms: roomType[];
  onStatusChange: (id: string, status: WishListStatus) => void;
  onDelete: (id: string) => void;
  onRemoveDate: (id: string, date: string) => void;
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
  fulfilledDates: string[];
  hasAvailable: boolean;
  allFulfilled: boolean;
  token: string;
  onStatusChange: (id: string, status: WishListStatus) => void;
  onDelete: (id: string) => void;
  onRemoveDate: (id: string, date: string) => void;
}

const EntryRow = ({ entry, availableDates, fulfilledDates, hasAvailable, allFulfilled, token, onStatusChange, onDelete, onRemoveDate }: EntryRowProps) => {
  const [offset, setOffset] = useState(0);
  // The tapped wish date. Opens the action menu; also earmarks which date a future
  // per-date "remove"/"remind" action would target (only whole-list delete for now).
  const [menuDate, setMenuDate] = useState<string | null>(null);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const offsetAtStart = useRef(0);
  const didMove = useRef(false);
  const direction = useRef<"horizontal" | "vertical" | null>(null);

  const availableSet = new Set(availableDates);
  const fulfilledSet = new Set(fulfilledDates);
  const outstandingDates = [...entry.dates].filter((d) => !fulfilledSet.has(d)).sort();
  const sortedFulfilled = [...fulfilledDates].sort();
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
          hasAvailable
            ? "bg-green-50 border-green-200"
            : allFulfilled
              ? "bg-gray-50 border-gray-200 opacity-75"
              : "bg-white border-gray-100"
        }`}
        style={{
          transform: `translateX(${offset}px)`,
          transition: snapping ? "transform 0.18s ease" : "none",
        }}
        onTouchStart={(e) => {
          touchStartX.current = e.touches[0].clientX;
          touchStartY.current = e.touches[0].clientY;
          offsetAtStart.current = offset;
          didMove.current = false;
          direction.current = null;
        }}
        onTouchMove={(e) => {
          const dx = e.touches[0].clientX - touchStartX.current;
          const dy = e.touches[0].clientY - touchStartY.current;
          if (direction.current === null && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) {
            direction.current = Math.abs(dx) > Math.abs(dy) ? "horizontal" : "vertical";
          }
          if (direction.current !== "horizontal") return;
          didMove.current = true;
          setOffset(Math.min(0, Math.max(offsetAtStart.current + dx, -SNAP_WIDTH)));
        }}
        onTouchEnd={() => {
          if (!didMove.current) { setOffset(0); return; }
          setOffset(offset < -SWIPE_THRESHOLD ? -SNAP_WIDTH : 0);
        }}
      >
        {/* Header row */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-col">
            <span className="font-semibold text-sm text-gray-800">{entry.guestName}</span>
            <span className="text-[11px] text-gray-400">{formatPhone(entry.guestPhone)}</span>
          </div>
          <div className="flex items-center gap-2">
            {hasAvailable && (
              <span className="text-[10px] font-semibold bg-green-500 text-white px-2 py-0.5 rounded-full">
                {availableDates.length} available
              </span>
            )}
            {allFulfilled && (
              <span className="text-[10px] font-semibold bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">
                Got room
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

        {/* Date pills — tap any to open the action menu. Outstanding wishes first, then
            dates the guest already got a room for. */}
        <div className="flex flex-wrap gap-1.5">
          {outstandingDates.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setMenuDate(d)}
              className={
                availableSet.has(d)
                  ? "bg-green-100 border border-green-400 text-green-700 text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap hover:brightness-95"
                  : "bg-amber-50 border border-amber-200 text-amber-700 text-[11px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap hover:brightness-95"
              }
            >
              {fmtDate(d)}{availableSet.has(d) ? " ✓" : ""}
            </button>
          ))}
          {sortedFulfilled.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setMenuDate(d)}
              title="Guest already has a room this night"
              className="bg-gray-100 border border-gray-200 text-gray-400 line-through text-[11px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap hover:brightness-95"
            >
              {fmtDate(d)}
            </button>
          ))}
        </div>

        {/* Action menu for the tapped date. Removes just that date; a "remind guest" action
            can slot in here later. */}
        {menuDate && (
          <div className="flex items-center justify-between gap-2 pt-2 mt-0.5 border-t border-gray-100">
            <span className="text-[11px] text-gray-500">
              Remove <span className="font-semibold text-gray-600">{fmtDate(menuDate)}</span>?
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setMenuDate(null)}
                className="text-[11px] text-gray-400 hover:text-gray-600 px-2 py-1"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => { const d = menuDate; setMenuDate(null); onRemoveDate(entry.id, d); }}
                className="text-[11px] font-semibold text-white bg-red-500 hover:bg-red-600 rounded-md px-3 py-1"
              >
                Remove
              </button>
            </div>
          </div>
        )}

        <p className="text-[10px] text-gray-300">Added {fmtTimestamp(entry.createdAt)}</p>
      </div>
    </div>
  );
};

const WishListPanel = ({ token, entries, loading, monthMap, rooms, onStatusChange, onDelete, onRemoveDate }: WishListPanelProps) => {
  const activeRooms = rooms.filter((r) => r.active);
  const activeEntries = entries.filter((e) => e.dates.length > 0);

  const annotated = activeEntries.map((entry) => {
    const fulfilledDates = entry.dates.filter((d) => guestBookedOn(d, entry.guestPhone, monthMap));
    const outstanding = entry.dates.filter((d) => !fulfilledDates.includes(d));
    const availableDates = outstanding.filter((d) => isDateAvailable(d, monthMap, activeRooms));
    return {
      entry,
      availableDates,
      fulfilledDates,
      hasAvailable: availableDates.length > 0,
      // The guest already has a room for every date they wished for — nothing left to do.
      allFulfilled: fulfilledDates.length > 0 && outstanding.length === 0,
    };
  });

  // Available first, still-waiting next, fully-satisfied entries sink to the bottom.
  const rank = (a: (typeof annotated)[number]) => (a.hasAvailable ? 2 : a.allFulfilled ? 0 : 1);
  const sorted = [...annotated].sort((a, b) => rank(b) - rank(a));

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
      {sorted.map(({ entry, availableDates, fulfilledDates, hasAvailable, allFulfilled }) => (
        <EntryRow
          key={entry.id}
          entry={entry}
          availableDates={availableDates}
          fulfilledDates={fulfilledDates}
          hasAvailable={hasAvailable}
          allFulfilled={allFulfilled}
          token={token}
          onStatusChange={onStatusChange}
          onDelete={handleDelete}
          onRemoveDate={onRemoveDate}
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
    .filter((e) =>
      e.dates.some(
        (d) => !guestBookedOn(d, e.guestPhone, monthMap) && isDateAvailable(d, monthMap, activeRooms),
      ),
    ).length;
};