import { useRef, useState } from "react";
import { format, parseISO } from "date-fns";
import { DANGER_BUTTON, SWIPE_DELETE } from "../shared/dangerButton";
import {
  cleanerLeadLine,
  deleteReviewEntry,
  fetchReviewEntry,
  ReviewEntryFull,
  ReviewEntryRow,
} from "../../util/ttQuestionLog";

// One review in the list under the form.
//
// TAP it to read the whole review — the list holds only the first line, and a
// long review was cut off there with no way to see the rest (the host,
// 2026-10-07). SWIPE it left for Delete, then confirm: TiMag's one way of
// removing a row (shared/dangerButton), never an × on the line. Delete was
// missing entirely, so a review saved by mistake could not be taken back.
//
// Pointer events, not touch events, so a mouse can drag it too; `touch-action:
// pan-y` leaves vertical scrolling of the list to the browser.
//
// EDIT, once opened: a pasted review can arrive without the reviewer's name —
// "Sacramento, California" stood where the name should be (host, 2026-10-08).
// Edit hands the review UP to the add form, which edits it in place. This row
// used to open its own smaller form — name, a stars dropdown, a month — beside
// the add form that already had all of that and the stay date; the host called
// it redundant (2026-10-10).

// 80: the 72px Delete behind the row plus its 4px inset on each side.
const SNAP_WIDTH = 80;
const SWIPE_THRESHOLD = 32;

const monthLabel = (ym: string) => {
  try {
    return format(parseISO(`${ym}-01`), "MMM yyyy");
  } catch {
    return ym;
  }
};
const dayLabel = (key: string) => {
  try {
    return format(parseISO(key), "MMM d, yyyy");
  } catch {
    return key;
  }
};

const ReviewEntryItem = ({
  entry,
  onDeleted,
  onEdit,
}: {
  entry: ReviewEntryRow;
  onDeleted: () => void;
  // Hands the review to the add form above, which edits it in place of a new
  // one — every field, the stay lookup and the stars, with nothing doubled.
  onEdit: (full: ReviewEntryFull) => void;
}) => {
  const [offset, setOffset] = useState(0);
  const [open, setOpen] = useState(false);
  const [full, setFull] = useState<ReviewEntryFull | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  // Guards the delete against a second tap while the first is in flight.
  const inFlight = useRef(false);
  const startX = useRef(0);
  const startY = useRef(0);
  const offsetAtStart = useRef(0);
  const moved = useRef(false);
  const direction = useRef<"horizontal" | "vertical" | null>(null);
  const pressed = useRef(false);

  const toggle = () => {
    if (offset !== 0) {
      setOffset(0);
      return;
    }
    const next = !open;
    setOpen(next);
    if (next && !full) {
      setLoadFailed(false);
      fetchReviewEntry(entry.id)
        .then(setFull)
        .catch(() => setLoadFailed(true));
    }
  };

  const remove = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setDeleting(true);
    setError("");
    try {
      await deleteReviewEntry(entry.id);
      onDeleted();
    } catch (e: any) {
      setError(e?.response?.data?.error ?? "That didn't delete. Try again.");
      inFlight.current = false;
      setDeleting(false);
    }
  };

  const snapping = offset === 0 || offset === -SNAP_WIDTH;
  const date = entry.stayDate ? dayLabel(entry.stayDate) : entry.reviewMonth ? monthLabel(entry.reviewMonth) : "";

  return (
    <li className="py-0.5">
      <div className="relative overflow-hidden rounded-lg">
        <div className={SWIPE_DELETE}>
          <button
            type="button"
            className="h-full w-full text-sm font-bold text-white"
            onClick={() => {
              setOffset(0);
              setConfirming(true);
            }}
          >
            Delete
          </button>
        </div>

        <div
          role="button"
          tabIndex={0}
          aria-expanded={open}
          className="relative cursor-pointer rounded-lg bg-white px-2 py-2.5 text-sm text-gray-700"
          style={{
            transform: `translateX(${offset}px)`,
            transition: snapping ? "transform 0.18s ease" : "none",
            touchAction: "pan-y",
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              toggle();
            }
          }}
          onPointerDown={(e) => {
            pressed.current = true;
            startX.current = e.clientX;
            startY.current = e.clientY;
            offsetAtStart.current = offset;
            moved.current = false;
            direction.current = null;
          }}
          onPointerMove={(e) => {
            if (!pressed.current) return;
            const dx = e.clientX - startX.current;
            const dy = e.clientY - startY.current;
            if (direction.current === null && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) {
              direction.current = Math.abs(dx) > Math.abs(dy) ? "horizontal" : "vertical";
            }
            if (direction.current !== "horizontal") return;
            moved.current = true;
            setOffset(Math.min(0, Math.max(offsetAtStart.current + dx, -SNAP_WIDTH)));
          }}
          onPointerUp={() => {
            pressed.current = false;
            if (!moved.current) {
              toggle();
              return;
            }
            setOffset(offset < -SWIPE_THRESHOLD ? -SNAP_WIDTH : 0);
          }}
          onPointerCancel={() => {
            pressed.current = false;
            setOffset(0);
          }}
        >
          <span className="text-base font-semibold text-gray-900">{entry.guestName || "A guest"}</span>
          {entry.stars != null && <span className="text-amber-500"> · {"★".repeat(entry.stars)}</span>}
          {date && <span className="text-gray-500"> · {date}</span>}
          {!open && <p className="mt-0.5 line-clamp-2 text-[15px] leading-snug text-gray-600">{entry.snippet}</p>}
          {open && (
            <div className="mt-1">
              {!full && !loadFailed && <p className="text-gray-400">Opening…</p>}
              {loadFailed && <p className="text-rose-600">It didn't open. Tap to try again.</p>}
              {full && (
                <>
                  <p className="mt-0.5 whitespace-pre-line text-base leading-relaxed text-gray-800">{full.text}</p>
                  {full.addedAt && (
                    <p className="mt-1 text-xs text-gray-400">Added {format(new Date(full.addedAt), "MMM d, yyyy")}</p>
                  )}
                </>
              )}
            </div>
          )}
          {/* Who cleaned the room for this stay — the reason reviews are kept
              (host, 2026-10-10: "show under each review who the cleaner was,
              like in Ask TT"). Teal: the house's own note, not the guest's
              words; the same sentence TT gives. */}
          {entry.basis && (
            <p className="mt-1 text-xs font-medium text-teal-700">{cleanerLeadLine(entry.basis, entry.cleaners)}</p>
          )}
        </div>
      </div>

      {open && full && !confirming && (
        <div className="mt-0.5 flex justify-end">
          <button type="button" onClick={() => onEdit(full)} className="rounded-md px-2 py-0.5 text-xs font-semibold text-sky-700 hover:bg-sky-50">
            Edit
          </button>
        </div>
      )}

      {confirming && (
        <div className="mt-1 rounded-lg border border-red-200 bg-red-50 px-2.5 py-2 text-xs">
          <p className="text-gray-800">
            Delete {entry.guestName ? `${entry.guestName}'s` : "this"} review? It is taken off the record and out of the room's
            file.
          </p>
          <div className="mt-1.5 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={deleting}
              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button type="button" onClick={remove} disabled={deleting} className={DANGER_BUTTON}>
              {deleting ? "Deleting…" : "Delete"}
            </button>
          </div>
          {error && <p className="mt-1 text-rose-600">{error}</p>}
        </div>
      )}
    </li>
  );
};

export default ReviewEntryItem;
