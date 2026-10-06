import { useCallback, useEffect, useRef, useState } from "react";
import { format, parseISO } from "date-fns";
import { fetchReviewsState, publishReviews, ReviewsState, startReviewDraft } from "../../util/ttQuestionLog";
import { uploadPasteText } from "../../util/pasteParts";

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
  const [pasteRoomId, setPasteRoomId] = useState("");
  // A room whose reviews came from a file. The text is NOT loaded into the box
  // (a few hundred kilobytes in a textarea freezes it); it is sent to the server
  // as soon as the file is chosen, and only its name and size are kept here.
  const [files, setFiles] = useState<Record<string, { name: string; chars: number; uploadId: string }>>({});
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
  // The tab showing; the first room until one is picked.
  const pasteRoom = rooms.find((r) => r.roomId === pasteRoomId) ?? rooms[0];

  // A saved text file instead of a paste. The browser reads it and sends it to
  // the server at once, in small parts (CloudFront refuses any request of 8 KB or
  // more — see util/pasteParts), WITHOUT putting it in the paste box. The server
  // keeps it in memory only until the draft starts: the pasted text isn't kept.
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
      const uploadId = await uploadPasteText(roomId, text, (done, total) =>
        setProgress({ label: `Sending ${file.name}`, pct: Math.round((done / total) * 100) }),
      );
      setFiles((f) => ({ ...f, [roomId]: { name: file.name, chars: text.length, uploadId } }));
    } catch (e: any) {
      setNote(e?.response?.data?.error ?? "The file didn't go through. Check the connection and try again.");
    } finally {
      setProgress(null);
      setBusy(false);
    }
  };

  // Pasted text longer than this travels in parts too, exactly as a file does.
  const INLINE_MAX = 3000;

  const draft = async () => {
    setNote("");
    setBusy(true);
    try {
      const entries: { roomId: string; text?: string; uploadId?: string }[] = [];
      for (const r of rooms) {
        const file = files[r.roomId];
        const text = pasted[r.roomId] ?? "";
        if (file) {
          entries.push({ roomId: r.roomId, uploadId: file.uploadId });
        } else if (text.length > INLINE_MAX) {
          const uploadId = await uploadPasteText(r.roomId, text, (done, total) =>
            setProgress({ label: `Sending ${r.name}`, pct: Math.round((done / total) * 100) }),
          );
          entries.push({ roomId: r.roomId, uploadId });
        } else if (text.trim()) {
          entries.push({ roomId: r.roomId, text });
        }
      }
      // Whole, however long: a paste is never cut for the host. The server says
      // so, in words, if it is more than Claude can read at once.
      await startReviewDraft(entries);
      setFiles({});
      load();
    } catch (e: any) {
      const said = e?.response?.data?.error;
      setNote(said ?? "The draft didn't start. Check the connection and try again.");
      // An upload the server lost (it keeps one for half an hour, in memory) has
      // to be chosen again; leaving it listed would fail the same way every time.
      if (typeof said === "string" && /upload/i.test(said)) setFiles({});
    } finally {
      setProgress(null);
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
      setPasted({});
      setFiles({});
      setNote("Published. Guests asking TT “What guests say” now read this.");
    } catch (e: any) {
      setNote(e?.response?.data?.error ?? "That didn't publish. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const anyPasted = rooms.some((r) => files[r.roomId] || (pasted[r.roomId] ?? "").trim());
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

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-4 py-4">
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
          ) : (
            <>
              <section>
                <h3 className="text-sm font-bold text-gray-900">1 · Paste the reviews</h3>
                <p className="mt-0.5 text-xs text-gray-500">
                  Open each room's listing, show all reviews, select them and paste here. Leave a room empty to skip
                  it. The pasted text isn't kept — only the summaries you publish.
                </p>
                {/* One room at a time, chosen by tab. Five paste boxes stacked
                    meant scrolling past four long pastes to reach the fifth, and
                    a tick on the tab shows which rooms already have reviews in. */}
                <div role="tablist" className="mt-3 flex flex-wrap gap-1.5">
                  {rooms.map((r) => {
                    const has = !!files[r.roomId] || (pasted[r.roomId] ?? "").trim().length > 0;
                    const on = r.roomId === pasteRoom?.roomId;
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
                        {has && <span className={`ml-1 ${on ? "text-emerald-300" : "text-emerald-600"}`}>✓</span>}
                      </button>
                    );
                  })}
                </div>
                {pasteRoom && (
                  <div className="mt-3">
                    <div className="mb-1 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                      <label htmlFor={`paste-${pasteRoom.roomId}`} className="text-xs font-semibold text-gray-700">
                        {pasteRoom.name}
                      </label>
                      {/* Up here, beside the room, not under the box: the box is
                          tall, and a button below it falls off a phone screen. */}
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
                      {pasteRoom.airbnbUrl && (
                        <a
                          href={pasteRoom.airbnbUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs font-semibold text-sky-600 hover:underline"
                        >
                          Open {pasteRoom.name}'s listing ↗
                        </a>
                      )}
                    </div>
                    {files[pasteRoom.roomId] ? (
                      // The file is on the server already; only its name and size
                      // are shown. Putting hundreds of kilobytes in a textarea
                      // would freeze it, and there is nothing to edit in it.
                      <div className="flex items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-gray-900">📄 {files[pasteRoom.roomId].name}</p>
                          <p className="text-xs text-gray-600">
                            {files[pasteRoom.roomId].chars.toLocaleString()} characters · received ✓
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setFiles((f) => {
                              const { [pasteRoom.roomId]: _gone, ...rest } = f;
                              return rest;
                            })
                          }
                          className="shrink-0 rounded-lg border border-gray-300 bg-white px-2.5 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                        >
                          Remove
                        </button>
                      </div>
                    ) : (
                      <>
                        <textarea
                          id={`paste-${pasteRoom.roomId}`}
                          rows={7}
                          value={pasted[pasteRoom.roomId] ?? ""}
                          onChange={(e) => setPasted((p) => ({ ...p, [pasteRoom.roomId]: e.target.value }))}
                          placeholder={`Paste ${pasteRoom.name}'s AirBnB reviews, or choose a text file…`}
                          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none"
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
                  </div>
                )}
                <button
                  type="button"
                  onClick={draft}
                  disabled={!anyPasted || busy || drafting}
                  className="mt-3 w-full rounded-lg bg-gray-800 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-900 disabled:opacity-40"
                >
                  {drafting ? "Claude is reading the reviews…" : "Draft summaries with Claude"}
                </button>
                {state.draft.status === "failed" && (
                  <p className="mt-2 text-xs text-rose-600">The draft didn't finish: {state.draft.error}</p>
                )}
              </section>

              <section>
                <h3 className="text-sm font-bold text-gray-900">2 · Read, edit, publish</h3>
                <p className="mt-0.5 text-xs text-gray-500">
                  {showingDraft
                    ? `Claude's draft, from ${state.draft.reviewsRead} review${state.draft.reviewsRead === 1 ? "" : "s"}. Check it says only what guests said, then publish.`
                    : state.published.at
                      ? `What guests see now, published ${format(parseISO(state.published.at), "MMM d, yyyy")}. Edit and publish again to change it.`
                      : "Nothing published yet — TT tells guests it has no summary. Draft one above, or write it yourself."}
                </p>
                <div className="mt-3 space-y-3">
                  <div>
                    <label htmlFor="summary-house" className="mb-1 block text-xs font-semibold text-gray-700">
                      The whole house
                    </label>
                    <textarea
                      id="summary-house"
                      rows={4}
                      value={edit.house}
                      onChange={(e) => setEdit((x) => ({ ...x, house: e.target.value }))}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none"
                    />
                  </div>
                  {rooms.map((r) => (
                    <div key={r.roomId}>
                      <label htmlFor={`summary-${r.roomId}`} className="mb-1 block text-xs font-semibold text-gray-700">
                        {r.name}
                      </label>
                      <textarea
                        id={`summary-${r.roomId}`}
                        rows={3}
                        value={edit.rooms[r.roomId] ?? ""}
                        onChange={(e) => setEdit((x) => ({ ...x, rooms: { ...x.rooms, [r.roomId]: e.target.value } }))}
                        placeholder="Empty — TT says it has no summary for this room yet"
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none"
                      />
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={publish}
                  disabled={busy || drafting}
                  className="mt-3 w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-40"
                >
                  Publish to TiBook
                </button>
              </section>

              {note && <p className="text-center text-xs text-gray-600">{note}</p>}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default GuestReviewsModal;
