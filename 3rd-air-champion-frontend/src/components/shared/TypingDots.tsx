interface TypingDotsProps {
  // The dot colour, as a Tailwind class. Passed in rather than themed here:
  // this bubble sits on a light sheet in TiMag and on a themed one in TiBook,
  // and a shared component that reached for TiBook's theme could not be used by
  // the other two apps.
  dotClass?: string;
  className?: string;
  // Named for a screen reader, which gets a sentence rather than three dots.
  label?: string;
}

/*
 * Three dots waving, for "the other person is writing".
 *
 * The wave itself is `tibook-typing-dot` in index.css, where the keyframes can
 * be turned off under prefers-reduced-motion — a Tailwind arbitrary animation
 * cannot carry that guard with it.
 */
const TypingDots = ({
  dotClass = "bg-gray-400",
  className = "",
  label = "Typing",
}: TypingDotsProps) => (
  <span className={`inline-flex items-center gap-1 ${className}`} role="status" aria-label={label}>
    <span className={`tibook-typing-dot h-1.5 w-1.5 rounded-full ${dotClass}`} />
    <span className={`tibook-typing-dot h-1.5 w-1.5 rounded-full ${dotClass}`} />
    <span className={`tibook-typing-dot h-1.5 w-1.5 rounded-full ${dotClass}`} />
  </span>
);

export default TypingDots;
