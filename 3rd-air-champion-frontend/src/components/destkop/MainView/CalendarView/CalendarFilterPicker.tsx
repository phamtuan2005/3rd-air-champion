import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { FaUser } from "react-icons/fa";
import { HiSparkles } from "react-icons/hi2";
import { format, startOfToday } from "date-fns";
import { roomType } from "../../../../util/types/roomType";
import { guestType } from "../../../../util/types/guestType";
import { dayType } from "../../../../util/types/dayType";
import RoomBadge from "../../../shared/RoomBadge";
import { airbnbGuestList } from "../../../../util/airbnbGuestList";
import { houseGuestList, isPhoneQuery, matchesTyped, topMatches } from "../../../../util/houseGuestList";
import { matchesReservation, reviewsTyped, screensMatching, weekTyped, whenTyped, whoAndWhen, worthAsking, When } from "../../../../util/ttIntents";
import { jwtDecode } from "jwt-decode";
import { cleanerLeadLine, fetchPublishedReviews, fetchReviewStats, PublishedReviews, ReviewStats } from "../../../../util/ttQuestionLog";
import { getToken } from "../../../../util/authSession";
import { latestDateLabel, starRow } from "../../../../util/askTT";
import type { SearchWorker } from "../../../../util/searchWorkers";

interface CalendarFilterPickerProps {
  rooms: roomType[];
  roomValue: string | null;
  onRoomChange: (roomName: string | null) => void;
  guests: guestType[];
  monthMap: Map<string, dayType>;
  guestValue: string | null;
  // null = everyone: the host clears an AirBnB filter with it too.
  onGuestChange: (guestId: string | null) => void;
  // The AirBnB guest filtered on, by the name AirBnB gave them (the alias).
  airbnbValue: string | null;
  onAirBnBChange: (alias: string) => void;
  // The house's own people. Picking one leaves the calendar as it is and opens
  // their window instead: Staffing for staff, Clean for a cleaner.
  workers: SearchWorker[];
  onWorkerPick: (worker: SearchWorker) => void;
  // Who is signed in, for TT's greeting: the host, or a cohost.
  hostName?: string;
  // The rest of what TT understands (util/ttIntents): a day to go to and open,
  // a month to turn to, a screen to open by its key, and a question to put to
  // the assistant.
  onDateJump: (dateKey: string) => void;
  onMonthJump: (dateKey: string) => void;
  // A week of cleaning: Clean opens on its Week tab, this week (0) or next
  // (1), on one cleaner's rows when one was named.
  onWeek: (offset: 0 | 1, cleanerId?: string) => void;
  onScreen: (key: string) => void;
  onAsk: (question: string) => void;
}

// The most results a search draws under each heading. Past a handful nobody
// reads a list; they type another letter, and the line under the results says
// how many more there are.
const RESULT_LIMIT = 8;

/*
 * The one control that decides WHO and WHAT the calendar shows — a search box.
 *
 * How it got here, since each step was a design that worked until it did not:
 *
 *  1. Room and guest were two dropdowns side by side in a header already
 *     carrying the month, the lens and the page size. They became one list
 *     with two sections, every room and then every guest.
 *  2. AirBnB guests were missing from it entirely — every AirBnB stay hangs
 *     off one placeholder guest record — though half the house's guests come
 *     through AirBnB. They were added as a third list behind a switch
 *     (2026-10-02).
 *  3. The same day Anh-Tuan asked what a thousand guests would do to it. A
 *     list that long is bad design, and trimming it was not the answer either:
 *     "even when the list is more than 10-15, I no longer [use] the drop down
 *     list. Instead, I type the name directly." His design, which this is:
 *     remove every item, and give the host a text box. Type a room, a guest's
 *     name, or a phone number.
 *
 * So nothing is listed until something is typed, and what is typed is looked
 * for in all three at once — a host typing "King" wants the room and one
 * typing "Eddie" wants the guest, and which it is does not need asking.
 *
 * Room stays INDEPENDENT of who: filtering to King and to Eddie at once is a
 * reasonable thing to want. A house guest and an AirBnB guest are one choice:
 * picking either clears the other. With the box empty, the panel shows what is
 * filtered now, each with its own way off — the lists used to carry "All
 * rooms" and "Everyone" for that.
 *
 *  4. Then it stopped being only a filter. Anh-Tuan: "That filter function I
 *     want to promote to a general search" — staff by name or phone as well,
 *     and "depending on the target, you will display either the calendar or
 *     the staffing modal or the cleaner modal". So the control is called
 *     Search now, and WHAT is picked decides where the host lands: a room or
 *     a guest narrows the calendar, as before; a staff member opens Staffing
 *     on them; a cleaner opens Clean on them. One box in place of a button
 *     for each destination — his words, "the modern UI design with
 *     simplification of buttons, drop down etc".
 *
 * The component keeps its old name. It is still the thing that filters the
 * calendar, and renaming the file would only move every line of its history.
 */

