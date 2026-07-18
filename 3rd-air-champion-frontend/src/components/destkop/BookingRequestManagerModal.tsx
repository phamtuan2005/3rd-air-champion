import { useEffect, useRef, useState } from "react";
import { roomType } from "../../util/types/roomType";
import { guestType } from "../../util/types/guestType";
import WishListPanel, { countAvailableWishListEntries } from "./WishListPanel";
import { WishListEntry, WishListStatus, getHostWishLists, setGuestWishList, deleteWishListEntry } from "../../util/wishListOperations";
import { dayType } from "../../util/types/dayType";
import {
  fetchBookingRequestsByHost,
  updateBookingRequestStatus,
  deleteBookingRequest,
} from "../../util/bookingRequestOperations";
import { getRoomColor } from "../../util/getRoomColor";
import RoomBadge from "../shared/RoomBadge";
import { format, toZonedTime } from "date-fns-tz";
import { format as formatLocal, addDays } from "date-fns";

type RequestOutcome =
  | { type: "booked" }
  | { type: "relocated"; roomName: string; roomColor?: string }
  | { type: "unfulfilled"; inWishList: boolean };

const resolveRequestOutcome = (
  req: BookingRequest,
  monthMap: Map<string, import("../../util/types/dayType").dayType>,
  wishListEntries: WishListEntry[],
): RequestOutcome => {
  const phone = req.guestPhone.replace(/\D/g, "");
  const checkInKey = req.date.slice(0, 10);
  const day = monthMap.get(checkInKey);
  if (day) {
    const matching = day.bookings.find(
      (b) => (b.guest?.phone ?? "").replace(/\D/g, "") === phone,
    );
    if (matching) {
      if (matching.room?.id === req.room) return { type: "booked" };
      return { type: "relocated", roomName: matching.room?.name ?? "", roomColor: matching.room?.color };
    }
  }
  const wishEntry = wishListEntries.find((e) => e.guestPhone.replace(/\D/g, "") === phone);
  const inWishList = wishEntry
    ? Array.from({ length: Math.max(req.duration, 1) }, (_, i) =>
        formatLocal(addDays(parseBookingDate(checkInKey), i), "yyyy-MM-dd"),
      ).some((d) => wishEntry.dates.includes(d))
    : false;
  return { type: "unfulfilled", inWishList };
};

const formatPhone = (raw: string): string => {
  const digits = raw.replace(/\D/g, "");
  const local = digits.startsWith("84") ? "0" + digits.slice(2) : digits;
  if (local.length === 10) return `${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`;
  if (local.length === 11) return `${local.slice(0, 4)} ${local.slice(4, 7)} ${local.slice(7)}`;
  return raw;
};

const parseBookingDate = (dateStr: string) => {
  const [y, m, d] = dateStr.substring(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
};

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
  onUnbook?: (ids: string[]) => void;
}

const SNAP_WIDTH = 72;
const SWIPE_THRESHOLD = 32;

const calcGroupStats = (
  group: BookingRequest[],
  getRoom: (id: string) => roomType | undefined,
  getGuest: (phone: string) => guestType | undefined,
) => {
  const nights = group.reduce((s, r) => s + r.duration, 0);
  const revenue = group.reduce((s, r) => {
    const guestPrice = getGuest(r.guestPhone)?.pricing.find((p) => p.room === r.room)?.price;
    const nightlyRate = guestPrice ?? getRoom(r.room)?.price ?? 0;
    return s + r.duration * nightlyRate;
  }, 0);
  return { nights, revenue };
};

const fmtRevenue = (n: number) => `$${n.toLocaleString()}`;

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

interface HistoryDetailSheetProps {
  group: BookingRequest[];
  rooms: roomType[];
  guests: guestType[];
  timeZone: string;
  formatDate: (d: string) => string;
  getRoom: (id: string) => roomType | undefined;
  matchGuest: (phone: string) => guestType | undefined;
  monthMap: Map<string, import("../../util/types/dayType").dayType>;
  onUnbookGroup?: (bookingIds: string[], requestIds: string[]) => void;
  onClose: () => void;
}

const DISMISS_HEIGHT = 100; // px — close when dragged below this

