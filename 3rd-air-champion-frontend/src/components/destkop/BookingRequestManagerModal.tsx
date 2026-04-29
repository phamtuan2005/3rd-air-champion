import { useEffect, useRef, useState } from "react";
import { roomType } from "../../util/types/roomType";
import { guestType } from "../../util/types/guestType";
import WishListPanel, { countAvailableWishListEntries } from "./WishListPanel";
import { WishListEntry, WishListStatus, getHostWishLists } from "../../util/wishListOperations";
import { dayType } from "../../util/types/dayType";
import {
  fetchBookingRequestsByHost,
  updateBookingRequestStatus,
  deleteBookingRequest,
} from "../../util/bookingRequestOperations";
import { getRoomColor } from "../../util/getRoomColor";
import { format, toZonedTime } from "date-fns-tz";

export interface BookingRequest {
  id: string;
  guestName: string;
  guestPhone: string;
  date: string;
  room: string;
  duration: number;
  numberOfGuests: number;
  status: "pending" | "confirmed" | "cancelled" | "expired";
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

interface BookingRequestManagerModalProps {
  hostId: string;
  token: string;
  rooms: roomType[];
  guests: guestType[];
  monthMap: Map<string, dayType>;
  onClose: () => void;
  onAccept: (
    items: Array<{
      requestId: string;
      prefill: {
        guestId: string | null;
        roomId: string;
        date: Date;
        duration: number;
        numberOfGuests: number;
      };
    }>,
  ) => void;
  onAddGuest: (guest: { name: string; phone: string }) => void;
}

const SNAP_WIDTH = 72;
const SWIPE_THRESHOLD = 32;

const statusLabel = (status: string) => {
  if (status === "confirmed") return "Accepted";
  if (status === "cancelled") return "Declined";
  return status.charAt(0).toUpperCase() + status.slice(1);
};

const statusColor = (status: string) => {
  if (status === "confirmed") return "text-green-600";
  if (status === "cancelled") return "text-red-500";
  return "text-gray-500";
};

interface SwipeableHistoryRowProps {
  req: BookingRequest;
  rooms: roomType[];
  guests: guestType[];
  roomBoxWidth: string | undefined;
  timeZone: string;
  gridTemplateColumns: string;
  onDelete: (id: string) => void;
}

const SwipeableHistoryRow = ({
  req,
  rooms,
  guests,
  roomBoxWidth,
  timeZone,
  gridTemplateColumns,
  onDelete,
}: SwipeableHistoryRowProps) => {
  const [offset, setOffset] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const touchStartX = useRef(0);
  const offsetAtStart = useRef(0);
  const didMove = useRef(false);

  const room = rooms.find((r) => r.id === req.room);
  const matched = guests.find(
    (g) => g.phone.replace(/\D/g, "") === req.guestPhone.replace(/\D/g, ""),
  );
  const displayName = matched?.name ?? req.guestName;
  const roomColorClass = room ? getRoomColor(room.name, room.color) : "bg-gray-400";
  const borderClass =
    req.status === "confirmed"
      ? "border-green-500"
      : req.status === "cancelled"
        ? "border-red-400"
        : roomColorClass.replace("bg-", "border-");

  const fmtDate = (dateStr: string) =>
    format(new Date(dateStr), "EEE, MMM d yyyy", { timeZone });

  const fmtTimestamp = (dateStr: string) => {
    const ms = Number(dateStr);
    const date = isNaN(ms) ? new Date(dateStr) : new Date(ms);
    return format(date, "MMM d, h:mm a", { timeZone });
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    offsetAtStart.current = offset;
    didMove.current = false;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const dx = e.touches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 5) didMove.current = true;
    setOffset(Math.min(0, Math.max(offsetAtStart.current + dx, -SNAP_WIDTH)));
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!didMove.current) {
      if (offset === -SNAP_WIDTH) {
        e.preventDefault();
        onDelete(req.id);
        setOffset(0);
      } else {
        setExpanded((v) => !v);
      }
      return;
    }
    setOffset(offset < -SWIPE_THRESHOLD ? -SNAP_WIDTH : 0);
  };

  const snapping = offset === 0 || offset === -SNAP_WIDTH;

  return (
    <div
      className={`relative overflow-hidden border-l-4 ${borderClass}`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Delete button revealed behind */}
      <div className="absolute right-0 top-0 bottom-0 w-[72px] bg-red-500 flex items-center justify-center">
        <button
          type="button"
          className="text-white text-xs font-semibold w-full h-full"
          onClick={() => onDelete(req.id)}
        >
          Delete
        </button>
      </div>

      {/* Swipeable row content */}
      <div
        className="relative grid bg-gray-50 text-[11px] py-2.5 items-center"
        style={{
          gridTemplateColumns,
          transform: `translateX(${offset}px)`,
          transition: snapping ? "transform 0.18s ease" : "none",
        }}
      >
        <div className="pl-2 pr-2 font-medium text-gray-600 truncate min-w-0">{displayName}</div>
        <div className="pr-2 text-gray-500 whitespace-nowrap">{fmtDate(req.date)}</div>
        <div className="pr-2 whitespace-nowrap">
          {room && (
            <span
              className={`${roomColorClass} text-white font-medium py-0.5 rounded text-[10px] inline-block text-center whitespace-nowrap`}
              style={{ width: roomBoxWidth }}
            >
              {room.name}
            </span>
          )}
        </div>
        <div className="pl-2 pr-2 text-gray-400 whitespace-nowrap">{fmtTimestamp(req.updatedAt)}</div>
      </div>

      {/* Expanded detail panel */}
      {expanded && (
        <div
          className="bg-white border-t border-gray-100 px-3 py-2 text-[11px] flex flex-wrap gap-x-4 gap-y-0.5"
          style={{
            transform: `translateX(${offset}px)`,
            transition: snapping ? "transform 0.18s ease" : "none",
          }}
        >
          <span className="font-semibold text-gray-700">{displayName}</span>
          <span className={`font-semibold ${statusColor(req.status)}`}>{statusLabel(req.status)}</span>
          <span className="text-gray-500">{req.duration} night{req.duration > 1 ? "s" : ""} · {req.numberOfGuests} guest{req.numberOfGuests > 1 ? "s" : ""}</span>
          <span className="text-gray-400">{req.guestPhone}</span>
          {req.notes && <span className="text-gray-400 w-full">{req.notes}</span>}
        </div>
      )}
    </div>
  );
};

