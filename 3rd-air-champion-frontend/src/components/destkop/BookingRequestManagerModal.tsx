import { useEffect, useState } from "react";
import { roomType } from "../../util/types/roomType";
import { guestType } from "../../util/types/guestType";
import {
  fetchBookingRequestsByHost,
  updateBookingRequestStatus,
} from "../../util/bookingRequestOperations";
import { getRoomColor } from "../../util/getRoomColor";
import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";

export interface BookingRequest {
  id: string;
  guestName: string;
  guestPhone: string;
  date: string;
  room: string;
  duration: number;
  numberOfGuests: number;
  status: "pending" | "confirmed" | "cancelled" | "expired";
  createdAt: string;
  updatedAt: string;
}

interface BookingRequestManagerModalProps {
  hostId: string;
  token: string;
  rooms: roomType[];
  guests: guestType[];
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

const BookingRequestManagerModal = ({
  hostId,
  token,
  rooms,
  guests,
  onAccept,
  onAddGuest,
}: BookingRequestManagerModalProps) => {
  const [requests, setRequests] = useState<BookingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingPhone, setUpdatingPhone] = useState<string | null>(null);
  const [clearedIds, setClearedIds] = useState<Set<string>>(
    () => new Set(JSON.parse(sessionStorage.getItem(`clearedRequestIds_${hostId}`) || "[]")),
  );
  const [showCleared, setShowCleared] = useState(false);
  const [historySort, setHistorySort] = useState<{ key: "guest" | "date" | "room" | "when"; dir: "asc" | "desc" }>({ key: "when", dir: "desc" });

  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  useEffect(() => {
    fetchBookingRequestsByHost(hostId, token)
      .then((reqs) => setRequests(reqs ?? []))
      .catch(() => setRequests([]))
      .finally(() => setLoading(false));
  }, [hostId, token]);

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

  const formatDate = (dateStr: string) => {
    const d = toZonedTime(dateStr, timeZone);
    return format(d, "EEE, MMM d yyyy");
  };

  const formatTimestamp = (dateStr: string) => {
    const d = toZonedTime(new Date(Number(dateStr)), timeZone);
    return format(d, "MMM d, h:mm a");
  };

  const roomBoxWidth = rooms.length > 0
    ? `${rooms.reduce((max, r) => Math.max(max, r.name.length), 0) * 4.5 + 8}px`
    : undefined;

  const pending = requests.filter((r) => r.status === "pending");
  const allResolved = requests.filter((r) => r.status !== "pending");
  const resolved = showCleared
    ? allResolved
    : allResolved.filter((r) => !clearedIds.has(r.id));
  const hiddenCount = allResolved.length - resolved.length;
  const sortedResolved = [...resolved].sort((a, b) => {
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

  const renderPendingGroup = (group: BookingRequest[]) => {
    const first = group[0];
    const matched = matchGuest(first.guestPhone);
    const displayName = matched?.name ?? first.guestName;
    const phone = normalizePhone(first.guestPhone);
    const isUpdating = updatingPhone === phone;

    // Use the first request's room color for the left border
    const firstRoom = getRoom(first.room);
    const borderClass = firstRoom
      ? getRoomColor(firstRoom.name, firstRoom.color).replace("bg-", "border-")
      : "border-gray-400";

    return (
      <div
        key={phone}
        className={`rounded-lg border-l-4 ${borderClass} bg-white shadow-sm p-3 flex flex-col gap-2`}
      >
        {/* Guest header */}
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

        {/* Date rows */}
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

        {/* Accept / Decline */}
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

  const renderResolvedCard = (req: BookingRequest) => {
    const room = getRoom(req.room);
    const matched = matchGuest(req.guestPhone);
    const displayName = matched?.name ?? req.guestName;
    const roomColorClass = room ? getRoomColor(room.name, room.color) : "bg-gray-400";
    const resolvedBorder =
      req.status === "confirmed"
        ? "border-green-500"
        : req.status === "cancelled"
          ? "border-red-400"
          : roomColorClass.replace("bg-", "border-");

    return (
      <tr key={req.id} className={`border-l-4 ${resolvedBorder} bg-gray-50 opacity-70 text-[11px] hover:opacity-100`}>
        <td className="py-1 pl-2 pr-3 font-medium text-gray-600 max-w-[80px] truncate">{displayName}</td>
        <td className="py-1 pr-3 text-gray-500 whitespace-nowrap">{formatDate(req.date)}</td>
        <td className="py-1 pr-3 whitespace-nowrap">
          {room && (
            <span
              className={`${roomColorClass} text-white font-medium py-0.5 rounded text-[10px] inline-block text-center whitespace-nowrap`}
              style={{ width: roomBoxWidth }}
            >
              {room.name}
            </span>
          )}
        </td>
        <td className="py-1 pr-3 text-gray-400 whitespace-nowrap">{formatTimestamp(req.updatedAt)}</td>
        <td className="py-1 pr-3 text-gray-400 whitespace-nowrap">{req.duration}n · {req.numberOfGuests}g</td>
        <td className={`py-1 pr-3 font-medium whitespace-nowrap ${statusColor(req.status)}`}>{statusLabel(req.status)}</td>
      </tr>
    );
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-gray-100 flex-shrink-0">
        <h2 className="text-base font-bold text-gray-800">Booking Requests</h2>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        {loading ? (
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
            {(resolved.length > 0 || hiddenCount > 0) && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                    History {resolved.length > 0 && `(${resolved.length})`}
                  </h3>
                  <div className="flex items-center gap-2">
                    {clearedIds.size > 0 && (
                      <button
                        type="button"
                        className="text-[10px] text-blue-400 hover:text-blue-600 transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowCleared((v) => !v);
                        }}
                      >
                        {showCleared ? "Hide cleared" : `Show cleared (${hiddenCount})`}
                      </button>
                    )}
                    {resolved.length > 0 && !showCleared && (
                      <button
                        type="button"
                        className="text-[10px] text-gray-400 hover:text-red-400 transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          const newIds = new Set([
                            ...clearedIds,
                            ...resolved.map((r) => r.id),
                          ]);
                          sessionStorage.setItem(
                            `clearedRequestIds_${hostId}`,
                            JSON.stringify([...newIds]),
                          );
                          setClearedIds(newIds);
                        }}
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="text-[10px] text-gray-400 uppercase tracking-wider border-b border-gray-200">
                      {(["guest", "date", "room", "when"] as const).map((col) => {
                        const labels: Record<string, string> = { guest: "Guest", date: "Date", room: "Room", when: "When" };
                        const active = historySort.key === col;
                        return (
                          <th
                            key={col}
                            className={`pb-1 ${col === "guest" ? "pl-2" : ""} ${col === "when" ? "text-right" : "text-left"} font-medium cursor-pointer select-none hover:text-gray-600 whitespace-nowrap ${active ? "text-gray-600" : ""}`}
                            onClick={() => setHistorySort((s) => s.key === col ? { key: col, dir: s.dir === "asc" ? "desc" : "asc" } : { key: col, dir: "asc" })}
                          >
                            {labels[col]}{active ? (historySort.dir === "desc" ? " ↓" : " ↑") : ""}
                          </th>
                        );
                      })}
                      <th className="pb-1 text-left font-medium">Stay</th>
                      <th className="pb-1 text-left font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedResolved.map((r) => renderResolvedCard(r))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default BookingRequestManagerModal;