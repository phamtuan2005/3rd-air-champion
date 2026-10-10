import { useRef, useState } from "react";
import { FeedbackVerdict, saveVisitFeedback, VisitFeedbackType } from "../../../util/cleanerOperations";
import { VERDICT_OPTIONS, verdictLabel } from "../../../util/feedbackVerdict";

// The house's word to a cleaner on one done visit, under that visit's row in
// Clean → Hours. The cleaner reads it in TiWork, on the same day.
//
// Asked for by Cindy (2026-10-09): a cleaner had no way to hear how a visit
// went. A line of its own under the row, not another button on it: the row
// already holds the day, the rooms, the hours and Edit, and a phone has no
// room for a fourth thing.
const VisitFeedback = ({
  hostId,
  token,
  cleanerId,
  cleanerName,
  date,
  feedback,
  onSaved,
}: {
  hostId: string;
  token: string;
  cleanerId: string;
  cleanerName: string;
  date: string;
  feedback: VisitFeedbackType | undefined;
  onSaved: (fb: VisitFeedbackType | null) => void;
}) => {
  const [open, setOpen] = useState(false);
  const [verdict, setVerdict] = useState<FeedbackVerdict>("");
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  // A second tap while the first save is in flight would send it twice.
  const busy = useRef(false);
  const first = cleanerName.trim().split(/\s+/)[0] || "the cleaner";

  const start = () => {
    setVerdict(feedback?.verdict ?? "");
    setText(feedback?.text ?? "");
    setError("");
    setOpen(true);
  };

  const save = async () => {
    if (busy.current) return;
    busy.current = true;
    setSaving(true);
    setError("");
    try {
      onSaved(await saveVisitFeedback({ host: hostId, date, cleaner: cleanerId, verdict, text: text.trim() }, token));
      setOpen(false);
    } catch (e: any) {
      setError(e?.response?.data?.error ?? "That didn't save. Check the connection and try again.");
    } finally {
      busy.current = false;
      setSaving(false);
    }
  };

  if (!open) {
    if (!feedback) {
      return (
        <button type="button" onClick={start} className="mt-1 text-xs font-semibold text-teal-700 hover:underline">
          + Feedback for {first}
        </button>
      );
    }
    return (
      <button type="button" onClick={start} className="mt-1 block w-full rounded-md text-left text-xs hover:bg-white">
        <span className="font-semibold text-gray-800">{verdictLabel(feedback.verdict) || "Feedback"}</span>
        {/* Whether the cleaner has read it yet — so nobody has to ask. */}
        <span className="text-gray-400"> · {feedback.seenAt ? `${first} has seen it` : `${first} hasn't seen it yet`}</span>
        {feedback.text && <span className="block whitespace-pre-line text-gray-600">{feedback.text}</span>}
      </button>
    );
  }

  return (
    <div className="mt-1.5 space-y-1.5 rounded-lg border border-gray-200 bg-white p-2">
      <p className="text-xs font-semibold text-gray-700">How did {first}'s visit go?</p>
      <div className="flex flex-wrap gap-1.5">
        {VERDICT_OPTIONS.map((o) => {
          const on = verdict === o.key;
          return (
            <button
              key={o.key}
              type="button"
              aria-pressed={on}
              // A second tap on the chosen one clears it: a comment needs no verdict.
              onClick={() => setVerdict(on ? "" : o.key)}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${
                on ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {o.emoji} {o.label}
            </button>
          );
        })}
      </div>
      <textarea
        rows={3}
        maxLength={1000}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={`What ${first} did well, and anything to fix — name the room: "Queen: mirror had streaks."`}
        className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm focus:border-gray-400 focus:outline-none"
      />
      {error && <p className="text-xs text-rose-600">{error}</p>}
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] text-gray-400">{first} sees this in TiWork, on this day.</p>
        <div className="flex shrink-0 gap-1.5">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-semibold text-gray-700"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="rounded-lg bg-gray-900 px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-40"
          >
            {saving ? "Saving…" : !verdict && !text.trim() && feedback ? "Remove" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default VisitFeedback;
