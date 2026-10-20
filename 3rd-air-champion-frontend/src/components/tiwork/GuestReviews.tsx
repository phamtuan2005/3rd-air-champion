import { useState } from "react";
import type { CleanerPraise, CleanerReview } from "../../util/workOperations";

// What guests said about rooms this cleaner prepared (Anh-Tri for the house,
// 2026-10-16: show the cleaners their work is not unnoticed). Amber, the
// colour of a star: the teal block on a visit is the HOUSE speaking about it;
// this is a GUEST, and the two should never be mistaken for each other.

const Stars = ({ n }: { n: number }) => (
  <span className="tracking-tight text-amber-500" aria-label={`${n} stars`}>
    {"★".repeat(n)}
    <span className="text-amber-200">{"★".repeat(Math.max(0, 5 - n))}</span>
  </span>
);

/*
 * The review with the words about the cleaner's work in bold — "spotless",
 * "fresh towels", "the bed was made". Those words are what connects a review
 * to the visit, so the cleaner should not have to hunt for them. Since
 * 2026-10-19 a good review without them is shown too, with nothing in bold.
 * Which words they are is the server's call (workWords in the backend); this
 * only finds them in the text.
 */
const WorkWords = ({ text, words }: { text: string; words: string[] }) => {
  if (!words.length) return <>{text}</>;
  const escaped = [...words].sort((a, b) => b.length - a.length).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const parts = text.split(new RegExp(`(${escaped.join("|")})`, "g"));
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <strong key={i} className="font-bold text-amber-950">
            {part}
          </strong>
        ) : (
          part
        ),
      )}
    </>
  );
};

/*
 * One review, shown under the room and morning of the clean it followed — so
 * it says neither; the visit row around it already does.
 *
 * There was also a card listing every review together, and it went: a list of
 * reviews apart from the work read as reviews in general, not as what came of
 * THIS clean of THIS room (Anh-Tri, 2026-10-16).
 */
export const ReviewQuote = ({ review }: { review: CleanerReview }) => {
  // Clamped to four lines: a long review is a wall on a phone, and the first
  // lines are where guests say what stayed with them.
  const [open, setOpen] = useState(false);
  const long = review.text.length > 220;
  return (
    <div className="w-full rounded-xl bg-amber-50 px-3 py-2">
      <p className="flex flex-wrap items-center gap-x-2 text-sm font-semibold text-amber-950">
        <Stars n={review.stars} />
        {/* The guest who stayed after the clean, by first name, as AirBnB
            shows them. Not "the next guest": a cleaner reads that as a
            stranger; a name is a person who slept in a room they made. */}
        <span>{review.guestFirstName || "A guest"}</span>
      </p>
      {/* Says which kind of review this is. Every good review of a stay they
          prepared is shown now (host, 2026-10-19), and one that never mentions
          the cleaning must not read as praise for it — it is a happy guest in
          a room they made ready, which is still worth knowing. */}
      <p className="text-xs font-semibold text-amber-700">
        {review.workWords.length ? "About your work" : "A guest enjoyed the stay you prepared"}
      </p>
      <p className={`mt-0.5 whitespace-pre-line text-sm text-amber-950/80 ${long && !open ? "line-clamp-4" : ""}`}>
        “<WorkWords text={review.text} words={review.workWords} />”
      </p>
      {long && (
        <button type="button" onClick={() => setOpen((o) => !o)} className="mt-0.5 text-xs font-bold text-amber-700">
          {open ? "Show less" : "Read all of it"}
        </button>
      )}
    </div>
  );
};

/*
 * The congratulation, when there has been a run of good reviews (the server
 * decides how many, and over how long). Said to the cleaner, in the second
 * person, with the number — "great work" alone is what an app says to
 * everyone; "4 guests in two months" is about them.
 *
 * At the TOP of the work screen. It started at the foot of the page under the
 * whole visit list, which a cleaner checking today's rooms never scrolls to —
 * acknowledgement nobody sees is not given. Its button takes them to the
 * visits the reviews are about.
 */
export const PraiseBanner = ({
  praise,
  firstName,
  onRead,
}: {
  praise: CleanerPraise;
  firstName: string;
  onRead: () => void;
}) => (
  <div className="rounded-3xl bg-gradient-to-br from-amber-300 via-amber-200 to-yellow-100 px-4 py-3 text-amber-950 shadow-lg shadow-amber-200/50">
    <p className="text-lg font-black leading-tight">🎉 Congratulations, {firstName}!</p>
    {/* Counts only reviews that praise the cleaning itself (praiseFor),
        so it says that rather than "4 or 5 stars" — a five-star stay is not
        by itself praise for the clean. */}
    <p className="mt-1 text-sm font-semibold">
      {praise.count} guests praised how you left their room in the last {Math.round(praise.days / 30)} months
      {praise.fiveStars === praise.count
        ? " — all with five stars"
        : praise.fiveStars > 0
          ? ` — ${praise.fiveStars} with five stars`
          : ""}
      .
    </p>
    <p className="mt-1 text-sm">Guests notice the care you put in, and so does the house. Thank you.</p>
    <button
      type="button"
      onClick={onRead}
      className="mt-2 rounded-full bg-white/70 px-4 py-1.5 text-sm font-bold text-amber-900 transition active:scale-95"
    >
      Read the reviews
    </button>
  </div>
);
