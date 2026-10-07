import { useCallback, useEffect, useRef, useState } from "react";
import { format, parseISO } from "date-fns";
import { deleteReviewSource, fetchReviewsState, publishReviews, ReviewsState, startReviewDraft } from "../../util/ttQuestionLog";
import { uploadPasteText } from "../../util/pasteParts";
import GuestReviewForm from "./GuestReviewForm";
import ReviewSplitPanel from "./ReviewSplitPanel";

// What guests say, for TiBook's TT to tell the next guest.
//
// AirBnB has no API for reviews and its pages may not be scraped, so the host
// copies each listing's reviews in here. Claude drafts a summary for the house
// and one per room; the host reads it, fixes anything wrong, and publishes.
// Nothing reaches a guest until that last step — TT only ever shows what the
// house stands behind.

type Edit = { house: string; rooms: Record<string, string> };

const fromSet = (set: { house: string; rooms: { roomId: string; summary: string }[] }): Edit => ({
  house: set.house,
  rooms: Object.fromEntries(set.rooms.map((r) => [r.roomId, r.summary])),
});

// How often to look for the finished draft. Claude takes tens of seconds over
// a few hundred reviews; this is quick enough to feel live and slow enough to
// be nothing for the server.
const POLL_MS = 3000;

const GuestReviewsModal = ({ onClose }: { onClose: () => void }) => {
  const [state, setState] = useState<ReviewsState | null>(null);
  const [error, setError] = useState("");
  const [pasted, setPasted] = useState<Record<string, string>>({});
  // The tab showing: "house", or a room's id. Each tab holds everything about
  // its subject — the house's summary, or one room's summary and its reviews —
  // and the two actions that cover the whole house at once (draft, publish) sit
  // below the tabs, not inside any of them. They used to sit inside the room
  // tabs' section while the summaries below listed every room whatever tab was
  // chosen, which read as two designs on one screen (host, 2026-10-07).
  const [pasteRoomId, setPasteRoomId] = useState("house");
  // Sending a file or paste to the server, in parts: what and how far.
  const [progress, setProgress] = useState<{ label: string; pct: number } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [edit, setEdit] = useState<Edit>({ house: "", rooms: {} });
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  // The draft already copied into the editor, so a poll does not overwrite the
  // host's edits with the same draft again.
  const loadedDraft = useRef<string | null>(null);

  const apply = useCallback((s: ReviewsState) => {
    setState(s);
    const key = s.draft.status === "ready" ? `draft:${s.draft.startedAt}` : `published:${s.published.at}`;
    if (loadedDraft.current !== key) {
      loadedDraft.current = key;
      setEdit(fromSet(s.draft.status === "ready" ? s.draft : s.published));
    }
  }, []);

  const load = useCallback(() => {
    setError("");
    fetchReviewsState()
      .then(apply)
      .catch(() => setError("The reviews didn't load. Check the connection and try again."));
  }, [apply]);

  useEffect(() => {
    load();
  }, [load]);

  const drafting = state?.draft.status === "drafting";
  useEffect(() => {
    if (!drafting) return;
    const t = setInterval(() => fetchReviewsState().then(apply).catch(() => {}), POLL_MS);
    return () => clearInterval(t);
  }, [drafting, apply]);

  const rooms = state?.houseRooms ?? [];
  const pasteRoom = rooms.find((r) => r.roomId === pasteRoomId);
  // How many reviews each room has on record, for its tab.
  const countOf = Object.fromEntries((state?.onRecord ?? []).map((r) => [r.roomId, r.count]));

  // The review file KEPT on the server for each room (name, size, date).
  const sources = Object.fromEntries((state?.sources ?? []).map((x) => [x.roomId, x]));

  // A saved text file instead of a paste. The browser reads it and sends it to
  // the server at once, in small parts (CloudFront refuses any request of 8 KB or
  // more — see util/pasteParts), WITHOUT putting it in the paste box. When the
  // last part lands the server KEEPS it as this room's review file, replacing the
  // last: the host wants the reviews on file, to be read again and counted later.
  const send = async (roomId: string, text: string, name: string) => {
    await uploadPasteText(roomId, text, name, (done, total) => setProgress({ label: `Sending ${name}`, pct: Math.round((done / total) * 100) }));
  };

  const loadFile = async (roomId: string, file: File | undefined) => {
    if (!file) return;
    setNote("");
    let text: string;
    try {
      text = await file.text();
    } catch {
      setNote("That file couldn't be read. Save the reviews as a plain .txt file and try again.");
      return;
    }
    if (!text.trim()) {
      setNote("That file is empty.");
      return;
    }
    setBusy(true);
    try {
      await send(roomId, text, file.name);
      load();
    } catch (e: any) {
      setNote(e?.response?.data?.error ?? "The file didn't go through. Check the connection and try again.");
    } finally {
      setProgress(null);
      setBusy(false);
    }
  };

  const removeFile = async (roomId: string) => {
    setNote("");
    try {
      await deleteReviewSource(roomId);
      load();
    } catch {
      setNote("That didn't come off. Try again.");
    }
  };

  // Before a split: text waiting in the big box is sent (and kept) as the room's
  // file, so there is something on the server to read.
  const sendWaitingText = async (roomId: string) => {
    const text = pasted[roomId] ?? "";
    if (!text.trim()) return;
    setBusy(true);
    try {
      await send(roomId, text, "Pasted text");
      setPasted((p) => ({ ...p, [roomId]: "" }));
      load();
    } finally {
      setProgress(null);
      setBusy(false);
    }
  };

  // Drafts from the individual reviews on record, every room that has some —
  // the house's one record of what guests said. Nothing is sent: it is all on
  // the server already.
  const draft = async () => {
    setNote("");
    setBusy(true);
    try {
      await startReviewDraft(rooms.map((r) => r.roomId));
      load();
    } catch (e: any) {
      setNote(e?.response?.data?.error ?? "The draft didn't start. Check the connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  const publish = async () => {
    setNote("");
    setBusy(true);
    try {
      const s = await publishReviews({
        house: edit.house,
        rooms: rooms.map((r) => ({ roomId: r.roomId, summary: edit.rooms[r.roomId] ?? "" })),
      });
      loadedDraft.current = null;
      apply(s);
      setNote("Published. Guests asking TT “What guests say” now read this.");
    } catch (e: any) {
      setNote(e?.response?.data?.error ?? "That didn't publish. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const onRecord = (state?.onRecord ?? []).reduce((n, r) => n + r.count, 0);
  const anyPasted = onRecord > 0;
  const showingDraft = state?.draft.status === "ready";

  return (
    <div
      className="modal-type fixed inset-0 z-[300] flex items-center justify-center bg-black/50 p-3"
      onClick={onClose}
    >
      <div
        className="flex max-h-[88vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <div>
            <h2 className="text-base font-bold text-gray-900">⭐ Guest reviews</h2>
            <p className="text-xs text-gray-500">What TT tells guests who ask what others thought</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-xl leading-none text-gray-400 hover:bg-gray-100"
          >
            &times;
          </button>
        </div>

        {state && !error && (
          <div role="tablist" className="flex shrink-0 flex-wrap gap-1.5 border-b border-gray-100 px-4 py-2.5">
            {[{ roomId: "house", name: "House" }, ...rooms].map((r) => {
              const on = r.roomId === pasteRoomId;
              const count = r.roomId === "house" ? onRecord : countOf[r.roomId] ?? 0;
              return (
                <button
                  key={r.roomId}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  onClick={() => setPasteRoomId(r.roomId)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                    on ? "bg-gray-800 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {r.name}
                  {count > 0 && <span className={`ml-1 font-normal ${on ? "text-gray-300" : "text-gray-400"}`}>{count}</span>}
                </button>
              );
            })}
          </div>
        )}

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-4">
          {error ? (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <p className="text-sm text-gray-600">{error}</p>
              <button
                type="button"
                onClick={load}
                className="rounded-lg bg-gray-800 px-4 py-1.5 text-sm font-semibold text-white hover:bg-gray-900"
              >
                Try again
              </button>
            </div>
          ) : !state ? (
            <p className="py-10 text-center text-sm text-gray-500">Loading…</p>
          ) : !pasteRoom ? (
            // ── The house ──
            <section>
              <h3 className="text-sm font-bold text-gray-900">What guests say about TT House</h3>
              <p className="mt-0.5 text-xs text-gray-500">
                What TT tells a guest who asks about the house. Each room's own summary, and its reviews, are on the room's tab.
              </p>
              <textarea
                id="summary-house"
                rows={6}
                value={edit.house}
                onChange={(e) => setEdit((x) => ({ ...x, house: e.target.value }))}
                placeholder="Empty — TT says it has no summary for the house yet"
                className="mt-2 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm leading-relaxed focus:border-gray-400 focus:outline-none"
              />
            </section>
          ) : (
            // ── One room ──
            <>
              <section>
                <h3 className="text-sm font-bold text-gray-900">What guests say about {pasteRoom.name}</h3>
                <p className="mt-0.5 text-xs text-gray-500">What TT tells a guest who asks about this room.</p>
                <textarea
                  id={`summary-${pasteRoom.roomId}`}
                  rows={4}
                  value={edit.rooms[pasteRoom.roomId] ?? ""}
                  onChange={(e) => setEdit((x) => ({ ...x, rooms: { ...x.rooms, [pasteRoom.roomId]: e.target.value } }))}
                  placeholder="Empty — TT says it has no summary for this room yet"
                  className="mt-2 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm leading-relaxed focus:border-gray-400 focus:outline-none"
                />
              </section>

              <section className="border-t border-gray-100 pt-4">
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                  <h3 className="text-sm font-bold text-gray-900">
                    {pasteRoom.name}'s reviews{countOf[pasteRoom.roomId] ? ` · ${countOf[pasteRoom.roomId]} on record` : ""}
                  </h3>
                  {pasteRoom.airbnbUrl && (
                    <a
                      href={pasteRoom.airbnbUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-semibold text-sky-600 hover:underline"
                    >
                      Open the listing ↗
                    </a>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-gray-500">
                  New reviews: paste the listing's whole page of reviews (select all, copy) or choose a saved file, then Split.
                  Each review is kept on its own record, for you only. The page is cleared once its reviews are added.
                </p>

                <div className="mt-2 flex items-center justify-between gap-3">
                  <label htmlFor={`paste-${pasteRoom.roomId}`} className="text-xs font-semibold text-gray-700">
                    The page
                  </label>
                  {/* Up here, not under the box: the box is tall, and a button
                      below it falls off a phone screen. */}
                  <input
                    ref={fileInput}
                    type="file"
                    accept=".txt,text/plain"
                    className="hidden"
                    onChange={(e) => {
                      loadFile(pasteRoom.roomId, e.target.files?.[0]);
                      // Cleared so choosing the same file again still fires.
                      e.target.value = "";
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => fileInput.current?.click()}
                    disabled={busy}
                    className="rounded-lg border border-gray-300 px-2.5 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-40"
                  >
                    Choose a text file…
                  </button>
                </div>
                {sources[pasteRoom.roomId] ? (
                  // On the server already; only its name, size and date are shown.
                  // Hundreds of kilobytes in a textarea would freeze it.
                  <div className="mt-1 flex items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-gray-900">📄 {sources[pasteRoom.roomId].name}</p>
                      <p className="text-xs text-gray-600">
                        {sources[pasteRoom.roomId].chars.toLocaleString()} characters · ready to split
                        {sources[pasteRoom.roomId].savedAt ? ` · ${format(parseISO(sources[pasteRoom.roomId].savedAt!), "MMM d, h:mm a")}` : ""}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFile(pasteRoom.roomId)}
                      disabled={busy}
                      className="shrink-0 rounded-lg border border-gray-300 bg-white px-2.5 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-40"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <>
                    <textarea
                      id={`paste-${pasteRoom.roomId}`}
                      rows={5}
                      value={pasted[pasteRoom.roomId] ?? ""}
                      onChange={(e) => setPasted((p) => ({ ...p, [pasteRoom.roomId]: e.target.value }))}
                      placeholder={`Paste ${pasteRoom.name}'s page of AirBnB reviews…`}
                      className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none"
                    />
                    <p className="mt-1 text-right text-[11px] text-gray-400">
                      {(pasted[pasteRoom.roomId] ?? "").length.toLocaleString()} characters
                    </p>
                  </>
                )}
                {progress && (
                  <div className="mt-2" role="status">
                    <div className="flex justify-between text-[11px] text-gray-500">
                      <span className="truncate">{progress.label}…</span>
                      <span>{progress.pct}%</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-gray-100">
                      <div className="h-full bg-emerald-500 transition-[width]" style={{ width: `${progress.pct}%` }} />
                    </div>
                  </div>
                )}

                <ReviewSplitPanel
                  key={`split-${pasteRoom.roomId}`}
                  roomId={pasteRoom.roomId}
                  roomName={pasteRoom.name}
                  hasReviews={!!sources[pasteRoom.roomId] || !!(pasted[pasteRoom.roomId] ?? "").trim()}
                  beforeSplit={() => sendWaitingText(pasteRoom.roomId)}
                  onAdded={load}
                />
                <GuestReviewForm key={pasteRoom.roomId} roomId={pasteRoom.roomId} roomName={pasteRoom.name} onAdded={load} />
              </section>
            </>
          )}
        </div>

        {/* The two actions that cover the whole house at once — one draft writes
            every summary, one publish sends them all to TiBook — so they sit
            under the tabs, the same on every one. */}
        {state && !error && (
          <div className="shrink-0 border-t border-gray-100 bg-white px-4 py-3">
            <p className="text-[11px] text-gray-500">
              {drafting
                ? "Claude is reading the reviews…"
                : state.draft.status === "failed"
                  ? `The draft didn't finish: ${state.draft.error}`
                  : showingDraft
                    ? `Claude's draft, from ${state.draft.reviewsRead} review${state.draft.reviewsRead === 1 ? "" : "s"} — check each tab says only what guests said, then publish.`
                    : state.published.at
                      ? `What guests see now, published ${format(parseISO(state.published.at), "MMM d, yyyy")}.`
                      : "Nothing published yet — TT tells guests it has no summary."}
            </p>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={draft}
                disabled={!anyPasted || busy || drafting}
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-40"
              >
                {drafting ? "Drafting…" : "Draft all summaries"}
              </button>
              <button
                type="button"
                onClick={publish}
                disabled={busy || drafting}
                className="flex-1 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-40"
              >
                Publish to TiBook
              </button>
            </div>
            {note && <p className="mt-1.5 text-center text-xs text-gray-600">{note}</p>}
          </div>
        )}
      </div>
    </div>
  );
};

export default GuestReviewsModal;
