import { format, parseISO } from "date-fns";
import { getRoomColor } from "../../util/getRoomColor";
import { useTiBookTheme } from "../../contexts/TiBookThemeContext";

export interface ReservedHold {
  roomName: string;
  roomColor?: string;
  checkIn: Date;
  checkOut: Date;
  nights: number;
  // This guest's own nightly rate where they have one, otherwise the room's.
  // Undefined when it could not be worked out — silent beats wrong on money.
  nightly?: number;
  // Whole-stay extras, counted once for the stay rather than per night.
  fees?: number;
  // yyyy-MM-dd this guest told the host they would pay. Their own words, said
  // back to them — a date they chose is a firmer thing to act on than a vague
  // "pending payment", and they can see it without having to ask.
  expectedPayDate?: string;
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

  // What each hold costs, and what they come to together. A guest asked to send
  // money needs to know how much; without it the only way to find out was to ask,
  // which is a message and a wait standing between them and paying.
  const costOf = (h: ReservedHold) =>
    h.nightly == null ? null : h.nightly * h.nights + (h.fees ?? 0);
  // Only totalled when EVERY hold has a price. A total missing one room still
  // reads as the whole amount, and would be quoted back short.
  const priced = holds.map(costOf);
  const total = priced.every((p) => p != null)
    ? (priced as number[]).reduce((sum, p) => sum + p, 0)
    : null;
  const money = (n: number) => (Number.isInteger(n) ? `$${n}` : `$${n.toFixed(2)}`);
  // The soonest date this guest gave across their holds, and whether it has
  // passed. String comparison on zero-padded yyyy-MM-dd, so no timezone can
  // shift which day it is.
  const promisedDate = holds
    .map((h) => h.expectedPayDate)
    .filter((d): d is string => !!d)
    .sort()[0];
  const promisedLate = !!promisedDate && promisedDate < format(new Date(), "yyyy-MM-dd");
  // A deliberate $0 rate is family, not a bug — never quote them "$0", which
  // reads as a broken price. Same wording the room cards already use.
  const priceLabel = (n: number) => (n === 0 ? "No charge" : money(n));

  const textHost = () => {
    if (!hostPhone) return;
    const lines = holds.map((h) => {
      const cost = costOf(h);
      return `- ${h.roomName}: ${format(h.checkIn, "MMM d")} → ${format(h.checkOut, "MMM d")}${
        cost == null ? "" : ` — ${priceLabel(cost)}`
      }`;
    });
    const body =
      `Hi ${hostFirstName}! I'd like to confirm the room${holds.length === 1 ? "" : "s"} you're holding for me:\n` +
      lines.join("\n") +
      // The total travels in the message too, so the host and the guest are
      // quoting the same figure to each other.
      (total == null ? "" : `\nTotal: ${priceLabel(total)}`) +
      `\nHow would you like me to send the payment? Thank you!`;
    window.location.href = `sms:${hostPhone}?&body=${encodeURIComponent(body)}`;
  };

  return (
    <div className="tibook-type fixed inset-0 z-[130] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      {/* Bounded and split into three, because the list of holds has no ceiling.
          A guest with fifteen rooms held pushed the header — and the × in it —
          off the top, and the Total and both buttons off the bottom, where
          overflow-hidden clipped them: no way to pay, no way to read the total,
          no way out. Only the LIST scrolls; the way out and the amount owed stay
          on screen however many rooms there are.
          dvh, not vh: on a phone vh is the tallest the viewport can be, so the
          panel would be sized for a window the browser toolbar is covering. */}
      <div
        className="flex max-h-[85dvh] w-full max-w-sm flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex shrink-0 items-start justify-between gap-2 border-b border-amber-100 bg-amber-50 px-4 py-3">
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

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-3 pt-3">
          <p className="text-xs leading-relaxed text-gray-600">
            We're holding {holds.length === 1 ? "this room" : "these rooms"} just for you. To keep{" "}
            {holds.length === 1 ? "it" : "them"}, please send your payment soon — unpaid holds may be
            released so other guests can book. 🙏
          </p>

          {/* The date THEY gave, when they gave one. Only the soonest is shown:
              several holds usually share one promise, and listing a date per
              room turns one commitment into a list to decode. */}
          {promisedDate && (
            <p
              className={`mt-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold ${
                promisedLate
                  ? "bg-red-50 text-red-700"
                  : "bg-amber-100/70 text-amber-800"
              }`}
            >
              {promisedLate
                ? `You'd planned to send payment by ${format(parseISO(promisedDate), "EEEE, MMM d")} — no problem if you need a little longer, just let ${hostFirstName} know.`
                : `You said you'd send payment by ${format(parseISO(promisedDate), "EEEE, MMM d")} — thank you!`}
            </p>
          )}

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
                    {h.nightly != null && h.nightly > 0 && ` × ${money(h.nightly)}`}
                    {!!h.fees && ` + ${money(h.fees)} fees`}
                  </p>
                  {costOf(h) != null && (
                    <p className="text-sm font-bold text-gray-800">{priceLabel(costOf(h)!)}</p>
                  )}
                </div>
              </div>
            ))}
          </div>

        </div>

        {/* What it comes to, and what to do about it — pinned, not scrolled.
            This is the answer the guest opened the popup for; with the rooms
            above it in a scroller, it is also the part that would be furthest
            out of reach. */}
        <div className="shrink-0 border-t border-gray-100 px-4 pb-4 pt-3">
          {total != null && (
            <div className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
              <span className="text-sm font-semibold text-amber-800">
                {total === 0 ? "Total" : "Total to pay"}
              </span>
              <span className="text-base font-bold text-amber-900">{priceLabel(total)}</span>
            </div>
          )}

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
