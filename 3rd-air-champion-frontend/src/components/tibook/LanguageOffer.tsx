import { useTiBookTheme } from "../../contexts/TiBookThemeContext";
import { useTiBookLang } from "../../contexts/TiBookLanguageContext";

/*
 * "要用中文浏览吗?" — asked once, of a guest whose phone lists Chinese, Korean,
 * Spanish or Vietnamese but who TiBook opened in English (see
 * languageToSuggest).
 *
 * Written in the OFFERED language, not through t(): t() speaks the page's
 * current language, which is English here, and the whole point is a guest who
 * reads English haltingly. The decline stays English — whoever taps it is
 * choosing to read English.
 *
 * Both buttons store a choice, so the offer never comes back; and a choice made
 * in the Look menu meanwhile puts it away too. Above the bottom bar, like the
 * wish-list Undo, so it never covers Request a Booking.
 */
const OFFER = {
  zh: { ask: "要用中文浏览 TiBook 吗？", yes: "切换到中文", tag: "zh-Hans" },
  // 을, not 를: TiBook ends on a consonant (북).
  ko: { ask: "TiBook을 한국어로 보시겠어요?", yes: "한국어로 보기", tag: "ko" },
  es: { ask: "¿Quieres ver TiBook en español?", yes: "Ver en español", tag: "es" },
  // "bạn", as the rest of TiBook's Vietnamese: never "quý khách" or "anh/chị".
  vi: { ask: "Bạn muốn xem TiBook bằng tiếng Việt không?", yes: "Xem bằng tiếng Việt", tag: "vi" },
} as const;

const LanguageOffer = () => {
  const { theme } = useTiBookTheme();
  const { suggestLang, setLang } = useTiBookLang();
  if (!suggestLang) return null;
  const offer = OFFER[suggestLang];
  return (
    <div className="tibook-type pointer-events-none fixed inset-x-0 bottom-24 z-[130] flex justify-center px-4">
      <div
        role="dialog"
        aria-label={offer.ask}
        className={`pointer-events-auto w-full max-w-sm rounded-2xl border ${theme.surface} ${theme.line} px-4 py-3 shadow-2xl`}
      >
        <p lang={offer.tag} className={`text-sm font-semibold ${theme.surfaceText}`}>
          🌐 {offer.ask}
        </p>
        <div className="mt-2.5 flex gap-2">
          <button
            type="button"
            lang={offer.tag}
            onClick={() => setLang(suggestLang)}
            className={`flex-1 rounded-full px-3 py-2 text-sm font-semibold text-white ${theme.btn}`}
          >
            {offer.yes}
          </button>
          <button
            type="button"
            lang="en"
            onClick={() => setLang("en")}
            className={`flex-1 rounded-full border px-3 py-2 text-sm font-semibold ${theme.chromeBorder} ${theme.surfaceText} ${theme.chromeHover}`}
          >
            Keep English
          </button>
        </div>
      </div>
    </div>
  );
};

export default LanguageOffer;
