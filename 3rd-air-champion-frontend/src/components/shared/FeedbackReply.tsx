import { useRef, useState } from "react";
import { replyToFeedback, WorkCreds } from "../../util/workOperations";

// The cleaner's answer to the house's feedback on one visit, in TiWork, under
// the feedback it answers.
//
// Asked for by the host (2026-10-15): "When the cleaner got a feedback,
// definitely they want to explain." A "Needs a fix" that asks "did you clean
// the bathroom next to Chill as well?" is a question, and before this the
// only way to answer it was a text message, away from the visit it was about.
// One reply, which they can change; Anh-Tuan and Cindy read it in TiMag under
// the feedback they wrote.
const FeedbackReply = ({
  creds,
  date,
  reply,
  onSaved,
}: {
  creds: WorkCreds;
  date: string;
  reply: string;
  onSaved: (reply: string) => void;
}) => {
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  // A second tap while the first send is in flight would send it twice.
  const busy = useRef(false);

  const send = async () => {
    if (draft === null || busy.current) return;
    busy.current = true;
    setSending(true);
    setError("");
    try {
      onSaved(await replyToFeedback(creds, date, draft.trim()));
      setDraft(null);
    } catch (e: any) {
      setError(e?.message || "That didn't send. Check the connection and try again.");
    } finally {
      busy.current = false;
      setSending(false);
    }
  };

  if (draft === null) {
    return reply ? (
      // Their reply, as sent. A tap opens it to change.
      <button
        type="button"
        onClick={() => setDraft(reply)}
        className="mt-2 block w-full rounded-lg border border-teal-200 bg-white px-2.5 py-1.5 text-left"
      >
        <span className="block text-xs font-semibold text-teal-800">Your reply</span>
        <span className="block whitespace-pre-line text-sm text-gray-700">{reply}</span>
      </button>
    ) : (
      <button
        type="button"
        onClick={() => setDraft("")}
        className="mt-2 rounded-lg border border-teal-300 bg-white px-3 py-1.5 text-sm font-semibold text-teal-800 active:scale-95"
      >
        Reply
      </button>
    );
  }

  return (
    <div className="mt-2 space-y-1.5">
      <textarea
        autoFocus
        rows={3}
        maxLength={1000}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="Your answer — what happened, anything they should know."
        // 16px: below that, a phone zooms the page in on focus.
        className="w-full rounded-lg border border-teal-200 bg-white px-2.5 py-2 text-[16px] focus:border-teal-400 focus:outline-none"
      />
      {error && <p className="text-xs text-rose-600">{error}</p>}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => {
            setDraft(null);
            setError("");
          }}
          className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-semibold text-gray-700"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={send}
          disabled={sending || (!draft.trim() && !reply)}
          className="rounded-lg bg-teal-700 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-40"
        >
          {sending ? "Sending…" : !draft.trim() && reply ? "Take back" : "Send"}
        </button>
      </div>
    </div>
  );
};

export default FeedbackReply;
