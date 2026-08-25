import { useState } from "react";
import { toZonedTime } from "date-fns-tz";
import { formatDate } from "../../../../util/formatDate";
import { bookingType } from "../../../../util/types/bookingType";
import { dayType } from "../../../../util/types/dayType";
import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns";
import { CHARGE_LABELS, createCharge } from "../../../../util/chargeOperations";

interface UnbookingConfirmationProps {
  bookings: bookingType[]; // one or many stays to unbook in a single firm step
  monthMap: Map<string, dayType>;
  cancellationFullRefundDays?: number;
  cancellationHalfRefundDays?: number;
  hostId?: string;
  token?: string | null;
  onClose: () => void;
  onUnbook: (ids: string[]) => void;
}

// Refund % for one stay, given the host's cancellation policy and how far out
// the check-in is. Returns null when no policy is configured.
const refundFor = (
  booking: bookingType,
  fullDays?: number,
  halfDays?: number,
): { pct: number; amount: number } | null => {
  if (fullDays === undefined || halfDays === undefined) return null;
  // AirBnB owns its own cancellations and refunds — you never refund an AirBnB
  // guest directly. And booking.price on an AirBnB stay is the room default
  // rate, not what the guest paid (that is airbnbPrice, the payout), so any
  // figure computed from it would be doubly wrong. No policy applies.
  if (booking.guest?.name === "AirBnB") return null;
  const rate =
    booking.price ?? 0;
  const total = rate * booking.duration;
  const daysOut = differenceInCalendarDays(parseISO(booking.startDate.split("T")[0]), new Date());
  const pct = daysOut >= fullDays ? 100 : daysOut >= halfDays ? 50 : 0;
  return { pct, amount: Math.round((total * pct) / 100) };
};