const HistoryDetailSheet = ({
  group,
  rooms,
  formatDate,
  getRoom,
  matchGuest,
  monthMap,
  onUnbookGroup,
  onClose,
}: HistoryDetailSheetProps) => {
  const backdropRef = useRef<HTMLDivElement>(null);
  const mountedAtRef = useRef(Date.now());
  const [heightPx, setHeightPx] = useState<number | null>(null); // null = use CSS default
  const [animating, setAnimating] = useState(false);
  const [dismissing, setDismissing] = useState(false);
  const [showUnbookConfirm, setShowUnbookConfirm] = useState(false);
  const [unbooking, setUnbooking] = useState(false);
  const startYRef = useRef<number | null>(null);
  const startHeightRef = useRef<number>(0);

  const getContainerHeight = () => backdropRef.current?.clientHeight ?? 400;

  const resolvedHeight = (): number =>
    heightPx ?? getContainerHeight() * 0.6;

  // Slide sheet to 0 first, then call onClose after animation so the touch
  // gesture finishes before the element unmounts (prevents rerouting to MobilePanel).
  const dismiss = () => {
    setDismissing(true);
    setHeightPx(0);
    setTimeout(onClose, 280);
  };

  const commitDrag = (finalY: number) => {
    if (startYRef.current === null) return;
    const delta = startYRef.current - finalY; // positive = dragging up = taller
    const newH = Math.min(
      getContainerHeight() * 0.94,
      Math.max(0, startHeightRef.current + delta),
    );
    startYRef.current = null;
    if (newH < DISMISS_HEIGHT) {
      dismiss();
    } else {
      setAnimating(true);
      setHeightPx(newH);
      setTimeout(() => setAnimating(false), 250);
    }
  };

  const moveDrag = (clientY: number) => {
    if (startYRef.current === null) return;
    const delta = startYRef.current - clientY;
    const newH = Math.min(
      getContainerHeight() * 0.94,
      Math.max(0, startHeightRef.current + delta),
    );
    setHeightPx(newH);
  };

  const startDrag = (clientY: number) => {
    startYRef.current = clientY;
    startHeightRef.current = resolvedHeight();
    setAnimating(false);
  };

  const handleTouchStart = (e: React.TouchEvent) => startDrag(e.touches[0].clientY);
  const handleTouchMove = (e: React.TouchEvent) => moveDrag(e.touches[0].clientY);
  const handleTouchEnd = (e: React.TouchEvent) => commitDrag(e.changedTouches[0].clientY);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    startDrag(e.clientY);
    const onMove = (ev: MouseEvent) => moveDrag(ev.clientY);
    const onUp = (ev: MouseEvent) => {
      commitDrag(ev.clientY);
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  const first = group[0];
  const matched = matchGuest(first.guestPhone);
  const displayName = matched?.name ?? first.guestName;
  const allConfirmed = group.every((r) => r.status === "confirmed");
  const allCancelled = group.every((r) => r.status === "cancelled");
  const overallStatus = allConfirmed ? "confirmed" : allCancelled ? "cancelled" : "mixed";

  return (
    <div
      ref={backdropRef}
      className="absolute inset-0 bg-black/40 z-20"
      onClick={(e) => { if (Date.now() - mountedAtRef.current < 500) return; e.stopPropagation(); dismiss(); }}
    >
      <div
        className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-xl flex flex-col overflow-hidden"
        style={{
          height: heightPx !== null ? `${heightPx}px` : "60%",
          transition: (animating || dismissing) ? "height 0.28s ease" : "none",
        }}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {/* Drag zone: handle bar + header — the whole top area is draggable */}
        <div
          className="flex-shrink-0 cursor-ns-resize select-none"
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="flex justify-center pt-3 pb-2">
            <div className="w-10 h-1 bg-gray-300 rounded-full" />
          </div>
          <div className="flex items-start justify-between gap-2 px-5 pb-3">
            <div>
              <p className="text-base font-bold text-gray-800">{displayName}</p>
              <p className="text-sm text-gray-400">{formatPhone(first.guestPhone)}</p>
            </div>
            <span className={`text-sm font-semibold ${statusColor(overallStatus)}`}>
              {statusLabel(overallStatus)}
            </span>
          </div>

          {/* Nights + revenue strip */}
          {(() => {
            const { nights, revenue } = calcGroupStats(group, getRoom, matchGuest);
            return revenue > 0 ? (
              <div className="flex items-center gap-4 bg-green-50 border border-green-200 rounded-xl px-4 py-2.5 mt-1">
                <div className="flex flex-col items-center gap-0.5">
                  <span className="text-[10px] text-green-500 font-medium uppercase tracking-wide">Nights</span>
                  <span className="text-base font-bold text-green-700">{nights}</span>
                </div>
                <div className="w-px h-8 bg-green-200" />
                <div className="flex flex-col items-center gap-0.5 flex-1">
                  <span className="text-[10px] text-green-500 font-medium uppercase tracking-wide">Revenue</span>
                  <span className="text-base font-bold text-green-700">{fmtRevenue(revenue)}</span>
                </div>
              </div>
            ) : null;
          })()}
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto overscroll-y-contain flex-1 px-5 pb-6 border-t border-gray-100">
          <div className="flex flex-col gap-3 pt-3">
            {[...group].sort((a, b) => a.date.localeCompare(b.date)).map((req) => {
              const room = getRoom(req.room);
              return (
                <div key={req.id} className="flex flex-col gap-1 text-sm text-gray-700">
                  <div className="flex items-center gap-2">
                    {room && <RoomBadge room={room} rooms={rooms} />}
                    <span>{formatDate(req.date)}</span>
                    {group.length > 1 && (
                      <span className={`ml-auto text-xs font-medium ${statusColor(req.status)}`}>
                        {statusLabel(req.status)}
                      </span>
                    )}
                  </div>
                  {req.duration === 0 ? (
                    <p className="text-amber-500 text-xs font-medium">0 nights — will move to wish list</p>
                  ) : (
                    <p className="text-gray-500 text-xs">
                      {req.duration} night{req.duration > 1 ? "s" : ""} · {req.numberOfGuests} guest{req.numberOfGuests > 1 ? "s" : ""}
                    </p>
                  )}
                  {req.notes && <p className="text-gray-500 text-xs italic">{req.notes}</p>}
                </div>
              );
            })}
          </div>
        </div>

        {/* Unbook footer — only for confirmed groups */}
        {onUnbookGroup && group.some((r) => r.status === "confirmed") && (
          <div className="flex-shrink-0 px-5 py-3 border-t border-gray-100">
            <button
              type="button"
              className="w-full py-2.5 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm font-semibold hover:bg-red-100 active:bg-red-200 transition-colors"
              onClick={() => setShowUnbookConfirm(true)}
            >
              Unbook Guest
            </button>
          </div>
        )}
      </div>

      {/* Unbook confirmation overlay */}
      {showUnbookConfirm && (
        <div
          className="absolute inset-0 bg-black/40 flex items-end z-30"
          onClick={() => setShowUnbookConfirm(false)}
        >
          <div
            className="bg-white rounded-t-2xl w-full p-6 flex flex-col gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col gap-1 text-center">
              <p className="text-base font-bold text-gray-800">Unbook {displayName}?</p>
              <p className="text-sm text-gray-400">
                This will remove{" "}
                {group.filter((r) => r.status === "confirmed").length > 1
                  ? `all ${group.filter((r) => r.status === "confirmed").length} confirmed bookings`
                  : "the confirmed booking"}{" "}
                from the calendar.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                className="flex-1 py-3 rounded-xl bg-gray-100 text-gray-600 text-sm font-semibold hover:bg-gray-200"
                onClick={() => setShowUnbookConfirm(false)}
              >
                Keep it
              </button>
              <button
                type="button"
                disabled={unbooking}
                className="flex-1 py-3 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600 disabled:opacity-50"
                onClick={async () => {
                  setUnbooking(true);
                  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
                  const bookingIds: string[] = [];
                  const requestIds: string[] = [];
                  for (const req of group) {
                    if (req.status !== "confirmed") continue;
                    requestIds.push(req.id);
                    const guest = matchGuest(req.guestPhone);
                    if (!guest) continue;
                    const startDate = toZonedTime(req.date, timeZone);
                    for (let i = 0; i < req.duration; i++) {
                      const dayKey = addDays(startDate, i).toISOString().split("T")[0];
                      const day = monthMap.get(dayKey);
                      if (!day) continue;
                      day.bookings.forEach((b) => {
                        if (b.guest.id === guest.id && b.room.id === req.room) bookingIds.push(b.id);
                      });
                    }
                  }
                  onUnbookGroup!(bookingIds, requestIds);
                  setUnbooking(false);
                  setShowUnbookConfirm(false);
                  onClose();
                }}
              >
                {unbooking ? "Unbooking…" : "Yes, unbook"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface SwipeableHistoryGroupRowProps {
  group: BookingRequest[];
  rooms: roomType[];
  guests: guestType[];
  timeZone: string;
  monthMap: Map<string, import("../../util/types/dayType").dayType>;
  wishListEntries: WishListEntry[];
  onDeleteGroup: (ids: string[]) => void;
  onSelect: (group: BookingRequest[]) => void;
  onAddToWishList: (phone: string, name: string, dates: string[]) => Promise<void>;
}

const SwipeableHistoryGroupRow = ({
  group,
  rooms,
  guests,
  timeZone,
  monthMap,
  wishListEntries,
  onDeleteGroup,
  onSelect,
  onAddToWishList,
}: SwipeableHistoryGroupRowProps) => {
  const [offset, setOffset] = useState(0);
  const [confirming, setConfirming] = useState(false);
  const [addingWishList, setAddingWishList] = useState<Set<string>>(new Set());
  const activeRooms = rooms.filter((r) => r.active);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const offsetAtStart = useRef(0);
  const didMove = useRef(false);
  const direction = useRef<"horizontal" | "vertical" | null>(null);

  const first = group[0];
  const matched = guests.find((g) => g.phone.replace(/\D/g, "") === first.guestPhone.replace(/\D/g, ""));
  const displayName = matched?.name ?? first.guestName;

  const allConfirmed = group.every((r) => r.status === "confirmed");
  const allCancelled = group.every((r) => r.status === "cancelled");
  const borderClass = allConfirmed ? "border-green-500" : allCancelled ? "border-red-400" : "border-gray-300";
  const statusBadgeClass = allConfirmed ? "bg-green-100 text-green-700" : allCancelled ? "bg-red-100 text-red-500" : "bg-gray-100 text-gray-500";
  const statusText = allConfirmed ? "Accepted" : allCancelled ? "Declined" : "Mixed";

  const latestUpdatedAt = group.reduce((max, r) => Math.max(max, Number(r.updatedAt)), 0);
  const fmtTimestamp = (ms: number) => {
    const date = new Date(ms);
    return format(date, "MMM d, h:mm a", { timeZone });
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    offsetAtStart.current = offset;
    didMove.current = false;
    direction.current = null;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const dx = e.touches[0].clientX - touchStartX.current;
    const dy = e.touches[0].clientY - touchStartY.current;
    if (direction.current === null && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) {
      direction.current = Math.abs(dx) > Math.abs(dy) ? "horizontal" : "vertical";
    }
    if (direction.current !== "horizontal") return;
    didMove.current = true;
    setOffset(Math.min(0, Math.max(offsetAtStart.current + dx, -SNAP_WIDTH)));
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!didMove.current) {
      const netDy = Math.abs(e.changedTouches[0].clientY - touchStartY.current);
      if (netDy > 10) return; // real scroll, not a tap
      if (offset === -SNAP_WIDTH) {
        e.preventDefault();
        setConfirming(true);
      } else {
        onSelect(group);
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
      <div className="absolute right-1 top-1 bottom-1 w-[68px] bg-red-500 flex items-center justify-center rounded-lg">
        <button
          type="button"
          className="text-white text-xs font-semibold w-full h-full"
          onClick={() => setConfirming(true)}
        >
          {group.length > 1 ? `Delete\n(${group.length})` : "Delete"}
        </button>
      </div>

      {/* Swipeable card content */}
      <div
        className="relative bg-gray-50 px-3 py-2.5 flex flex-col gap-1"
        style={{
          transform: `translateX(${offset}px)`,
          transition: snapping ? "transform 0.18s ease" : "none",
        }}
      >
        {/* Header row */}
        {(() => {
          const getR = (id: string) => rooms.find((r) => r.id === id);
          const getG = (phone: string) => guests.find((g) => g.phone.replace(/\D/g, "") === phone.replace(/\D/g, ""));
          const { nights, revenue } = calcGroupStats(group, getR, getG);
          return (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-medium text-[12px] text-gray-700 truncate min-w-0">{displayName}</span>
              {revenue > 0 && (
                <>
                  <span className="text-[10px] text-gray-400 shrink-0">{nights}n</span>
                  <span className="text-[11px] font-bold text-green-700 shrink-0">{fmtRevenue(revenue)}</span>
                </>
              )}
              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0 ${statusBadgeClass}`}>{statusText}</span>
              <span className="text-[10px] text-gray-400 ml-auto shrink-0">{fmtTimestamp(latestUpdatedAt)}</span>
            </div>
          );
        })()}

        {/* Request rows */}
        {[...group].sort((a, b) => a.date.localeCompare(b.date)).map((req) => {
          const room = rooms.find((r) => r.id === req.room);
          const outcome = resolveRequestOutcome(req, monthMap, wishListEntries);
          const isAdding = addingWishList.has(req.id);
          return (
            <div key={req.id} className="flex items-center gap-2 text-[11px] text-gray-600 flex-wrap">
              {room && <RoomBadge room={room} rooms={activeRooms} />}
              <span className="whitespace-nowrap">{formatLocal(parseBookingDate(req.date), "EEE, MMM d yyyy")}</span>
              <span className="text-gray-400 whitespace-nowrap">
                {req.duration}n · {req.numberOfGuests} guest{req.numberOfGuests > 1 ? "s" : ""}
              </span>
              {outcome.type === "booked" && (
                <span className="ml-auto text-green-500 font-bold text-xs">✓</span>
              )}
              {outcome.type === "relocated" && (
                <span className="ml-auto flex items-center gap-1 shrink-0">
                  <span className="text-gray-400">→</span>
                  <RoomBadge room={{ name: outcome.roomName, color: outcome.roomColor }} rooms={activeRooms} />
                </span>
              )}
              {outcome.type === "unfulfilled" && outcome.inWishList && (
                <span className="ml-auto text-amber-400 text-xs">★</span>
              )}
              {outcome.type === "unfulfilled" && !outcome.inWishList && req.status === "cancelled" && (
                <button
                  type="button"
                  disabled={isAdding}
                  className="ml-auto text-amber-500 text-[10px] font-semibold hover:text-amber-700 disabled:opacity-50 whitespace-nowrap"
                  onClick={async (e) => {
                    e.stopPropagation();
                    const dates = Array.from({ length: Math.max(req.duration, 1) }, (_, i) =>
                      formatLocal(addDays(parseBookingDate(req.date.slice(0, 10)), i), "yyyy-MM-dd"),
                    );
                    setAddingWishList((prev) => new Set([...prev, req.id]));
                    await onAddToWishList(req.guestPhone, req.guestName, dates);
                    setAddingWishList((prev) => { const next = new Set(prev); next.delete(req.id); return next; });
                  }}
                >
                  {isAdding ? "…" : "→ wish list"}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Delete confirmation overlay */}
      {confirming && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-30 px-6"
          onClick={() => { setConfirming(false); setOffset(0); }}
          onTouchStart={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
          onTouchEnd={(e) => e.stopPropagation()}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 flex flex-col gap-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col gap-1 text-center">
              <p className="text-base font-bold text-gray-800">Remove {group.length > 1 ? "these records" : "this record"}?</p>
              <p className="text-sm text-gray-400">
                {group.length > 1 ? `${group.length} requests from ` : "This request from "}
                <span className="font-medium text-gray-600">{displayName}</span> will be permanently deleted.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                className="flex-1 py-3 rounded-xl bg-gray-100 text-gray-600 text-sm font-semibold hover:bg-gray-200 active:bg-gray-300"
                onClick={() => { setConfirming(false); setOffset(0); }}
              >
                Keep it
              </button>
              <button
                type="button"
                className="flex-1 py-3 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600 active:bg-red-700"
                onClick={() => { onDeleteGroup(group.map((r) => r.id)); setOffset(0); setConfirming(false); }}
              >
                Yes, delete
              </button>
            </div>
          </div>
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
  onUnbook,
}: BookingRequestManagerModalProps) => {
  const [requests, setRequests] = useState<BookingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingPhone, setUpdatingPhone] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(true);
  const [historySort, setHistorySort] = useState<{ key: "guest" | "date" | "room" | "when"; dir: "asc" | "desc" }>({ key: "when", dir: "desc" });
  const [activeTab, setActiveTab] = useState<"requests" | "wishlist">("requests");
  const [selectedHistoryGroup, setSelectedHistoryGroup] = useState<BookingRequest[] | null>(null);
  const [selectedPendingGroup, setSelectedPendingGroup] = useState<BookingRequest[] | null>(null);
  const [wishListEntries, setWishListEntries] = useState<WishListEntry[]>([]);
  const [wishListLoading, setWishListLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addPhone, setAddPhone] = useState("");
  const [addName, setAddName] = useState("");
  const [addDates, setAddDates] = useState<string[]>([]);
  const [addSaving, setAddSaving] = useState(false);
  const [addError, setAddError] = useState("");
  const [nameSuggestions, setNameSuggestions] = useState<guestType[]>([]);

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
  const totalWishListBadge = wishListEntries.filter((e) => e.dates.length > 0).length;

  const fmtAddDate = (d: string) => {
    const date = new Date(`${d}T12:00:00`);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const handleAddPhoneChange = (phone: string) => {
    setAddPhone(phone);
    const normalized = phone.replace(/\D/g, "");
    if (normalized.length >= 10) {
      const found = guests.find((g) => g.phone.replace(/\D/g, "") === normalized);
      if (found) { setAddName(found.name); setNameSuggestions([]); }
    }
  };

  const handleAddNameChange = (name: string) => {
    setAddName(name);
    if (!name.trim()) { setNameSuggestions([]); return; }
    const q = name.toLowerCase();
    setNameSuggestions(
      guests.filter(
        (g) => g.name.toLowerCase().includes(q) || (g.alias && g.alias.toLowerCase().includes(q)),
      ).slice(0, 6),
    );
  };

  const handleSelectGuest = (g: guestType) => {
    setAddName(g.name);
    setAddPhone(g.phone);
    setNameSuggestions([]);
  };

  const handleAddDate = (dateStr: string) => {
    if (!dateStr || addDates.includes(dateStr)) return;
    setAddDates((prev) => [...prev, dateStr].sort());
  };

  const handleAddWishList = async () => {
    if (!addPhone.trim() || !addName.trim() || addDates.length === 0) {
      setAddError("Please enter phone, name, and at least one date.");
      return;
    }
    setAddSaving(true);
    setAddError("");
    try {
      const normalizedPhone = addPhone.replace(/\D/g, "");
      const existing = wishListEntries.find(
        (e) => e.guestPhone.replace(/\D/g, "") === normalizedPhone,
      );
      const mergedDates = existing
        ? [...new Set([...existing.dates, ...addDates])].sort()
        : [...addDates];
      await setGuestWishList({
        host: hostId,
        guestPhone: normalizedPhone,
        guestName: addName.trim(),
        dates: mergedDates,
      });
      const updated = await getHostWishLists(hostId, token);
      setWishListEntries(updated);
      setShowAddForm(false);
      setAddPhone("");
      setAddName("");
      setAddDates([]);
      setNameSuggestions([]);
    } catch {
      setAddError("Failed to save. Please try again.");
    } finally {
      setAddSaving(false);
    }
  };

  const handleWishListStatusChange = (id: string, status: WishListStatus) => {
    setWishListEntries((prev) => prev.map((e) => (e.id === id ? { ...e, status } : e)));
  };

  const handleWishListDelete = (id: string) => {
    setWishListEntries((prev) => prev.filter((e) => e.id !== id));
  };

  // Remove a single wished date. Removing the last one drops the whole entry.
  const handleWishListRemoveDate = (id: string, date: string) => {
    const entry = wishListEntries.find((e) => e.id === id);
    if (!entry) return;
    const remaining = entry.dates.filter((d) => d !== date);
    if (remaining.length === 0) {
      setWishListEntries((prev) => prev.filter((e) => e.id !== id));
      deleteWishListEntry(id, token).catch(() => {});
    } else {
      setWishListEntries((prev) => prev.map((e) => (e.id === id ? { ...e, dates: remaining } : e)));
      setGuestWishList({
        host: hostId,
        guestPhone: entry.guestPhone,
        guestName: entry.guestName,
        dates: remaining,
      }).catch(() => {});
    }
  };

  const normalizePhone = (phone: string) => phone.replace(/\D/g, "");

  const matchGuest = (phone: string): guestType | undefined =>
    guests.find((g) => normalizePhone(g.phone) === normalizePhone(phone));

  const getRoom = (roomId: string): roomType | undefined =>
    rooms.find((r) => r.id === roomId);

  const handleAcceptGroup = async (group: BookingRequest[]) => {
    const valid = group.filter((req) => req.duration > 0);
    const zeroDuration = group.filter((req) => req.duration === 0);

    // Zero-duration requests can't be booked — add their dates to the wish list instead
    if (zeroDuration.length > 0) {
      const byPhone = new Map<string, BookingRequest[]>();
      for (const req of zeroDuration) {
        const phone = normalizePhone(req.guestPhone);
        if (!byPhone.has(phone)) byPhone.set(phone, []);
        byPhone.get(phone)!.push(req);
      }

      await Promise.all(
        Array.from(byPhone.entries()).map(async ([phone, reqs]) => {
          const existing = wishListEntries.find((e) => normalizePhone(e.guestPhone) === phone);
          const newDates = reqs.map((r) => r.date.slice(0, 10));
          const mergedDates = existing
            ? [...new Set([...existing.dates, ...newDates])].sort()
            : newDates;
          await setGuestWishList({ host: hostId, guestPhone: phone, guestName: reqs[0].guestName, dates: mergedDates }).catch(() => {});
          reqs.forEach((req) => {
            updateBookingRequestStatus(req.id, "cancelled", token)
              .then(() => setRequests((prev) => prev.map((r) => r.id === req.id ? { ...r, status: "cancelled", updatedAt: String(Date.now()) } : r)))
              .catch(() => {});
          });
        }),
      );

      getHostWishLists(hostId, token).then(setWishListEntries).catch(() => {});
    }

    if (valid.length > 0) {
      onAccept(
        valid.map((req) => {
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
    }
  };

  const handleDeleteGroup = (ids: string[]) => {
    setRequests((prev) => prev.filter((r) => !ids.includes(r.id)));
    ids.forEach((id) => deleteBookingRequest(id, token).catch(() => {}));
  };

  const handleUnbookGroup = (bookingIds: string[], requestIds: string[]) => {
    if (onUnbook) onUnbook(bookingIds);
    setRequests((prev) =>
      prev.map((r) =>
        requestIds.includes(r.id)
          ? { ...r, status: "pending", updatedAt: String(Date.now()) }
          : r,
      ),
    );
    requestIds.forEach((id) =>
      updateBookingRequestStatus(id, "pending", token).catch(() => {}),
    );
    setSelectedHistoryGroup(null);
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
    formatLocal(parseBookingDate(dateStr), "EEE, MMM d yyyy");

  const pending = requests.filter((r) => r.status === "pending");
  const allResolved = requests.filter((r) => r.status !== "pending");

  // Group resolved requests by (phone, submission date)
  const getSubmissionDateKey = (ts: string) => {
    const ms = Number(ts);
    return isNaN(ms) ? ts.slice(0, 10) : new Date(ms).toISOString().slice(0, 10);
  };

  const resolvedGroupMap = new Map<string, BookingRequest[]>();
  for (const req of allResolved) {
    const key = `${normalizePhone(req.guestPhone)}_${getSubmissionDateKey(req.createdAt)}`;
    if (!resolvedGroupMap.has(key)) resolvedGroupMap.set(key, []);
    resolvedGroupMap.get(key)!.push(req);
  }

  const sortedHistoryGroups = [...resolvedGroupMap.values()].sort((a, b) => {
    const dir = historySort.dir === "asc" ? 1 : -1;
    switch (historySort.key) {
      case "guest": {
        const aName = (matchGuest(a[0].guestPhone)?.name ?? a[0].guestName).toLowerCase();
        const bName = (matchGuest(b[0].guestPhone)?.name ?? b[0].guestName).toLowerCase();
        return dir * aName.localeCompare(bName);
      }
      case "date": {
        const aDate = Math.min(...a.map((r) => new Date(r.date).getTime()));
        const bDate = Math.min(...b.map((r) => new Date(r.date).getTime()));
        return dir * (aDate - bDate);
      }
      case "room": {
        const aRoom = getRoom(a[0].room)?.name ?? "";
        const bRoom = getRoom(b[0].room)?.name ?? "";
        return dir * aRoom.localeCompare(bRoom);
      }
      case "when":
      default: {
        const aWhen = Math.max(...a.map((r) => Number(r.updatedAt)));
        const bWhen = Math.max(...b.map((r) => Number(r.updatedAt)));
        return dir * (aWhen - bWhen);
      }
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
        {/* Tappable detail area — opens full detail sheet */}
        <div
          className="flex flex-col gap-2 cursor-pointer"
          onClick={() => setSelectedPendingGroup(group)}
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
                  onClick={(e) => { e.stopPropagation(); onAddGuest({ name: first.guestName, phone: first.guestPhone }); }}
                >
                  + Add
                </button>
              </span>
            )}
            <span className="text-[10px] text-gray-400 ml-auto">{formatPhone(first.guestPhone)}</span>
          </div>

          <div className="flex flex-col gap-1">
            {group.map((req) => {
              const room = getRoom(req.room);
              const isZero = req.duration === 0;
              return (
                <div key={req.id} className="flex items-center gap-2 text-xs text-gray-600">
                  {room && <RoomBadge room={room} rooms={rooms} />}
                  <span>{formatDate(req.date)}</span>
                  {isZero ? (
                    <span className="text-amber-500 font-medium">→ wish list</span>
                  ) : (
                    <span className="text-gray-400">
                      {req.duration}n · {req.numberOfGuests} guest{req.numberOfGuests > 1 ? "s" : ""}
                    </span>
                  )}
                </div>
              );
            })}
            {group[0].notes && (
              <p className="text-[11px] text-gray-400 mt-0.5">{group[0].notes}</p>
            )}
          </div>

          {/* Revenue highlight */}
          {(() => {
            const { nights, revenue } = calcGroupStats(group, getRoom, matchGuest);
            return revenue > 0 ? (
              <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-green-600 font-medium">{nights} night{nights !== 1 ? "s" : ""}</span>
                </div>
                <span className="text-sm font-bold text-green-700">{fmtRevenue(revenue)}</span>
              </div>
            ) : null;
          })()}
        </div>

        <div className="flex gap-2">
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
    <div className="h-full flex flex-col overflow-hidden relative">
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
          {totalWishListBadge > 0 && (
            <span className={`text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none ${availableBadge > 0 ? "bg-green-500" : "bg-amber-400"}`}>
              {totalWishListBadge}
            </span>
          )}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        {activeTab === "wishlist" ? (
          <>
            <div className="flex justify-end mb-3">
              <button
                type="button"
                onClick={() => { setShowAddForm((v) => !v); setAddError(""); setNameSuggestions([]); }}
                className="text-xs font-semibold text-amber-600 hover:text-amber-800"
              >
                {showAddForm ? "Cancel" : "+ Add"}
              </button>
            </div>

            {showAddForm && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-3 flex flex-col gap-2">
                <input
                  type="tel"
                  placeholder="Guest phone"
                  value={addPhone}
                  onChange={(e) => handleAddPhoneChange(e.target.value)}
                  className="w-full border border-gray-200 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:border-amber-400"
                />
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Guest name"
                    value={addName}
                    onChange={(e) => handleAddNameChange(e.target.value)}
                    className="w-full border border-gray-200 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:border-amber-400"
                  />
                  {nameSuggestions.length > 0 && (
                    <div className="absolute z-10 top-full left-0 right-0 bg-white border border-gray-200 rounded shadow-md mt-0.5 overflow-hidden">
                      {nameSuggestions.map((g) => (
                        <button
                          key={g.id}
                          type="button"
                          onMouseDown={() => handleSelectGuest(g)}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-amber-50 flex items-center justify-between gap-2"
                        >
                          <span className="font-medium text-gray-800">{g.name}</span>
                          <span className="text-[11px] text-gray-400 shrink-0">{g.phone}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <input
                  type="date"
                  onChange={(e) => { handleAddDate(e.target.value); e.currentTarget.value = ""; }}
                  className="w-full border border-gray-200 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:border-amber-400"
                />
                {addDates.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {addDates.map((d) => (
                      <span
                        key={d}
                        className="bg-amber-100 border border-amber-300 text-amber-800 text-[11px] font-medium px-2 py-0.5 rounded-full flex items-center gap-1"
                      >
                        {fmtAddDate(d)}
                        <button
                          type="button"
                          onClick={() => setAddDates((prev) => prev.filter((x) => x !== d))}
                          className="text-amber-500 hover:text-amber-800 leading-none"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                {addError && <p className="text-xs text-red-500">{addError}</p>}
                <button
                  type="button"
                  disabled={addSaving}
                  onClick={handleAddWishList}
                  className="bg-amber-500 text-white text-xs font-semibold py-1.5 rounded hover:bg-amber-600 disabled:opacity-50"
                >
                  {addSaving ? "Saving…" : "Save"}
                </button>
              </div>
            )}

            <WishListPanel
              token={token}
              entries={wishListEntries}
              loading={wishListLoading}
              monthMap={monthMap}
              rooms={rooms}
              onStatusChange={handleWishListStatusChange}
              onDelete={handleWishListDelete}
              onRemoveDate={handleWishListRemoveDate}
            />
          </>
        ) : loading ? (
          <p className="text-sm text-gray-500 text-center py-8">Loading...</p>
        ) : pendingGroups.length === 0 && allResolved.length === 0 ? (
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
                    {/* Sort controls */}
                    <div className="flex gap-2 flex-wrap">
                      {(["guest", "date", "room", "when"] as const).map((col) => {
                        const labels: Record<string, string> = { guest: "Guest", date: "Date", room: "Room", when: "When" };
                        const active = historySort.key === col;
                        return (
                          <button
                            key={col}
                            type="button"
                            className={`text-[10px] font-medium px-2 py-0.5 rounded-full border cursor-pointer select-none transition-colors ${active ? "border-gray-400 text-gray-600 bg-gray-100" : "border-gray-200 text-gray-400 hover:text-gray-600"}`}
                            onClick={() => setHistorySort((s) => s.key === col ? { key: col, dir: s.dir === "asc" ? "desc" : "asc" } : { key: col, dir: "asc" })}
                          >
                            {labels[col]}{active ? (historySort.dir === "desc" ? " ↓" : " ↑") : ""}
                          </button>
                        );
                      })}
                    </div>

                    {/* Grouped history cards */}
                    <div className="flex flex-col gap-1">
                      {sortedHistoryGroups.map((group) => (
                        <SwipeableHistoryGroupRow
                          key={group.map((r) => r.id).join("_")}
                          group={group}
                          rooms={rooms}
                          guests={guests}
                          timeZone={timeZone}
                          monthMap={monthMap}
                          wishListEntries={wishListEntries}
                          onDeleteGroup={handleDeleteGroup}
                          onSelect={setSelectedHistoryGroup}
                          onAddToWishList={async (phone, name, dates) => {
                            const normalized = phone.replace(/\D/g, "");
                            const existing = wishListEntries.find((e) => e.guestPhone.replace(/\D/g, "") === normalized);
                            const merged = existing ? [...new Set([...existing.dates, ...dates])].sort() : [...dates];
                            await setGuestWishList({ host: hostId, guestPhone: normalized, guestName: name, dates: merged });
                            getHostWishLists(hostId, token).then(setWishListEntries).catch(() => {});
                          }}
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

      {/* History detail bottom sheet */}
      {selectedHistoryGroup && (
        <HistoryDetailSheet
          group={selectedHistoryGroup}
          rooms={rooms}
          guests={guests}
          timeZone={timeZone}
          formatDate={formatDate}
          getRoom={getRoom}
          matchGuest={matchGuest}
          monthMap={monthMap}
          onUnbookGroup={handleUnbookGroup}
          onClose={() => setSelectedHistoryGroup(null)}
        />
      )}

      {/* Pending detail bottom sheet (read-only — no unbook) */}
      {selectedPendingGroup && (
        <HistoryDetailSheet
          group={selectedPendingGroup}
          rooms={rooms}
          guests={guests}
          timeZone={timeZone}
          formatDate={formatDate}
          getRoom={getRoom}
          matchGuest={matchGuest}
          monthMap={monthMap}
          onClose={() => setSelectedPendingGroup(null)}
        />
      )}
    </div>
  );
};

export default BookingRequestManagerModal;