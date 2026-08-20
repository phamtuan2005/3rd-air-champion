import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChatTurn, askTiMag } from "../../../util/aiOperations";

interface AskTiMagModalProps {
  token: string;
  onClose: () => void;
}

// What each tool is, said the way the host would say it. A waiting line that
// reads "get_calendar" tells him the machinery is working; one that reads
// "reading the calendar" tells him what it is working ON.
const TOOL_WORDS: Record<string, string> = {
  get_calendar: "reading the calendar",
  get_rooms: "checking the rooms",
  get_guests: "looking up guests",
  get_cleanings: "checking the cleaning rota",
};

// Openers, so the first use is not a blank box. Chosen to show what it can
// actually reach — the calendar, the guest list, the cleaning rota — rather
// than to be clever.
const STARTERS = [
  "Which rooms are empty this week?",
  "What am I owed right now, and by whom?",
  "Who is arriving tonight and how many guests?",
  "Which cleanings still have no hours recorded?",
];

/**
 * A conversation with somebody who can see the books.
 *
 * The model runs on the server with read-only tools over the real calendar,
 * rooms, guests and cleanings — so answers are looked up, not guessed. It
 * cannot change anything: no booking, unbooking, pricing or messaging. That is
 * a deliberate line, not a missing feature. A wrong sentence costs a
 * conversation; a wrong write costs a guest at a door at 1am, which this house
 * has already paid for once.
 */
const AskTiMagModal = ({ token, onClose }: AskTiMagModalProps) => {
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [doing, setDoing] = useState<string>("");
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement | null>(null);

  // Follow the conversation down as it grows, including while an answer is
  // being waited on — the "thinking" line is the thing worth seeing.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns, busy]);

  const send = async (text: string) => {
    const question = text.trim();
    if (!question || busy) return;
    const next: ChatTurn[] = [...turns, { role: "user", content: question }];
    setTurns(next);
    setDraft("");
    setError("");
    setDoing("");
    setBusy(true);
    try {
      // The whole history goes each time; the model keeps no memory of its own.
      const { reply } = await askTiMag(next, token, (tools) =>
        setDoing(tools.map((t) => TOOL_WORDS[t] ?? t).join(", ")),
      );
      setTurns([...next, { role: "assistant", content: reply }]);
    } catch (err) {
      // The question stays on screen. Losing what you typed because a server
      // was busy is its own small insult.
      setError(typeof err === "string" ? err : "Could not reach the assistant.");
    } finally {
      setBusy(false);
      setDoing("");
    }
  };

  return createPortal(
    <div
      className="modal-type fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="flex h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-2 border-b border-gray-100 px-4 py-3">
          <div>
            <h2 className="text-base font-bold text-gray-900">Ask TiMag</h2>
            <p className="text-xs text-gray-500">
              It reads your calendar, guests and cleanings. It changes nothing.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 px-1 text-xl leading-none text-gray-400 hover:text-gray-600"
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
          {turns.length === 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-gray-500">
                Ask about the house — occupancy, money, guests, cleanings. It looks the
                answer up rather than guessing, and says so when the books do not say.
              </p>
              {STARTERS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => send(s)}
                  className="rounded-xl border border-gray-200 px-3 py-2 text-left text-sm font-medium text-gray-700 hover:border-gray-400 hover:bg-gray-50"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {turns.map((t, i) => (
            <div
              key={i}
              className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                t.role === "user"
                  ? "self-end bg-gray-900 text-white"
                  : "self-start whitespace-pre-line border border-gray-200 bg-gray-50 text-gray-800"
              }`}
            >
              {t.content}
            </div>
          ))}

          {busy && (
            <div className="self-start rounded-2xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500">
              {/* Says what it is doing, and names the book it is in. Looking
                  things up takes real seconds, and a silent pause reads as a
                  hang — worse, it reads as a machine making something up. */}
              {doing ? `${doing}…` : "Thinking…"}
            </div>
          )}

          {error && (
            <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
              {error}
            </p>
          )}

          <div ref={bottomRef} />
        </div>

        <div className="shrink-0 border-t border-gray-100 p-3">
          <div className="flex items-end gap-2">
            <textarea
              autoFocus
              rows={2}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                // Enter sends, Shift+Enter breaks the line — the way every
                // messaging app the host uses already behaves.
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(draft);
                }
              }}
              placeholder="Ask about the house…"
              className="min-w-0 flex-1 resize-none rounded-xl border border-gray-300 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => send(draft)}
              disabled={busy || !draft.trim()}
              className="shrink-0 rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
            >
              Ask
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default AskTiMagModal;
