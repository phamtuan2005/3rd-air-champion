import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { addDays, format, startOfToday } from "date-fns";
import RoomBadge from "../../shared/RoomBadge";
import { dayType } from "../../../util/types/dayType";
import { bookingType } from "../../../util/types/bookingType";
import { readGuestMessage } from "../../../util/urgentMessage";
import { recommendAction, StayContext } from "../../../util/urgentAction";

interface UrgentActionModalProps {
  monthMap: Map<string, dayType>;
  onClose: () => void;
  // Jump to the stay on the calendar, where the room can actually be opened.
  // This panel never unbooks anything itself — see the note on the verdict card.
  onGoToStay: (booking: bookingType, dateKey: string) => void;
}

// How far either side of today to offer stays. Wide enough for "I'll be late
// Friday" sent on a Tuesday, narrow enough that the list stays a list.
const BACK_DAYS = 2;
const AHEAD_DAYS = 10;

const VERDICT_STYLE = {
  hold: {
    card: "border-emerald-300 bg-emerald-50",
    head: "text-emerald-800",
    label: "HOLD THE ROOM",
    chip: "bg-emerald-600",
  },
  open: {
    card: "border-rose-300 bg-rose-50",
    head: "text-rose-800",
    label: "THE ROOM IS FREE",
    chip: "bg-rose-600",
  },
  ask: {
    card: "border-amber-300 bg-amber-50",
    head: "text-amber-900",
    label: "NOT ENOUGH TO GO ON",
    chip: "bg-amber-500",
  },
} as const;

/**
 * Urgent Action — paste what the guest wrote, get a recommendation about the room.
 *
 * Built after a night when "1-2am" was read in a hurry as "1-2pm", the room was
 * opened as a no-show, and the guest arrived. So the guest's own words stay on
 * screen beside the reading, the time is re-stated in language that cannot be
 * skimmed wrong, and nothing here changes a booking: it recommends, and the host
 * acts on the calendar where unbooking already lives.
 */
