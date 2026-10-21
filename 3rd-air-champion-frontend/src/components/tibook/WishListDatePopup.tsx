import { useRef, useState } from "react";
import { useTiBookTheme } from "../../contexts/TiBookThemeContext";
import { useTiBookLang } from "../../contexts/TiBookLanguageContext";

interface WishListDatePopupProps {
  date: Date;
  // Takes the night off the SAVED wish list (the server), then off the screen.
  // Throws on failure, and the popup says so.
  onRemove: () => Promise<void>;
  onClose: () => void;
}

/*
 * A tap on a night already SAVED to the guest's wish list. It used to take
 * the night off the calendar at once, and only on the screen — the saved list
 * kept it, so the star came back on the next visit and the guest could not
 * tell what their tap had done (host, 2026-10-20: say it is on the wish list,
 * and ask whether to remove it or keep waiting).
 *
 * Keep waiting is the first and larger button: it is what a guest who has
 * starred a night most likely wants, and a stray tap must not cost them it.
 * Same promise as the booking request ("We'll let you know as soon as those
 * dates open up"), so the two never say different things.
 */
const WishListDatePopup = ({ date, onRemove, onClose }: WishListDatePopupProps) => {
  const { theme } = useTiBookTheme();
  const { t, fmtDate } = useTiBookLang();
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState("");
  // Guards the write itself, not just the button's look: a second tap lands
  // before the re-render that disables it.
  const inFlight = useRef(false);

  const remove = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setRemoving(true);
    setError("");
    try {
      await onRemove();
      onClose();
    } catch (e) {
      // The thrower writes its message in English, as a key: t() turns a known
      // one into German and lets an unknown one through as it is.
      setError(e instanceof Error && e.message ? t(e.message) : t("That didn't go through. Please try again."));
    } finally {
      inFlight.current = false;
      setRemoving(false);
    }
  };

  return (
    <div className={`tibook-type fixed inset-0 z-[130] flex items-center justify-center ${theme.scrim} p-4`} onClick={onClose}>
      <div
        className={`w-full max-w-xs overflow-hidden rounded-2xl ${theme.surface} shadow-2xl`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 px-4 pb-1 pt-3">
          <div className="min-w-0">
            <p className={`text-sm font-bold ${theme.textPrimary}`}>
              <span style={{ color: "#fbbf24" }}>★</span> {t("On your wish list")}
            </p>
            <p className={`text-xs ${theme.surfaceMuted}`}>{fmtDate(date, "EEEE, MMM d")}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("Close")}
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xl leading-none ${theme.surfaceMuted2} ${theme.surfaceHover2}`}
          >
            &times;
          </button>
        </div>

        <p className={`px-4 pt-1 text-sm ${theme.surfaceText3}`}>
          {t("This night is sold out, and it's saved on your wish list. We'll let you know as soon as a room opens up.")}
        </p>

        {error && <p className={`mx-4 mt-2 text-xs font-semibold ${theme.alertText}`}>{error}</p>}

        <div className="flex flex-col gap-1.5 px-4 pb-4 pt-3">
          <button
            type="button"
            onClick={onClose}
            className={`rounded-xl py-2.5 text-sm font-bold text-white ${theme.btn}`}
          >
            {t("Keep waiting")}
          </button>
          <button
            type="button"
            onClick={remove}
            disabled={removing}
            className={`rounded-xl border ${theme.line} py-2 text-sm font-semibold ${theme.surfaceText3} ${theme.chromeHover} disabled:opacity-50`}
          >
            {removing ? t("Removing…") : t("Remove from wish list")}
          </button>
        </div>
      </div>
    </div>
  );
};

export default WishListDatePopup;
