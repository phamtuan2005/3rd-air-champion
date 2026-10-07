import { Fragment, ReactNode, useEffect, useRef, useState } from "react";
import { HiSparkles } from "react-icons/hi2";
import { useRoomChip, useTiBookTheme } from "../../contexts/TiBookThemeContext";
import { askTT, AskTTContext, TTAction, TTBookingAction, TTBookingStart, ttStarters } from "../../util/askTT";
import { logTTQuestion } from "../../util/ttQuestionLog";
import {
  bookingRequestOf,
  chooseRoom,
  holidaysIn,
  maxGuestsOf,
  nextStep,
  phoneHint,
  phoneLooksReal,
  readContact,
  readParty,
  readYesNo,
  stayLine,
  summaryLines,
  TTBookingDraft,
  TTBookingRequest,
  TTBookingStep,
} from "../../util/ttBooking";
import { holidayLabel, usHolidayOn } from "../../util/usHolidays";
import { addDays, format, parseISO } from "date-fns";

// TT's mark, the same one TiMag's Ask TT wears: a sparkle on the
// emerald-to-violet gradient. Kept identical on purpose — TT is the house's
// assistant in both apps, and a guest who later meets the host's screen should
// recognise who they were talking to. Like a status chip it carries its own
// colours rather than the theme's, so it reads the same in every look.
const TTBadge = ({ box = "h-6 w-6", icon = 14 }: { box?: string; icon?: number }) => (
  <span
    aria-hidden
    className={`flex ${box} shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 via-blue-500 to-violet-500 text-white shadow-sm`}
  >
    <HiSparkles size={icon} />
  </span>
);

/*
 * Pointing TT out, once.
 *
 * A round sparkle in the corner of a booking page is, to somebody arriving for
 * the first time, decoration — the reason the Look menu grew its own nudge
 * (NavBarDesktop). So TT says what it is, once, under its own button:
 *
 *  - to somebody NEW, as the helper that walks them through booking — the
 *    house, the rooms, which nights are free, and how a request works;
 *  - to a guest coming BACK, as the quick way to book: say the dates, and the
 *    request is set up in their usual room.
 *
 * Two keys, so a guest who met TT as a stranger still hears the second
 * sentence the first time they come back as somebody TiBook knows.
 *
 * The Look nudge is held back while this one is up (see `ttNudgeActive`): two
 * callouts at once on a 360px nav bar cover each other and the guest reads
 * neither. TT goes first because it is the one that helps them book.
 */
export type TTNudge = "new" | "returning";
const nudgeKey = (n: TTNudge) => (n === "new" ? "tiBookTTHintSeen" : "tiBookTTReturningHintSeen");
const readNudgeSeen = (n: TTNudge) => {
  // Same reasoning as the Look nudge: storage that throws means "seen", so a
  // guest in private browsing gets a TiBook that renders, minus a nudge.
  try {
    return localStorage.getItem(nudgeKey(n)) === "1";
  } catch {
    return true;
  }
};
const markNudgeSeen = (n: TTNudge) => {
  try {
    localStorage.setItem(nudgeKey(n), "1");
  } catch {
    // It shows again next visit — harmless for a one-line nudge.
  }
};

// Whether TT's nudge is up or about to be, for the Look nudge to wait on.
let nudgeActive = false;
const nudgeDone = new Set<() => void>();
export const ttNudgeActive = () => nudgeActive;
export const onTTNudgeDone = (cb: () => void) => {
  nudgeDone.add(cb);
  return () => {
    nudgeDone.delete(cb);
  };
};
const finishNudge = () => {
  if (!nudgeActive) return;
  nudgeActive = false;
  nudgeDone.forEach((cb) => cb());
  nudgeDone.clear();
};

