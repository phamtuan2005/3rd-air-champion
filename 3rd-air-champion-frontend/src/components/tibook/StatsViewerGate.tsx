import { useEffect, useState } from "react";
import { useTiBookTheme } from "../../contexts/TiBookThemeContext";
import TiBookVisitorsModal from "../destkop/TiBookVisitorsModal";
import TTQuestionsModal from "../destkop/TTQuestionsModal";
import { fetchTiBookStatsAsViewer, formatStatsCode, ViewerStats } from "../../util/tibookVisitOperations";
import { fetchTTQuestionsAsViewer } from "../../util/ttQuestionLog";

// Where a guest the host gave access to reads TiBook's visitor numbers, and
// what guests asked its TT:
// /book?stats, with the code TiMag gave them.
//
// Reached by the link the host sends and nothing else — there is no button for
// it in TiBook, because it is for one or two people helping develop the site,
// not for guests. The code is the proof (see tibookStatsViewerRoute); TiBook's
// idea of who a guest is, a phone number anyone can type, plays no part.
//
// The code is remembered on this device so the link opens straight to the
// numbers next time, and forgotten when the server says it no longer works.
const CODE_KEY = "tiBookStatsCode";
const readCode = () => {
  try {
    return localStorage.getItem(CODE_KEY) ?? "";
  } catch {
    return "";
  }
};
const saveCode = (code: string) => {
  try {
    if (code) localStorage.setItem(CODE_KEY, code);
    else localStorage.removeItem(CODE_KEY);
  } catch {
    // Not remembered: they type it again next time.
  }
};

const StatsViewerGate = ({ hostFirstName, onClose }: { hostFirstName: string; onClose: () => void }) => {
  const { theme } = useTiBookTheme();
  const [code, setCode] = useState(readCode);
  const [draft, setDraft] = useState("");
  const [stats, setStats] = useState<ViewerStats | null>(null);
  const [state, setState] = useState<"idle" | "checking">("idle");
  const [error, setError] = useState("");
  // The one code opens two screens: TiBook's visitor numbers and what guests
  // asked its TT. Both help develop TiBook, which is what the host gave it for.
  const [view, setView] = useState<"visitors" | "tt">("visitors");

  // Under each screen's header, the way across to the other. Wrapping pills,
  // like the spans below it, so neither is cut off on a 360px phone.
  //
  // Greys, not theme tokens, unlike the rest of TiBook: it sits inside the
  // TiMag modals (TiBookVisitorsModal, TTQuestionsModal), which are white and
  // grey in every look. A Neon token here would be a dark pill on a white card.
  const switcher = (
    <div className="flex gap-1 border-b border-gray-100 px-3 pt-2 pb-2" role="tablist">
      {(
        [
          ["visitors", "📈 Visitors"],
          ["tt", "💬 TT questions"],
        ] as const
      ).map(([key, label]) => (
        <button
          key={key}
          type="button"
          role="tab"
          aria-selected={view === key}
          onClick={() => setView(key)}
          className={`rounded-full px-3 py-1 text-sm font-semibold transition-colors ${
            view === key ? "bg-gray-800 text-white" : "text-gray-600 hover:bg-gray-100"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );

  const tryCode = (c: string) => {
    if (!c.trim()) return;
    setState("checking");
    setError("");
    fetchTiBookStatsAsViewer(c)
      .then((s) => {
        saveCode(c);
        setCode(c);
        setStats(s);
      })
      .catch((e: Error) => {
        // Only a "no" from the server forgets the code. A dropped connection
        // says nothing about it — the TiWork lesson.
        if (e.message === "wrong") {
          saveCode("");
          setCode("");
          setError(
            c === readCode() || !draft
              ? `That code doesn't work any more. Ask ${hostFirstName} for a new one.`
              : "That code isn't right. Check it and try again.",
          );
        } else if (e.message === "slow") {
          setError("Too many tries. Wait a few minutes and try again.");
        } else {
          setError("Couldn't reach TT House. Check the connection and try again.");
        }
      })
      .finally(() => setState("idle"));
  };

  // A remembered code goes straight through.
  useEffect(() => {
    if (code) tryCode(code);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (stats && view === "tt") {
    return (
      <TTQuestionsModal
        onClose={onClose}
        viewer={{ name: stats.viewer, load: (span) => fetchTTQuestionsAsViewer(code, span), switcher }}
      />
    );
  }

  if (stats) {
    return (
      <TiBookVisitorsModal
        onClose={onClose}
        viewer={{
          name: stats.viewer,
          // The modal re-asks on "Try again"; the stats already loaded are
          // handed over first so it does not ask twice on the way in.
          load: (() => {
            let first: ViewerStats | null = stats;
            return () => {
              if (first) {
                const s = first;
                first = null;
                return Promise.resolve(s);
              }
              return fetchTiBookStatsAsViewer(code);
            };
          })(),
          onForget: () => {
            saveCode("");
            onClose();
          },
          switcher,
        }}
      />
    );
  }

  return (
    <div className={`tibook-type fixed inset-0 z-[130] flex items-end justify-center sm:items-center ${theme.scrim}`} onClick={onClose}>
      <div
        className={`w-full rounded-t-2xl border p-5 shadow-2xl sm:max-w-sm sm:rounded-2xl ${theme.surface} ${theme.surfaceBorder}`}
        onClick={(e) => e.stopPropagation()}
      >
        <p className={`text-base font-bold ${theme.surfaceText}`}>📈 TiBook numbers</p>
        <p className={`mt-1 text-sm ${theme.surfaceMuted}`}>
          Enter the access code {hostFirstName} sent you.
        </p>
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            tryCode(draft);
          }}
        >
          <input
            autoFocus
            value={draft}
            // Dashes go in by themselves and the code stops at its length
            // (formatStatsCode). Deleting is read from the input event, or a
            // shorter value where the browser does not say.
            onChange={(e) => {
              const type = (e.nativeEvent as InputEvent).inputType ?? "";
              setDraft(formatStatsCode(e.target.value, type.startsWith("delete") || e.target.value.length < draft.length));
            }}
            inputMode="text"
            placeholder="XXXX-XXXX-XXXX"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            // 16px: below that iOS zooms in on focus and stays zoomed.
            className={`min-w-0 flex-1 rounded-lg border px-3 py-2 font-mono text-[16px] tracking-wider ${theme.field} ${theme.fieldFocus}`}
          />
          <button
            type="submit"
            disabled={!draft.trim() || state === "checking"}
            className={`shrink-0 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-40 ${theme.btn} ${theme.btnHover}`}
          >
            {state === "checking" ? "Checking…" : "Open"}
          </button>
        </form>
        {state === "checking" && !draft && <p className={`mt-2 text-sm ${theme.surfaceMuted}`}>Opening the numbers…</p>}
        {error && <p className={`mt-2 text-sm font-semibold ${theme.alertText}`}>{error}</p>}
        <button type="button" onClick={onClose} className={`mt-4 text-sm font-semibold ${theme.surfaceMuted} ${theme.mutedHover}`}>
          Back to TiBook
        </button>
      </div>
    </div>
  );
};

export default StatsViewerGate;
