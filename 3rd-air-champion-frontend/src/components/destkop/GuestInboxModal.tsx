import { useEffect, useRef, useState } from "react";
import { format, isValid } from "date-fns";
import TypingDots from "../shared/TypingDots";
import {
  GuestMessage,
  GuestMessageThread,
  fetchHostThread,
  fetchHostThreads,
  markHostThreadRead,
  messageDate,
  pingHostTyping,
  replyToGuest,
} from "../../util/guestMessageOperations";

interface GuestInboxModalProps {
  hostId: string;
  token: string;
  onClose: () => void;
  // Lets the nav badge fall as threads are read, without waiting for its own
  // poll to come round again.
  onUnreadChange?: (total: number) => void;
}

// The inbox is open in front of someone who is answering guests, so it refreshes
// faster than the badge behind it does.
const POLL_MS = 20000;

// The typing bubble has its own, much faster clock — 20s is fine for "has a new
// question arrived", useless for "is she writing right now". Two booleans per
// call, and it doubles as this side's own ping.
const TYPING_MS = 2500;

// Whether to show read receipts, remembered per browser.
const RECEIPTS_KEY = "tiMagChatReceipts";

const readReceiptPref = (): boolean => {
  try {
    return localStorage.getItem(RECEIPTS_KEY) === "on";
  } catch {
    return false;
  }
};

const when = (ts: string) => {
  const d = messageDate(ts);
  return isValid(d) ? format(d, "MMM d · h:mma") : "";
};

