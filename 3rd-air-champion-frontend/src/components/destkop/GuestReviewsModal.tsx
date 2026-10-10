import { useCallback, useEffect, useRef, useState } from "react";
import { fetchReviewsState, publishReviews, ReviewsState, startReviewDraft, SummarySet } from "../../util/ttQuestionLog";
import GuestReviewForm from "./GuestReviewForm";

// What guests say, for TiBook's TT to tell the next guest.
//
// AirBnB has no API for reviews and its pages may not be scraped, so the host
// copies each listing's reviews in here. Claude drafts a summary for the house
// and one per room; the host reads it, fixes anything wrong, and publishes.
// Nothing reaches a guest until that last step — TT only ever shows what the
// house stands behind.

// `latest` is each room's newest review, summarised on its own. Only its words
// are the host's to edit; the month and stars came from the review on record
// and ride along untouched, so TT never calls an undated review the latest.
type Latest = { text: string; month: string; stars: number | null };
type Edit = { house: string; rooms: Record<string, string>; latest: Record<string, Latest> };

const fromSet = (set: SummarySet): Edit => ({
  house: set.house,
  rooms: Object.fromEntries(set.rooms.map((r) => [r.roomId, r.summary])),
  latest: Object.fromEntries(
    set.rooms
      .filter((r) => r.latestMonth)
      .map((r) => [r.roomId, { text: r.latest ?? "", month: r.latestMonth!, stars: r.latestStars ?? null }]),
  ),
});

// How often to look for the finished draft. Claude takes tens of seconds over
// a few hundred reviews; this is quick enough to feel live and slow enough to
// be nothing for the server.
const POLL_MS = 3000;

const GuestReviewsModal = ({ onClose }: { onClose: () => void }) => {
  const [state, setState] = useState<ReviewsState | null>(null);
  const [error, setError] = useState("");
  // The tab showing: "house", or a room's id. Each tab holds everything about
  // its subject — the house's summary, or one room's summary and its reviews —
  // and the two actions that cover the whole house at once (draft, publish) sit
  // below the tabs, not inside any of them. They used to sit inside the room
  // tabs' section while the summaries below listed every room whatever tab was
  // chosen, which read as two designs on one screen (host, 2026-10-07).
  // Nothing picked yet opens on the first ROOM, and House is the last tab: the
  // window is used to add each new review to its room, and the house summary
  // opening first stood in the way of that (host, 2026-10-09).
  const [pickedId, setPasteRoomId] = useState("");
  const [edit, setEdit] = useState<Edit>({ house: "", rooms: {}, latest: {} });
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
  const pasteRoomId = pickedId || rooms[0]?.roomId || "house";
  const pasteRoom = rooms.find((r) => r.roomId === pasteRoomId);
  // How many reviews each room has on record, for its tab.
  const countOf = Object.fromEntries((state?.onRecord ?? []).map((r) => [r.roomId, r.count]));

  // A room's page of reviews — pasted, or chosen as a text file, then split by
  // Claude — is gone from this window. Reviews come in one at a time through
  // the form below (host, 2026-10-07: "from now on I will keep passing the
  // review of individual guest"), and the page box, the file chooser and the
  // split panel only stood between the host and it (host, 2026-10-08: "No
  // longer need these sections"). The server routes for pages are left alone.

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
        rooms: rooms.map((r) => {
          const l = edit.latest[r.roomId];
          return {
            roomId: r.roomId,
            summary: edit.rooms[r.roomId] ?? "",
            ...(l ? { latest: l.text, latestMonth: l.month, latestStars: l.stars } : {}),
          };
        }),
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

        {/* The two actions that cover the whole house at once — one draft writes
            every summary, one publish sends them all to TiBook — so they sit
            above the tabs, the same on every one. They were at the foot of the
            window; the host wanted them under the title (2026-10-09). */}
        {state && !error && (
          <div className="shrink-0 border-b border-gray-100 bg-white px-4 py-2">
            {/* Only what is happening now: a draft in progress, one that
                failed, one to check. "What guests see now, published Oct 8"
                gave the host nothing to act on (host, 2026-10-08). */}
            {(drafting || state.draft.status === "failed" || showingDraft) && (
              <p className="mb-2 text-[11px] text-gray-500">
                {drafting
                  ? "Claude is reading the reviews…"
                  : state.draft.status === "failed"
                    ? `The draft didn't finish: ${state.draft.error}`
                    : `Claude's draft, from ${state.draft.reviewsRead} review${state.draft.reviewsRead === 1 ? "" : "s"} — check each tab says only what guests said, then publish.`}
              </p>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={draft}
                disabled={!anyPasted || busy || drafting}
                className="whitespace-nowrap rounded-lg border border-gray-300 px-3 py-1 text-sm font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-40"
              >
                {drafting ? "Drafting…" : "Draft all summaries"}
              </button>
              <button
                type="button"
                onClick={publish}
                disabled={busy || drafting}
                className="whitespace-nowrap rounded-lg bg-emerald-600 px-3 py-1 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-40"
              >
                Publish to TiBook
              </button>
            </div>
            {note && <p className="mt-1.5 text-xs text-gray-600">{note}</p>}
          </div>
        )}

        {state && !error && (
          <div role="tablist" className="flex shrink-0 flex-wrap gap-1.5 border-b border-gray-100 px-4 py-2.5">
            {[...rooms, { roomId: "house", name: "House" }].map((r) => {
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
            // Adding the new review comes first, the summary after it: adding
            // is what the host opens this tab to do (host, 2026-10-09).
            <>
              <section>
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
                  Add each new review as it comes in: paste it below. Each one is kept on its own record, for you only.
                </p>
                <GuestReviewForm key={pasteRoom.roomId} roomId={pasteRoom.roomId} roomName={pasteRoom.name} onAdded={load} />
              </section>

              <section className="border-t border-gray-100 pt-4">
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
                {/* No "Latest review" editor: TiBook reads each room's newest
                    review straight from the record, as soon as it is added —
                    nothing to draft or publish (host, 2026-10-08). */}
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default GuestReviewsModal;
