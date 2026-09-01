import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { format } from "date-fns";
import { dayType } from "../../../util/types/dayType";
import { getRoomColor } from "../../../util/getRoomColor";
import { ListedReservation, parseReservationList } from "../../../util/airbnbReservation";

interface AirbnbCheckModalProps {
  monthMap: Map<string, dayType>;
  onClose: () => void;
}

// Checking what TiMag holds against what AirBnB says.
//
// The guest count is the field that gets typed wrong, because a host entering a
// booking is reading the name and the payout. Every booking made before the
// paste box existed still carries whatever was typed at the time, and a stay
// recorded as 2 guests that is really 3 means the sofa bed was never prepared —
// discovered by the guest, at night.
//
// It cannot be checked by eye: TiMag has no upcoming-reservations list. The
// calendar shows stays as bars, which cannot be read down a column.
//
// So: one copy of AirBnB's Upcoming list, and only the DISAGREEMENTS are shown.
// Forty-nine matching rows say nothing; three mismatches say everything.

type Issue =
  | { kind: "missing"; row: ListedReservation }
  | { kind: "guests"; row: ListedReservation; theirs: number; ours: number };

const AirbnbCheckModal = ({ monthMap, onClose }: AirbnbCheckModalProps) => {
  const [text, setText] = useState("");

  // Every AirBnB stay TiMag holds, by its START night and room — the same key
  // AirBnB's list is written in. A stay is written onto every night it covers,
  // so start nights only, or one stay is compared several times.
  const ours = useMemo(() => {
    const map = new Map<string, { guests: number; alias: string }>();
    monthMap.forEach((day, dateKey) => {
      day.bookings.forEach((b) => {
        if (!b.room || b.guest?.name !== "AirBnB") return;
        if (b.startDate.split("T")[0] !== dateKey) return;
        map.set(`${dateKey}|${b.room.name.toLowerCase()}`, {
          guests: b.numberOfGuests ?? 1,
          alias: b.alias || "",
        });
      });
    });
    return map;
  }, [monthMap]);

  const { rows, issues } = useMemo(() => {
    const parsed = parseReservationList(text);
    const found: Issue[] = [];
    for (const row of parsed) {
      const mine = ours.get(`${row.startDate}|${row.roomName.toLowerCase()}`);
      if (!mine) {
        // Only flagged where TiMag could have known: a stay outside the months
        // loaded into the calendar is absent from monthMap for a reason that
        // has nothing to do with the booking.
        if (monthMap.has(row.startDate)) found.push({ kind: "missing", row });
        continue;
      }
      if (mine.guests !== row.guests) {
        found.push({ kind: "guests", row, theirs: row.guests, ours: mine.guests });
      }
    }
    return { rows: parsed, issues: found };
  }, [text, ours, monthMap]);

  const checked = text.trim() !== "" && rows.length > 0;

  return createPortal(
    <div
      className="modal-type fixed inset-0 z-[300] flex items-start justify-center bg-black/40 p-3 pt-[6dvh]"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85dvh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2 border-b border-gray-100 px-4 py-3">
          <div>
            <h2 className="text-base font-bold text-gray-900">Check against AirBnB</h2>
            <p className="text-xs text-gray-500">
              Paste your Upcoming list — only what disagrees is shown
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xl leading-none text-gray-400 hover:bg-gray-100"
          >
            &times;
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            placeholder="On AirBnB: Today → Upcoming → Show more until the list ends → select all → copy → paste here"
            className="w-full resize-none rounded-lg border border-gray-300 px-2.5 py-2 text-xs focus:border-gray-400 focus:outline-none"
          />

          {checked && (
            <p className="mt-2 text-xs text-gray-500">
              Read <span className="font-bold text-gray-800">{rows.length}</span> reservation
              {rows.length === 1 ? "" : "s"} ·{" "}
              {issues.length === 0 ? (
                <span className="font-bold text-emerald-600">everything agrees</span>
              ) : (
                <span className="font-bold text-red-600">
                  {issues.length} to look at
                </span>
              )}
            </p>
          )}

          <div className="mt-3 flex flex-col gap-2">
            {issues.map((issue, i) => (
              <div
                key={`${issue.row.startDate}-${issue.row.roomName}-${i}`}
                className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`${getRoomColor(issue.row.roomName)} shrink-0 rounded-md px-2 py-0.5 text-xs font-bold text-black`}
                  >
                    {issue.row.roomName}
                  </span>
                  <span className="text-sm font-bold text-gray-900">{issue.row.alias}</span>
                  <span className="text-xs text-gray-500">
                    {format(new Date(issue.row.startDate + "T00:00:00"), "EEE MMM d")} ·{" "}
                    {issue.row.nights} night{issue.row.nights === 1 ? "" : "s"}
                  </span>
                </div>
                <p className="mt-1 text-xs font-semibold text-red-700">
                  {issue.kind === "missing"
                    ? "On AirBnB, not in TiMag"
                    : `Guests — TiMag says ${issue.ours}, AirBnB says ${issue.theirs}`}
                </p>
              </div>
            ))}
          </div>

          {checked && issues.length === 0 && (
            <p className="py-6 text-center text-sm text-gray-400">
              Nothing to fix — every stay AirBnB lists matches TiMag.
            </p>
          )}

          {/* Said out loud rather than left to be discovered: a clean result
              only means clean for the months the calendar has loaded, and the
              list carries no payouts to check money against. */}
          {checked && (
            <p className="mt-3 border-t border-gray-100 pt-2 text-[11px] leading-relaxed text-gray-400">
              Only stays in the months TiMag has loaded are compared, and the Upcoming list
              carries no payouts — so this checks whether a stay exists and how many people
              are in it, not the money.
            </p>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default AirbnbCheckModal;