const GuestInboxModal = ({ hostId, token, onClose, onUnreadChange }: GuestInboxModalProps) => {
  const [threads, setThreads] = useState<GuestMessageThread[]>([]);
  const [openPhone, setOpenPhone] = useState<string | null>(null);
  const [openName, setOpenName] = useState("");
  const [messages, setMessages] = useState<GuestMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const [guestTyping, setGuestTyping] = useState(false);
  const [receipts, setReceipts] = useState(readReceiptPref);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const sendingRef = useRef(false);
  // When the host last touched the reply box, so a half-written reply left on
  // screen stops showing the guest a bubble that never ends.
  const lastKeyRef = useRef(0);

  const loadThreads = (quiet = false) => {
    if (!quiet) setLoading(true);
    fetchHostThreads(hostId, token)
      .then((rows) => {
        setThreads(rows ?? []);
        onUnreadChange?.((rows ?? []).reduce((s, t) => s + (t.unreadForHost || 0), 0));
      })
      .catch(() => {
        if (!quiet) setError("Could not load messages.");
      })
      .finally(() => {
        if (!quiet) setLoading(false);
      });
  };

  useEffect(() => {
    loadThreads();
    const t = setInterval(() => loadThreads(true), POLL_MS);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hostId, token]);

  const openThread = (phone: string, name: string) => {
    setOpenPhone(phone);
    setOpenName(name);
    setMessages([]);
    fetchHostThread(hostId, phone, token)
      .then((rows) => {
        setMessages(rows ?? []);
        return markHostThreadRead(hostId, phone, token);
      })
      .then(() => loadThreads(true))
      .catch(() => setError("Could not open that conversation."));
  };

  // Keep the open conversation current too, so a guest replying while it is on
  // screen appears without the host reopening it.
  useEffect(() => {
    if (!openPhone) return;
    const t = setInterval(() => {
      fetchHostThread(hostId, openPhone, token)
        .then((rows) => setMessages(rows ?? []))
        .catch(() => {});
    }, POLL_MS);
    return () => clearInterval(t);
  }, [openPhone, hostId, token]);

  // Typing, both directions, while a conversation is open. Unconditional on
  // whether the host is writing: the same call reports him and answers with
  // her, so he sees her start even while he is only reading.
  useEffect(() => {
    if (!openPhone) return;
    const tick = () => {
      const typingNow = Date.now() - lastKeyRef.current < TYPING_MS * 2;
      pingHostTyping(hostId, openPhone, typingNow, token)
        .then((s) => setGuestTyping(s.guestTyping))
        .catch(() => {});
    };
    tick();
    const t = setInterval(tick, TYPING_MS);
    return () => {
      clearInterval(t);
      pingHostTyping(hostId, openPhone, false, token).catch(() => {});
      setGuestTyping(false);
    };
  }, [openPhone, hostId, token]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, guestTyping]);

  const send = async () => {
    const body = draft.trim();
    if (!body || !openPhone || sendingRef.current) return;
    sendingRef.current = true;
    setSending(true);
    setError("");

    const optimistic: GuestMessage = {
      id: `pending-${Date.now()}`,
      guestName: openName,
      guestPhone: openPhone,
      sender: "host",
      body,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    setDraft("");

    try {
      await replyToGuest(
        { host: hostId, guestName: openName, guestPhone: openPhone, body },
        token,
      );
      const rows = await fetchHostThread(hostId, openPhone, token);
      setMessages(rows ?? []);
      // The reply has landed, so this side has stopped typing. Cleared now
      // rather than left to expire, so the bubble goes as the message arrives.
      lastKeyRef.current = 0;
      pingHostTyping(hostId, openPhone, false, token).catch(() => {});
      loadThreads(true);
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setDraft(body);
      setError("That did not send. Your reply is still here.");
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  };

  const totalUnread = threads.reduce((s, t) => s + (t.unreadForHost || 0), 0);

  return (
    <div className="flex h-full flex-col bg-white">
      {/* Header */}
      <div className="flex shrink-0 items-center gap-2 border-b border-gray-200 px-4 py-3">
        {openPhone && (
          <button
            type="button"
            onClick={() => setOpenPhone(null)}
            className="rounded-full p-1 text-gray-500 hover:bg-gray-100"
            aria-label="Back to all messages"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-base font-bold text-gray-800">
            {openPhone ? openName || "Guest" : "Guest messages"}
          </h2>
          <p className="truncate text-xs text-gray-500">
            {openPhone
              ? openPhone
              : totalUnread > 0
                ? `${totalUnread} waiting for you`
                : "Questions from TiBook"}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full p-1.5 text-gray-500 hover:bg-gray-100"
          aria-label="Close"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {error && (
        <p className="shrink-0 bg-red-50 px-4 py-2 text-xs font-medium text-red-600">{error}</p>
      )}

      {/* Thread list */}
      {!openPhone && (
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="flex justify-center py-10">
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-blue-500" />
            </div>
          )}

          {!loading && threads.length === 0 && (
            <div className="px-4 py-10 text-center">
              <p className="text-sm font-semibold text-gray-700">No messages yet.</p>
              <p className="mt-1 text-xs text-gray-500">
                When a guest writes from TiBook, their question lands here.
              </p>
            </div>
          )}

          {threads.map((t) => (
            <button
              key={t.guestPhone}
              type="button"
              onClick={() => openThread(t.guestPhone, t.guestName)}
              className="flex w-full items-start gap-3 border-b border-gray-100 px-4 py-3 text-left transition-colors hover:bg-gray-50"
            >
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
                {(t.guestName || "?").slice(0, 2).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="truncate text-sm font-semibold text-gray-800">
                    {t.guestName || "Guest"}
                  </span>
                  {t.unreadForHost > 0 && (
                    <span className="rounded-full bg-yellow-400 px-1.5 text-[10px] font-bold text-gray-900">
                      {t.unreadForHost}
                    </span>
                  )}
                </span>
                <span className="mt-0.5 block truncate text-xs text-gray-500">
                  {t.lastSender === "host" ? "You: " : ""}
                  {t.lastBody}
                </span>
              </span>
              <span className="shrink-0 text-[10px] text-gray-400">{when(t.lastAt)}</span>
            </button>
          ))}
        </div>
      )}

      {/* One conversation */}
      {openPhone && (
        <>
          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
            {messages.map((m, i) => {
              const mine = m.sender === "host";
              // Only the newest of his own messages carries a receipt — one
              // under every bubble is a column of "Read" saying nothing extra.
              const lastMine = mine && !messages.slice(i + 1).some((x) => x.sender === "host");
              const pending = m.id.startsWith("pending-");
              return (
                <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                  <div className="max-w-[80%]">
                    <div
                      className={
                        mine
                          ? "rounded-2xl rounded-br-sm bg-blue-500 px-3 py-2 text-sm text-white"
                          : "rounded-2xl rounded-bl-sm border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800"
                      }
                    >
                      <p className="whitespace-pre-wrap break-words">{m.body}</p>
                    </div>
                    <p
                      className={`mt-0.5 text-[10px] text-gray-400 ${mine ? "text-right" : "text-left"}`}
                    >
                      {pending ? "Sending…" : when(m.createdAt)}
                      {receipts && lastMine && !pending && (
                        <span className={m.readByGuest ? "text-blue-500" : undefined}>
                          {" · "}
                          {m.readByGuest ? "Read" : "Sent"}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              );
            })}

            {/* She is writing. Sits where her next message will appear. */}
            {guestTyping && (
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-bl-sm border border-gray-200 bg-gray-50 px-3 py-2.5">
                  <TypingDots dotClass="bg-gray-400" label={(openName || "The guest") + " is typing"} />
                </div>
              </div>
            )}
          </div>

          <div className="shrink-0 border-t border-gray-200 px-4 py-3">
            <div className="flex items-end gap-2">
              <textarea
                value={draft}
                onChange={(e) => {
                  setDraft(e.target.value);
                  // Just a stamp; the ping rides the interval above.
                  lastKeyRef.current = Date.now();
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                rows={1}
                placeholder={`Reply to ${openName || "guest"}…`}
                className="max-h-28 min-h-[38px] flex-1 resize-y rounded-lg border border-gray-300 px-2.5 py-2 text-sm focus:border-blue-400 focus:outline-none"
              />
              <button
                type="button"
                onClick={send}
                disabled={sending || !draft.trim()}
                className={`shrink-0 rounded-full bg-blue-500 px-4 py-2 text-sm font-semibold text-white ${
                  sending || !draft.trim() ? "opacity-40" : "hover:bg-blue-600"
                }`}
              >
                {sending ? "Sending…" : "Send"}
              </button>
            </div>
            <label className="mt-2 flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={receipts}
                onChange={(e) => {
                  const on = e.target.checked;
                  setReceipts(on);
                  try {
                    localStorage.setItem(RECEIPTS_KEY, on ? "on" : "off");
                  } catch {
                    // The choice still holds for this session.
                  }
                }}
                className="h-3.5 w-3.5 shrink-0 cursor-pointer accent-blue-500"
              />
              <span className="text-[11px] leading-tight text-gray-500">
                Show me when the guest has read my replies
              </span>
            </label>
            <p className="mt-1.5 text-[11px] text-gray-400">
              Replies appear in the guest&apos;s TiBook, on the screen they wrote from.
            </p>
          </div>
        </>
      )}
    </div>
  );
};

export default GuestInboxModal;
