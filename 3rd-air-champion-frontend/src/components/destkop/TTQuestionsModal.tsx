import { ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { format, parseISO } from "date-fns";
import { CategoryGroup, fetchTTQuestions, QuestionSpan, TTQuestionStats } from "../../util/ttQuestionLog";
import type { TTCategory } from "../../util/askTT";

// What guests have asked TiBook's TT — the screen the host asked for to see
// what TT should learn next. "Not answered" opens first, because it is the
// to-do list: each line there is a question a guest had to take to the host
// instead. "Answered" shows where guests' attention goes.

// TT's topics, in the host's words.
const CATEGORY_LABEL: Record<TTCategory, string> = {
  availability: "Dates & availability",
  wishList: "Wish list",
  rooms: "Rooms",
  reviews: "Reviews",
  checkIn: "Check-in & arrival",
  parking: "Parking",
  cancellation: "Cancellation",
  price: "Price",
  kitchen: "Kitchen",
  bathroom: "Bathroom",
  amenities: "Amenities",
  houseRules: "House rules",
  location: "Location & getting here",
  contactHost: "Reaching the host",
  booking: "How to book",
  myBookings: "Their own bookings",
  greeting: "Hello",
  thanks: "Thanks",
  privacy: "Turned down for privacy",
  other: "Not recognised",
};

const SPANS: { key: QuestionSpan; label: string }[] = [
  { key: "week", label: "7 days" },
  { key: "month", label: "30 days" },
  { key: "year", label: "12 months" },
  { key: "all", label: "All time" },
];

// One measure across the categories, not a series — so one quiet hue, the
// same slate the visitors screen gives its continent bars.
const BAR = "#64748b";

const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

interface TTQuestionsModalProps {
  onClose: () => void;
  // Viewer mode: a guest the host gave the stats code to, reading from TiBook.
  // The same code opens the visitor numbers, and `switcher` goes across to
  // them. The questions are the same ones the host sees — already scrubbed of
  // numbers, emails and links when they were stored, and tied to no guest.
  viewer?: { name: string; load: (span: QuestionSpan) => Promise<TTQuestionStats>; switcher?: ReactNode };
}

const TTQuestionsModal = ({ onClose, viewer }: TTQuestionsModalProps) => {
  const [span, setSpan] = useState<QuestionSpan>("month");
  const [stats, setStats] = useState<TTQuestionStats | null>(null);
  const [error, setError] = useState("");
  const [pile, setPile] = useState<"unanswered" | "answered">("unanswered");
  const [only, setOnly] = useState<TTCategory | null>(null);

  // Only the newest request may fill the screen: tapping "7 days" then "All
  // time" quickly would otherwise show whichever answer arrived LAST, under
  // whichever pill is lit.
  const latest = useRef(0);
  const load = useCallback(() => {
    const ticket = ++latest.current;
    setError("");
    (viewer ? viewer.load(span) : fetchTTQuestions(span))
      .then((s) => {
        if (ticket === latest.current) setStats(s);
      })
      .catch(() => {
        if (ticket === latest.current) setError("The questions didn't load. Check the connection and try again.");
      });
  }, [span]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    load();
  }, [load]);

  const groups: CategoryGroup[] = stats ? stats[pile].categories : [];
  const max = Math.max(1, ...groups.map((g) => g.count));
  const shown = only ? groups.filter((g) => g.category === only) : groups;

  const choosePile = (p: typeof pile) => {
    setPile(p);
    setOnly(null);
  };

  return (
    <div
      className="modal-type fixed inset-0 z-[300] flex items-center justify-center bg-black/50 p-3"
      onClick={onClose}
    >
      <div
        className="flex max-h-[88vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <div>
            <h2 className="text-base font-bold text-gray-900">💬 TT questions</h2>
            <p className="text-xs text-gray-500">
              {viewer
                ? `Shared with you${viewer.name ? `, ${viewer.name},` : ""} by TT House to help develop TiBook`
                : "What guests ask TT in TiBook, and what it couldn't answer"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-xl leading-none text-gray-400 hover:bg-gray-100"
          >
            &times;
          </button>
        </div>
        {viewer?.switcher}

        <div className="flex flex-wrap gap-0.5 border-b border-gray-100 bg-gray-50 px-2 py-2 sm:gap-1 sm:px-3">
          {SPANS.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setSpan(s.key)}
              aria-pressed={s.key === span}
              className={`shrink-0 rounded-lg px-2 py-1 text-sm font-semibold whitespace-nowrap transition-colors sm:px-3 ${
                s.key === span ? "bg-white text-gray-900 shadow-sm ring-1 ring-gray-200" : "text-gray-500 hover:bg-gray-200"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
          {error ? (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <p className="text-sm text-gray-600">{error}</p>
              <button
                type="button"
                onClick={load}
                className="rounded-lg bg-gray-800 px-4 py-1.5 text-sm font-semibold text-white hover:bg-gray-900"
              >
                Try again
              </button>
            </div>
          ) : !stats ? (
            <p className="py-10 text-center text-sm text-gray-500">Loading…</p>
          ) : stats.total === 0 ? (
            <p className="py-10 text-center text-sm text-gray-500">
              Nobody has asked TT anything in this span yet. Questions appear here as guests ask them.
            </p>
          ) : (
            <>
              {/* The two piles are also the switch between them: the number
                  and the list it opens are the same thing. */}
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-xl border border-gray-200 px-3 py-2">
                  <p className="text-xs text-gray-500">Asked</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
                  <p className="text-[11px] text-gray-500">
                    {stats.fromReturning > 0 ? `${stats.fromReturning} by returning guests` : "all by new guests"}
                  </p>
                </div>
                {(["unanswered", "answered"] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => choosePile(p)}
                    aria-pressed={pile === p}
                    className={`rounded-xl border px-3 py-2 text-left transition-colors ${
                      pile === p ? "border-gray-800 bg-gray-50 ring-1 ring-gray-800" : "border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    <p className="text-xs text-gray-500">{p === "unanswered" ? "⚠️ Not answered" : "✓ Answered"}</p>
                    <p className="text-2xl font-bold text-gray-900">{stats[p].count}</p>
                    <p className="text-[11px] text-gray-500">{pct(stats[p].count, stats.total)}% of questions</p>
                  </button>
                ))}
              </div>

              <h3 className="mt-5 mb-2 text-xs font-semibold tracking-wide text-gray-500 uppercase">
                {pile === "unanswered" ? "What TT couldn't answer, by topic" : "What TT answered, by topic"}
              </h3>
              {groups.length === 0 ? (
                <p className="text-sm text-gray-500">
                  {pile === "unanswered" ? "TT answered every question in this span." : "Nothing answered in this span."}
                </p>
              ) : (
                <ul className="space-y-1">
                  {groups.map((g) => (
                    <li key={g.category}>
                      {/* A row is a filter: tap a topic to see only its
                          questions below, tap again to see them all. */}
                      <button
                        type="button"
                        onClick={() => setOnly(only === g.category ? null : g.category)}
                        aria-pressed={only === g.category}
                        title={`${CATEGORY_LABEL[g.category]}: ${g.count} question${g.count === 1 ? "" : "s"}`}
                        className={`grid w-full grid-cols-[9.5rem_1fr_2.5rem] items-center gap-2 rounded-lg px-1.5 py-1 text-left text-sm hover:bg-gray-50 ${
                          only === g.category ? "bg-gray-100" : ""
                        }`}
                      >
                        <span className="truncate text-gray-700">{CATEGORY_LABEL[g.category]}</span>
                        <span className="h-3 overflow-hidden rounded-r bg-gray-100">
                          <span
                            className="block h-full rounded-r"
                            style={{ width: `${(g.count / max) * 100}%`, background: BAR }}
                          />
                        </span>
                        <span className="text-right font-semibold text-gray-900 tabular-nums">{g.count}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {shown.length > 0 && (
                <>
                  <h3 className="mt-5 mb-2 text-xs font-semibold tracking-wide text-gray-500 uppercase">
                    The questions{only ? ` — ${CATEGORY_LABEL[only]}` : ""}
                  </h3>
                  <div className="space-y-3">
                    {shown.map((g) => (
                      <div key={g.category}>
                        {!only && <p className="mb-1 text-xs font-semibold text-gray-700">{CATEGORY_LABEL[g.category]}</p>}
                        <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200">
                          {g.questions.map((q) => (
                            <li key={q.question + q.lastAsked} className="flex items-start gap-2 px-3 py-2 text-sm">
                              <span className="min-w-0 flex-1 break-words text-gray-800">“{q.question}”</span>
                              <span className="shrink-0 text-right text-[11px] text-gray-500">
                                {q.count > 1 && <span className="mr-1 font-semibold text-gray-700">×{q.count}</span>}
                                {format(parseISO(q.lastAsked), "MMM d")}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default TTQuestionsModal;
