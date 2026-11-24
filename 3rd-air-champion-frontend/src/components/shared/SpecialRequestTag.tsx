/**
 * The host's own words about how a room must be made ready for the arriving
 * stay ("comforter cover free of detergent odor").
 *
 * Its own line, not a pill beside the headcount like the sofa bed: it is a
 * sentence, and a phone-width pill cut it off. Wraps instead.
 *
 * Shared by TiWork (the cleaner's rota) and TiMag's Hours queue and To Do, so
 * the host and the cleaner read the same request for the same morning. Added
 * 2026-11-24: the host had a guest's request and no way to put it in front of
 * the person preparing the room.
 */
// `room`: names the room the request is for. Wherever several rooms are listed
// one under another (TiWork's day, the Hours queue), a request without its
// room's name read as belonging to the room below it.
const SpecialRequestTag = ({ text, small, room }: { text?: string; small?: boolean; room?: string }) => {
  const t = (text ?? "").trim();
  if (!t) return null;
  return (
    <p
      className={`flex items-start gap-1.5 rounded-lg border border-teal-200 bg-teal-50 px-2 py-1 font-semibold text-teal-800 ${
        small ? "text-xs" : "text-sm"
      }`}
    >
      <span aria-hidden>📝</span>
      <span className="min-w-0 whitespace-pre-line break-words">
        {room && <span className="font-bold">{room}: </span>}
        {t}
      </span>
    </p>
  );
};

export default SpecialRequestTag;
