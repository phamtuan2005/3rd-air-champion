import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { format, parseISO } from "date-fns";
import { jwtDecode } from "jwt-decode";
import { getToken } from "../../util/authSession";
import { fetchGuests } from "../../util/guestOperations";
import { guestType } from "../../util/types/guestType";
import { parseAirbnbReview } from "../../util/airbnbReviewPaste";
import ReviewEntryItem from "./ReviewEntryItem";
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
const GuestReviewForm = ({ roomId, roomName, onAdded }: { roomId: string; roomName: string; onAdded: () => void }) => {
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
  const formTop = useRef<HTMLDivElement>(null);
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
    formTop.current?.scrollIntoView({ behavior: "smooth", block: "start" });
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

  return (
    <div ref={formTop} className={`mt-3 rounded-xl border p-3 ${editingId ? "border-sky-300 bg-sky-50/40" : "border-gray-200"}`}>
      <h4 className="text-xs font-bold text-gray-900">
        {editingId
          ? `Edit ${guestName.trim() ? `${guestName.trim().split(/\s+/)[0]}'s` : "this"} review of ${roomName}`
          : `Add one guest's review of ${roomName}`}
      </h4>
      <p className="mt-0.5 text-[11px] leading-relaxed text-gray-500">
        Kept for this room, this guest and this stay — so a complaint leads to who cleaned it, and a 5-star stay can be
        thanked.
      </p>

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
            // 16px: below that, iOS Safari zooms the page in on focus.
            className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-[16px] focus:border-gray-400 focus:outline-none sm:text-sm"
          />
          <datalist id="rev-guests">
            {guests.slice(0, 200).map((g) => (
              <option key={g.id} value={g.name} />
            ))}
          </datalist>
          {guestName.trim() && (
            <p className="mt-0.5 text-[10px] text-gray-400">{matched ? "On your guest list" : "Not on your guest list — kept as typed"}</p>
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
          {/* Where the date came from, so the host knows to check it rather
              than wonder. */}
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
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onPaste={(e) => {
          if (fillFrom(e.clipboardData.getData("text"))) e.preventDefault();
        }}
        rows={4}
        maxLength={MAX_REVIEW_CHARS}
        placeholder={`Paste this guest's review of ${roomName}…`}
        className="mt-2 w-full rounded-lg border border-gray-200 px-3 py-2 text-[16px] focus:border-gray-400 focus:outline-none sm:text-sm"
      />
      <div className="mt-0.5 text-right text-[10px] text-gray-400">
        {text.length.toLocaleString()} / {MAX_REVIEW_CHARS.toLocaleString()}
      </div>

      <div className="mt-1 flex gap-2">
        {editingId && (
          <button
            type="button"
            onClick={() => {
              clearForm();
              setNote("");
            }}
            disabled={busy}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
        )}
        <button
          type="button"
          onClick={add}
          disabled={busy || !text.trim()}
          className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-40 ${
            editingId ? "bg-sky-600 hover:bg-sky-700" : "bg-gray-800 hover:bg-gray-900"
          }`}
        >
          {busy ? "Saving…" : editingId ? "Save changes" : "Add review"}
        </button>
      </div>
      {note && (
        <p role="status" className="mt-1.5 text-xs text-gray-600">
          {note}
        </p>
      )}

      {(mine.length > 0 || search.trim()) && (
        <div className="mt-3 border-t border-gray-100 pt-2">
          <p className="text-[11px] font-semibold text-gray-600">
            {search.trim() ? `Found in ${roomName}: ${mine.length}` : `On record for ${roomName}: ${mine.length}`}
          </p>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search — a name, a word, a month (2026-09)"
            aria-label={`Search ${roomName}'s reviews`}
            // 16px: below that, iOS Safari zooms the page in on focus.
            className="mt-1 w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-[16px] focus:border-gray-400 focus:outline-none sm:text-sm"
          />
          <p className="mt-1 text-[10px] text-gray-400">Tap a review to read it all · swipe it left to delete</p>
          {search.trim() && mine.length === 0 && (
            <p className="mt-1 text-xs text-gray-500">No review of {roomName} has all of those words.</p>
          )}
          <ul className="mt-1 max-h-72 divide-y divide-gray-100 overflow-y-auto">
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
        </div>
      )}
    </div>
  );
};

export default GuestReviewForm;
