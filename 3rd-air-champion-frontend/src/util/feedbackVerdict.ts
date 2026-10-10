import type { FeedbackVerdict } from "./cleanerOperations";

// The three one-tap verdicts on a cleaning visit, as BOTH sides show them: the
// host picks one in TiMag's Clean screen, the cleaner reads the same words in
// TiWork. One list, so the two can never name a verdict differently.
export const VERDICT_OPTIONS: { key: Exclude<FeedbackVerdict, "">; label: string; emoji: string }[] = [
  { key: "great", label: "Great", emoji: "👍" },
  { key: "good", label: "Good", emoji: "👌" },
  { key: "fix", label: "Needs a fix", emoji: "🔧" },
];

export const verdictLabel = (v: FeedbackVerdict | undefined): string => {
  const o = VERDICT_OPTIONS.find((x) => x.key === v);
  return o ? `${o.emoji} ${o.label}` : "";
};