// One review in TT's review answer, under "Latest review of each room": room,
// guest, stars, date, the whole review, and who prepared the room. A tap opens
// it to edit in Guest reviews. (A "3 stars or lower" list used it too until the
// host found that list unnecessary, 2026-10-10.)
// Drawn the way Guest reviews draws one (host, 2026-10-10: "same design"):
// the room as its coloured badge, the name and stars large, the WHOLE review
// rather than a cut-off line and a tap to open, a date a person reads, and who
// prepared the room under it. Editing lives in Guest reviews; here it is read.
const reviewDate = (r: { stayDate: string; reviewMonth: string }) =>
  r.stayDate
    ? format(new Date(`${r.stayDate}T12:00:00`), "MMM d, yyyy")
    : r.reviewMonth
      ? format(new Date(`${r.reviewMonth}-01T12:00:00`), "MMM yyyy")
      : "";

const ReviewLine = ({
  r,
  roomColor,
  onOpen,
}: {
  r: NonNullable<ReviewStats["recent"]>[number];
  roomColor?: string;
  // A tap opens the review to edit, in Guest reviews (host, 2026-10-10).
  onOpen?: (id: string) => void;
}) => {
  const date = reviewDate(r);
  const open = r.id && onOpen ? () => onOpen(r.id!) : undefined;
  return (
    <div
      role={open ? "button" : undefined}
      tabIndex={open ? 0 : undefined}
      aria-label={open ? `Edit ${r.guestName || "this"} review` : undefined}
      onClick={open}
      onKeyDown={(e) => {
        if (open && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          open();
        }
      }}
      className={`mt-1.5 rounded-md border-b border-gray-100 pb-2 last:border-0 ${open ? "cursor-pointer hover:bg-gray-50" : ""}`}
    >
      <p className="flex flex-wrap items-center gap-x-1.5">
        <RoomBadge room={{ name: r.roomName, color: roomColor }} className="text-xs font-semibold" />
        <span className="text-base font-semibold text-gray-900">{r.guestName || "A guest"}</span>
        {r.stars != null && <span className="text-amber-500">· {"★".repeat(r.stars)}</span>}
        {date && <span className="text-sm text-gray-500">· {date}</span>}
      </p>
      <p className="mt-0.5 whitespace-pre-line text-base leading-relaxed text-gray-800">{r.text ?? r.snippet}</p>
      {/* Teal, not the review's grey: it is the house's own note, not the
          guest's words, and read as part of the review it was mistaken for one
          (host, 2026-10-08). Teal is TiMag's colour for operational things. */}
      <p className="mt-0.5 text-xs font-medium text-teal-700">{cleanerLeadLine(r.basis, r.cleaners)}</p>
    </div>
  );
};