const UrgentActionModal = ({ monthMap, onClose, onGoToStay }: UrgentActionModalProps) => {
  const [text, setText] = useState("");
  const [stayKey, setStayKey] = useState<string>("");

  const todayKey = format(startOfToday(), "yyyy-MM-dd");

  // Every stay STARTING in the window — an arrival is the thing a message about
  // checking in can be about.
  const arrivals = useMemo(() => {
    const out: { key: string; dateKey: string; booking: bookingType }[] = [];
    for (let i = -BACK_DAYS; i <= AHEAD_DAYS; i++) {
      const dateKey = format(addDays(startOfToday(), i), "yyyy-MM-dd");
      const day = monthMap.get(dateKey);
      if (!day) continue;
      for (const b of day.bookings) {
        if (!b.room || !b.guest) continue;
        if (b.startDate.split("T")[0] !== dateKey) continue;
        out.push({ key: `${b.id}|${dateKey}`, dateKey, booking: b });
      }
    }
    return out;
  }, [monthMap]);

  const selected = arrivals.find((a) => a.key === stayKey) ?? null;

  const reading = useMemo(() => readGuestMessage(text), [text]);

  const recommendation = useMemo(() => {
    if (!selected) return null;
    const stay: StayContext = {
      roomName: selected.booking.room.name,
      guestName: selected.booking.guest.name,
      startDate: selected.dateKey,
      startWeekday: new Date(selected.dateKey + "T00:00:00").getDay(),
    };
    return recommendAction(reading, stay);
  }, [reading, selected]);

  const style = recommendation ? VERDICT_STYLE[recommendation.verdict] : null;

  return createPortal(
    <div
      className="modal-type fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-2 border-b border-gray-100 px-4 py-3">
          <div>
            <h2 className="text-base font-bold text-gray-900">Urgent Action</h2>
            <p className="text-xs text-gray-500">
              Paste what the guest wrote. Don't retype it.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 px-1 text-xl leading-none text-gray-400 hover:text-gray-600"
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        <div className="flex min-h-0 flex-col gap-3 overflow-y-auto p-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500">
              Their message
            </label>
            {/* Verbatim, and it stays on screen next to the reading. Retyping a
                time into a form is where "1-2am" became "1-2pm". */}
            <textarea
              autoFocus
              rows={3}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Tuesday I will checkin at 1-2am"
              className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500">
              Which stay is it about?
            </label>
            {/* Chosen, never inferred. Guessing which booking a message refers
                to is the same class of mistake this tool exists to prevent. */}
            {arrivals.length === 0 ? (
              <p className="mt-1 rounded-xl bg-gray-50 px-3 py-2 text-sm text-gray-500">
                No arrivals in the next {AHEAD_DAYS} days.
              </p>
            ) : (
              <div className="mt-1 flex max-h-44 flex-col gap-1 overflow-y-auto rounded-xl border border-gray-200 p-1">
                {arrivals.map((a) => {
                  const on = a.key === stayKey;
                  return (
                    <button
                      key={a.key}
                      type="button"
                      onClick={() => setStayKey(a.key)}
                      className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-left ${
                        on ? "bg-gray-900 text-white" : "hover:bg-gray-50"
                      }`}
                    >
                      <RoomBadge room={a.booking.room} />
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                        {a.booking.guest.name}
                      </span>
                      <span className={`text-xs ${on ? "text-gray-300" : "text-gray-500"}`}>
                        {format(new Date(a.dateKey + "T00:00:00"), "EEE MMM d")}
                        {a.dateKey === todayKey ? " · tonight" : ""}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {recommendation && style && text.trim() && (
            <div className={`rounded-2xl border-2 p-3 ${style.card}`}>
              <span
                className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white ${style.chip}`}
              >
                {style.label}
              </span>
              <p className={`mt-1.5 text-xl font-bold leading-tight ${style.head}`}>
                {recommendation.headline}
              </p>
              <p className="mt-1 text-sm font-medium text-gray-700">{recommendation.because}</p>

              {/* The arrival said in words that cannot be skimmed wrong. "1-2am"
                  and "1-2pm" differ by two characters; "after midnight" and
                  "afternoon" do not. */}
              {reading.timeInWords && (
                <p className="mt-2 rounded-lg bg-white/70 px-2.5 py-1.5 text-base font-bold text-gray-900">
                  {reading.timeInWords}
                </p>
              )}

              {recommendation.cautions.length > 0 && (
                <ul className="mt-2 flex flex-col gap-1">
                  {recommendation.cautions.map((c, i) => (
                    <li key={i} className="flex gap-1.5 text-xs leading-relaxed text-gray-600">
                      <span className="shrink-0">•</span>
                      <span>{c}</span>
                    </li>
                  ))}
                </ul>
              )}

              {/* Their words, kept under the verdict. You are confirming a
                  reading, not trusting one. */}
              <p className="mt-2.5 border-l-2 border-gray-300 pl-2 text-xs italic leading-relaxed text-gray-500">
                "{text.trim()}"
              </p>

              {selected && (
                <button
                  type="button"
                  onClick={() => onGoToStay(selected.booking, selected.dateKey)}
                  className="mt-2.5 w-full rounded-xl border border-gray-300 bg-white py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Open this stay on the calendar
                </button>
              )}
            </div>
          )}
        </div>

        {/* Why there is no "open the room" button here. Unbooking lives on the
            calendar, behind its own confirmation, and it should keep costing the
            few seconds it costs — this panel is for reading a message correctly,
            not for acting fast on it. */}
        <p className="shrink-0 border-t border-gray-100 px-4 py-2 text-[11px] leading-relaxed text-gray-400">
          Nothing here changes a booking. Opening a room is done on the calendar, on
          purpose — a room given away cannot be taken back once someone books it.
        </p>
      </div>
    </div>,
    document.body,
  );
};

export default UrgentActionModal;
