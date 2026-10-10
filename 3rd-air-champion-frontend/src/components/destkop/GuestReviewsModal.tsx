import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchReviewEntry,
  fetchReviewsState,
  publishReviews,
  ReviewEntryFull,
  ReviewsState,
  startReviewDraft,
  SummarySet,
} from "../../util/ttQuestionLog";
import GuestReviewForm from "./GuestReviewForm";
import RoomBadge from "../shared/RoomBadge";
import { HiPaperAirplane, HiSparkles } from "react-icons/hi2";

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

const GuestReviewsModal = ({
  onClose,
  openAt = null,
}: {
  onClose: () => void;
  // Where to open, when Ask TT sent the host here: "house", "room:<id>", or a
  // review's id — that review, in its room, in the edit pop-up.
  openAt?: string | null;
}) => {
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
  const [pickerOpen, setPickerOpen] = useState(false);
  // The review Ask TT asked to edit, until the form has opened it.
  const [pendingEdit, setPendingEdit] = useState<ReviewEntryFull | null>(null);
  // "add review" in Ask TT: open the add pop-up as soon as a room's form is up.
  const [pendingAdd, setPendingAdd] = useState(false);
  useEffect(() => {
    if (!openAt) return;
    if (openAt === "house") return setPasteRoomId("house");
    if (openAt === "add") return setPendingAdd(true);
    if (openAt.startsWith("room:")) return setPasteRoomId(openAt.slice("room:".length));
    let live = true;
    fetchReviewEntry(openAt)
      .then((full) => {
        if (!live) return;
        setPasteRoomId(full.roomId);
        setPendingEdit(full);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [openAt]);
  // A room as RoomBadge draws it: its own colour when it has one, else the
  // colour its name gives it everywhere else (util/getRoomColor).
  const badgeOf = (id: string) => {
    const r = rooms.find((x) => x.roomId === id);
    return r ? { name: r.name, color: r.color || undefined } : { name: "House" };
  };
  const countLabel = (id: string) => {
    const n = id === "house" ? (state?.onRecord ?? []).reduce((a, r) => a + r.count, 0) : countOf[id] ?? 0;
    return n > 0 ? `${n} review${n === 1 ? "" : "s"}` : "no reviews yet";
  };

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
          {/* Title alone: the line under it ("What TT tells guests who ask
              what others thought") read as a riddle, and the window is now
              mostly the reviews themselves (host, 2026-10-10). */}
          <h2 className="text-base font-bold text-gray-900">⭐ Guest reviews</h2>
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
          // One dropdown, not a row of tabs: six tabs took two rows on a phone
          // (host, 2026-10-09).
          // Each room in its own colour, the badge it wears on the calendar,
          // in Clean and in TiWork — a plain <select> can only show grey text
          // (host, 2026-10-10: "bring the room in consistent with the rest of
          // Ti"). House last, in grey: it is every room, not one of them.
          <div className="relative flex shrink-0 items-center gap-2 border-b border-gray-100 px-4 py-2.5">
            <button
              type="button"
              aria-haspopup="listbox"
              aria-expanded={pickerOpen}
              onClick={() => setPickerOpen((o) => !o)}
              className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-left hover:bg-gray-50"
            >
              <RoomBadge room={badgeOf(pasteRoomId)} override={pasteRoom ? undefined : "bg-gray-700"} className="text-sm font-semibold" />
              <span className="flex-1 truncate text-sm text-gray-500">{countLabel(pasteRoomId)}</span>
              <span aria-hidden className="text-xs text-gray-400">
                {pickerOpen ? "▲" : "▼"}
              </span>
            </button>
            {pasteRoom?.airbnbUrl && (
              // The booking card's Airbnb tag, the same coral pill: one mark for
              // "this opens on Airbnb" across TiMag (host, 2026-10-10), in place
              // of a blue "Open the listing ↗". Beside the room it opens.
              <a
                href={pasteRoom.airbnbUrl}
                target="_blank"
                rel="noreferrer"
                title={`Open ${pasteRoom.name}'s listing on Airbnb`}
                className="shrink-0 rounded-full bg-[#FF5A5F] px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-white transition hover:brightness-110 active:brightness-95"
              >
                Airbnb ↗
              </a>
            )}
            {pickerOpen && (
              <>
                {/* A tap anywhere else closes it. */}
                <div className="fixed inset-0 z-10" onClick={() => setPickerOpen(false)} />
                {/* top-full: hung from the picker's bottom edge. Without it the
                    list took its place from the row, which centres its items,
                    so it sat half above the picker and the window cut off its
                    top rooms (host, 2026-10-10). */}
                <ul
                  role="listbox"
                  aria-label="Room"
                  className="absolute left-4 right-4 top-full z-20 -mt-1 overflow-hidden rounded-xl border border-gray-200 bg-white py-1 shadow-xl"
                >
                  {[...rooms.map((r) => r.roomId), "house"].map((id) => (
                    <li key={id}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={id === pasteRoomId}
                        onClick={() => {
                          setPasteRoomId(id);
                          setPickerOpen(false);
                        }}
                        className={`flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-gray-50 ${
                          id === pasteRoomId ? "bg-gray-50" : ""
                        }`}
                      >
                        <RoomBadge
                          room={badgeOf(id)}
                          rooms={[...rooms, { name: "House" }]}
                          override={id === "house" ? "bg-gray-700" : undefined}
                          className="text-sm font-semibold"
                        />
                        <span className="flex-1 text-sm text-gray-500">{countLabel(id)}</span>
                        {id === pasteRoomId && <span className="text-sm text-gray-900">✓</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
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
              {/* Drafting and publishing the summaries live HERE, on the House
                  tab, not over every room: the host does it about once a month,
                  when the count passes a milestone (400, 500…), and on top of
                  each room they pushed the reviews down (host, 2026-10-10). */}
              <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 px-3 py-3">
                <p className="text-sm font-semibold text-gray-900">Refresh the summaries</p>
                <p className="mt-0.5 mb-2 text-xs text-gray-500">
                  Every so often — when the reviews pass a milestone. Claude drafts the house's summary and each
                  room's from all {onRecord} reviews; check them, then Publish to TiBook.
                </p>
                {/* Only what is happening now: a draft in progress, one that
                    failed, one to check. "What guests see now, published Oct 8"
                    gave the host nothing to act on (host, 2026-10-08). */}
                {(drafting || state.draft.status === "failed" || showingDraft) && (
                  <p className="mb-2 text-[11px] text-gray-500">
                    {drafting
                      ? "Claude is reading the reviews…"
                      : state.draft.status === "failed"
                        ? `The draft didn't finish: ${state.draft.error}`
                        : `Claude's draft, from ${state.draft.reviewsRead} review${state.draft.reviewsRead === 1 ? "" : "s"} — check each room in the list above says only what guests said, then Publish.`}
                  </p>
                )}
                {/* Short labels on one line each: "Draft all summaries" + "Publish to
                    TiBook" ran past the edge of a phone (2026-10-09). The window is
                    about what TT tells guests, so "Publish" needs no "to TiBook". */}
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={draft}
                    disabled={!anyPasted || busy || drafting}
                    className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-gray-300 px-3 py-1 text-sm font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-40"
                  >
                    <HiSparkles aria-hidden className={`h-4 w-4 shrink-0 text-violet-500 ${drafting ? "animate-pulse" : ""}`} />
                    {drafting ? "Drafting…" : "Draft summaries"}
                  </button>
                  <button
                    type="button"
                    onClick={publish}
                    disabled={busy || drafting}
                    className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-emerald-600 px-3 py-1 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-40"
                  >
                    <HiPaperAirplane aria-hidden className="h-4 w-4 shrink-0" />
                    Publish
                  </button>
                </div>
                {note && <p className="mt-1.5 text-xs text-gray-600">{note}</p>}
              </div>
            </section>
          ) : (
            // ── One room ──
            // Adding the new review comes first, the summary after it: adding
            // is what the host opens this tab to do (host, 2026-10-09).
            <>
              {/* No heading of its own: the picker above already names the room
                  and its count, and "[Chill] reviews · 74 on record" right
                  under it said it all twice (host, 2026-10-10). */}
              <section>
                <GuestReviewForm
                  key={pasteRoom.roomId}
                  roomId={pasteRoom.roomId}
                  roomName={pasteRoom.name}
                  roomColor={pasteRoom.color}
                  openForEdit={pendingEdit?.roomId === pasteRoom.roomId ? pendingEdit : null}
                  onEditOpened={() => setPendingEdit(null)}
                  rooms={rooms.map((r) => ({ roomId: r.roomId, name: r.name, color: r.color, airbnbUrl: r.airbnbUrl }))}
                  openAdd={pendingAdd}
                  onAddOpened={() => setPendingAdd(false)}
                  onRoomChange={setPasteRoomId}
                  onAdded={load}
                />
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
