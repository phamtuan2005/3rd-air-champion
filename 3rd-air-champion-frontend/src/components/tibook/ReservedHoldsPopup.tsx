import { format, parseISO } from "date-fns";
import { useTiBookTheme, useRoomChip } from "../../contexts/TiBookThemeContext";
import { useTiBookLang } from "../../contexts/TiBookLanguageContext";

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
  // POSITIVE only: money added to what she owes.
  fees?: number;
  // Money that has come OFF, as a positive magnitude. Kept apart from fees
  // because this is the screen where she decides to send money, and
  // "+ $-5 fees" reads as a mistake sitting on top of a kindness.
  discount?: number;
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
  const roomChip = useRoomChip();
  const hostFirstName = (hostName ?? "").split(" ")[0] || "the host";
  const { t, fmtDate } = useTiBookLang();
  // Said to the guest in their language; hostFirstName itself stays English
  // because it also opens the text the host receives.
  const hostShown = (hostName ?? "").split(" ")[0] || t("the host");

  // What each hold costs, and what they come to together. A guest asked to send
  // money needs to know how much; without it the only way to find out was to ask,
  // which is a message and a wait standing between them and paying.
  const costOf = (h: ReservedHold) =>
    h.nightly == null ? null : h.nightly * h.nights + (h.fees ?? 0) - (h.discount ?? 0);
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
  // The same on screen, in the guest's language. priceLabel stays English for
  // the text to the host.
  const shownPrice = (n: number) => (n === 0 ? t("No charge") : money(n));

  // Kept English, dates included, whatever language the guest reads TiBook
  // in: this text lands on the host's phone.
  const textHost = () => {
    if (!hostPhone) return;
    const lines = holds.map((h) => {
      const cost = costOf(h);
      return `- ${h.roomName}: ${format(h.checkIn, "MMM d")} → ${format(h.checkOut, "MMM d")}${
        cost == null ? "" : ` — ${priceLabel(cost)}`
      }`;
    });
    const body =
      `Hi ${hostFirstName}! I'd like to confirm the booking${holds.length === 1 ? "" : "s"} you're holding for me:\n` +
      lines.join("\n") +
      // The total travels in the message too, so the host and the guest are
      // quoting the same figure to each other.
      (total == null ? "" : `\nTotal: ${priceLabel(total)}`) +
      `\nHow would you like me to send the payment? Thank you!`;
    window.location.href = `sms:${hostPhone}?&body=${encodeURIComponent(body)}`;
  };

  return (
    <div className={`tibook-type fixed inset-0 z-[130] flex items-center justify-center ${theme.scrim} p-4`} onClick={onClose}>
      {/* Bounded and split into three, because the list of holds has no ceiling.
          A guest with fifteen rooms held pushed the header — and the × in it —
          off the top, and the Total and both buttons off the bottom, where
          overflow-hidden clipped them: no way to pay, no way to read the total,
          no way out. Only the LIST scrolls; the way out and the amount owed stay
          on screen however many rooms there are.
          dvh, not vh: on a phone vh is the tallest the viewport can be, so the
          panel would be sized for a window the browser toolbar is covering. */}
      <div
        className={`flex max-h-[85dvh] w-full max-w-sm flex-col overflow-hidden rounded-2xl ${theme.surface} shadow-2xl`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`flex shrink-0 items-start justify-between gap-2 border-b ${theme.warmBorder} ${theme.warmFill} px-4 py-3`}>
          <div className="flex items-center gap-2">
            <span className="text-xl">⏳</span>
            <div>
              {/* BOOKINGS, not rooms. This counts held STAYS, and a guest with
                  thirteen of them across a five-room house was told "13 rooms
                  held for you" — which claims a house four times the size and
                  is the first line they read. "Bookings" is also the word
                  TiBook already uses for these, in Your Bookings. */}
              <p className={`text-sm font-bold ${theme.warmStrong}`}>
                {holds.length === 1
                  ? t("A booking is held for you")
                  : t("{n} bookings held for you", { n: holds.length })}
              </p>
              <p className={`text-[11px] ${theme.warmText}`}>{t("Pending payment")}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("Close")}
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xl leading-none ${theme.warmDim} ${theme.warmHover}`}
          >
            &times;
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-3 pt-3">
          <p className={`text-xs leading-relaxed ${theme.surfaceText3}`}>
            {/* Whole sentences per count rather than the pieces of one: German
                bends more than the pronoun between one booking and several. */}
            {holds.length === 1
              ? t("We're holding this booking just for you. To keep it, please send your payment soon — unpaid holds may be released so other guests can book. 🙏")
              : t("We're holding these bookings just for you. To keep them, please send your payment soon — unpaid holds may be released so other guests can book. 🙏")}
          </p>

          {/* The date THEY gave, when they gave one. Only the soonest is shown:
              several holds usually share one promise, and listing a date per
              room turns one commitment into a list to decode. */}
          {promisedDate && (
            <p
              className={`mt-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold ${
                promisedLate
                  ? `${theme.alertFill} ${theme.alertText3}`
                  : `${theme.warmFill2} ${theme.warmStrong}`
              }`}
            >
              {promisedLate
                ? t("You'd planned to send payment by {date} — no problem if you need a little longer, just let {host} know.", { date: fmtDate(parseISO(promisedDate), "EEEE, MMM d"), host: hostShown })
                : t("You said you'd send payment by {date} — thank you!", { date: fmtDate(parseISO(promisedDate), "EEEE, MMM d") })}
            </p>
          )}

          {/* Held stays */}
          <div className="mt-3 flex flex-col gap-2">
            {holds.map((h, i) => (
              <div
                key={`${h.roomName}-${i}`}
                className={`flex items-center justify-between gap-2 rounded-xl border ${theme.warmBorder} ${theme.warmFill} px-3 py-2`}
              >
                <span
                  className={`${roomChip({ name: h.roomName, color: h.roomColor })} shrink-0 rounded-lg px-2.5 py-1 text-sm font-bold text-black`}
                >
                  {h.roomName}
                </span>
                <div className="min-w-0 flex-1 text-right">
                  <p className={`text-xs font-semibold ${theme.surfaceText}`}>
                    {fmtDate(h.checkIn, "EEE MMM d")} <span className={`${theme.dim}`}>→</span>{" "}
                    {fmtDate(h.checkOut, "EEE MMM d")}
                  </p>
                  <p className={`text-[11px] ${theme.surfaceMuted}`}>
                    {t(h.nights === 1 ? "{n} night" : "{n} nights", { n: h.nights })}
                    {h.nightly != null && h.nightly > 0 && ` × ${money(h.nightly)}`}
                    {!!h.fees && ` + ${t("{amount} fees", { amount: money(h.fees) })}`}
                  </p>
                  {!!h.discount && (
                    <p className={`text-[11px] font-semibold ${theme.textPrimary}`}>
                      &hearts; {t("{amount} loyalty discount applied", { amount: money(h.discount) })}
                    </p>
                  )}
                  {costOf(h) != null && (
                    <p className={`text-sm font-bold ${theme.surfaceText}`}>{shownPrice(costOf(h)!)}</p>
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
        <div className={`shrink-0 border-t ${theme.surfaceBorder} px-4 pb-4 pt-3`}>
          {total != null && (
            <div className={`flex items-center justify-between rounded-xl border ${theme.warmBorder} ${theme.warmFill} px-3 py-2`}>
              <span className={`text-sm font-semibold ${theme.warmStrong}`}>
                {total === 0 ? t("Total") : t("Total to pay")}
              </span>
              <span className={`text-base font-bold ${theme.warmStrong}`}>{shownPrice(total)}</span>
            </div>
          )}

          {/* Pay via the host */}
          {hostPhone && (
            <button
              type="button"
              onClick={textHost}
              className={`mt-3 w-full rounded-lg ${theme.btn} py-2.5 text-sm font-bold text-white`}
            >
              💬 {t("Message {host} to pay", { host: hostShown })}
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className={`mt-2 w-full rounded-lg border ${theme.line} py-2 text-sm font-semibold ${theme.surfaceMuted} ${theme.chromeHover}`}
          >
            {t("Got it")}
          </button>

          {/* The way out of a room asked for by mistake.
              Deliberately a NOTE and not a button. Removing a hold deletes every
              night of the stay and cannot be undone, and the guest cannot see
              what sits behind it — a rate agreed by phone, a room blocked, a
              clean already planned. So the guest says so and the host releases
              it, which is one tap on a screen that shows all of that.
              Said as what WILL happen, not as what they cannot do. */}
          <p className={`mt-2.5 text-center text-[11px] leading-relaxed ${theme.surfaceMuted2}`}>
            {t("Asked for one of these by mistake? Just let {host} know and it will be released.", { host: hostShown })}
          </p>
        </div>
      </div>
    </div>
  );
};

export default ReservedHoldsPopup;
