import { useRef, useState } from "react";
import { format, parseISO } from "date-fns";
import { DANGER_BUTTON, SWIPE_DELETE } from "../shared/dangerButton";
import {
  deleteReviewEntry,
  fetchReviewEntry,
  MAX_REVIEW_CHARS,
  ReviewEntryFull,
  ReviewEntryRow,
  updateReviewEntry,
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
// EDIT, once opened: the guest's name, stars, month and words. A pasted review
// can arrive without the reviewer's name — "Sacramento, California" stood where
// the name should be (host, 2026-10-08). The form sits BELOW the row, not in
// it: a tap on the row opens and closes it, and typing there would too.

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

const ReviewEntryItem = ({ entry: given, onDeleted }: { entry: ReviewEntryRow; onDeleted: () => void }) => {
  // The row as last saved here — an edit shows at once, without reloading the list.
  const [entry, setEntry] = useState<ReviewEntryRow>(given);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ guestName: "", stars: "", reviewMonth: "", text: "" });
  const [saving, setSaving] = useState(false);
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

  const startEdit = () => {
    if (!full) return;
    setError("");
    setForm({
      guestName: full.guestName,
      stars: full.stars != null ? String(full.stars) : "",
      reviewMonth: full.reviewMonth,
      text: full.text,
    });
    setEditing(true);
  };

  const save = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setSaving(true);
    setError("");
    try {
      const updated = await updateReviewEntry(entry.id, {
        guestName: form.guestName.trim(),
        stars: form.stars ? Number(form.stars) : null,
        reviewMonth: form.reviewMonth,
        text: form.text.trim(),
      });
      setFull(updated);
      setEntry((e) => ({
        ...e,
        guestName: updated.guestName,
        stars: updated.stars,
        reviewMonth: updated.reviewMonth,
        snippet: updated.text.slice(0, 160),
      }));
      setEditing(false);
    } catch (e: any) {
      setError(e?.response?.data?.error ?? "That didn't save. Try again.");
    } finally {
      inFlight.current = false;
      setSaving(false);
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
          className="relative cursor-pointer rounded-lg bg-white px-2 py-1.5 text-xs text-gray-700"
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
          <span className="font-semibold text-gray-900">{entry.guestName || "A guest"}</span>
          {entry.stars != null && <span className="text-amber-500"> · {"★".repeat(entry.stars)}</span>}
          {date && <span className="text-gray-500"> · {date}</span>}
          {!open && <p className="truncate text-gray-500">{entry.snippet}</p>}
          {open && (
            <div className="mt-1">
              {!full && !loadFailed && <p className="text-gray-400">Opening…</p>}
              {loadFailed && <p className="text-rose-600">It didn't open. Tap to try again.</p>}
              {full && (
                <>
                  <p className="whitespace-pre-line leading-relaxed text-gray-700">{full.text}</p>
                  {full.addedAt && (
                    <p className="mt-1 text-[10px] text-gray-400">Added {format(new Date(full.addedAt), "MMM d, yyyy")}</p>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {open && full && !editing && !confirming && (
        <div className="mt-0.5 flex justify-end">
          <button type="button" onClick={startEdit} className="rounded-md px-2 py-0.5 text-xs font-semibold text-sky-700 hover:bg-sky-50">
            Edit
          </button>
        </div>
      )}

      {editing && (
        <div className="mt-1 space-y-2 rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-2 text-xs">
          <label className="block">
            <span className="font-semibold text-gray-700">Guest's name</span>
            <input
              value={form.guestName}
              onChange={(e) => setForm((f) => ({ ...f, guestName: e.target.value }))}
              maxLength={120}
              placeholder="As on AirBnB"
              className="mt-0.5 w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm"
            />
          </label>
          <div className="flex gap-2">
            <label className="block flex-1">
              <span className="font-semibold text-gray-700">Stars</span>
              <select
                value={form.stars}
                onChange={(e) => setForm((f) => ({ ...f, stars: e.target.value }))}
                className="mt-0.5 w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm"
              >
                <option value="">None</option>
                {[5, 4, 3, 2, 1].map((n) => (
                  <option key={n} value={n}>
                    {"★".repeat(n)} {n}
                  </option>
                ))}
              </select>
            </label>
            <label className="block flex-1">
              <span className="font-semibold text-gray-700">Month</span>
              <input
                type="month"
                value={form.reviewMonth}
                onChange={(e) => setForm((f) => ({ ...f, reviewMonth: e.target.value }))}
                className="mt-0.5 w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm"
              />
            </label>
          </div>
          <label className="block">
            <span className="font-semibold text-gray-700">Review</span>
            <textarea
              value={form.text}
              onChange={(e) => setForm((f) => ({ ...f, text: e.target.value }))}
              maxLength={MAX_REVIEW_CHARS}
              rows={5}
              className="mt-0.5 w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm leading-relaxed"
            />
          </label>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setEditing(false)}
              disabled={saving}
              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving || !form.text.trim()}
              className="rounded-lg bg-sky-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
          {error && <p className="text-rose-600">{error}</p>}
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