// The door to TT in the nav bar, in both layouts. A pill with the badge and
// the name, so it reads as somebody to talk to rather than one more control.
export const AskTTButton = ({
  onClick,
  nudge,
  guestFirstName,
  align = "center",
}: {
  onClick: () => void;
  // Which sentence this guest is owed, or nothing while a sheet owns the screen.
  nudge?: TTNudge | null;
  guestFirstName?: string;
  // Where the callout hangs from the button: centred in the stacked nav, where
  // TT sits mid-bar; from the right in Hero, where it sits near the edge and a
  // centred callout would run off the screen.
  align?: "center" | "right";
}) => {
  const { theme } = useTiBookTheme();
  const [showing, setShowing] = useState<TTNudge | null>(null);

  useEffect(() => {
    if (!nudge || readNudgeSeen(nudge)) return;
    // Claimed at once, so the Look nudge's own timer (1.2s) finds it taken.
    nudgeActive = true;
    // A beat after the page settles, so it reads as a nudge about the button
    // and not one more thing loading in.
    const t = setTimeout(() => setShowing(nudge), 800);
    return () => {
      clearTimeout(t);
      // A sheet took the screen before the guest answered: the callout steps
      // aside and comes back with the next render that owes it.
      setShowing(null);
      finishNudge();
    };
  }, [nudge]);

  const dismiss = () => {
    if (showing) markNudgeSeen(showing);
    setShowing(null);
    finishNudge();
  };

  const open = () => {
    dismiss();
    onClick();
  };

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={open}
        title="Ask TT"
        aria-label="Ask TT, your booking helper"
        className={`relative flex shrink-0 items-center gap-1 rounded-full border py-0.5 pl-0.5 pr-2.5 transition-colors ${theme.chromeBorder} ${theme.chromeHover} ${theme.chromeText}`}
      >
        {/* The same soft ring the Look nudge uses, only while TT's callout is
            up — and gone under prefers-reduced-motion, like that one. */}
        {showing && (
          <span
            aria-hidden
            className={`tibook-attention pointer-events-none absolute inset-0 rounded-full ${theme.btn} opacity-40`}
          />
        )}
        <span className="relative">
          <TTBadge />
        </span>
        <span className="relative text-xs font-extrabold tracking-wide">TT</span>
      </button>

      {showing && (
        <div
          role="note"
          className={`absolute top-full z-50 mt-2 w-60 rounded-2xl border p-3 shadow-xl ${theme.surface} ${theme.chromeBorder} ${
            align === "right" ? "right-0" : "left-1/2 -translate-x-1/2"
          }`}
        >
          <span
            aria-hidden
            className={`absolute -top-1.5 h-3 w-3 rotate-45 border-l border-t ${theme.surface} ${theme.chromeBorder} ${
              align === "right" ? "right-5" : "left-1/2 -ml-1.5"
            }`}
          />
          <div className="relative flex items-start gap-2">
            <TTBadge />
            <p className={`flex-1 text-xs leading-snug ${theme.surfaceText}`}>
              {showing === "new" ? (
                <>
                  <span className="font-bold">New here? Meet TT, your AI helper.</span> Ask about the rooms, parking
                  or your dates, and TT will walk you through booking.
                </>
              ) : (
                <>
                  <span className="font-bold">Welcome back{guestFirstName ? `, ${guestFirstName}` : ""}.</span> Tell
                  TT your dates and it sets up the request — in your usual room when it's free.
                </>
              )}
            </p>
            <button
              type="button"
              onClick={dismiss}
              aria-label="Dismiss"
              className={`shrink-0 text-sm leading-none ${theme.surfaceMuted} ${theme.mutedHover}`}
            >
              ×
            </button>
          </div>
          <button
            type="button"
            onClick={open}
            className={`relative mt-2 w-full rounded-full py-1.5 text-xs font-semibold text-white ${theme.btn} ${theme.btnHover} ${theme.glow}`}
          >
            {showing === "new" ? "Ask TT" : "Book with TT"}
          </button>
        </div>
      )}
    </div>
  );
};

interface Reply {
  lines: string[];
  actions: TTAction[];
}

interface Turn {
  id: number;
  question: string;
  answer: Reply;
  // Set on a turn that is a step of a booking: its booking buttons work only
  // while that booking is still at that step, so "Send" on a message the
  // conversation has moved past cannot send twice.
  stage?: { draftId: number; step: TTBookingStep };
}

// What happened to a request TT sent: really sent, or — on the dev server —
// only shown (ttBookingIsDryRun).
export type TTSendOutcome = "sent" | "dryRun";

