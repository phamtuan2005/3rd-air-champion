/**
 * A sofa bed to make up for the arriving stay.
 *
 * Beside the headcount, because it answers the same question — what does this
 * room need doing to it — but louder, because it is the one that makes extra
 * WORK. A sofa bed nobody mentions is a bed nobody makes, and the cleaner
 * finds out from the guest standing in the doorway.
 *
 * Shared between TiWork (the cleaner's own rota) and TiMag's Hours queue, so a
 * cleaner and the host are never looking at different accounts of the same
 * morning.
 */
const SofaBedTag = ({ on }: { on?: boolean }) => {
  if (!on) return null;
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-xs font-bold text-violet-700">
      <span aria-hidden>🛋</span>
      sofa bed
    </span>
  );
};

export default SofaBedTag;