const CalendarFilterPicker = ({
  rooms,
  roomValue,
  onRoomChange,
  guests,
  monthMap,
  guestValue,
  onGuestChange,
  airbnbValue,
  onAirBnBChange,
  workers,
  onWorkerPick,
  hostName,
  onDateJump,
  onMonthJump,
  onWeek,
  onScreen,
  onAsk,
}: CalendarFilterPickerProps) => {
  // The first name only: "Anh-Tuan", not the full account name.
  const greetName = (hostName ?? "").trim().split(/\s+/)[0] ?? "";
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const activeRooms = useMemo(() => rooms.filter((r) => r.active), [rooms]);
  const selectedRoom = activeRooms.find((r) => r.name === roomValue) ?? null;
  const selectedGuest = guests.find((g) => g.id === guestValue) ?? null;

  const todayKey = format(startOfToday(), "yyyy-MM-dd");
  // The rows a search runs over, each list already in "who is here soonest"
  // order, so the likeliest match is the first one shown.
  const airbnbRows = useMemo(() => airbnbGuestList(monthMap, todayKey), [monthMap, todayKey]);
  const houseRows = useMemo(() => houseGuestList(guests, monthMap, todayKey), [guests, monthMap, todayKey]);

  const q = query.trim();
  // "Susan Dec": a name with a time beside it. The name is what the rooms and
  // guests are searched for, and the time is where the calendar opens once one
  // is picked. Anh-Tuan's example (2026-10-02): "Susan stay in Dec" — a thing
  // the calendar shows on its own, without a question to the assistant.
  const split = q ? whoAndWhen(q) : null;
  const who = split?.who ?? q;
  const roomHits = who ? activeRooms.filter((r) => matchesTyped(who, r.name)) : [];
  const house = topMatches(houseRows, (r) => matchesTyped(who, r.name, r.phone), RESULT_LIMIT);
  // AirBnB gives a first name, a reservation code and the last four digits of
  // a phone — so those are what an AirBnB guest is found by.
  const airbnb = topMatches(
    airbnbRows,
    (r) => matchesTyped(who, r.alias) || !!matchesReservation(who, r.codes, r.last4s),
    RESULT_LIMIT,
  );
  // A day or a month, when the whole of what was typed is one.
  const when = q && !split ? whenTyped(q) : null;
  // A week of cleaning — "next week", "Henry next week", "Henry's schedule".
  // Anh-Tuan: "Henry nxt week schedule would work without API?" It does: the
  // Clean window's Week tab is the answer, with no model in the way. A name
  // that is no cleaner's is not a week; it falls through to a question.
  const weekAsked = q ? weekTyped(q) : null;
  const weekCleaner = weekAsked?.who
    ? workers.find((w) => w.kind === "cleaner" && !w.former && matchesTyped(weekAsked.who, w.name))
    : undefined;
  const week = weekAsked && (!weekAsked.who || weekCleaner) ? weekAsked : null;
  // A screen, by its name or another word for it.
  const screens = q ? screensMatching(q) : [];
  // A question about the guest reviews — averages, the low ones, what guests say
  // about something. Answered from the server's own arithmetic, no model in the
  // way (the host: "I don't want to use API for such trivial questions").
  const reviewAsked = q ? reviewsTyped(q) : null;
  const reviewTopic = reviewAsked?.topic ?? null;
  const [reviewStats, setReviewStats] = useState<ReviewStats | null>(null);
  const [reviewFailed, setReviewFailed] = useState(false);
  useEffect(() => {
    if (!reviewAsked) return;
    let live = true;
    setReviewFailed(false);
    fetchReviewStats(reviewTopic)
      .then((s) => live && setReviewStats(s))
      .catch(() => live && setReviewFailed(true));
    return () => {
      live = false;
    };
    // The topic is what changes the answer; the query's other words do not.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!reviewAsked, reviewTopic]);
  // A room named in a review question gets its LATEST review, read from the
  // very route TiBook's TT reads, so the host sees word for word what a guest
  // is shown. "latest review cozy" answered in TiBook and not here, where it
  // gave the house-wide numbers instead (host, 2026-10-09).
  const reviewRoom = reviewAsked
    ? rooms.find((r) => r.name && new RegExp(`\\b${r.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(q))
    : undefined;
  const [latestReviews, setLatestReviews] = useState<PublishedReviews["latest"] | null>(null);
  useEffect(() => {
    if (!reviewRoom || latestReviews) return;
    let hostId = "";
    try {
      hostId = (jwtDecode(getToken() ?? "") as { hostId?: string }).hostId ?? "";
    } catch {
      return;
    }
    if (!hostId) return;
    let live = true;
    fetchPublishedReviews(hostId)
      .then((p) => live && setLatestReviews(p.latest))
      .catch(() => {});
    return () => {
      live = false;
    };
    // Fetched once, the first time a room is named; every room comes back.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!reviewRoom]);
  const roomLatest = reviewRoom ? latestReviews?.[reviewRoom.id] : undefined;
  // Staff and cleaners, by name or phone like a guest — and by what they do,
  // so "cleaner" brings up the cleaners and "intern" the intern. Not with a
  // time beside the name: the team has no page on the calendar to open.
  const team = topMatches(
    workers,
    (w) => !split && (matchesTyped(q, w.name, w.phone) || matchesTyped(q, w.role)),
    RESULT_LIMIT,
  );
  const byPhone = isPhoneQuery(who);
  const foundAnything =
    !!when || !!week || !!reviewAsked || screens.length > 0 || roomHits.length > 0 || house.total > 0 || airbnb.total > 0 || team.total > 0;
  // A guest called May, or June: her exact name beats the month on Enter.
  const exactGuest = when?.month ? house.shown.find((r) => r.name.toLowerCase() === q.toLowerCase()) : undefined;
  // A sentence, or a word that found nothing, is offered to TT as a question.
  const askable = worthAsking(q, foundAnything);

  const close = () => {
    setOpen(false);
    setQuery("");
  };
  const goTo = (w: When) => (w.month ? onMonthJump(w.key) : onDateJump(w.key));
  // A room or a guest picked with a time beside the name: the filter is set,
  // then the calendar turns to that time. In that order, because setting a
  // guest moves the calendar to their next stay, and the time typed wins.
  const pickRoom = (name: string | null) => {
    onRoomChange(name);
    if (split) goTo(split.when);
    close();
  };
  const pickGuest = (id: string | null) => {
    onGuestChange(id);
    if (split) goTo(split.when);
    close();
  };
  const pickAirBnB = (alias: string) => {
    onAirBnBChange(alias);
    if (split) goTo(split.when);
    close();
  };
  const pickWorker = (worker: SearchWorker) => {
    onWorkerPick(worker);
    close();
  };
  const pickWhen = (w: When) => {
    goTo(w);
    close();
  };
  const pickWeek = () => {
    if (week) onWeek(week.offset, weekCleaner?.id);
    close();
  };
  const pickScreen = (key: string) => {
    onScreen(key);
    close();
  };
  const ask = () => {
    onAsk(q);
    close();
  };
  // Enter takes the first thing found, in the order it is shown: for a host at
  // a keyboard, "ki" and Enter is the whole gesture.
  const pickFirst = () => {
    if (exactGuest) pickGuest(exactGuest.id);
    else if (when) pickWhen(when);
    else if (week) pickWeek();
    else if (screens[0]) pickScreen(screens[0].key);
    else if (roomHits[0]) pickRoom(roomHits[0].name);
    else if (house.shown[0]) pickGuest(house.shown[0].id);
    else if (airbnb.shown[0]) pickAirBnB(airbnb.shown[0].alias);
    else if (team.shown[0]) pickWorker(team.shown[0]);
    else if (askable) ask();
  };

  const day = (key: string, pattern: string) => format(new Date(key + "T00:00:00"), pattern);
  // Where a room or guest row will take the calendar, said on the row.
  const thenLabel = split ? (
    <span className="ml-auto shrink-0 text-sm font-semibold text-gray-500">
      {day(split.when.key, split.when.month ? "MMMM" : "MMM d")} ›
    </span>
  ) : null;

  // The trigger says what is ON. A guest narrows the calendar further than a
  // room does, so it leads when both are set.
  // Sized for a SCREENSHOT, not just for this screen. Anh-Tuan photographs the
  // filtered calendar and sends it to the guest, who looks first for their own
  // name — at 12px it arrived as small grey text above a wall of bars. A picked
  // guest is the largest thing in this control.
  // An AirBnB guest reads the same way as a house guest, with "(A)" after the
  // name — the mark the header has always used for an AirBnB filter.
  const filteredName = selectedGuest ? selectedGuest.alias || selectedGuest.name : airbnbValue;
  // TT's mark: a sparkle on the gradient the Clean window's brand bar uses, so
  // the assistant looks like part of this house and not a stock icon.
  const ttBadge = (box: string, icon: number) => (
    <span
      aria-hidden
      className={`flex ${box} shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 via-blue-500 to-violet-500 text-white shadow-sm`}
    >
      <HiSparkles size={icon} />
    </span>
  );
  const triggerContent = filteredName ? (
    // Guest and room STACK when both are on. Side by side they shared one line's
    // width, so each had to shrink to fit the other — and the name is the half
    // that must not. On two lines each gets its own full width at full size.
    <span className="flex min-w-0 flex-col items-start gap-0.5 leading-tight">
      <span className="flex w-full min-w-0 items-center gap-2 text-2xl font-bold text-emerald-700">
        <FaUser size={17} className="shrink-0" />
        <span className="truncate">{filteredName}</span>
        {!selectedGuest && <span className="shrink-0 text-base font-semibold text-gray-400">(A)</span>}
      </span>
      {selectedRoom && (
        <span className="text-lg">
          <RoomBadge room={selectedRoom} rooms={activeRooms} />
        </span>
      )}
    </span>
  ) : selectedRoom ? (
    <span className="text-lg">
      <RoomBadge room={selectedRoom} rooms={activeRooms} />
    </span>
  ) : (
    // Nothing filtered: the trigger names the control. It said "Filter" while
    // it was a list to choose from, then "Search" once it was a place to type,
    // then "? TT" when Anh-Tuan named the house's assistant TT (2026-10-02).
    // He found the bare "? TT" ugly and asked for an AI icon in it: so it is
    // TT's badge now, the sparkle that marks an assistant, beside its name.
    <span className="flex items-center gap-1.5" aria-label="Ask TT">
      {ttBadge("h-6 w-6", 14)}
      <span className="text-sm font-extrabold tracking-wide text-gray-800">TT</span>
    </span>
  );
  // A room or a guest is filtered: the trigger is a name to tap, with a caret.
  // Otherwise it is TT's own pill and needs none.
  const isFiltered = !!filteredName || !!selectedRoom;

  const heading = "px-4 pb-1 pt-3 text-xs font-bold uppercase tracking-wide text-gray-400";
  // text-base: the rows read at the size of the reviews above them. Their
  // hints were 11px, a size the host called "too tiny" (2026-10-10).
  const rowClass = "flex w-full items-center gap-3 px-4 py-2.5 text-left text-base hover:bg-gray-50";
  const tick = <span className="ml-auto shrink-0 text-sm font-bold text-emerald-600">✓</span>;
  const more = (shown: number, total: number) =>
    total > shown ? (
      <p className="px-4 pb-1 text-xs text-gray-400">
        {total - shown} more. Type more of the name to narrow it.
      </p>
    ) : null;

  // Nothing found and too short to be a question: the only dead end left.
  const nothingFound = q && !foundAnything && !askable;
  // Each section after the first gets a rule above it.
  let sectionsShown = 0;
  const sectionHeading = (text: string) => (
    <p className={`${heading} ${sectionsShown++ > 0 ? "border-t border-gray-100" : ""}`}>{text}</p>
  );

  const modal = open
    ? createPortal(
        <div
          // Anchored to the TOP, not centred.
          //
          // The panel's height changes as results come and go, and centred that
          // moved the TOP edge down to keep the middle still — carrying the
          // search box down behind a phone's keyboard, which is open the
          // moment this appears because the box autofocuses. Pinned at the
          // top, the height only ever changes at the bottom.
          //
          // dvh, never vh: on a phone vh is the tallest the viewport can be, so
          // the panel would be sized for a window the browser toolbar is
          // covering ([[project-mobile-dvh-calendar]]).
          className="modal-type fixed inset-0 z-[300] flex items-start justify-center bg-black bg-opacity-40 pt-[8dvh]"
          onClick={close}
        >
          <div
            className="flex max-h-[78dvh] w-80 flex-col rounded-lg bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                {ttBadge("h-6 w-6", 14)}
                Ask TT
              </h3>
              <button
                type="button"
                className="text-gray-400 hover:text-gray-600 text-xl leading-none px-1"
                onClick={close}
              >
                &times;
              </button>
            </div>

            {/* TT introduces itself, in Anh-Tuan's words (2026-10-02). TT is
                the house's assistant, and this box is where the host speaks to
                it, so it greets whoever is signed in — the host, or a cohost
                such as Cindy — by name. Above the box and always there, so the
                box does not jump when the first letter is typed. */}
            <p className="px-4 pt-3 text-sm leading-snug text-gray-600">
              Hello{greetName ? ` ${greetName}` : ""}, TT is your assistant. I will do my best to assist you.
              What can I do for you today?
            </p>

            <div className="px-4 pt-3">
              <input
                autoFocus
                type="text"
                // A name or a number: the plain keyboard, with nothing
                // "corrected" on the way.
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") pickFirst();
                }}
                placeholder="A name, a date, a screen, a question…"
                className="w-full rounded border border-gray-300 px-2.5 py-1.5 text-sm focus:border-gray-400 focus:outline-none"
              />
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto pb-2 pt-1">
              {!q && (
                <>
                  {/* What is on now, each with its own way off. */}
                  {(selectedRoom || filteredName) && (
                    <>
                      <p className={heading}>Showing now</p>
                      {filteredName && (
                        <div className="flex items-center gap-3 px-4 py-2 text-sm">
                          <FaUser size={13} className="shrink-0 text-emerald-700" />
                          <span className="min-w-0 truncate font-semibold text-gray-800">
                            {filteredName}
                            {!selectedGuest && <span className="ml-1 font-semibold text-gray-400">(A)</span>}
                          </span>
                          <button
                            type="button"
                            onClick={() => pickGuest(null)}
                            className="ml-auto shrink-0 rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-50"
                          >
                            Show everyone
                          </button>
                        </div>
                      )}
                      {selectedRoom && (
                        <div className="flex items-center gap-3 px-4 py-2 text-sm">
                          <RoomBadge room={selectedRoom} rooms={activeRooms} />
                          <button
                            type="button"
                            onClick={() => pickRoom(null)}
                            className="ml-auto shrink-0 rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-50"
                          >
                            Show all rooms
                          </button>
                        </div>
                      )}
                    </>
                  )}
                  {/* What TT can be asked, as examples to type rather than a
                      list of rules to read. */}
                  <p className="px-4 pb-2 pt-3 text-sm leading-relaxed text-gray-400">
                    Try a room or a name, a phone number, an AirBnB code, a date such as
                    “Oct 19”, a name and a month such as “Susan Dec”, a screen such as
                    “stats” — or ask me a question.
                  </p>
                </>
              )}

              {/* A day: the calendar goes there. First, because when the whole
                  of what was typed is a date it can be nothing else. */}
              {when && (
                <>
                  {sectionHeading("Go to")}
                  <button type="button" className={rowClass} onClick={() => pickWhen(when)}>
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-gray-800">
                        {day(when.key, when.month ? "MMMM yyyy" : "EEEE, MMM d, yyyy")}
                      </span>
                      <span className="block truncate text-sm text-gray-500">
                        {when.month ? "Turn the calendar to this month" : "Show this day on the calendar"}
                      </span>
                    </span>
                    <span className="ml-auto shrink-0 text-sm font-semibold text-gray-500">Calendar ›</span>
                  </button>
                </>
              )}

              {/* A week of cleaning, in Clean. */}
              {week && (
                <>
                  {sectionHeading("Open")}
                  <button type="button" className={rowClass} onClick={pickWeek}>
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-gray-800">
                        {week.offset ? "Next week" : "This week"}
                        {weekCleaner ? ` · ${weekCleaner.name.split(" ")[0]}` : ""}
                      </span>
                      <span className="block truncate text-sm text-gray-500">
                        {weekCleaner ? `${weekCleaner.name.split(" ")[0]}'s rooms, morning by morning` : "Who cleans what, morning by morning"}
                      </span>
                    </span>
                    <span className="ml-auto shrink-0 text-sm font-semibold text-gray-500">Clean ›</span>
                  </button>
                </>
              )}

              {/* The guest reviews, added up on the server. */}
              {reviewAsked && (
                <>
                  {sectionHeading("Guest reviews")}
                  <div className="px-3 py-2 text-[12px] text-gray-700">
                    {reviewFailed && <p className="text-rose-600">The reviews didn't load. Try again in a moment.</p>}
                    {!reviewStats && !reviewFailed && <p className="text-gray-400">Adding them up…</p>}
                    {reviewRoom && roomLatest && (
                      <div className="mb-2 rounded-lg bg-gray-50 px-3 py-2">
                        <p className="text-base font-semibold text-gray-900">
                          {reviewRoom.name}'s latest review
                          <span className="font-normal text-gray-500">
                            {roomLatest.guest ? ` · ${roomLatest.guest}` : ""} ·{" "}
                            {latestDateLabel(roomLatest)}
                          </span>
                          {roomLatest.stars ? <span className="text-amber-500"> · {starRow(roomLatest.stars)}</span> : null}
                        </p>
                        <p className="mt-1 whitespace-pre-line text-base leading-relaxed text-gray-800">{roomLatest.summary}</p>
                      </div>
                    )}
                    {reviewStats && reviewStats.total === 0 && (
                      <p className="text-gray-500">No reviews are on record yet. Add them under Guest reviews.</p>
                    )}
                    {/* What TiBook's TT tells a guest who asks, word for word — the
                        room's summary when a room is named, else the house's.
                        The host reads exactly what guests are shown. */}
                    {reviewStats &&
                      (() => {
                        const named = reviewStats.published.rooms.find((r) =>
                          new RegExp(`\\b${r.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(q),
                        );
                        const text = named ? named.summary : reviewStats.published.house;
                        if (!text.trim()) {
                          return (
                            <p className="mb-2 text-gray-500">
                              Nothing published for guests yet. Draft and publish under Guest reviews.
                            </p>
                          );
                        }
                        return (
                          // Reading size, like the reviews under it: the overview is
                          // what TT tells a guest, and at the box's 12px it was too
                          // small to read (host, 2026-10-10).
                          // A tap opens it where it is written and refreshed: the
                          // House tab (Draft and Publish), or the named room's tab
                          // (host, 2026-10-10).
                          <div
                            role="button"
                            tabIndex={0}
                            onClick={() => pickScreen(named ? `reviews:room:${named.room}` : "reviews:house")}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                pickScreen(named ? `reviews:room:${named.room}` : "reviews:house");
                              }
                            }}
                            className="mb-2 cursor-pointer rounded-lg bg-gray-50 px-3 py-2 hover:bg-gray-100"
                          >
                            <p className="text-base font-semibold text-gray-900">
                              What guests say about {named ? named.name : "TT House"}:
                            </p>
                            <p className="mt-1 whitespace-pre-line text-base leading-relaxed text-gray-800">{text}</p>
                          </div>
                        );
                      })()}
                    {reviewStats && reviewStats.total > 0 && (
                      <>
                        <p className="text-base font-semibold text-gray-900">
                          {reviewStats.total} review{reviewStats.total === 1 ? "" : "s"} on record
                        </p>
                        {/* Three real columns — room, stars, count — with the
                            numbers right-aligned on tabular digits. As one run
                            of text per row, "4.97 ★ · 115 reviews" and "4.98 ★
                            · 42 reviews" ended together and their stars and
                            counts zig-zagged down the list (host, 2026-10-08).
                            Each column as wide as its widest entry, not the name
                            stretched across the box: that left a gulf between a
                            room and its numbers. The room as its coloured badge,
                            at reading size (host, 2026-10-10). */}
                        <div className="mt-1.5 grid w-fit grid-cols-[auto_auto_auto] items-center gap-x-4 gap-y-1.5 text-base tabular-nums">
                          {reviewStats.rooms.map((r) => (
                            // A whole line is one tap: it opens Guest reviews on that
                            // room (host, 2026-10-10). Subgrid keeps the three columns
                            // lined up across the rows, as they were as plain cells.
                            <button
                              key={r.room}
                              type="button"
                              onClick={() => pickScreen(`reviews:room:${r.room}`)}
                              className="col-span-3 -mx-1 grid grid-cols-subgrid items-center rounded-md px-1 py-0.5 text-left hover:bg-gray-50"
                            >
                              <RoomBadge
                                room={{ name: r.name, color: rooms.find((x) => x.name === r.name)?.color }}
                                rooms={reviewStats.rooms}
                                className="text-sm font-semibold"
                              />
                              <span className="text-right">
                                {r.average != null ? (
                                  <span className="font-semibold text-amber-600">{r.average.toFixed(2)} ★</span>
                                ) : (
                                  <span className="text-gray-400">no stars</span>
                                )}
                              </span>
                              <span className="text-right text-gray-400">
                                {r.reviews} review{r.reviews === 1 ? "" : "s"}
                                {r.withStars !== r.reviews ? `, ${r.withStars} with stars` : ""}
                              </span>
                            </button>
                          ))}
                        </div>

                        {reviewStats.topic && (
                          <div className="mt-2 border-t border-gray-100 pt-2">
                            <p className="font-semibold text-gray-900">Mentioning {reviewStats.topic.label}</p>
                            {reviewStats.topic.rooms.length === 0 ? (
                              <p className="text-gray-500">No review mentions it.</p>
                            ) : (
                              <>
                                <p className="text-gray-600">
                                  {reviewStats.topic.rooms.map((r) => `${r.name} ${r.count}`).join(" · ")}
                                </p>
                                {reviewStats.topic.snippets.map((s, i) => (
                                  <p key={i} className="mt-1 text-gray-500">
                                    <span className="font-semibold text-gray-700">{s.roomName}</span>
                                    {s.guestName ? ` · ${s.guestName}` : ""}
                                    {s.stars != null ? ` · ${"★".repeat(s.stars)}` : ""} — {s.snippet}
                                  </p>
                                ))}
                              </>
                            )}
                          </div>
                        )}

                        {/* The newest reviews, whatever the stars, ABOVE the low ones:
                            most recent stays are 5 stars, and the host follows
                            those first — with the cleaner lead, to credit a
                            good stay (host, 2026-10-08). One per room since 2026-10-10. */}
                        {reviewStats.recent && reviewStats.recent.length > 0 && (
                          <div className="mt-2 border-t border-gray-100 pt-2">
                            <p className="text-base font-semibold text-gray-900">Latest review of each room</p>
                            {reviewStats.recent.map((r, i) => (
                              <ReviewLine key={i} r={r} roomColor={rooms.find((x) => x.name === r.roomName)?.color} onOpen={(id) => pickScreen(`reviews:${id}`)} />
                            ))}
                          </div>
                        )}
                        {/* No "3 stars or lower" list: the host found it unnecessary
                            here (2026-10-10). A low review is in its room's list in
                            Guest reviews, and a search finds it. */}
                      </>
                    )}
                  </div>
                </>
              )}

              {/* A screen, by its name or another word for it. Under the
                  week's heading when there is one: "cleaning schedule" is a
                  week and the Clean screen, and one "Open" covers both. */}
              {screens.length > 0 && (
                <>
                  {!week && sectionHeading("Open")}
                  {screens.map((s) => (
                    <button key={s.key} type="button" className={rowClass} onClick={() => pickScreen(s.key)}>
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-gray-800">{s.label}</span>
                        <span className="block truncate text-sm text-gray-500">{s.hint}</span>
                      </span>
                      <span className="ml-auto shrink-0 text-sm font-semibold text-gray-500">Open ›</span>
                    </button>
                  ))}
                </>
              )}

              {roomHits.length > 0 && (
                <>
                  {sectionHeading("Room")}
                  {roomHits.map((room) => (
                    <button key={room.id} type="button" className={rowClass} onClick={() => pickRoom(room.name)}>
                      <RoomBadge room={room} rooms={activeRooms} />
                      {roomValue === room.name && tick}
                      {thenLabel}
                    </button>
                  ))}
                </>
              )}

              {house.shown.length > 0 && (
                <>
                  {sectionHeading("Guest")}
                  {house.shown.map((r) => (
                    <button key={r.id} type="button" className={rowClass} onClick={() => pickGuest(r.id)}>
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-gray-800">{r.name}</span>
                        {/* When they are next in, and where — how a host tells
                            one Susan from another faster than by surname. The
                            number shows when a number is what was typed, so the
                            host sees why this guest came up. */}
                        <span className="block truncate text-sm text-gray-500">
                          {r.next === todayKey
                            ? "Here now"
                            : r.next
                              ? `Next stay ${day(r.next, "EEE MMM d")}`
                              : r.last
                                ? `Last stayed ${day(r.last, "MMM d, yyyy")}`
                                : "No stays on the calendar"}
                          {r.room ? ` · ${r.room}` : ""}
                          {byPhone && r.phone ? ` · ${r.phone}` : ""}
                        </span>
                      </span>
                      {guestValue === r.id && tick}
                      {thenLabel}
                    </button>
                  ))}
                  {more(house.shown.length, house.total)}
                </>
              )}

              {airbnb.shown.length > 0 && (
                <>
                  {sectionHeading("AirBnB guest")}
                  {airbnb.shown.map((r) => {
                    // Found by the code or the four digits rather than by
                    // name: say which, so the host sees why this guest came up.
                    const via = matchesReservation(who, r.codes, r.last4s);
                    return (
                    <button key={r.alias} type="button" className={rowClass} onClick={() => pickAirBnB(r.alias)}>
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-gray-800">{r.alias}</span>
                        {/* An AirBnB name is a first name, and the room is what
                            tells two Dannys apart. */}
                        <span className="block truncate text-sm text-gray-500">
                          {r.inHouse
                            ? "Here now"
                            : r.next
                              ? `Arrives ${day(r.next, "EEE MMM d")}`
                              : `Last stayed ${day(r.last ?? todayKey, "MMM d, yyyy")}`}
                          {r.room ? ` · ${r.room}` : ""}
                          {r.stays > 1 ? ` · ${r.stays} stays` : ""}
                          {via === "code"
                            ? ` · code ${r.codes.find((c) => c.startsWith(who.toUpperCase())) ?? ""}`
                            : via === "last4"
                              ? ` · phone ends ${who}`
                              : ""}
                        </span>
                      </span>
                      {airbnbValue === r.alias && tick}
                      {thenLabel}
                    </button>
                    );
                  })}
                  {more(airbnb.shown.length, airbnb.total)}
                </>
              )}

              {team.shown.length > 0 && (
                <>
                  {sectionHeading("Your team")}
                  {team.shown.map((w) => (
                    <button key={`${w.kind}-${w.id}`} type="button" className={rowClass} onClick={() => pickWorker(w)}>
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-gray-800">{w.name}</span>
                        <span className="block truncate text-sm text-gray-500">
                          {w.role}
                          {w.former ? " · left the team" : ""}
                          {byPhone && w.phone ? ` · ${w.phone}` : ""}
                        </span>
                      </span>
                      {/* Said on the row, because this result leaves the
                          calendar: where the tap goes. */}
                      <span className="ml-auto shrink-0 text-sm font-semibold text-gray-500">
                        {w.kind === "cleaner" ? "Clean ›" : "Staffing ›"}
                      </span>
                    </button>
                  ))}
                  {more(team.shown.length, team.total)}
                </>
              )}

              {/* A question, handed to TT. Last, so a name that also happens
                  to be three words long still shows its matches first; and
                  shown in place of "nothing matches" when nothing did, since
                  that was a dead end and this is not. TT reads the books and
                  changes nothing — said here, before the tap. */}
              {askable && (
                <>
                  {sectionHeading("Ask TT")}
                  <button type="button" className={rowClass} onClick={ask}>
                    {ttBadge("h-6 w-6", 14)}
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-gray-800">“{q}”</span>
                      <span className="block truncate text-sm text-gray-500">
                        TT looks it up in your calendar, guests and cleanings
                      </span>
                    </span>
                    <span className="ml-auto shrink-0 text-sm font-semibold text-gray-500">Ask ›</span>
                  </button>
                </>
              )}

              {nothingFound && (
                <p className="px-4 py-6 text-center text-sm text-gray-400">
                  Nothing matches “{query}”.
                </p>
              )}
            </div>
          </div>
        </div>,
        document.body,
      )
    : null;

  return (
    <>
      {/* Hugs its content rather than filling its container — the old fixed
          width left "Filter" floating in a box four times its length. Capped so
          a long name cannot push the month off the header instead; past the cap
          the name truncates. */}
      <button
        type="button"
        title={isFiltered ? undefined : "Ask TT"}
        className={
          isFiltered
            ? "inline-flex max-w-[17rem] items-center gap-1.5 rounded border border-gray-300 px-2.5 py-1 text-left"
            : // TT's pill: rounded, on a faint wash of its own gradient, so it
              // reads as somebody to talk to and not as one more form control.
              "inline-flex items-center rounded-full border border-emerald-200 bg-gradient-to-r from-emerald-50 to-violet-50 py-0.5 pl-0.5 pr-3 text-left shadow-sm transition-shadow hover:shadow"
        }
        onClick={() => setOpen(true)}
      >
        <span className="min-w-0">{triggerContent}</span>
        {isFiltered && <span className="flex-shrink-0 text-xs text-gray-400">▾</span>}
      </button>

      {modal}
    </>
  );
};

export default CalendarFilterPicker;
