import { Fragment, ReactNode, useEffect, useRef, useState } from "react";
import { HiSparkles } from "react-icons/hi2";
import { useRoomChip, useTiBookTheme } from "../../contexts/TiBookThemeContext";
import { askTT, AskTTContext, TTAction, TTAnswer, ttStarters } from "../../util/askTT";
import { logTTQuestion } from "../../util/ttQuestionLog";

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

interface Turn {
  id: number;
  question: string;
  answer: TTAnswer;
}

interface AskTTSheetProps {
  ctx: AskTTContext;
  // Whose log the questions go to (ttQuestionLog).
  hostId: string;
  guestName?: string;
  // Each room's own colour, by room id, from the full room record. It comes in
  // beside `ctx` and not inside it: TTRoom is a whitelist on purpose
  // (toTTRoom's test pins its exact fields), and a colour is not worth
  // widening it for.
  roomColors?: Record<string, string | undefined>;
  onAction: (action: Exclude<TTAction, { kind: "ask" }>) => void;
  onClose: () => void;
}

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
const AskTTSheet = ({ ctx, hostId, guestName, roomColors, onAction, onClose }: AskTTSheetProps) => {
  const { theme } = useTiBookTheme();
  const roomChip = useRoomChip();
  const [draft, setDraft] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
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

  // `typed` is false for a suggestion the guest tapped. Only typed questions
  // are logged: a tap sends TT's own wording ("parking", "King reviews"), and
  // the host's screen is for what guests ask in THEIR words — the taps would
  // fill it with the buttons' layout instead.
  const ask = (question: string, typed = true) => {
    const q = question.trim();
    if (!q) return;
    const answer = askTT(q, ctx);
    setTurns((prev) => [...prev, { id: Date.now() + prev.length, question: q, answer }]);
    setDraft("");
    if (typed) logTTQuestion(hostId, q, answer, !!ctx.guest);
  };

  // The newest answer in view, as a chat thread would.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [turns.length]);

  const act = (a: TTAction) => (a.kind === "ask" ? ask(a.query, false) : onAction(a));

  const actionRow = (actions: TTAction[]) =>
    actions.length > 0 && (
      <div className="mt-2.5 flex flex-wrap gap-2">
        {actions.map((a, i) => (
          <button
            key={i}
            type="button"
            onClick={() => act(a)}
            className={
              // The step that changes something — picking nights — is solid in
              // the theme's colour. Everything else is TINTED in it: grey
              // outlines on a grey bubble read as part of the message, and the
              // house asked for TT's options to stand out (2026-10-06).
              // Tinted rather than solid still leaves the one that DOES
              // something the one that stands out most.
              a.kind === "pick"
                ? `rounded-full px-3.5 py-2 text-[13px] font-bold text-white shadow-sm ${theme.btn} ${theme.btnHover} ${theme.btnActive}`
                : `rounded-full border px-3.5 py-2 text-[13px] font-semibold shadow-sm transition-colors ${theme.tagBg} ${theme.selectedBorder} ${theme.tagText} ${theme.tileHover} ${theme.tileActive}`
            }
          >
            {chipify(a.label, true)}
          </button>
        ))}
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
                    Welcome back{first ? `, ${first}` : ""}! TT is your assistant. Tell me your dates and I'll set up
                    the request
                    {usualName ? (
                      <>
                        {" in "}
                        {/* The room as it is everywhere else in TiBook — its
                            coloured chip — so a guest knows it by sight. */}
                        {chipify(usualName)}
                        {", your usual room"}
                      </>
                    ) : null}
                    {" — you check it before it's sent."}
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
                    New to TT House? Ask me anything — the rooms, parking, check-in. When you're ready, tell me your
                    dates (“Oct 10-12”, “this weekend”) and I'll show you which rooms are free and pick them for you.
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
                  {actionRow(t.answer.actions)}
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
            placeholder="Ask about dates, rooms, parking…"
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
