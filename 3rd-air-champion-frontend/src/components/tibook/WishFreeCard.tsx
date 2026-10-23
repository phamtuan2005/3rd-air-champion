import { parseISO } from "date-fns";
import { useTiBookTheme, useRoomChip } from "../../contexts/TiBookThemeContext";
import { useTiBookLang } from "../../contexts/TiBookLanguageContext";
import { roomType } from "../../util/types/roomType";

export interface FreeWishNight {
  night: string; // yyyy-MM-dd
  rooms: roomType[];
}

// "A night you wished for is free." The other half of the backend's wish-list
// job (jobs/wishListNotify.ts), which tells the guest in their chat and points
// them here: the chat says "tap Book it", and this is Book it.
//
// It used to take the host noticing the free night in TiMag and texting, and
// then the guest finding the night on the calendar themselves. Book it puts the
// nights into the request in one tap; the guest still reads it and sends it.
const WishFreeCard = ({
  nights,
  onBook,
  onClose,
}: {
  nights: FreeWishNight[];
  onBook: () => void;
  onClose: () => void;
}) => {
  const { theme } = useTiBookTheme();
  const roomChip = useRoomChip();
  const { t, fmtDate } = useTiBookLang();

  return (
    <div className={`tibook-type fixed inset-0 z-[130] flex items-center justify-center ${theme.scrim} p-4`} onClick={onClose}>
      {/* Bounded with only the list scrolling, as ReservedHoldsPopup: a long
          wish list must not push Book it off the screen. */}
      <div
        className={`flex max-h-[85dvh] w-full max-w-sm flex-col overflow-hidden rounded-2xl ${theme.surface} shadow-2xl`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`flex shrink-0 items-start justify-between gap-2 border-b ${theme.surfaceBorder} px-4 py-3`}>
          <p className={`text-sm font-bold ${theme.surfaceText}`}>
            <span style={{ color: "#fbbf24" }}>★</span>{" "}
            {nights.length === 1 ? t("A night you wished for is free") : t("Nights you wished for are free")}
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("Close")}
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xl leading-none ${theme.surfaceMuted} ${theme.chromeHover}`}
          >
            &times;
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-3 pt-3">
          <div className="flex flex-col gap-2">
            {nights.map(({ night, rooms }) => (
              <div key={night} className={`flex items-center justify-between gap-2 rounded-xl border ${theme.surfaceBorder} px-3 py-2`}>
                <span className={`text-sm font-semibold ${theme.surfaceText}`}>{fmtDate(parseISO(night), "EEE MMM d")}</span>
                <span className="flex flex-wrap justify-end gap-1">
                  {rooms.map((r) => (
                    <span key={r.id} className={`${roomChip(r)} rounded-lg px-2 py-0.5 text-xs font-bold text-black`}>
                      {r.name}
                    </span>
                  ))}
                </span>
              </div>
            ))}
          </div>
          {/* What will happen, so the guest knows why to tap now rather than later. */}
          <p className={`mt-3 text-xs leading-relaxed ${theme.surfaceText3}`}>
            {t("Rooms go to whoever asks first. Book it puts these nights into your request — you check it and send it.")}
          </p>
        </div>

        <div className={`shrink-0 border-t ${theme.surfaceBorder} px-4 pb-4 pt-3`}>
          <button
            type="button"
            onClick={onBook}
            className={`w-full rounded-lg ${theme.btn} ${theme.btnHover} py-2.5 text-sm font-bold text-white`}
          >
            {t("Book it")}
          </button>
          <button
            type="button"
            onClick={onClose}
            className={`mt-2 w-full rounded-lg border ${theme.line} py-2 text-sm font-semibold ${theme.surfaceMuted} ${theme.chromeHover}`}
          >
            {t("Not now")}
          </button>
        </div>
      </div>
    </div>
  );
};

export default WishFreeCard;
