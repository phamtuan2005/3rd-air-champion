import { useCallback, useEffect, useRef, useState } from "react";
import {
  addReviewSplit,
  discardReviewSplit,
  fetchReviewSplit,
  ReviewSplitState,
  startReviewSplit,
} from "../../util/ttQuestionLog";

// Turns the page of reviews kept for a room into individual reviews — each with
// its guest, stars and month — by having Claude find them.
//
// The host pastes the WHOLE page (select all, copy, on AirBnB) into the big box
// or sends it as a file, and it is kept as the room's review file. Pressing the
// button reads that file; nothing is SAVED until he has seen what was found and
// presses Add — a wrong split is caught by eye here, not trusted. Reviews
// already on file are marked and skipped, so pasting the whole page again later
// only adds what is new.
//
// The work runs on the server (a long page can take minutes, past what
// CloudFront waits for), so this polls, and picks up where it was if the screen
// is closed and reopened.
const POLL_MS = 2500;

const ReviewSplitPanel = ({
  roomId,
  roomName,
  hasReviews,
  beforeSplit,
  onAdded,
}: {
  roomId: string;
  roomName: string;
  /** A file is on record for this room, or text is waiting in the big box. */
  hasReviews: boolean;
  /** Sends any text waiting in the big box, so there is a file to read. */
  beforeSplit: () => Promise<void>;
  onAdded: () => void;
}) => {
  const [split, setSplit] = useState<ReviewSplitState>({ status: "none" });
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const refresh = useCallback(async () => {
    try {
      setSplit(await fetchReviewSplit(roomId));
    } catch {
      // A dropped poll is tried again by the next one.
    }
  }, [roomId]);

  useEffect(() => {
    refresh();
    return () => clearTimeout(timer.current);
  }, [refresh]);

  useEffect(() => {
    if (split.status !== "running") return;
    timer.current = setTimeout(refresh, POLL_MS);
    return () => clearTimeout(timer.current);
  }, [split, refresh]);

  const start = async () => {
    setNote("");
    setBusy(true);
    try {
      await beforeSplit();
      await startReviewSplit(roomId);
      setSplit({ status: "running", done: 0, total: 0 });
    } catch (e: any) {
      setNote(e?.response?.data?.error ?? "That didn't start. Check the connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  const add = async () => {
    setNote("");
    setBusy(true);
    try {
      const { added, skipped } = await addReviewSplit(roomId);
      setSplit({ status: "none" });
      setNote(
        `Added ${added} review${added === 1 ? "" : "s"} to ${roomName}` +
          (skipped > 0 ? `; ${skipped} already on file ${skipped === 1 ? "was" : "were"} skipped.` : "."),
      );
      onAdded();
    } catch (e: any) {
      setNote(e?.response?.data?.error ?? "That didn't save. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const discard = async () => {
    setNote("");
    try {
      await discardReviewSplit(roomId);
    } catch {
      // Gone from the screen either way.
    }
    setSplit({ status: "none" });
  };

  const fresh = split.status === "ready" ? (split.reviews ?? []).filter((r) => !r.onFile).length : 0;
  const found = split.status === "ready" ? (split.reviews ?? []).length : 0;

  return (
    <div className="mt-3 rounded-xl border border-gray-200 p-3">
      <h4 className="text-xs font-bold text-gray-900">Split {roomName}'s page into individual reviews</h4>
      <p className="mt-0.5 text-[11px] leading-relaxed text-gray-500">
        Paste the whole page of reviews above (select all, copy) — Claude finds each one, with its guest, stars and month.
        You see what it found before anything is saved.
      </p>

      {(split.status === "none" || split.status === "failed") && (
        <button
          type="button"
          onClick={start}
          disabled={busy || !hasReviews}
          className="mt-2 w-full rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-40"
        >
          {busy ? "Starting…" : "Split into individual reviews"}
        </button>
      )}
      {split.status === "failed" && <p className="mt-1.5 text-xs text-rose-600">It didn't finish: {split.error}</p>}
      {!hasReviews && split.status === "none" && (
        <p className="mt-1 text-[11px] text-gray-400">Paste the page, or choose a file, first.</p>
      )}

      {split.status === "running" && (
        <div className="mt-2" role="status">
          <div className="flex justify-between text-[11px] text-gray-500">
            <span>Claude is reading the reviews…</span>
            <span>{split.total ? `${split.done} of ${split.total}` : ""}</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full bg-emerald-500 transition-[width]"
              style={{ width: `${split.total ? Math.round(((split.done ?? 0) / split.total) * 100) : 5}%` }}
            />
          </div>
        </div>
      )}

      {split.status === "ready" && (
        <div className="mt-2">
          <p className="text-xs font-semibold text-gray-800">
            Found {found} review{found === 1 ? "" : "s"}
            {found - fresh > 0 ? ` · ${found - fresh} already on file` : ""}
          </p>
          <ul className="mt-1 max-h-64 divide-y divide-gray-100 overflow-y-auto rounded-lg border border-gray-100">
            {(split.reviews ?? []).map((r, i) => (
              <li key={i} className={`px-2.5 py-1.5 text-xs ${r.onFile ? "opacity-50" : ""}`}>
                <span className="font-semibold text-gray-900">{r.guestName || "A guest"}</span>
                {r.stars != null && <span className="text-amber-500"> · {"★".repeat(r.stars)}</span>}
                {(r.when || r.month) && <span className="text-gray-500"> · {r.when || r.month}</span>}
                {r.onFile && <span className="ml-1 text-[10px] font-semibold text-gray-500">on file</span>}
                <p className="truncate text-gray-500">{r.snippet}</p>
              </li>
            ))}
          </ul>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={add}
              disabled={busy || fresh === 0}
              className="flex-1 rounded-lg bg-gray-800 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-900 disabled:opacity-40"
            >
              {fresh === 0 ? "All already on file" : `Add ${fresh} new review${fresh === 1 ? "" : "s"}`}
            </button>
            <button
              type="button"
              onClick={discard}
              disabled={busy}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              Discard
            </button>
          </div>
        </div>
      )}

      {note && (
        <p role="status" className="mt-1.5 text-xs text-gray-600">
          {note}
        </p>
      )}
    </div>
  );
};

export default ReviewSplitPanel;
