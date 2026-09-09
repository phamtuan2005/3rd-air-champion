import { useEffect, useRef, useState } from "react";
import { format, isValid } from "date-fns";
import { useTiBookTheme } from "../../contexts/TiBookThemeContext";
import {
  GuestMessage,
  fetchGuestThread,
  markGuestThreadRead,
  messageDate,
  sendGuestMessage,
} from "../../util/guestMessageOperations";

interface HostChatSheetProps {
  hostId: string;
  hostName: string;
  hostPhone?: string;
  savedPhone: string;
  savedName: string;
  // Called the first time a guest gives their number here, so the same
  // remember-me consent gate the booking flow uses gets its say. This sheet
  // deliberately does not write anything to storage itself.
  onIdentified: (phone: string, name: string) => void;
  onClose: () => void;
}

// While the sheet is open, look for a reply on this cadence. There is no socket
// in this app and a guest waiting on an answer should not have to close and
// reopen the sheet to find it; 15s is often enough to feel live and rare enough
// to be nothing next to the calendar fetches on the same screen.
const POLL_MS = 15000;

const HostChatSheet = ({
  hostId,
  hostName,
  hostPhone,
  savedPhone,
  savedName,
  onIdentified,
  onClose,
}: HostChatSheetProps) => {
  const { theme } = useTiBookTheme();

  const [phone, setPhone] = useState(savedPhone);
  const [name, setName] = useState(savedName);
  const [messages, setMessages] = useState<GuestMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  // A guest who has never given a number has no thread to load — they get the
  // short form first. Anyone we already greet by name goes straight to writing.
  const known = savedPhone.trim().length > 0;
  const [identified, setIdentified] = useState(known);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const sendingRef = useRef(false);

  const loadThread = (forPhone: string, quiet = false) => {
    if (!forPhone.trim()) return;
    if (!quiet) setLoading(true);
    fetchGuestThread(hostId, forPhone)
      .then((rows) => {
        setMessages(rows ?? []);
        // Opening the thread is reading it. Only clears the guest's own side —
        // the host's unread count is his to clear.
        return markGuestThreadRead(hostId, forPhone).catch(() => undefined);
      })
      .catch(() => {
        if (!quiet) setError("Could not load your messages just now.");
      })
      .finally(() => {
        if (!quiet) setLoading(false);
      });
  };

  useEffect(() => {
    if (!identified || !phone.trim()) return;
    loadThread(phone);
    const t = setInterval(() => loadThread(phone, true), POLL_MS);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identified, phone, hostId]);

  // Pin to the newest message whenever the list grows.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, loading]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleSend = async () => {
    const body = draft.trim();
    if (!body || sendingRef.current) return;

    const digits = phone.replace(/\D/g, "");
    if (digits.length < 7) {
      setError("A phone number lets him write back — please add yours.");
      return;
    }

    sendingRef.current = true;
    setSending(true);
    setError("");

    // Shown immediately under a temporary id, so the guest sees their message
    // land rather than watching a spinner decide whether it did. Replaced by
    // the saved row on the next load.
    const optimistic: GuestMessage = {
      id: `pending-${Date.now()}`,
      guestName: name.trim() || "Guest",
      guestPhone: phone,
      sender: "guest",
      body,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    setDraft("");

    try {
      await sendGuestMessage({
        host: hostId,
        guestName: name.trim() || "Guest",
        guestPhone: phone,
        body,
      });
      if (!identified) setIdentified(true);
      onIdentified(phone, name.trim());
      loadThread(phone, true);
    } catch {
      // Put it back in the box rather than losing what they wrote.
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setDraft(body);
      setError("That did not send. Your message is still here — try again?");
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  };

  const dayLabel = (ts: string) => {
    const d = messageDate(ts);
    return isValid(d) ? format(d, "EEE, MMM d · h:mma") : "";
  };

  return (
    <div className={`tibook-type fixed inset-0 z-[130] flex items-end justify-center sm:items-center ${theme.scrim}`}>
      <div
        className={`flex h-[85vh] w-full flex-col overflow-hidden rounded-t-2xl border shadow-2xl sm:h-[70vh] sm:max-w-md sm:rounded-2xl ${theme.surface} ${theme.surfaceBorder}`}
      >
        {/* Header */}
        <div className={`flex shrink-0 items-center gap-3 border-b px-4 py-3 ${theme.surfaceBorder}`}>
          <div className="relative shrink-0">
            <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border-2 border-green-500 bg-green-100">
              <img
                src={`/${hostName}.jpg`}
                alt={hostName}
                className="h-full w-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            </div>
            <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-green-500" />
          </div>
          <div className="min-w-0 flex-1">
            <p className={`truncate text-sm font-bold ${theme.surfaceText}`}>{hostName}</p>
            <p className={`text-[11px] leading-tight ${theme.surfaceMuted}`}>
              Your host. He reads these himself.
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

        {/* Thread */}
        <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
          {loading && messages.length === 0 && (
            <div className="flex items-center justify-center py-8">
              <span className={`h-5 w-5 animate-spin rounded-full border-2 ${theme.spinner}`} />
            </div>
          )}

          {!loading && messages.length === 0 && (
            <div className={`rounded-xl border p-3 ${theme.surfaceBorder} ${theme.surfaceSubtle}`}>
              <p className={`text-sm font-semibold ${theme.surfaceText}`}>
                Ask {hostName} anything about the house.
              </p>
              <p className={`mt-1 text-[12px] leading-snug ${theme.surfaceMuted}`}>
                Parking, the kitchen, a late arrival, what a room is really like — whatever you
                would like to know before you book. Your message goes straight to him and his reply
                comes back here.
              </p>
            </div>
          )}

          {messages.map((m) => {
            const mine = m.sender === "guest";
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div className="max-w-[80%]">
                  <div
                    className={
                      mine
                        ? `rounded-2xl rounded-br-sm px-3 py-2 text-sm text-white ${theme.btn}`
                        : `rounded-2xl rounded-bl-sm border px-3 py-2 text-sm ${theme.surfaceSubtle} ${theme.surfaceBorder} ${theme.surfaceText}`
                    }
                  >
                    <p className="whitespace-pre-wrap break-words">{m.body}</p>
                  </div>
                  {/* Who wrote it, on every bubble — the mirror of the label in
                      the host's inbox. Side and colour alone left people
                      scrolling a long thread unsure which words were theirs.
                      The host is named rather than called "Him": a guest who
                      has been writing to Anh-Tuan should see Anh-Tuan answer. */}
                  <p
                    className={`mt-0.5 text-[10px] ${theme.surfaceMuted} ${mine ? "text-right" : "text-left"}`}
                  >
                    <span className="font-semibold">
                      {mine ? "You" : hostName || "Your host"}
                    </span>
                    {" · "}
                    {m.id.startsWith("pending-") ? "Sending…" : dayLabel(m.createdAt)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Composer */}
        <div className={`shrink-0 border-t px-4 py-3 ${theme.surfaceBorder}`}>
          {!identified && (
            <div className="mb-2 flex gap-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                className={`min-w-0 flex-1 rounded-lg border px-2.5 py-1.5 text-sm ${theme.field} ${theme.fieldFocus}`}
              />
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                inputMode="tel"
                placeholder="Your phone"
                className={`min-w-0 flex-1 rounded-lg border px-2.5 py-1.5 text-sm ${theme.field} ${theme.fieldFocus}`}
              />
            </div>
          )}

          {error && <p className="mb-1.5 text-[11px] font-medium text-rose-500">{error}</p>}

          <div className="flex items-end gap-2">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                // Enter sends on a desktop keyboard; Shift+Enter makes a new
                // line. Left alone on touch, where Enter is how you get one.
                if (e.key === "Enter" && !e.shiftKey && window.matchMedia("(pointer: fine)").matches) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              rows={1}
              placeholder={`Write to ${hostName}…`}
              className={`max-h-28 min-h-[38px] flex-1 resize-y rounded-lg border px-2.5 py-2 text-sm ${theme.field} ${theme.fieldFocus}`}
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={sending || !draft.trim()}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold text-white transition-opacity ${theme.btn} ${theme.glow} ${
                sending || !draft.trim() ? "opacity-40" : ""
              }`}
            >
              {sending ? "Sending…" : "Send"}
            </button>
          </div>

          {hostPhone && (
            <p className={`mt-2 text-[11px] ${theme.surfaceMuted}`}>
              In a hurry?{" "}
              <a href={`tel:${hostPhone}`} className={`font-semibold underline ${theme.textPrimary}`}>
                Call {hostName}
              </a>{" "}
              or{" "}
              <a
                href={`sms:${hostPhone}?&body=${encodeURIComponent(`Hi ${hostName}, `)}`}
                className={`font-semibold underline ${theme.textPrimary}`}
              >
                text his phone
              </a>
              .
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default HostChatSheet;
