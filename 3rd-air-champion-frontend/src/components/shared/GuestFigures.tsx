import { FaUser } from "react-icons/fa";

// Above this, a row of figures stops being countable at a glance and becomes a
// smear you have to read the number off anyway — so past it we show one figure
// and the count instead of pretending to draw them all.
const MAX_FIGURES = 6;

/**
 * How many guests arrive into a room after it is cleaned, drawn as people.
 *
 * One figure per person, counted before the words are read — a single icon
 * beside "2 guests" reads as an icon MEANING "guests" and leaves the number to
 * be noticed. Shared between TiWork (the cleaner's own rota) and TiMag's Hours
 * queue (the host reviewing their claim), so both are looking at one day rather
 * than two accounts of it.
 */
const GuestFigures = ({ n }: { n: number }) => {
  if (!n) return null;
  return (
    <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-600">
      <span className="inline-flex shrink-0 items-center gap-0.5 text-gray-500">
        {n <= MAX_FIGURES ? (
          Array.from({ length: n }, (_, i) => <FaUser key={i} size={11} className="shrink-0" />)
        ) : (
          <>
            <FaUser size={11} className="shrink-0" />
            <span className="text-xs font-bold">x{n}</span>
          </>
        )}
      </span>
      {n} {n === 1 ? "guest" : "guests"} arriving
    </span>
  );
};

export default GuestFigures;