interface AskTTSheetProps {
  ctx: AskTTContext;
  // Whose log the questions go to (ttQuestionLog).
  hostId: string;
  guestName?: string;
  // The number this device knows the guest by, so a returning guest is not
  // asked for it again. Shown back only as its last four digits.
  guestPhone?: string;
  // Files the request the same way the booking form does, or — in test mode —
  // does not. TiBook owns this, so remembering the guest afterwards happens
  // in the one place that already decides it (rememberOrAsk).
  onBook: (request: TTBookingRequest) => Promise<TTSendOutcome>;
  // Nothing TT sends reaches the host. Said in the header, on the Send
  // button, and in the reply, so a tester never wonders.
  testMode?: boolean;
  // Each room's own colour, by room id, from the full room record. It comes in
  // beside `ctx` and not inside it: TTRoom is a whitelist on purpose
  // (toTTRoom's test pins its exact fields), and a colour is not worth
  // widening it for.
  roomColors?: Record<string, string | undefined>;
  onAction: (action: Exclude<TTAction, { kind: "ask" | "book" | "booking" }>) => void;
  onClose: () => void;
}

const nightsAfter = (k: string) => format(addDays(parseISO(k), 1), "EEE MMM d");

// Nights written the way the date parser reads them ("10/10/2026, 10/11/2026"),
// to ask TT about them again. It does not read yyyy-MM-dd.
const asTyped = (dates: string[]) => dates.map((k) => format(parseISO(k), "M/d/yyyy")).join(", ");

// A holiday at either END of a stay can be left out and it is still one stay.
// One in the middle cannot — taking it out would split the stay in two — so
// for that the guest picks other dates instead.
const withoutEdgeHolidays = (dates: string[]) => {
  let from = 0;
  let to = dates.length;
  while (from < to && usHolidayOn(dates[from])) from++;
  while (to > from && usHolidayOn(dates[to - 1])) to--;
  return dates.slice(from, to);
};

/*
 * Ask TT, for guests.
 *
 * A conversation rather than a search box: a guest asks a question, and gets an
 * answer with the next step on a button under it — "Choose King" puts the
 * nights in their selection, "Message Anh-Tuan" opens the chat. The answer
 * never stops at telling the guest what to tap somewhere else (TIBOOK.md
 * rule 5).
 *
 * The thread lives only as long as the sheet is open. TT answers on this
 * phone, from what TiBook has already loaded. Each question is then logged for
 * the host — scrubbed, with whether TT could answer it — so the house can see
 * what TT should learn next; the footer tells the guest so.
 */
