/**
 * The arriving guest asked to get in before the usual check-in time.
 *
 * Solid orange with white text rather than the orange-on-white line it used to
 * be. As a line of small coloured text under "Arrives Mon" it read as one more
 * detail about the arrival, and the host could look straight past it. That
 * matters because an early check-in moves the whole morning: the room has to be
 * cleaned first, so it changes the cleaning order (cleaningTasks puts it first)
 * and whoever cleans needs to know before they start.
 *
 * One component wherever TiMag shows the request, so the booking card, the
 * cleaning lists and the calendar all say it the same way and the host learns
 * one shape.
 *
 * `compact` is the calendar bar version: just the clock, sized to sit beside a
 * guest name in a tile, with the words in its tooltip.
 *
 * `label` lets TiWork say what to DO about it ("clean this room first") rather
 * than only naming the request. The host knows what an early check-in means
 * for the morning; the team should not have to work it out.
 *
 * `wrap` lets that longer label break onto two lines instead of running past
 * the edge of a narrow phone. It ran out of TiWork's room box as a pill that
 * could not shrink. Rounded corners rather than a full pill, because a
 * two-line pill looks like a lozenge with the text crammed into it.
 */
const EarlyCheckinTag = ({
  on,
  compact = false,
  label = "Early check-in",
  wrap = false,
}: {
  on?: boolean;
  compact?: boolean;
  label?: string;
  wrap?: boolean;
}) => {
  if (!on) return null;
  if (compact) {
    return (
      <span
        className="flex-shrink-0 rounded-full bg-orange-500 px-1 py-px text-[8px] font-bold leading-none text-white"
        title="Early check-in requested"
        aria-label="Early check-in requested"
      >
        ⏰
      </span>
    );
  }
  return (
    <span
      className={`inline-flex items-center gap-1 bg-orange-500 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-white ${
        wrap ? "max-w-full rounded-lg" : "shrink-0 rounded-full"
      }`}
    >
      <span aria-hidden>⏰</span>
      {label}
    </span>
  );
};

export default EarlyCheckinTag;
