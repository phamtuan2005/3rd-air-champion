import { format } from "date-fns";
import { getRoomColor } from "../../util/getRoomColor";
import { useTiBookTheme } from "../../contexts/TiBookThemeContext";

export interface ReservedHold {
  roomName: string;
  roomColor?: string;
  checkIn: Date;
  checkOut: Date;
  nights: number;
}

interface ReservedHoldsPopupProps {
  holds: ReservedHold[];
  hostName?: string;
  hostPhone?: string; // guest texts this to arrange payment
  onClose: () => void;
}

// A gentle heads-up the guest sees when the host is HOLDING room(s) for them that
// aren't paid yet. It summarizes the holds and asks them to pay so the rooms
// aren't released — warm, not threatening.
const ReservedHoldsPopup = ({ holds, hostName, hostPhone, onClose }: ReservedHoldsPopupProps) => {
  const { theme } = useTiBookTheme();
  const hostFirstName = (hostName ?? "").split(" ")[0] || "the host";

  const textHost = () => {
    if (!hostPhone) return;
    const lines = holds.map(
      (h) => `- ${h.roomName}: ${format(h.checkIn, "MMM d")} → ${format(h.checkOut, "MMM d")}`,
    );
    const body =
      `Hi ${hostFirstName}! I'd like to confirm the room${holds.length === 1 ? "" : "s"} you're holding for me:\n` +
      lines.join("\n") +
      `\nHow would you like me to send the payment? Thank you!`;
    window.location.href = `sms:${hostPhone}?&body=${encodeURIComponent(body)}`;
  };

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-2 border-b border-amber-100 bg-amber-50 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">⏳</span>
            <div>
              <p className="text-sm font-bold text-amber-800">
                {holds.length === 1 ? "A room is held for you" : `${holds.length} rooms held for you`}
              </p>
              <p className="text-[11px] text-amber-600">Pending payment</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xl leading-none text-amber-400 hover:bg-amber-100"
          >
            &times;
          </button>
        </div>

        <div className="px-4 pb-4 pt-3">
          <p className="text-xs leading-relaxed text-gray-600">
            We're holding {holds.length === 1 ? "this room" : "these rooms"} just for you. To keep{" "}
            {holds.length === 1 ? "it" : "them"}, please send your payment soon — unpaid holds may be
            released so other guests can book. 🙏
          </p>

          {/* Held stays */}
          <div className="mt-3 flex flex-col gap-2">
            {holds.map((h, i) => (
              <div
                key={`${h.roomName}-${i}`}
                className="flex items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50/50 px-3 py-2"
              >
                <span
                  className={`${getRoomColor(h.roomName, h.roomColor)} shrink-0 rounded-lg px-2.5 py-1 text-sm font-bold text-black`}
                >
                  {h.roomName}
                </span>
                <div className="min-w-0 flex-1 text-right">
                  <p className="text-xs font-semibold text-gray-800">
                    {format(h.checkIn, "EEE MMM d")} <span className="text-gray-300">→</span>{" "}
                    {format(h.checkOut, "EEE MMM d")}
                  </p>
                  <p className="text-[11px] text-gray-500">
                    {h.nights} night{h.nights === 1 ? "" : "s"}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Pay via the host */}
          {hostPhone && (
            <button
              type="button"
              onClick={textHost}
              className={`mt-3 w-full rounded-lg ${theme.btn} py-2.5 text-sm font-bold text-white`}
            >
              💬 Message {hostFirstName} to pay
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="mt-2 w-full rounded-lg border border-gray-200 py-2 text-sm font-semibold text-gray-500 hover:bg-gray-50"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReservedHoldsPopup;
