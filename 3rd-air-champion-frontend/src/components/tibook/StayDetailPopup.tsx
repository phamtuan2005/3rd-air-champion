import { differenceInCalendarDays, format, startOfToday } from "date-fns";
import { getRoomColor } from "../../util/getRoomColor";
import { useTiBookTheme } from "../../contexts/TiBookThemeContext";

interface StayDetailPopupProps {
  roomName: string;
  roomColor?: string;
  roomCode?: string;
  checkIn: Date;
  checkOut: Date;
  nights: number;
  guests: number;
  address?: string;
  doorCode?: string;
  hostPhone?: string; // guests text this to ask about changes / add a room
  hostName?: string;
  onViewDetails: () => void;
  onBookAnother?: () => void; // self-serve: request another room for the same dates
  onClose: () => void;
}

// A light, in-place card the guest gets by tapping their stay on the calendar —
// answers "when / where / how do I get in" at a glance, with a link to the full
// booking. Door/room codes appear only when the stay is near or active.
const StayDetailPopup = ({
  roomName,
  roomColor,
  roomCode,
  checkIn,
  checkOut,
  nights,
  guests,
  address,
  doorCode,
  hostPhone,
  hostName,
  onViewDetails,
  onBookAnother,
  onClose,
}: StayDetailPopupProps) => {
  const { theme } = useTiBookTheme();
  const hostFirstName = (hostName ?? "").split(" ")[0] || "the host";

  // One-tap text to the host, pre-filled with the stay so changes / "add a room"
  // reach them personally with context (their preferred way to handle it).
  const textHost = () => {
    if (!hostPhone) return;
    const body =
      `Hi ${hostFirstName}! About my stay — ${roomName}, ${format(checkIn, "MMM d")} → ${format(checkOut, "MMM d")}. ` +
      `I'd like to ask about `;
    window.location.href = `sms:${hostPhone}?&body=${encodeURIComponent(body)}`;
  };
  const today = startOfToday();
  const daysUntil = differenceInCalendarDays(checkIn, today);
  const isStaying = today >= checkIn && today < checkOut;
  const isPast = today >= checkOut;
  const countdown = isStaying
    ? "Staying now"
    : daysUntil === 0
      ? "Check-in today"
      : daysUntil > 0
        ? `in ${daysUntil} day${daysUntil === 1 ? "" : "s"}`
        : isPast
          ? "Completed"
          : "";
  // Practical codes only when they're actually needed (during the stay or within
  // a few days of arrival) — no early clutter, mildly more secure.
  const showCodes = !isPast && daysUntil <= 3;
  const mapsHref = address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address.replace(/\n/g, ", "))}`
    : undefined;

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-xs overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header — room + close */}
        <div className="flex items-center justify-between gap-2 px-4 pb-2 pt-3">
          <span className={`${getRoomColor(roomName, roomColor)} rounded-lg px-2.5 py-1 text-sm font-bold text-black`}>
            {roomName}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-xl leading-none text-gray-400 hover:bg-gray-100"
          >
            &times;
          </button>
        </div>

        <div className="px-4 pb-4">
          {/* Dates + meta */}
          <p className="text-base font-bold text-gray-900">
            {format(checkIn, "EEE MMM d")} <span className="text-gray-300">→</span>{" "}
            {format(checkOut, "EEE MMM d")}
          </p>
          <p className="mt-0.5 text-xs text-gray-500">
            {nights} night{nights === 1 ? "" : "s"} · {guests} guest{guests === 1 ? "" : "s"}
            {countdown && (
              <>
                {" · "}
                <span className={`font-semibold ${isStaying || daysUntil === 0 ? theme.textPrimary : "text-gray-600"}`}>
                  {countdown}
                </span>
              </>
            )}
          </p>

          {/* Codes — only near/active */}
          {showCodes && (doorCode || roomCode) && (
            <div className="mt-3 flex flex-wrap gap-2">
              {doorCode && (
                <div className={`flex items-center gap-1.5 rounded-xl border ${theme.tagBorder} ${theme.tagBg} px-2.5 py-1.5`}>
                  <span className="text-sm">🔑</span>
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Door</span>
                  <span className="text-sm font-bold tracking-widest text-gray-900">{doorCode}</span>
                </div>
              )}
              {roomCode && (
                <div className={`flex items-center gap-1.5 rounded-xl border ${theme.tagBorder} ${theme.tagBg} px-2.5 py-1.5`}>
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Room</span>
                  <span className="text-sm font-bold tracking-widest text-gray-900">{roomCode}</span>
                </div>
              )}
            </div>
          )}

          {/* Address → directions */}
          {address && (
            <a
              href={mapsHref}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 hover:bg-gray-50"
            >
              <span className="text-base">📍</span>
              <span className="min-w-0 flex-1 truncate text-xs text-gray-700">
                {address.replace(/\n/g, ", ")}
              </span>
              <span className="text-gray-300">›</span>
            </a>
          )}

          {/* Full details — only when the stay still lives in "Your Bookings"
              (upcoming/active). A completed stay has no row there, so no button. */}
          {!isPast ? (
            <button
              type="button"
              onClick={onViewDetails}
              className={`mt-3 w-full rounded-lg ${theme.btn} py-2.5 text-sm font-bold text-white`}
            >
              View full details
            </button>
          ) : (
            <p className="mt-3 text-center text-[11px] text-gray-400">
              This stay is complete — thank you for staying with us. 🏠
            </p>
          )}

          {/* Self-serve: request another room for these same dates (e.g. a room
              for parents joining the trip). */}
          {!isPast && onBookAnother && (
            <button
              type="button"
              onClick={onBookAnother}
              className={`mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border ${theme.tagBorder} py-2 text-sm font-semibold ${theme.textPrimary} hover:bg-gray-50`}
            >
              ➕ Book another room for these dates
            </button>
          )}

          {/* Reach the host directly — any change, personally handled. */}
          {hostPhone && (
            <button
              type="button"
              onClick={textHost}
              className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-gray-200 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50"
            >
              💬 Text {hostFirstName} about this stay
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default StayDetailPopup;
