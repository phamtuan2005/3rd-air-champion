import { useCallback, useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { jwtDecode } from "jwt-decode";
import { getToken } from "../../util/authSession";
import { fetchGuests } from "../../util/guestOperations";
import { guestType } from "../../util/types/guestType";
import {
  addReviewEntry,
  fetchReviewEntries,
  MAX_REVIEW_CHARS,
  ReviewEntryRow,
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
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  const loadEntries = useCallback(() => {
    fetchReviewEntries()
      .then(setEntries)
      .catch(() => {});
  }, []);

  // The guest list is only to finish a name as it is typed; the form works
  // without it.
  useEffect(() => {
    loadEntries();
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
  }, [loadEntries]);

  // A typed name that IS a guest on the list is matched to them; anything else
  // is kept as typed — AirBnB reviewers are often first names nobody here knows.
  const matched = useMemo(
    () => guests.find((g) => g.name.trim().toLowerCase() === guestName.trim().toLowerCase()),
    [guests, guestName],
  );

  const mine = entries.filter((e) => e.roomId === roomId);

  const add = async () => {
    if (busy) return;
    setNote("");
    if (!text.trim()) {
      setNote("Paste the review first.");
      return;
    }
    setBusy(true);
    try {
      const { added } = await addReviewEntry({
        roomId,
        guestId: matched?.id,
        guestName: guestName.trim() || undefined,
        stayDate: stayDate || undefined,
        stars: stars ?? undefined,
        text: text.trim(),
      });
      if (added) {
        // Cleared for the next one — the host passes several in a row. The stay
        // date is cleared too: the next review is almost never the same stay, and
        // a date carried over would be saved against the wrong stay without
        // anyone noticing.
        setText("");
        setGuestName("");
        setStayDate("");
        setStars(null);
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

  const day = (key: string) => {
    try {
      return format(parseISO(key), "MMM d, yyyy");
    } catch {
      return key;
    }
  };

  return (
    <div className="mt-3 rounded-xl border border-gray-200 p-3">
      <h4 className="text-xs font-bold text-gray-900">Add one guest's review of {roomName}</h4>
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
            onChange={(e) => setStayDate(e.target.value)}
            className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-[16px] focus:border-gray-400 focus:outline-none sm:text-sm"
          />
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

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        maxLength={MAX_REVIEW_CHARS}
        placeholder={`Paste this guest's review of ${roomName}…`}
        className="mt-2 w-full rounded-lg border border-gray-200 px-3 py-2 text-[16px] focus:border-gray-400 focus:outline-none sm:text-sm"
      />
      <div className="mt-0.5 text-right text-[10px] text-gray-400">
        {text.length.toLocaleString()} / {MAX_REVIEW_CHARS.toLocaleString()}
      </div>

      <button
        type="button"
        onClick={add}
        disabled={busy || !text.trim()}
        className="mt-1 w-full rounded-lg bg-gray-800 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-900 disabled:opacity-40"
      >
        {busy ? "Adding…" : "Add review"}
      </button>
      {note && (
        <p role="status" className="mt-1.5 text-xs text-gray-600">
          {note}
        </p>
      )}

      {mine.length > 0 && (
        <div className="mt-3 border-t border-gray-100 pt-2">
          <p className="text-[11px] font-semibold text-gray-600">
            On record for {roomName}: {mine.length}
          </p>
          <ul className="mt-1 max-h-48 divide-y divide-gray-100 overflow-y-auto">
            {mine.map((e) => (
              <li key={e.id} className="py-1.5 text-xs text-gray-700">
                <span className="font-semibold text-gray-900">{e.guestName || "A guest"}</span>
                {e.stayDate && <span className="text-gray-500"> · {day(e.stayDate)}</span>}
                {e.stars != null && <span className="text-amber-500"> · {"★".repeat(e.stars)}</span>}
                <p className="truncate text-gray-500">{e.snippet}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default GuestReviewForm;
