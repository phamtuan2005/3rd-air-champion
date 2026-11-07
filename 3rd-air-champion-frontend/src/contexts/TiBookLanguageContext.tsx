import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { format } from "date-fns";
import { de as deLocale, zhCN as zhLocale } from "date-fns/locale";
import { DE } from "../i18n/de";
import { ZH } from "../i18n/zh";

/*
 * The language TiBook talks to the guest in: English, German for the German
 * guests the house has started to see, or Simplified Chinese.
 *
 * Keyed by the ENGLISH sentence rather than by an id. The English is what
 * every comment in this codebase argues about, and a component that reads
 * t("Your bookings") still says what it says to anybody reading the code. A
 * sentence with no translation yet falls back to its English, so a new line
 * added in a hurry shows up in English rather than as a key or a blank.
 *
 * Only what the GUEST reads goes through here. Anything TiBook sends on — a
 * booking request, a message to the host, a wish list texted over, a question
 * logged for TiMag — stays English, because the host reads it in English.
 */
export type LangName = "en" | "de" | "zh";

const LANG_KEY = "tiBookLang";

// Module-level so plain helpers (a label builder, a date line) can translate
// without being handed the context. Components still call useTiBookLang(): that
// subscription is what re-renders them when the guest switches language.
let current: LangName = "en";

const readStored = (): LangName | null => {
  // Private Safari throws on access; that guest just gets the device's language.
  try {
    const v = localStorage.getItem(LANG_KEY);
    return v === "de" || v === "zh" || v === "en" ? v : null;
  } catch {
    return null;
  }
};

/*
 * The language a device's own settings ask for.
 *
 * Chinese must come BEFORE English in the list, unlike German: plenty of guests
 * in Silicon Valley run an English phone with Chinese added as a second
 * language, and they did not ask for TiBook to change on them.
 *
 * Traditional settings (Taiwan, Hong Kong, Macau) start in English: TiBook's
 * Chinese is Simplified, and it is the guest's to choose under Look → Language
 * rather than ours to assume.
 */
export const langOfDevice = (langs: readonly (string | undefined)[]): LangName => {
  if (langs.some((l) => /^de\b/i.test(l ?? ""))) return "de";
  const first = langs.find((l) => /^(?:en|zh)\b/i.test(l ?? "")) ?? "";
  return /^zh\b/i.test(first) && !/^zh-(?:hant|tw|hk|mo)\b/i.test(first) ? "zh" : "en";
};

/*
 * A guest who never chose starts in the language their phone is set to — a
 * German phone opens TiBook in German without the guest having to find the
 * switch. A guest's own choice beats this, as it does for the look.
 */
const startingLang = (): LangName => {
  const stored = readStored();
  if (stored) return stored;
  return langOfDevice(typeof navigator === "undefined" ? [] : navigator.languages?.length ? navigator.languages : [navigator.language]);
};

const fill = (s: string, vars?: Record<string, string | number>) =>
  vars ? s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : s;

const DICTIONARY: Partial<Record<LangName, Record<string, string>>> = { de: DE, zh: ZH };

/** The guest's sentence in their language. `{name}` slots are filled from vars. */
export const t = (en: string, vars?: Record<string, string | number>) =>
  fill(DICTIONARY[current]?.[en] ?? en, vars);

/*
 * German writes the day before the month ("3. Nov.", not "Nov 3") and the
 * clock in 24 hours, so a pattern is swapped, not just its names. Only display
 * patterns are listed; one that is not — "yyyy-MM-dd" above all, the key every
 * stored date is — goes through unchanged and comes out byte for byte the same.
 */
const DE_PATTERNS: Record<string, string> = {
  "d EEE": "EEE d.",
  "d MMM": "d. MMM",
  "EEE d MMM": "EEE d. MMM",
  "EEE MMM d": "EEE d. MMM",
  "EEE, MMM d": "EEE, d. MMM",
  "EEE, MMM d · h:mma": "EEE, d. MMM · HH:mm",
  "EEE, MMM d yyyy": "EEE, d. MMM yyyy",
  "EEE, MMMM d yyyy": "EEE, d. MMMM yyyy",
  "EEEE, MMM d": "EEEE, d. MMM",
  "EEEE, MMMM d": "EEEE, d. MMMM",
  "EEEE, MMMM d, yyyy": "EEEE, d. MMMM yyyy",
  "M/d/yyyy": "d.M.yyyy",
  "M/d": "d.M.",
  "MMM d EEE": "EEE d. MMM",
  "MMM d": "d. MMM",
  "MMM d, yyyy": "d. MMM yyyy",
  "MMMM d": "d. MMMM",
  "MMMM d, yyyy": "d. MMMM yyyy",
  "h:mm a": "HH:mm",
  "h:mma": "HH:mm",
  "h a": "H 'Uhr'",
  "ha": "H 'Uhr'",
};

