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
  completedRequestId: string | null;
  onClose: () => void;
  onAccept: (
    requestId: string,
    prefill: {
      guestId: string | null;
      roomId: string;
      date: Date;
      duration: number;
      numberOfGuests: number;
    },
  ) => void;
  onAddGuest: (guest: { name: string; phone: string }) => void;
}

const BookingRequestManagerModal = ({
  hostId,
  token,
  rooms,
  guests,
  completedRequestId,
  onAccept,
  onAddGuest,
}: BookingRequestManagerModalProps) => {
  const [requests, setRequests] = useState<BookingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    fetchBookingRequestsByHost(hostId, token)
      .then((reqs) => setRequests(reqs ?? []))
      .catch(() => setRequests([]))
      .finally(() => setLoading(false));
  }, [hostId, token]);

  useEffect(() => {
    if (!completedRequestId) return;
    updateBookingRequestStatus(completedRequestId, "confirmed", token)
      .then(() =>
        setRequests((prev) =>
          prev.map((r) =>
            r.id === completedRequestId
              ? { ...r, status: "confirmed", updatedAt: String(Date.now()) }
              : r,
          ),
        ),
      )
      .catch(() => {});
  }, [completedRequestId, token]);

  const normalizePhone = (phone: string) => phone.replace(/\D/g, "");

  const matchGuest = (phone: string): guestType | undefined =>
    guests.find((g) => normalizePhone(g.phone) === normalizePhone(phone));

  const getRoom = (roomId: string): roomType | undefined =>
    rooms.find((r) => r.id === roomId);

  const handleAccept = (req: BookingRequest) => {
    const matched = matchGuest(req.guestPhone);
    onAccept(req.id, {
      guestId: matched?.id ?? null,
      roomId: req.room,
      date: toZonedTime(req.date, timeZone),
      duration: req.duration,
      numberOfGuests: req.numberOfGuests,
    });
  };

  const handleDecline = async (req: BookingRequest) => {
    console.log(req.id, "cancelled", token);
    setUpdatingId(req.id);
    try {
      await updateBookingRequestStatus(req.id, "cancelled", token);
      setRequests((prev) =>
        prev.map((r) =>
          r.id === req.id
            ? { ...r, status: "cancelled", updatedAt: String(Date.now()) }
            : r,
        ),
      );
    } catch {
      // keep as pending on failure
    } finally {
      setUpdatingId(null);
    }
  };

  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const formatDate = (dateStr: string) => {
    const d = toZonedTime(dateStr, timeZone);
    return format(d, "EEE, MMM d yyyy");
  };

  const formatTimestamp = (dateStr: string) => {
    const d = toZonedTime(new Date(Number(dateStr)), timeZone);
    return format(d, "MMM d, h:mm a");
  };

  const pending = requests.filter((r) => r.status === "pending");
  const resolved = requests.filter((r) => r.status !== "pending");

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

  const renderCard = (req: BookingRequest, isPending: boolean) => {
    const room = getRoom(req.room);
    const matched = matchGuest(req.guestPhone);
    const displayName = matched?.name ?? req.guestName;
    const roomColorClass = room
      ? getRoomColor(room.name, room.color)
      : "bg-gray-400";
    const borderClass = roomColorClass.replace("bg-", "border-");
    const isUpdating = updatingId === req.id;

    const resolvedBorder =
      req.status === "confirmed"
        ? "border-green-500"
        : req.status === "cancelled"
          ? "border-red-400"
          : borderClass;

    return (
      <div
        key={req.id}
        className={`rounded-lg border-l-4 ${isPending ? borderClass : resolvedBorder} ${isPending ? "bg-white" : "bg-gray-50 opacity-70"} shadow-sm p-3 flex flex-col gap-2`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className={`font-semibold text-sm ${isPending ? "" : "text-gray-500"}`}
            >
              {displayName}
            </span>
            {matched ? (
              <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">
                returning
              </span>
            ) : (
              <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                NEW
                {isPending && (
                  <button
                    type="button"
                    className="underline font-medium hover:text-amber-900"
                    onClick={() =>
                      onAddGuest({ name: req.guestName, phone: req.guestPhone })
                    }
                  >
                    + Add
                  </button>
                )}
              </span>
            )}
          </div>
          {room && (
            <span
              className={`${roomColorClass} text-white text-xs font-medium px-2 py-0.5 rounded`}
            >
              {room.name}
            </span>
          )}
        </div>

        <div className="text-xs text-gray-600 flex flex-wrap gap-x-4 gap-y-1">
          <span>{formatDate(req.date)}</span>
          <span>
            {req.duration} night{req.duration > 1 ? "s" : ""}
          </span>
          <span>
            {req.numberOfGuests} guest{req.numberOfGuests > 1 ? "s" : ""}
          </span>
          <span>{req.guestPhone}</span>
        </div>

        {isPending ? (
          <div className="flex gap-2 mt-1">
            <button
              type="button"
              disabled={isUpdating}
              className="flex-1 bg-green-500 text-white text-xs font-medium py-1.5 rounded hover:bg-green-600 disabled:opacity-50"
              onClick={() => handleAccept(req)}
            >
              {isUpdating ? "..." : "Accept"}
            </button>
            <button
              type="button"
              disabled={isUpdating}
              className="flex-1 bg-red-500 text-white text-xs font-medium py-1.5 rounded hover:bg-red-600 disabled:opacity-50"
              onClick={() => handleDecline(req)}
            >
              {isUpdating ? "..." : "Decline"}
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between text-xs mt-1">
            <span className={`font-medium ${statusColor(req.status)}`}>
              {statusLabel(req.status)}
            </span>
            <span className="text-gray-400">
              {formatTimestamp(req.updatedAt)}
            </span>
          </div>
        )}
      </div>
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
            {pending.length > 0 && (
              <div className="flex flex-col gap-2">
                <h3 className="text-xs font-bold text-amber-600 uppercase tracking-wider">
                  Pending ({pending.length})
                </h3>
                {pending.map((r) => renderCard(r, true))}
              </div>
            )}
            {resolved.length > 0 && (
              <div className="flex flex-col gap-2">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                  History
                </h3>
                {resolved.map((r) => renderCard(r, false))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default BookingRequestManagerModal;
