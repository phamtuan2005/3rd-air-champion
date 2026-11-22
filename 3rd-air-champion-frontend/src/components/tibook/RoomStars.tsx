import { useTiBookLang } from "../../contexts/TiBookLanguageContext";

// A room's reviews as five stars and a count — "★★★★★ 112 reviews" — on its
// card (host, 2026-11-21). Stars, NOT the number: the host asked for "*****"
// rather than "4.96 stars". The stars fill to the average, so a 4.5 room shows
// four and a half and the row stays honest without a figure beside it. A room
// with no starred reviews shows nothing — no stars is not zero stars.
//
// One component for the Hero card and the room's photo window, so the two can
// never show a room's reviews differently.
export interface RoomRating {
  average: number;
  count: number;
}

// `onOpen` makes the count a link to what the reviews say: a guest who sees
// "41 reviews" wants to read them (host, 2026-11-21). Absent, it is plain text.
const RoomStars = ({ rating, onOpen }: { rating?: RoomRating; onOpen?: () => void }) => {
  const { t } = useTiBookLang();
  if (!rating || !(rating.count > 0)) return null;
  const pct = Math.max(0, Math.min(100, (rating.average / 5) * 100));
  return (
    <span className="flex items-center gap-1.5" aria-label={`${rating.average} / 5`}>
      {/* Grey stars underneath, gold ones on top clipped to the average. */}
      <span className="relative inline-block text-sm leading-none tracking-tight" aria-hidden>
        <span className="text-white/35">★★★★★</span>
        <span className="absolute inset-y-0 left-0 overflow-hidden whitespace-nowrap text-amber-400" style={{ width: `${pct}%` }}>
          ★★★★★
        </span>
      </span>
      {onOpen ? (
        <button
          type="button"
          // The card and the photo window both act on a tap; this one is
          // the reviews', not theirs.
          onClick={(e) => { e.stopPropagation(); onOpen(); }}
          className="text-xs font-semibold text-white/90 underline decoration-white/50 underline-offset-2"
        >
          {rating.count === 1 ? t("1 review") : t("{n} reviews", { n: rating.count })}
        </button>
      ) : (
        <span className="text-xs font-semibold text-white/85">
          {rating.count === 1 ? t("1 review") : t("{n} reviews", { n: rating.count })}
        </span>
      )}
    </span>
  );
};

export default RoomStars;