/*
 * Chinese runs largest to smallest ("2026年11月3日 周二") with the clock in 24
 * hours. These are not optional like German's: date-fns' zh-CN names the month
 * "11月" with no day beside it, so "MMM d" left alone reads "11月 3". As above,
 * a pattern not listed — the "yyyy-MM-dd" keys above all — passes through.
 */
const ZH_PATTERNS: Record<string, string> = {
  "d EEE": "d日 EEE",
  "d MMM": "M月d日",
  "EEE d MMM": "M月d日 EEE",
  "EEE MMM d": "M月d日 EEE",
  "EEE MMM d, yyyy": "yyyy年M月d日 EEE",
  "EEE, MMM d": "M月d日 EEE",
  "EEE, MMM d · h:mma": "M月d日 EEE · HH:mm",
  "EEE, MMM d yyyy": "yyyy年M月d日 EEE",
  "EEE, MMMM d yyyy": "yyyy年M月d日 EEE",
  "EEEE, MMM d": "M月d日 EEEE",
  "EEEE, MMMM d": "M月d日 EEEE",
  "EEEE, MMMM d, yyyy": "yyyy年M月d日 EEEE",
  "M/d/yyyy": "yyyy/M/d",
  "MMM d EEE": "M月d日 EEE",
  "MMM d": "M月d日",
  "MMM d, yyyy": "yyyy年M月d日",
  "MMMM": "M月",
  "MMMM d": "M月d日",
  "MMMM d, yyyy": "yyyy年M月d日",
  "MMMM yyyy": "yyyy年M月",
  "h:mm a": "HH:mm",
  "h:mma": "HH:mm",
  "h a": "H点",
  "ha": "H点",
};

/**
 * A date as the guest reads it. Use this, not date-fns `format`, for anything
 * shown on screen — and keep `format` for keys and for text sent to the host.
 */
export const fmtDate = (date: Date | number, pattern: string) =>
  current === "de"
    ? format(date, DE_PATTERNS[pattern] ?? pattern, { locale: deLocale })
    : current === "zh"
      ? format(date, ZH_PATTERNS[pattern] ?? pattern, { locale: zhLocale })
      : format(date, pattern);

/** For toLocaleString / Intl calls that build guest-facing text. */
export const localeTag = () => (current === "de" ? "de-DE" : current === "zh" ? "zh-CN" : "en-US");

export const currentLang = () => current;

const TiBookLanguageContext = createContext<{ lang: LangName; setLang: (l: LangName) => void }>({
  lang: "en",
  setLang: () => {},
});

export const TiBookLanguageProvider = ({ children }: { children: ReactNode }) => {
  const [lang, setLangState] = useState<LangName>(() => (current = startingLang()));
  // Set during render, not in an effect: the children render in this same pass
  // and must already read the new language, or the first frame after a switch
  // would be in the old one.
  current = lang;

  useEffect(() => {
    // Screen readers and the browser's own "translate this page?" offer read it.
    // zh-Hans rather than zh: phones pick their Chinese glyphs from this, and a
    // bare "zh" can draw Simplified text in a Traditional font.
    const prev = document.documentElement.lang;
    document.documentElement.lang = lang === "zh" ? "zh-Hans" : lang;
    return () => { document.documentElement.lang = prev; };
  }, [lang]);

  const value = useMemo(() => ({
    lang,
    setLang: (next: LangName) => {
      current = next;
      setLangState(next);
      try {
        localStorage.setItem(LANG_KEY, next);
      } catch {
        // Private browsing: kept for this visit, asked of the phone next time.
      }
    },
  }), [lang]);

  return <TiBookLanguageContext.Provider value={value}>{children}</TiBookLanguageContext.Provider>;
};

/*
 * Every component that shows the guest words calls this, even one that only
 * uses the module-level t(): calling it is what re-renders the component when
 * the language changes. A component that forgets keeps its old language until
 * something else re-renders it.
 */
export const useTiBookLang = () => {
  const { lang, setLang } = useContext(TiBookLanguageContext);
  return { lang, setLang, t, fmtDate, localeTag };
};