const UnbookingConfirmation = ({
  bookings,
  monthMap,
  cancellationFullRefundDays,
  cancellationHalfRefundDays,
  hostId,
  token,
  onClose,
  onUnbook,
}: UnbookingConfirmationProps) => {
  // A fee charged for cancelling cannot live on the booking being cancelled —
  // unbooking deletes every night of the stay and its fees with them. Eddie
  // cancelled two nights, owed a fee, and there was nowhere to record it. So it
  // is captured HERE, at the one moment the room, the dates and the guest are
  // all still known, and written to its own charge record.
  const [feeAmount, setFeeAmount] = useState("");
  const [feeLabel, setFeeLabel] = useState<string>("Cancellation");
  // A guest who settles up while cancelling is common enough that recording the
  // fee and then having to go and mark it paid is a chore the app can spare —
  // and in between it sits in "still to collect", which is simply untrue.
  const [feePaid, setFeePaid] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feeError, setFeeError] = useState<string | null>(null);
  const many = bookings.length > 1;
  const refunds = bookings.map((b) =>
    refundFor(b, cancellationFullRefundDays, cancellationHalfRefundDays),
  );
  const hasPolicy = refunds.some((r) => r !== null);
  const totalRefund = refunds.reduce((sum, r) => sum + (r?.amount ?? 0), 0);

  // Text the guest a cancellation notice (all selected stays belong to one
  // guest — the hold selection / card action is guest-scoped). "— Anh-Tuan"
  // keeps the personal sender name.
  const guest = bookings[0]?.guest;
  // AirBnB guests are one shared placeholder record, not a person with a phone —
  // AirBnB relays messages itself. Texting a cancellation only makes sense for a
  // direct guest whose number you actually hold.
  const isAirBnBGuest = guest?.name === "AirBnB";
  const textGuest = () => {
    if (!guest?.phone) return;
    const lines = bookings.map((b, i) => {
      const r = refunds[i];
      const refundText = r ? ` — refund $${r.amount} (${r.pct}%)` : "";
      return `* ${b.room.name}: ${formatDate(b.startDate)} – ${formatDate(b.endDate)}${refundText}`;
    });
    const name = bookings[0].alias || guest.name;
    const body = [
      `Hi ${name}, this confirms your booking${many ? "s have" : " has"} been cancelled:`,
      ...lines,
      ...(hasPolicy && many ? [`Total refund: $${totalRefund.toLocaleString()}`] : []),
      `Thank you! — Anh-Tuan`,
    ].join("\n");
    window.location.href = `sms:${guest.phone}?&body=${encodeURIComponent(body)}`;
  };

  const handleConfirm = async () => {
    // Save the fee BEFORE deleting anything. If it fails the stay is left
    // standing and the host can try again — unbooking first would destroy the
    // only record of what the fee was for, which is the whole problem this
    // exists to fix.
    const amount = Number(feeAmount);
    if (feeAmount.trim() !== "" && amount > 0) {
      if (!hostId || !token) {
        setFeeError("Cannot save the fee — please reload and try again.");
        return;
      }
      setSaving(true);
      setFeeError(null);
      try {
        const first = bookings[0];
        await createCharge(
          {
            host: hostId,
            guest: first.guest.id,
            label: feeLabel,
            amount,
            paid: feePaid,
            // Charged today: it belongs to the month the cancellation happened
            // in, not the month the stay would have been.
            date: format(new Date(), "yyyy-MM-dd"),
            note: bookings
              .map(
                (b) =>
                  `${b.room.name} ${formatDate(b.startDate)}–${formatDate(b.endDate)} (${b.duration} night${b.duration === 1 ? "" : "s"}), cancelled`,
              )
              .join("; "),
            roomName: first.room.name,
            stayStart: first.startDate.split("T")[0],
            stayNights: bookings.reduce((s, b) => s + b.duration, 0),
          },
          token,
        );
      } catch {
        setSaving(false);
        setFeeError("The fee could not be saved. Nothing was unbooked — try again.");
        return;
      }
      setSaving(false);
    }

    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    // Each stay is stored as one booking record per night; collect every
    // night's id across every selected stay, then delete them all in one batch.
    const bookingIds: string[] = [];
    bookings.forEach((booking) => {
      const startDate = toZonedTime(booking.startDate, timeZone);
      for (let i = 0; i < booking.duration; i++) {
        const currentDay = monthMap.get(addDays(startDate, i).toISOString().split("T")[0]);
        currentDay?.bookings.forEach((b) => {
          if (b.guest.id === booking.guest.id && b.room.id === booking.room.id) {
            bookingIds.push(b.id);
          }
        });
      }
    });
    onUnbook(bookingIds);
  };

  return (
    <div className="modal-type fixed bottom-0 left-0 w-full h-full bg-black bg-opacity-50 flex justify-center items-center z-[70]">
      <div className="bg-white rounded-xl p-4 max-w-lg w-full shadow-lg max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-lg font-bold text-gray-800">
            Unbook {bookings.length} {many ? "bookings" : "booking"}?
          </h1>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl leading-none px-1">
            &times;
          </button>
        </div>

        {/* One row per stay, with the refund it qualifies for */}
        <div className="min-h-0 flex-1 overflow-y-auto space-y-1.5">
          {bookings.map((booking, i) => {
            const refund = refunds[i];
            return (
              <div
                key={`${booking.room.id}|${booking.startDate}`}
                className="flex items-center justify-between gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-gray-900">
                    {booking.alias || booking.guest.name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {booking.room.name} · {formatDate(booking.startDate)} – {formatDate(booking.endDate)}
                  </p>
                </div>
                {refund && (
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${
                      refund.pct === 100
                        ? "bg-green-100 text-green-700"
                        : refund.pct === 50
                          ? "bg-amber-100 text-amber-700"
                          : "bg-red-100 text-red-700"
                    }`}
                  >
                    Refund ${refund.amount} ({refund.pct}%)
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {hasPolicy && (
          <div className="mt-3 flex items-center justify-between rounded-lg bg-gray-50 border border-gray-200 px-3 py-2">
            <span className="text-sm font-semibold text-gray-700">
              Total refund{many ? ` (${bookings.length} bookings)` : ""}
            </span>
            <span className="text-lg font-bold text-emerald-600">${totalRefund.toLocaleString()}</span>
          </div>
        )}

        {/* A fee the guest still owes. Offered for direct guests only — AirBnB
            owns its own cancellations and you never charge that guest yourself.
            Left blank it does nothing, so the usual cancellation is unchanged. */}
        {!isAirBnBGuest && (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
            <div className="flex items-center gap-2">
              <label className="text-sm font-semibold text-amber-800" htmlFor="cancel-fee">
                Fee still owed
              </label>
              <span className="text-xs text-amber-600">optional</span>
            </div>
            <div className="mt-1.5 flex items-center gap-2">
              <div className="relative">
                <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-400">
                  $
                </span>
                <input
                  id="cancel-fee"
                  type="number"
                  min="0"
                  step="1"
                  inputMode="decimal"
                  value={feeAmount}
                  onChange={(e) => setFeeAmount(e.target.value)}
                  placeholder="0"
                  className="w-24 rounded-md border border-amber-300 bg-white py-1.5 pl-5 pr-2 text-sm font-semibold text-gray-900"
                />
              </div>
              <select
                value={feeLabel}
                onChange={(e) => setFeeLabel(e.target.value)}
                className="rounded-md border border-amber-300 bg-white px-2 py-1.5 text-sm font-semibold text-gray-700"
              >
                {CHARGE_LABELS.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
            <label className="mt-2 flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={feePaid}
                onChange={(e) => setFeePaid(e.target.checked)}
                className="h-4 w-4 rounded border-amber-300 accent-emerald-600"
              />
              <span className="text-xs font-semibold text-amber-800">Already paid</span>
            </label>
            <p className="mt-1.5 text-xs text-amber-700">
              Kept against {bookings[0]?.alias || guest?.name} after the stay is removed, and
              counted in this month's money{feePaid ? "" : " as still to collect"}.
            </p>
            {feeError && <p className="mt-1 text-xs font-semibold text-red-600">{feeError}</p>}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 mt-3 pt-3 border-t border-gray-100">
          {!isAirBnBGuest && (
          <button
            type="button"
            onClick={textGuest}
            disabled={!guest?.phone}
            className="mr-auto px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-md text-sm font-semibold disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            Text guest
          </button>
          )}
          <button onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md text-sm font-semibold">
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={saving}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md text-sm font-bold disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            {saving
              ? "Saving fee…"
              : `Unbook ${bookings.length} ${many ? "bookings" : "booking"}`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default UnbookingConfirmation;