const BookingRequestManagerModal = ({
  hostId,
  token,
  rooms,
  guests,
  monthMap,
  onAccept,
  onAddGuest,
}: BookingRequestManagerModalProps) => {
  const [requests, setRequests] = useState<BookingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingPhone, setUpdatingPhone] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(true);
  const [historySort, setHistorySort] = useState<{ key: "guest" | "date" | "room" | "when"; dir: "asc" | "desc" }>({ key: "when", dir: "desc" });
  const [activeTab, setActiveTab] = useState<"requests" | "wishlist">("requests");
  const [wishListEntries, setWishListEntries] = useState<WishListEntry[]>([]);
  const [wishListLoading, setWishListLoading] = useState(true);

  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  useEffect(() => {
    fetchBookingRequestsByHost(hostId, token)
      .then((reqs) => setRequests(reqs ?? []))
      .catch(() => setRequests([]))
      .finally(() => setLoading(false));
  }, [hostId, token]);

  useEffect(() => {
    getHostWishLists(hostId, token)
      .then(setWishListEntries)
      .catch(() => setWishListEntries([]))
      .finally(() => setWishListLoading(false));
  }, [hostId, token]);

  const availableBadge = countAvailableWishListEntries(wishListEntries, monthMap, rooms);

  const handleWishListStatusChange = (id: string, status: WishListStatus) => {
    setWishListEntries((prev) => prev.map((e) => (e.id === id ? { ...e, status } : e)));
  };

  const handleWishListDelete = (id: string) => {
    setWishListEntries((prev) => prev.filter((e) => e.id !== id));
  };

  const normalizePhone = (phone: string) => phone.replace(/\D/g, "");

  const matchGuest = (phone: string): guestType | undefined =>
    guests.find((g) => normalizePhone(g.phone) === normalizePhone(phone));

  const getRoom = (roomId: string): roomType | undefined =>
    rooms.find((r) => r.id === roomId);

  const handleAcceptGroup = (group: BookingRequest[]) => {
    onAccept(
      group.map((req) => {
        const matched = matchGuest(req.guestPhone);
        return {
          requestId: req.id,
          prefill: {
            guestId: matched?.id ?? null,
            roomId: req.room,
            date: toZonedTime(req.date, timeZone),
            duration: req.duration,
            numberOfGuests: req.numberOfGuests,
          },
        };
      }),
    );
  };

  const handleDelete = (id: string) => {
    setRequests((prev) => prev.filter((r) => r.id !== id));
    deleteBookingRequest(id, token).catch(() => {});
  };

  const handleDeclineGroup = async (group: BookingRequest[]) => {
    const phone = normalizePhone(group[0].guestPhone);
    setUpdatingPhone(phone);
    try {
      await Promise.all(
        group.map((req) =>
          updateBookingRequestStatus(req.id, "cancelled", token).then(() =>
            setRequests((prev) =>
              prev.map((r) =>
                r.id === req.id
                  ? { ...r, status: "cancelled", updatedAt: String(Date.now()) }
                  : r,
              ),
            ),
          ),
        ),
      );
    } catch {
      // keep as pending on failure
    } finally {
      setUpdatingPhone(null);
    }
  };

  const formatDate = (dateStr: string) =>
    format(new Date(dateStr), "EEE, MMM d yyyy", { timeZone });

  const roomBoxWidth = rooms.length > 0
    ? `${rooms.reduce((max, r) => Math.max(max, r.name.length), 0) * 4.5 + 8}px`
    : undefined;

  const gridTemplateColumns = `minmax(0,1fr) 96px ${roomBoxWidth ?? "auto"} 115px`;

  const pending = requests.filter((r) => r.status === "pending");
  const allResolved = requests.filter((r) => r.status !== "pending");
  const sortedResolved = [...allResolved].sort((a, b) => {
    const dir = historySort.dir === "asc" ? 1 : -1;
    switch (historySort.key) {
      case "guest": {
        const aName = (matchGuest(a.guestPhone)?.name ?? a.guestName).toLowerCase();
        const bName = (matchGuest(b.guestPhone)?.name ?? b.guestName).toLowerCase();
        return dir * aName.localeCompare(bName);
      }
      case "date":
        return dir * (new Date(a.date).getTime() - new Date(b.date).getTime());
      case "room": {
        const aRoom = getRoom(a.room)?.name ?? "";
        const bRoom = getRoom(b.room)?.name ?? "";
        return dir * aRoom.localeCompare(bRoom);
      }
      case "when":
      default:
        return dir * (Number(a.updatedAt) - Number(b.updatedAt));
    }
  });

  // Group pending requests by normalized phone
  const pendingGroups: BookingRequest[][] = [];
  const seenPhones = new Set<string>();
  for (const req of pending) {
    const phone = normalizePhone(req.guestPhone);
    if (!seenPhones.has(phone)) {
      seenPhones.add(phone);
      pendingGroups.push(pending.filter((r) => normalizePhone(r.guestPhone) === phone));
    }
  }

  const renderPendingGroup = (group: BookingRequest[]) => {
    const first = group[0];
    const matched = matchGuest(first.guestPhone);
    const displayName = matched?.name ?? first.guestName;
    const phone = normalizePhone(first.guestPhone);
    const isUpdating = updatingPhone === phone;

    const firstRoom = getRoom(first.room);
    const borderClass = firstRoom
      ? getRoomColor(firstRoom.name, firstRoom.color).replace("bg-", "border-")
      : "border-gray-400";

    return (
      <div
        key={phone}
        className={`rounded-lg border-l-4 ${borderClass} bg-white shadow-sm p-3 flex flex-col gap-2`}
      >
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm">{displayName}</span>
          {matched ? (
            <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">
              returning
            </span>
          ) : (
            <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full flex items-center gap-1">
              NEW
              <button
                type="button"
                className="underline font-medium hover:text-amber-900"
                onClick={() => onAddGuest({ name: first.guestName, phone: first.guestPhone })}
              >
                + Add
              </button>
            </span>
          )}
          <span className="text-[10px] text-gray-400 ml-auto">{first.guestPhone}</span>
        </div>

        <div className="flex flex-col gap-1">
          {group.map((req) => {
            const room = getRoom(req.room);
            const roomColorClass = room ? getRoomColor(room.name, room.color) : "bg-gray-400";
            return (
              <div key={req.id} className="flex items-center gap-2 text-xs text-gray-600">
                {room && (
                  <span
                    className={`${roomColorClass} text-white font-medium py-0.5 rounded text-[10px] shrink-0 inline-block text-center whitespace-nowrap`}
                    style={{ width: roomBoxWidth }}
                  >
                    {room.name}
                  </span>
                )}
                <span>{formatDate(req.date)}</span>
                <span className="text-gray-400">
                  {req.duration}n · {req.numberOfGuests} guest{req.numberOfGuests > 1 ? "s" : ""}
                </span>
              </div>
            );
          })}
        </div>

        <div className="flex gap-2 mt-1">
          <button
            type="button"
            disabled={isUpdating}
            className="flex-1 bg-green-500 text-white text-xs font-medium py-1.5 rounded hover:bg-green-600 disabled:opacity-50"
            onClick={() => handleAcceptGroup(group)}
          >
            {isUpdating ? "..." : group.length > 1 ? `Accept all (${group.length})` : "Accept"}
          </button>
          <button
            type="button"
            disabled={isUpdating}
            className="flex-1 bg-red-500 text-white text-xs font-medium py-1.5 rounded hover:bg-red-600 disabled:opacity-50"
            onClick={() => handleDeclineGroup(group)}
          >
            {isUpdating ? "..." : group.length > 1 ? `Decline all (${group.length})` : "Decline"}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex items-center gap-3 px-4 pt-3 pb-2 border-b border-gray-100 flex-shrink-0">
        <button
          type="button"
          className={`text-sm font-bold pb-0.5 border-b-2 transition-colors ${activeTab === "requests" ? "border-gray-800 text-gray-800" : "border-transparent text-gray-400 hover:text-gray-600"}`}
          onClick={() => setActiveTab("requests")}
        >
          Requests
        </button>
        <button
          type="button"
          className={`text-sm font-bold pb-0.5 border-b-2 transition-colors flex items-center gap-1.5 ${activeTab === "wishlist" ? "border-amber-500 text-amber-600" : "border-transparent text-gray-400 hover:text-gray-600"}`}
          onClick={() => setActiveTab("wishlist")}
        >
          Wish List
          {availableBadge > 0 && (
            <span className="bg-green-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">
              {availableBadge}
            </span>
          )}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        {activeTab === "wishlist" ? (
          <WishListPanel
            token={token}
            entries={wishListEntries}
            loading={wishListLoading}
            monthMap={monthMap}
            rooms={rooms}
            onStatusChange={handleWishListStatusChange}
            onDelete={handleWishListDelete}
          />
        ) : loading ? (
          <p className="text-sm text-gray-500 text-center py-8">Loading...</p>
        ) : requests.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-8">
            No booking requests yet.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {pendingGroups.length > 0 && (
              <div className="flex flex-col gap-2">
                <h3 className="text-xs font-bold text-amber-600 uppercase tracking-wider">
                  Pending ({pending.length})
                </h3>
                {pendingGroups.map((group) => renderPendingGroup(group))}
              </div>
            )}
            {allResolved.length > 0 && (
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  className="flex items-center gap-1 text-xs font-bold text-gray-400 uppercase tracking-wider hover:text-gray-600 transition-colors select-none w-fit"
                  onClick={() => setShowHistory((v) => !v)}
                >
                  History ({allResolved.length})
                </button>

                {showHistory && (
                  <>
                    {/* Column headers */}
                    <div
                      className="grid text-[10px] text-gray-400 uppercase tracking-wider border-b border-gray-200 border-l-4 border-l-transparent pb-1 items-end"
                      style={{ gridTemplateColumns }}
                    >
                      {(["guest", "date", "room", "when"] as const).map((col) => {
                        const labels: Record<string, string> = { guest: "Guest", date: "Date", room: "Room", when: "When" };
                        const active = historySort.key === col;
                        return (
                          <div
                            key={col}
                            className={`${col === "guest" || col === "when" ? "pl-2" : ""} pr-2 font-medium cursor-pointer select-none hover:text-gray-600 whitespace-nowrap ${active ? "text-gray-600" : ""}`}
                            onClick={() => setHistorySort((s) => s.key === col ? { key: col, dir: s.dir === "asc" ? "desc" : "asc" } : { key: col, dir: "asc" })}
                          >
                            {labels[col]}{active ? (historySort.dir === "desc" ? " ↓" : " ↑") : ""}
                          </div>
                        );
                      })}
                    </div>

                    {/* Swipeable rows */}
                    <div className="flex flex-col">
                      {sortedResolved.map((req) => (
                        <SwipeableHistoryRow
                          key={req.id}
                          req={req}
                          rooms={rooms}
                          guests={guests}
                          roomBoxWidth={roomBoxWidth}
                          timeZone={timeZone}
                          gridTemplateColumns={gridTemplateColumns}
                          onDelete={handleDelete}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default BookingRequestManagerModal;