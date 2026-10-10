import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { format, parseISO } from "date-fns";
import { createPortal } from "react-dom";
import { HiMagnifyingGlass } from "react-icons/hi2";
import { jwtDecode } from "jwt-decode";
import { getToken } from "../../util/authSession";
import { fetchGuests } from "../../util/guestOperations";
import { guestType } from "../../util/types/guestType";
import { parseAirbnbReview } from "../../util/airbnbReviewPaste";
import ReviewEntryItem from "./ReviewEntryItem";
import RoomBadge from "../shared/RoomBadge";
import {
  addReviewEntry,
  fetchReviewEntries,
  fetchReviewStay,
  MAX_REVIEW_CHARS,
  ReviewEntryFull,
  ReviewEntryRow,
  ReviewStay,
  updateReviewEntry,
} from "../../util/ttQuestionLog";

// One guest's review, passed in on its own — what the host does from now on.
//
// Each is kept per ROOM, per GUEST, per STAY DATE, with its stars, so that a
// complaint can be traced to the cleaner who prepared that room that day and a
// 5-star stay can be counted toward rewarding them (the cleaning rota already
// has date + room + cleaner). A review itself only says a month; the host knows
// the night the stay started, so that is asked for here.
//
// Small by design: a review fits in one ordinary request, so none of the
// sent-in-parts machinery a whole review file needs (util/pasteParts).
const GuestReviewForm = ({
  roomId,
  roomName,
  roomColor,
  onAdded,
}: {
  roomId: string;
  roomName: string;
  // The room's own colour, when it has one; RoomBadge falls back to its name's.
  roomColor?: string;
  onAdded: () => void;
}) => {
  const [guests, setGuests] = useState<guestType[]>([]);
  const [entries, setEntries] = useState<ReviewEntryRow[]>([]);
  const [guestName, setGuestName] = useState("");
  const [stayDate, setStayDate] = useState("");
  const [stars, setStars] = useState<number | null>(null);
  // The month on a pasted AirBnB review ("2 days ago" → 2026-10), and how it
  // was printed — kept so the host sees where it came from.
  const [reviewMonth, setReviewMonth] = useState("");
  const [when, setWhen] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  // The review being edited in this form, or null when it adds a new one.
  const [editingId, setEditingId] = useState<string | null>(null);
  // The add/edit form, popped up over the list.
  const [formOpen, setFormOpen] = useState(false);
  // A search over this room's reviews — names, words, dates (host,
  // 2026-10-10). Searched on the server, where the whole text is: the list
  // holds only the first line of each.
  const [search, setSearch] = useState("");
  const searchNow = useRef("");
  searchNow.current = search;

  const loadEntries = useCallback(() => {
    const asked = searchNow.current;
    fetchReviewEntries(asked)
      // A slower answer to an older search must not replace a newer one.
      .then((rows) => asked === searchNow.current && setEntries(rows))
      .catch(() => {});
  }, []);
  useEffect(() => {
    const t = setTimeout(loadEntries, 300);
    return () => clearTimeout(t);
  }, [search, loadEntries]);

  // The guest list is only to finish a name as it is typed; the form works
  // without it.
  // (The reviews themselves load through the search effect above.)
  useEffect(() => {
    const token = getToken();
    let hostId = "";
    try {
      hostId = (jwtDecode(token ?? "") as { hostId?: string }).hostId ?? "";
    } catch {
      return;
    }
    fetchGuests(hostId, token ?? "")
      .then((list: guestType[]) => setGuests(list ?? []))
      .catch(() => {});
  }, []);

  // A typed name that IS a guest on the list is matched to them; anything else
  // is kept as typed — AirBnB reviewers are often first names nobody here knows.
  const matched = useMemo(
    () => guests.find((g) => g.name.trim().toLowerCase() === guestName.trim().toLowerCase()),
    [guests, guestName],
  );

  const mine = entries.filter((e) => e.roomId === roomId);

  // The stay the review is about, looked up in the bookings as soon as there is
  // a name and a month — the host used to find it on the calendar and type it
  // (host, 2026-10-10). "none" = looked, nothing fitted.
  const [found, setFound] = useState<ReviewStay | null | "none">(null);
  // Whether the date in the box is the one the lookup put there. A date the
  // host typed is theirs and is never overwritten.
  const stayAuto = useRef(false);
  useEffect(() => {
    const name = guestName.trim();
    if (!name || !reviewMonth) {
      setFound(null);
      return;
    }
    let live = true;
    // Typing a name fires this per keystroke: wait until they pause.
    const t = setTimeout(() => {
      fetchReviewStay(roomId, name, reviewMonth)
        .then((s) => {
          if (!live) return;
          setFound(s ?? "none");
          if (stayAuto.current || !stayDate) {
            stayAuto.current = !!s;
            setStayDate(s?.stayDate ?? "");
          }
        })
        .catch(() => live && setFound(null));
    }, 400);
    return () => {
      live = false;
      clearTimeout(t);
    };
    // stayDate is read, not watched: the host changing it must not re-run this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, guestName, reviewMonth]);

  // A review copied from AirBnB is taken apart where it lands: the name, stars
  // and date go in their fields and only the guest's words stay in the box.
  // Plain rules, no model — one review's layout is known (util/airbnbReviewPaste).
  const fillFrom = (raw: string): boolean => {
    const r = parseAirbnbReview(raw);
    if (r === "several") {
      setNote("That's several reviews — paste it into the big box above and press Split instead.");
      return true;
    }
    if (!r) return false;
    setText(r.text);
    setGuestName(r.guestName);
    setStars(r.stars);
    setReviewMonth(r.reviewMonth);
    setWhen(r.when);
    setNote(`Read from AirBnB: ${r.guestName || "a guest"}${r.stars ? `, ${r.stars} stars` : ""}${r.when ? `, ${r.when}` : ""}. Check, then Add.`);
    return true;
  };

  // Empty for the next review. The stay date goes too: the next review is
  // almost never the same stay, and a date carried over would be saved against
  // the wrong stay without anyone noticing.
  const clearForm = () => {
    setText("");
    setGuestName("");
    setStayDate("");
    stayAuto.current = false;
    setFound(null);
    setStars(null);
    setReviewMonth("");
    setWhen("");
    setEditingId(null);
  };

  // Edit = this same form, holding the saved review: every field, the stay
  // lookup and the stars, rather than a second, smaller form under the row
  // (host, 2026-10-10: "this form is redundant").
  const startEdit = (full: ReviewEntryFull) => {
    setEditingId(full.id);
    setGuestName(full.guestName);
    // The date on record is the host's (or the backfill's): kept, never
    // replaced by the lookup. Empty, the lookup may fill it.
    stayAuto.current = false;
    setStayDate(full.stayDate);
    setStars(full.stars);
    setReviewMonth(full.reviewMonth);
    setWhen("");
    setText(full.text);
    setNote("");
    setFormOpen(true);
  };

  const add = async () => {
    if (busy) return;
    setNote("");
    if (!text.trim()) {
      setNote("Paste the review first.");
      return;
    }
    // Typed or pasted without the paste being caught (some phones): read it now
    // rather than save the header lines as the review.
    const late = parseAirbnbReview(text);
    if (late === "several") {
      setNote("That's several reviews — paste it into the big box above and press Split instead.");
      return;
    }
    const parts = late ?? { guestName, stars, reviewMonth, text };
    setBusy(true);
    try {
      const name = (parts.guestName || guestName).trim();
      if (editingId) {
        await updateReviewEntry(editingId, {
          guestName: name,
          stars: parts.stars ?? stars,
          reviewMonth: parts.reviewMonth || reviewMonth,
          stayDate,
          text: parts.text.trim(),
        });
        clearForm();
        setFormOpen(false);
        setNote(`Saved ${name ? `${name.split(/\s+/)[0]}'s` : "the"} review.`);
        loadEntries();
        onAdded();
        return;
      }
      // The guest whose stay was found wins: "Mai" on the review is "Mai
      // Nguyen" on the list, which a name match alone would miss.
      const fromStay = found && found !== "none" && stayAuto.current ? found.guestId : undefined;
      const guestId = fromStay ?? guests.find((g) => g.name.trim().toLowerCase() === name.toLowerCase())?.id;
      const { added } = await addReviewEntry({
        roomId,
        guestId,
        guestName: name || undefined,
        stayDate: stayDate || undefined,
        reviewMonth: parts.reviewMonth || undefined,
        stars: (parts.stars ?? stars) ?? undefined,
        text: parts.text.trim(),
      });
      if (added) {
        // Cleared for the next one — the host passes several in a row. The stay
        // date is cleared too: the next review is almost never the same stay, and
        // a date carried over would be saved against the wrong stay without
        // anyone noticing.
        clearForm();
        setFormOpen(false);
        setNote(`Added to ${roomName}.`);
        loadEntries();
        // The room's file changed too (the review is appended to it), so the
        // screen above has to reload what is on file.
        onAdded();
      } else {
        setNote(`That review is already on file for ${roomName} — not added again.`);
      }
    } catch (e: any) {
      setNote(e?.response?.data?.error ?? "That didn't save. Check the connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  const closeForm = () => {
    if (busy) return;
    clearForm();
    setNote("");
    setFormOpen(false);
  };

  // The reviews are what this tab is FOR, so they fill it; adding one is a
  // button that opens the form over them, and Edit opens the same form, filled
  // (host, 2026-10-10). The form used to sit open above the list, and on a
  // phone the reviews began a screen and a half down.
  return (
    <div>
      {/* Search and Add on one row. The count is the picker's above; it is
          said here only for a search, where it is new (host, 2026-10-10:
          "the info got duplicated at two positions next to each other"). */}
      <div className="flex items-center gap-2">
        {/* Two words and an icon: "Search — a name, a word, a month (2026-09)"
            was cut off on a phone, and the cut-off part was the part that said
            anything (host, 2026-10-10). A name, a word or a month all work. */}
        <div className="relative min-w-0 flex-1">
          <HiMagnifyingGlass aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search reviews"
            aria-label={`Search ${roomName}'s reviews by name, word or month`}
            // 16px: below that, iOS Safari zooms the page in on focus.
            className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-[16px] focus:border-gray-400 focus:outline-none sm:text-sm"
          />
        </div>
        <button
          type="button"
          onClick={() => {
            clearForm();
            setNote("");
            setFormOpen(true);
          }}
          className="shrink-0 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800"
        >
          + Add
        </button>
      </div>
      {search.trim() && mine.length > 0 && (
        <p className="mt-1.5 text-sm font-semibold text-gray-800">Found: {mine.length}</p>
      )}
      {note && !formOpen && (
        <p role="status" className="mt-1.5 text-xs font-medium text-teal-700">
          {note}
        </p>
      )}
      <p className="mt-1.5 text-[11px] text-gray-400">Tap a review to edit · swipe it left to delete</p>
      {search.trim() && mine.length === 0 && (
        <p className="mt-2 text-sm text-gray-500">No review of {roomName} has all of those words.</p>
      )}
      {!search.trim() && mine.length === 0 && (
        <p className="mt-2 text-sm text-gray-500">No reviews of {roomName} yet. Tap Add to put the first one in.</p>
      )}
      <ul className="mt-1 divide-y divide-gray-100">
        {mine.map((e) => (
          <ReviewEntryItem
            // Keyed on what can change too: after a save the row starts
            // fresh, rather than keep showing the words it opened with.
            key={`${e.id}|${e.guestName}|${e.stars}|${e.stayDate}|${e.reviewMonth}|${e.snippet}`}
            entry={e}
            onEdit={startEdit}
            onDeleted={() => {
              if (e.id === editingId) clearForm();
              loadEntries();
              onAdded();
            }}
          />
        ))}
      </ul>

      {formOpen &&
        createPortal(
          // Above the Guest reviews window (z-300). A bottom sheet on a phone,
          // a centred card on a wider screen.
          <div
            className="modal-type fixed inset-0 z-[400] flex items-end justify-center bg-black/50 sm:items-center sm:p-3"
            onClick={closeForm}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-label={editingId ? "Edit review" : "Add a review"}
              className="flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-2 border-b border-gray-100 px-4 py-3">
                <div>
                  {/* The room as its badge, in its colour — the same mark as
                      the picker and the calendar (host, 2026-10-10). */}
                  <h4 className="flex flex-wrap items-center gap-1.5 text-base font-bold text-gray-900">
                    {editingId
                      ? `Edit ${guestName.trim() ? `${guestName.trim().split(/\s+/)[0]}'s` : "this"} review of`
                      : "Add a review of"}
                    <RoomBadge room={{ name: roomName, color: roomColor || undefined }} className="text-sm font-semibold" />
                  </h4>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-gray-500">
                    Paste it straight from AirBnB — the name, stars, month and stay fill themselves in.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeForm}
                  aria-label="Close"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xl leading-none text-gray-400 hover:bg-gray-100"
                >
                  &times;
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3">
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onPaste={(e) => {
                    if (fillFrom(e.clipboardData.getData("text"))) e.preventDefault();
                  }}
                  rows={6}
                  maxLength={MAX_REVIEW_CHARS}
                  autoFocus={!editingId}
                  placeholder={`Paste this guest's review of ${roomName}…`}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-[16px] leading-relaxed focus:border-gray-400 focus:outline-none sm:text-sm"
                />
                <div className="mt-0.5 text-right text-[10px] text-gray-400">
                  {text.length.toLocaleString()} / {MAX_REVIEW_CHARS.toLocaleString()}
                </div>

                <div className="mt-2 grid grid-cols-2 gap-2">
                  <div>
                    <label htmlFor="rev-guest" className="mb-0.5 block text-[11px] font-semibold text-gray-600">
                      Guest
                    </label>
                    <input
                      id="rev-guest"
                      list="rev-guests"
                      value={guestName}
                      onChange={(e) => setGuestName(e.target.value)}
                      placeholder="Type a name"
                      autoComplete="off"
                      className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-[16px] focus:border-gray-400 focus:outline-none sm:text-sm"
                    />
                    <datalist id="rev-guests">
                      {guests.slice(0, 200).map((g) => (
                        <option key={g.id} value={g.name} />
                      ))}
                    </datalist>
                    {guestName.trim() && (
                      <p className="mt-0.5 text-[10px] text-gray-400">
                        {matched ? "On your guest list" : "Not on your guest list — kept as typed"}
                      </p>
                    )}
                  </div>
                  <div>
                    <label htmlFor="rev-date" className="mb-0.5 block text-[11px] font-semibold text-gray-600">
                      Stay started
                    </label>
                    <input
                      id="rev-date"
                      type="date"
                      value={stayDate}
                      onChange={(e) => {
                        stayAuto.current = false;
                        setStayDate(e.target.value);
                      }}
                      className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-[16px] focus:border-gray-400 focus:outline-none sm:text-sm"
                    />
                    {/* Where the date came from, so the host knows to check it
                        rather than wonder. */}
                    {found && found !== "none" && stayAuto.current && stayDate === found.stayDate && (
                      <p className="mt-0.5 text-[10px] text-teal-700">
                        Found in the bookings: {found.nights} night{found.nights === 1 ? "" : "s"}, out{" "}
                        {format(parseISO(found.checkout), "MMM d")}
                        {found.others > 0 ? ` · ${found.others} earlier stay${found.others === 1 ? "" : "s"} too — check` : ""}
                      </p>
                    )}
                    {found === "none" && !stayDate && (
                      <p className="mt-0.5 text-[10px] text-gray-400">
                        No stay for {guestName.trim().split(/\s+/)[0]} in {roomName} around then — add it if you know it
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-2 flex items-center gap-1" role="group" aria-label="Stars">
                  <span className="mr-1 text-[11px] font-semibold text-gray-600">Stars</span>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      aria-pressed={stars === n}
                      aria-label={`${n} star${n === 1 ? "" : "s"}`}
                      // Tapping the chosen one again clears it: not every review gives stars.
                      onClick={() => setStars(stars === n ? null : n)}
                      className={`h-8 w-8 rounded-lg text-sm font-bold transition-colors ${
                        stars != null && n <= stars ? "bg-amber-400 text-white" : "bg-gray-100 text-gray-400 hover:bg-gray-200"
                      }`}
                    >
                      ★
                    </button>
                  ))}
                </div>

                {reviewMonth && (
                  <p className="mt-1 text-[11px] text-gray-500">
                    Dated {when ? `“${when}” — ` : ""}
                    {reviewMonth}
                    {!stayDate ? " (the month only; add the stay date above if you know it)" : ""}
                  </p>
                )}
                {note && (
                  <p role="status" className="mt-2 text-xs text-gray-600">
                    {note}
                  </p>
                )}
              </div>

              <div className="flex gap-2 border-t border-gray-100 px-4 py-3">
                <button
                  type="button"
                  onClick={closeForm}
                  disabled={busy}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={add}
                  disabled={busy || !text.trim()}
                  className="flex-1 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-40"
                >
                  {busy ? "Saving…" : editingId ? "Save changes" : "Add review"}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
};

export default GuestReviewForm;
