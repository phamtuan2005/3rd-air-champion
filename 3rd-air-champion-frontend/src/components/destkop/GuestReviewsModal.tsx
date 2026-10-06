import { useCallback, useEffect, useRef, useState } from "react";
import { format, parseISO } from "date-fns";
import { fetchReviewsState, publishReviews, ReviewsState, startReviewDraft } from "../../util/ttQuestionLog";

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

// The most of one room's paste that is sent: the same 120,000 characters the
// server reads (MAX_PASTE in reviewDraft.ts). The server cuts a paste down too,
// but only AFTER the whole request has arrived, and it refuses any request over
// 2 MB with a bare error — so a host pasting five long review histories got "The
// draft didn't start" and no reason (2026-10-06). Cut here, newest first, since
// AirBnB lists the newest reviews at the top.
const MAX_PASTE = 120_000;

const GuestReviewsModal = ({ onClose }: { onClose: () => void }) => {
  const [state, setState] = useState<ReviewsState | null>(null);
  const [error, setError] = useState("");
  const [pasted, setPasted] = useState<Record<string, string>>({});
  const [pasteRoomId, setPasteRoomId] = useState("");
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
  const nameOf = (id: string) => rooms.find((r) => r.roomId === id)?.name ?? "a room";

  const draft = async () => {
    setNote("");
    setBusy(true);
    try {
      const cutLocally = rooms.filter((r) => (pasted[r.roomId] ?? "").length > MAX_PASTE).map((r) => r.roomId);
      const { truncated: cutByServer } = await startReviewDraft(
        rooms.map((r) => ({ roomId: r.roomId, text: (pasted[r.roomId] ?? "").slice(0, MAX_PASTE) })),
      );
      const truncated = [...new Set([...cutLocally, ...cutByServer])];
      if (truncated.length > 0) {
        setNote(`${truncated.map(nameOf).join(", ")}: only the newest reviews were read — the paste was very long.`);
      }
      load();
    } catch (e: any) {
      setNote(e?.response?.data?.error ?? "The draft didn't start. Try again.");
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
      setPasted({});
      setNote("Published. Guests asking TT “What guests say” now read this.");
    } catch (e: any) {
      setNote(e?.response?.data?.error ?? "That didn't publish. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const anyPasted = rooms.some((r) => (pasted[r.roomId] ?? "").trim());
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
                    const has = (pasted[r.roomId] ?? "").trim().length > 0;
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
                    <div className="mb-1 flex items-center justify-between">
                      <label htmlFor={`paste-${pasteRoom.roomId}`} className="text-xs font-semibold text-gray-700">
                        {pasteRoom.name}
                      </label>
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
                    <textarea
                      id={`paste-${pasteRoom.roomId}`}
                      rows={7}
                      value={pasted[pasteRoom.roomId] ?? ""}
                      onChange={(e) => setPasted((p) => ({ ...p, [pasteRoom.roomId]: e.target.value }))}
                      placeholder={`Paste ${pasteRoom.name}'s AirBnB reviews…`}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none"
                    />
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