const AskTTSheet = ({ ctx, hostId, guestName, guestPhone, onBook, testMode, roomColors, onAction, onClose }: AskTTSheetProps) => {
  const { theme } = useTiBookTheme();
  const roomChip = useRoomChip();
  const [draft, setDraft] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  // The stay being booked in this conversation, if any (ttBooking.ts).
  const [booking, setBooking] = useState<TTBookingDraft | null>(null);
  const [sending, setSending] = useState(false);
  // The last answer asked for dates to BOOK ("I'd like to book" → "Tell me
  // your dates"), so the dates that come next are booked, not just checked.
  const [bookingAsked, setBookingAsked] = useState(false);
  const draftIds = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const host = ctx.hostFirstName;
  const first = (ctx.guest?.firstName || guestName || "").trim().split(/\s+/)[0];
  const usualName = ctx.rooms.find((r) => r.id === ctx.guest?.usualRoomId)?.name;

  // A room's name is its coloured chip wherever TT says it — the greeting, an
  // answer, a button — the same as everywhere else in TiBook, so a guest
  // knows the room by sight. Answers and labels are plain strings (askTT.ts
  // knows nothing of colour), so the names are found in the text here.
  // Case-sensitive on purpose: "King" is the room, "king-size" is a bed.
  const chipify = (text: string, compact = false): ReactNode => {
    const names = ctx.rooms.map((r) => r.name).filter(Boolean).sort((a, b) => b.length - a.length);
    if (names.length === 0) return text;
    const escaped = names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    // No lookbehind (older iPhones throw on that syntax and the sheet would
    // not open), so plain word boundaries.
    const parts = text.split(new RegExp(`\\b(${escaped.join("|")})\\b`));
    return parts.map((part, i) => {
      const room = i % 2 === 1 ? ctx.rooms.find((r) => r.name === part) : undefined;
      if (!room) return <Fragment key={i}>{part}</Fragment>;
      return (
        <span
          key={i}
          className={`${roomChip({ name: room.name, color: roomColors?.[room.id] })} rounded-lg font-bold text-black ${
            compact ? "px-1.5 py-px text-[11px]" : "px-2 py-0.5 text-[13px]"
          }`}
        >
          {room.name}
        </span>
      );
    });
  };

  const say = (question: string, answer: Reply, stage?: Turn["stage"]) =>
    setTurns((prev) => [...prev, { id: Date.now() + prev.length, question, answer, stage }]);

  // ── Booking, in the conversation ──────────────────────────────────────────
  //
  // TT asks for one missing thing at a time — how many guests, then who to
  // text — and then reads the whole request back. Nothing goes to the house
  // until the guest taps Send (or says "yes") on that read-back. The rules
  // are in ttBooking.ts; this is only the conversation around them.

  const roomOf = (id: string) => ctx.rooms.find((r) => r.id === id);
  const step = (do_: TTBookingAction, label: string): TTAction => ({ kind: "booking", label, step: do_ });

  const promptFor = (b: TTBookingDraft): Reply & { step: TTBookingStep } => {
    const s = nextStep(b);
    const room = roomOf(b.roomId)!;
    const cancel = step({ do: "cancel" }, "Start over");
    switch (s) {
      case "party": {
        const max = maxGuestsOf(room);
        return {
          step: s,
          lines: [`How many guests? ${room.name} sleeps up to ${max}.`],
          actions: [...Array.from({ length: max }, (_, i) => step({ do: "party", n: i + 1 }, i === 0 ? "Just me" : `${i + 1} guests`)), cancel],
        };
      }
      case "contact":
        return {
          step: s,
          lines: b.name.trim()
            ? [`What number should ${host} text about it, ${b.name.trim().split(/\s+/)[0]}?`]
            : [`Who should ${host} text about it? Type your name and phone number — like “Mai, 408 555 0123”.`],
          // Said before they type it: where the number goes, and that the
          // question log never sees it (this reply is not logged at all).
          actions: [cancel],
        };
      case "name":
        return { step: s, lines: ["And the name to put the request under?"], actions: [cancel] };
      case "holiday": {
        const hols = holidaysIn(b.dates);
        const trimmed = withoutEdgeHolidays(b.dates);
        const canDrop = trimmed.length > 0 && holidaysIn(trimmed).length === 0;
        return {
          step: s,
          lines: [
            `Heads up — your stay includes ${hols.map((k) => `${format(parseISO(k), "EEE MMM d")} (${holidayLabel(usHolidayOn(k)!)})`).join(", ")}, a US holiday. Do you mean to stay ${hols.length === 1 ? "that night" : "those nights"}?`,
          ],
          actions: [
            step({ do: "keepHolidays" }, hols.length === 1 ? "Yes, keep it" : "Yes, keep them"),
            ...(canDrop ? [step({ do: "dropHolidays" }, hols.length === 1 ? "Leave it out" : "Leave them out")] : []),
            cancel,
          ],
        };
      }
      case "confirm":
        return {
          step: s,
          lines: summaryLines(b, room, ctx),
          actions: [
            step({ do: "send" }, testMode ? "Send (test — nothing is sent)" : `Send to ${host}`),
            // "Oct 10-12" read as three nights; this is the two-night reading.
            ...(b.alt ? [step({ do: "alt" }, `I check out ${nightsAfter(b.alt[b.alt.length - 1])} instead`)] : []),
            ...(b.phone && b.phone === guestPhone ? [step({ do: "notMe" }, "Not me — change name or number")] : []),
            step({ do: "form" }, "Open in the booking form"),
            cancel,
          ],
        };
    }
  };

  // Moves the booking on one step and says the next thing TT needs.
  const advance = (b: TTBookingDraft, guestSaid: string, lead: string[] = []) => {
    setBooking(b);
    const p = promptFor(b);
    say(guestSaid, { lines: [...lead, ...p.lines], actions: p.actions }, { draftId: b.id, step: p.step });
  };

  // A new booking. What this device already knows about the guest is filled
  // in; a party size bigger than the room is asked again rather than kept.
  const begin = (start: TTBookingStart): TTBookingDraft => {
    const room = roomOf(start.roomId)!;
    draftIds.current += 1;
    return {
      id: draftIds.current,
      roomId: start.roomId,
      dates: start.dates,
      ...(start.alt ? { alt: start.alt } : {}),
      party: start.party != null && start.party <= maxGuestsOf(room) ? start.party : null,
      name: (guestName ?? "").trim(),
      phone: (guestPhone ?? "").trim(),
      holidaysKept: false,
    };
  };

  // A Book button: checked again first, since a room can go while the guest
  // reads (the answer was worked out when they asked, not when they tapped).
  const bookFrom = (a: Extract<TTAction, { kind: "book" }>) => {
    const room = roomOf(a.roomId);
    const label = a.label.replace(/\s*→$/, "");
    if (!room || chooseRoom(a.dates, ctx, room, null).kind !== "room") {
      say(label, {
        lines: [`${room?.name ?? "That room"} has just been taken for some of those nights. Here's what's free now:`, ...askTT(asTyped(a.dates), ctx).lines],
        actions: askTT(asTyped(a.dates), ctx, { booking: true }).actions,
      });
      return;
    }
    const b = begin({ roomId: a.roomId, dates: a.dates, party: a.party, alt: a.alt });
    advance(b, label, [`${room.name} — ${stayLine(b.dates)}.`]);
  };

  const finish = (guestSaid: string, reply: Reply) => {
    setBooking(null);
    say(guestSaid, reply);
  };

  const send = async (b: TTBookingDraft, guestSaid: string) => {
    if (sending) return;
    const room = roomOf(b.roomId)!;
    // Once more at the last moment: the house is booked by other people too.
    if (chooseRoom(b.dates, ctx, room, null).kind !== "room") {
      finish(guestSaid, {
        lines: [`${room.name} was taken for some of those nights while we talked — nothing was sent. Want to look at other rooms?`],
        actions: [{ kind: "ask", label: "What's free then?", query: `book ${asTyped(b.dates)}` }],
      });
      return;
    }
    const request = bookingRequestOf(b, room, hostId);
    setSending(true);
    try {
      const outcome = await onBook(request);
      if (outcome === "dryRun") {
        finish(guestSaid, {
          lines: [
            `🧪 Test mode — nothing was sent to ${host}. This is the request ${host} would have received:`,
            `Room: ${room.name}`,
            stayLine(b.dates),
            `Guests: ${request.numberOfGuests}`,
            `Name: ${request.guestName} · ${phoneHint(request.guestPhone)}`,
            `Note: ${request.notes}`,
          ],
          actions: [{ kind: "ask", label: "Try another booking", query: "I'd like to book" }],
        });
      } else {
        finish(guestSaid, {
          lines: [
            `Sent ✓ ${host} has your request for ${room.name} — ${stayLine(b.dates)}.`,
            `Nothing is booked until ${host} confirms — you'll hear back by text. It's under Your bookings in the meantime.`,
          ],
          actions: [{ kind: "bookings", label: "Open Your bookings" }],
        });
      }
    } catch {
      // Kept open on the same step, so Send works again from here.
      say(
        guestSaid,
        {
          lines: ["That didn't go through — the connection may have dropped. Nothing was sent."],
          actions: [step({ do: "send" }, "Try again"), { kind: "chat", label: `Message ${host}` }],
        },
        { draftId: b.id, step: "confirm" },
      );
    } finally {
      setSending(false);
    }
  };

  const onStep = (s: TTBookingAction, label: string) => {
    const b = booking;
    if (!b) return;
    switch (s.do) {
      case "party":
        return advance({ ...b, party: s.n }, label);
      case "keepHolidays":
        return advance({ ...b, holidaysKept: true }, label);
      case "dropHolidays": {
        const dates = withoutEdgeHolidays(b.dates);
        return advance({ ...b, dates, alt: undefined }, label, [`Done — ${stayLine(dates)}.`]);
      }
      case "alt":
        return b.alt ? advance({ ...b, dates: b.alt, alt: undefined, holidaysKept: false }, label, [`Got it — ${stayLine(b.alt)}.`]) : undefined;
      case "notMe":
        return advance({ ...b, name: "", phone: "" }, label);
      case "send":
        return void send(b, label);
      case "form":
        // The full form, with these nights already in it: for a guest who
        // wants to add a note or a second stay. TiBook opens it.
        setBooking(null);
        return onAction({ kind: "pick", label, dates: b.dates, roomId: b.roomId, review: true });
      case "cancel":
        return finish(label, {
          lines: ["No problem — nothing was sent. Tell me other dates whenever you like."],
          actions: [{ kind: "ask", label: "This weekend", query: "book this weekend" }],
        });
    }
  };

  // A TYPED reply while a booking is waiting on something. True when the
  // booking took it. These replies are never logged: they are a name, a
  // number, "2" — answers to TT, not questions for the house to learn from.
  const bookingTook = (q: string): boolean => {
    const b = booking;
    if (!b) return false;
    const s = nextStep(b);
    const room = roomOf(b.roomId)!;
    // "Cancel", "stop", "never mind" end the booking at any step. A QUESTION
    // about cancelling ("can I cancel later?") is still a question.
    if (!q.includes("?") && readYesNo(q) === "no") {
      onStep({ do: "cancel" }, q);
      return true;
    }
    // Details given before TT asked for them — a name and number while it
    // was asking how many — are taken, not misread: guests answer in the
    // order they think of things (found trying it, 2026-10-07).
    if (s === "party" && !q.includes("?")) {
      const c = readContact(q);
      if (phoneLooksReal(c.phone)) {
        advance({ ...b, phone: c.phone, name: c.name || b.name }, q, ["Thanks."]);
        return true;
      }
    }
    if (s === "party") {
      const n = readParty(q);
      if (n == null) return false;
      if (n < 1 || n > maxGuestsOf(room)) {
        const p = promptFor(b);
        say(q, { lines: [`${room.name} sleeps up to ${maxGuestsOf(room)}. For ${n}, ${host} can help split the party across two rooms.`], actions: [...p.actions, { kind: "chat", label: `Message ${host}` }] }, { draftId: b.id, step: s });
        return true;
      }
      advance({ ...b, party: n }, q);
      return true;
    }
    if ((s === "contact" || s === "name") && !q.includes("?")) {
      const c = readContact(q);
      if (s === "name") {
        if (!c.name) return false;
        advance({ ...b, name: c.name }, q);
        return true;
      }
      if (phoneLooksReal(c.phone)) {
        advance({ ...b, phone: c.phone, name: c.name || b.name }, q);
        return true;
      }
      if (c.name && !/\d/.test(q)) {
        advance({ ...b, name: c.name }, q, [`Thanks, ${c.name.split(/\s+/)[0]}.`]);
        return true;
      }
      if (/\d/.test(q)) {
        say(q, { lines: ["That number looks too short — type it with the area code, like 408 555 0123."], actions: promptFor(b).actions }, { draftId: b.id, step: s });
        return true;
      }
      return false;
    }
    if (s === "holiday" || s === "confirm") {
      const yn = readYesNo(q);
      if (yn === "no") {
        onStep({ do: "cancel" }, q);
        return true;
      }
      if (yn === "yes") {
        if (s === "holiday") advance({ ...b, holidaysKept: true }, q);
        else void send(b, q);
        return true;
      }
    }
    return false;
  };

  // `typed` is false for a suggestion the guest tapped. Only typed questions
  // are logged: a tap sends TT's own wording ("parking", "King reviews"), and
  // the host's screen is for what guests ask in THEIR words — the taps would
  // fill it with the buttons' layout instead.
  const ask = (question: string, typed = true) => {
    const q = question.trim();
    if (!q) return;
    setDraft("");
    if (typed && bookingTook(q)) return;
    const answer = askTT(q, ctx, { booking: bookingAsked });
    // Mid-booking, something TT cannot read is most likely an answer to its
    // own question in words it did not expect ("yes" to "how many guests?").
    // It asks again rather than dropping the booking for "I'm not sure I
    // understood that" — and does not log it: it was a reply, not a question.
    if (booking && answer.category === "other") {
      const p = promptFor(booking);
      say(q, { lines: ["Sorry, I didn't catch that.", ...p.lines], actions: p.actions }, { draftId: booking.id, step: p.step });
      return;
    }
    // "Book" with no dates yet: the next dates the guest gives are a booking.
    setBookingAsked(answer.category === "booking" && !answer.book && answer.actions.every((a) => a.kind !== "book"));
    if (typed) logTTQuestion(hostId, q, answer, !!ctx.guest);
    if (answer.book && roomOf(answer.book.roomId)) {
      // Asked to book, and one room is free for it: TT goes straight on to
      // what it still needs, in the same message.
      const b = begin(answer.book);
      advance(b, q, answer.lines);
      return;
    }
    say(q, { lines: answer.lines, actions: answer.actions });
  };

  // The newest answer in view, as a chat thread would.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [turns.length]);

  const act = (a: TTAction) => {
    if (a.kind === "ask") return ask(a.query, false);
    if (a.kind === "book") return bookFrom(a);
    if (a.kind === "booking") return onStep(a.step, a.label);
    onAction(a);
  };

  // A booking step's button is live only on the message that asked for it,
  // and only while the booking is still there.
  const live = (a: TTAction, stage?: Turn["stage"]) =>
    a.kind !== "booking" || (!sending && !!booking && !!stage && stage.draftId === booking.id && stage.step === nextStep(booking));

  const actionRow = (actions: TTAction[], stage?: Turn["stage"]) =>
    actions.length > 0 && (
      <div className="mt-2.5 flex flex-wrap gap-2">
        {actions.map((a, i) => {
          const on = live(a, stage);
          // The step that changes something — picking nights, booking,
          // sending — is solid in the theme's colour. Everything else is
          // TINTED in it: grey outlines on a grey bubble read as part of the
          // message, and the house asked for TT's options to stand out
          // (2026-10-06). Tinted rather than solid still leaves the one that
          // DOES something the one that stands out most.
          const primary = a.kind === "pick" || a.kind === "book" || (a.kind === "booking" && a.step.do === "send");
          return (
            <button
              key={i}
              type="button"
              disabled={!on}
              onClick={() => act(a)}
              className={`${
                primary
                  ? `rounded-full px-3.5 py-2 text-[13px] font-bold text-white shadow-sm ${theme.btn} ${theme.btnHover} ${theme.btnActive}`
                  : `rounded-full border px-3.5 py-2 text-[13px] font-semibold shadow-sm transition-colors ${theme.tagBg} ${theme.selectedBorder} ${theme.tagText} ${theme.tileHover} ${theme.tileActive}`
              } disabled:cursor-default disabled:opacity-40`}
            >
              {sending && a.kind === "booking" && a.step.do === "send" && booking && stage?.draftId === booking.id
                ? "Sending…"
                : chipify(a.label, true)}
            </button>
          );
        })}
      </div>
    );

  return (
    <div
      className={`tibook-type fixed inset-0 z-[130] flex items-end justify-center sm:items-center ${theme.scrim}`}
      onClick={onClose}
    >
      <div
        // dvh, not vh: on a phone vh is the height with the toolbar hidden, and
        // the input would sit under the keyboard and the toolbar together.
        className={`flex h-[85dvh] w-full flex-col overflow-hidden rounded-t-2xl border shadow-2xl sm:h-[70vh] sm:max-w-md sm:rounded-2xl ${theme.surface} ${theme.surfaceBorder}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`flex shrink-0 items-center gap-3 border-b px-4 py-3 ${theme.surfaceBorder}`}>
          <TTBadge box="h-9 w-9" icon={18} />
          <div className="min-w-0 flex-1">
            <p className={`text-sm font-bold ${theme.surfaceText}`}>Ask TT</p>
            <p className={`text-[11px] leading-tight ${theme.surfaceMuted}`}>
              TT House's assistant · answers from this page
            </p>
          </div>
          {/* Only on the dev server (ttBookingIsDryRun). A status chip, so it
              carries its own colours and reads the same in every look. */}
          {testMode && (
            <span
              title="Bookings made here are shown, not sent to the host"
              className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-900"
            >
              Test mode
            </span>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className={`rounded-full p-1.5 transition-colors ${theme.surfaceHover2} ${theme.surfaceMuted}`}
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
          {/* TT introduces itself in the words it uses in TiMag, to the guest
              by name when TiBook knows it. Always first in the thread, so it
              reads as the start of a conversation. */}
          <div className="flex justify-start">
            <div className={`max-w-[88%] rounded-2xl rounded-bl-sm border px-3 py-2 text-sm ${theme.surfaceSubtle} ${theme.surfaceBorder} ${theme.surfaceText}`}>
              {ctx.guest ? (
                <>
                  {/* A returning guest came to book, so TT says that it can,
                      and in which room, before anything else. */}
                  <p>
                    Welcome back{first ? `, ${first}` : ""}! TT is your assistant. Tell me your dates and I'll book
                    them
                    {usualName ? (
                      <>
                        {" in "}
                        {/* The room as it is everywhere else in TiBook — its
                            coloured chip — so a guest knows it by sight. */}
                        {chipify(usualName)}
                        {", your usual room"}
                      </>
                    ) : null}
                    {" — you check the request before it's sent."}
                  </p>
                  {ctx.guest.wishList.length > 0 && (
                    <p className={`mt-1 text-[12px] ${theme.surfaceMuted}`}>
                      You have {ctx.guest.wishList.length} night{ctx.guest.wishList.length === 1 ? "" : "s"} on your
                      wish list — I can check them all at once.
                    </p>
                  )}
                </>
              ) : (
                <>
                  <p>
                    Hello{first ? ` ${first}` : ""}, TT is your assistant. I will do my best to assist you. What can I
                    do for you today?
                  </p>
                  <p className={`mt-1 text-[12px] ${theme.surfaceMuted}`}>
                    New to TT House? Ask me anything — the rooms, parking, check-in. When you're ready, say “book
                    Oct 10-12” or “book this weekend for 2” and I'll book it for you. You see the whole request
                    before anything is sent.
                  </p>
                </>
              )}
              {turns.length === 0 && actionRow(ttStarters(ctx))}
            </div>
          </div>

          {turns.map((t) => (
            <div key={t.id} className="space-y-3">
              <div className="flex justify-end">
                <div className={`max-w-[80%] rounded-2xl rounded-br-sm px-3 py-2 text-sm text-white ${theme.btn}`}>
                  <p className="whitespace-pre-wrap break-words">{t.question}</p>
                </div>
              </div>
              <div className="flex justify-start">
                <div className={`max-w-[88%] rounded-2xl rounded-bl-sm border px-3 py-2 text-sm ${theme.surfaceSubtle} ${theme.surfaceBorder} ${theme.surfaceText}`}>
                  {t.answer.lines.map((line, i) => (
                    <p key={i} className={`whitespace-pre-wrap break-words ${i > 0 ? "mt-1" : ""}`}>
                      {chipify(line)}
                    </p>
                  ))}
                  {actionRow(t.answer.actions, t.stage)}
                </div>
              </div>
            </div>
          ))}

          {/* The house's promise, named as one — CLAUDE.md asks that it never
              be left to read as a promise to whoever happens to be reading. */}
          <p className={`pt-1 text-center text-[11px] ${theme.surfaceMuted}`}>
            “Your comfort. Our mission.” — TT House's promise to you
          </p>
          {/* Said before the first question, in a guest's terms: what is
              kept, what is not, and why. Phone numbers and emails are taken
              out before anything leaves the phone (ttQuestionLog). */}
          <p className={`text-center text-[11px] leading-snug ${theme.surfaceMuted}`}>
            Your questions are kept, without any phone number or email in them, so TT House can teach TT what guests
            ask.
          </p>
        </div>

        <form
          className={`flex shrink-0 items-center gap-2 border-t px-3 py-2.5 ${theme.surfaceBorder}`}
          onSubmit={(e) => {
            e.preventDefault();
            ask(draft);
          }}
        >
          <input
            autoFocus
            type="text"
            enterKeyHint="send"
            autoComplete="off"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={
              booking && nextStep(booking) === "contact"
                ? "Your name and phone number"
                : booking && nextStep(booking) === "name"
                  ? "Your name"
                  : "Ask, or say “book Oct 10-12”…"
            }
            // 16px on the field itself: below that, iOS Safari zooms the page
            // in on focus and leaves it zoomed after the keyboard goes.
            className={`min-w-0 flex-1 rounded-full border px-3.5 py-2 text-[16px] focus:outline-none ${theme.field} ${theme.fieldFocus}`}
          />
          <button
            type="submit"
            disabled={!draft.trim()}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold text-white disabled:opacity-40 ${theme.btn} ${theme.btnHover}`}
          >
            Ask
          </button>
        </form>
      </div>
    </div>
  );
};

export default AskTTSheet;
