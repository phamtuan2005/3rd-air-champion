import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { format } from "date-fns";
import { de as deLocale, es as esLocale, ko as koLocale, vi as viLocale, zhCN as zhLocale } from "date-fns/locale";
import { DE } from "../i18n/de";
import { ZH } from "../i18n/zh";
import { KO } from "../i18n/ko";
import { ES } from "../i18n/es";
import { VI } from "../i18n/vi";

/*
 * The language TiBook talks to the guest in: English, German for the German
 * guests the house has started to see, Simplified Chinese, Korean, Spanish or
 * Vietnamese.
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
export type LangName = "en" | "de" | "zh" | "ko" | "es" | "vi";

const LANG_KEY = "tiBookLang";

// Module-level so plain helpers (a label builder, a date line) can translate
// without being handed the context. Components still call useTiBookLang(): that
// subscription is what re-renders them when the guest switches language.
let current: LangName = "en";

const readStored = (): LangName | null => {
  // Private Safari throws on access; that guest just gets the device's language.
  try {
    const v = localStorage.getItem(LANG_KEY);
    return v === "de" || v === "zh" || v === "ko" || v === "es" || v === "vi" || v === "en" ? v : null;
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
 *
 * Korean follows the Chinese rule for the same reason: a Korean-American guest
 * on an English phone with Korean added did not ask TiBook to change either.
 *
 * Spanish too, with the most reason of all: a great many Californians run an
 * English phone with Spanish added, read English every day, and would be
 * surprised to find a booking page switched under them. A phone with Spanish
 * first opens in Spanish; the rest are offered it (languageToSuggest).
 *
 * Vietnamese the same way: plenty of Vietnamese-American guests grew up here
 * on English phones with Vietnamese added for family. They are offered it,
 * never switched.
 */
export const langOfDevice = (langs: readonly (string | undefined)[]): LangName => {
  if (langs.some((l) => /^de\b/i.test(l ?? ""))) return "de";
  const first = langs.find((l) => /^(?:en|zh|ko|es|vi)\b/i.test(l ?? "")) ?? "";
  if (/^ko\b/i.test(first)) return "ko";
  if (/^es\b/i.test(first)) return "es";
  if (/^vi\b/i.test(first)) return "vi";
  return /^zh\b/i.test(first) && !/^zh-(?:hant|tw|hk|mo)\b/i.test(first) ? "zh" : "en";
};

/*
 * A guest who never chose starts in the language their phone is set to — a
 * German phone opens TiBook in German without the guest having to find the
 * switch. A guest's own choice beats this, as it does for the look.
 */
const deviceLangs = (): readonly string[] =>
  typeof navigator === "undefined" ? [] : navigator.languages?.length ? navigator.languages : [navigator.language];

const startingLang = (): LangName => {
  const stored = readStored();
  if (stored) return stored;
  return langOfDevice(deviceLangs());
};

/*
 * The language to OFFER a guest TiBook left in English.
 *
 * langOfDevice keeps an English phone with Chinese, Korean, Spanish or Vietnamese added in English
 * on purpose — those guests did not ask for the page to change. But they are
 * the guests most likely to want it, and the switch sits in a menu called
 * "Look", which nobody reading a second language would open to find it. So
 * TiBook asks them once, in their language, and the answer is theirs.
 *
 * Never once the guest has chosen (either answer is stored as a choice), and
 * never for German, which a German phone already opens in. A Traditional
 * Chinese phone is offered the Simplified text too: it reads it, and here,
 * unlike at start-up, it is the guest deciding rather than TiBook assuming.
 */
export type OfferedLang = "zh" | "ko" | "es" | "vi";
export const languageToSuggest = (langs: readonly (string | undefined)[], stored: LangName | null): OfferedLang | null => {
  if (stored || langOfDevice(langs) !== "en") return null;
  const other = langs.find((l) => /^(?:zh|ko|es|vi)\b/i.test(l ?? ""));
  return other ? (/^ko\b/i.test(other) ? "ko" : /^es\b/i.test(other) ? "es" : /^vi\b/i.test(other) ? "vi" : "zh") : null;
};

const fill = (s: string, vars?: Record<string, string | number>) =>
  vars ? s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : s;

const DICTIONARY: Partial<Record<LangName, Record<string, string>>> = { de: DE, zh: ZH, ko: KO, es: ES, vi: VI };

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

/*
 * Korean runs largest to smallest as well, but keeps its spaces and puts the
 * day of the week in brackets after the date — "11월 3일 (화)", as Korean
 * booking sites and phone calendars write it. Like Chinese, not optional:
 * date-fns' ko names the month "11월", so "MMM d" left alone reads "11월 3" with
 * no 일. The clock stays 12-hour with 오전/오후 in front, as Korean phones show it.
 */
const KO_PATTERNS: Record<string, string> = {
  "d EEE": "d일 (EEE)",
  "d MMM": "M월 d일",
  "EEE d MMM": "M월 d일 (EEE)",
  "EEE MMM d": "M월 d일 (EEE)",
  "EEE MMM d, yyyy": "yyyy년 M월 d일 (EEE)",
  "EEE, MMM d": "M월 d일 (EEE)",
  "EEE, MMM d · h:mma": "M월 d일 (EEE) · a h:mm",
  "EEE, MMM d yyyy": "yyyy년 M월 d일 (EEE)",
  "EEE, MMMM d yyyy": "yyyy년 M월 d일 (EEE)",
  "EEEE, MMM d": "M월 d일 EEEE",
  "EEEE, MMMM d": "M월 d일 EEEE",
  "EEEE, MMMM d, yyyy": "yyyy년 M월 d일 EEEE",
  "M/d/yyyy": "yyyy. M. d.",
  "MMM d EEE": "M월 d일 (EEE)",
  "MMM d": "M월 d일",
  "MMM d, yyyy": "yyyy년 M월 d일",
  "MMMM": "M월",
  "MMMM d": "M월 d일",
  "MMMM d, yyyy": "yyyy년 M월 d일",
  "MMMM yyyy": "yyyy년 M월",
  "h:mm a": "a h:mm",
  "h:mma": "a h:mm",
  "h a": "a h시",
  "ha": "a h시",
};

/*
 * Spanish puts the day first, as German does, with "de" between the parts of a
 * written-out date ("3 de noviembre de 2026"), and the names lowercase, as
 * Spanish writes them. The clock stays 12-hour: Spanish-speaking guests in
 * California and Mexico read "3:05 PM". "M/d" is left alone on purpose: the
 * date box reads a slash month first, and a page that showed "3/11" for the
 * 3rd of November would be read back as the 11th of March if typed.
 */
const ES_PATTERNS: Record<string, string> = {
  "d EEE": "EEE d",
  "EEE MMM d": "EEE d MMM",
  "EEE MMM d, yyyy": "EEE d MMM yyyy",
  "EEE, MMM d": "EEE, d MMM",
  "EEE, MMM d · h:mma": "EEE, d MMM · h:mm a",
  "EEE, MMM d yyyy": "EEE, d MMM yyyy",
  "EEE, MMMM d yyyy": "EEE, d 'de' MMMM 'de' yyyy",
  "EEEE, MMM d": "EEEE, d MMM",
  "EEEE, MMMM d": "EEEE, d 'de' MMMM",
  "EEEE, MMMM d, yyyy": "EEEE, d 'de' MMMM 'de' yyyy",
  "MMM d EEE": "EEE d MMM",
  "MMM d": "d MMM",
  "MMM d, yyyy": "d MMM yyyy",
  "MMMM d": "d 'de' MMMM",
  "MMMM d, yyyy": "d 'de' MMMM 'de' yyyy",
  "MMMM yyyy": "MMMM 'de' yyyy",
  "h:mma": "h:mm a",
};

/*
 * Vietnamese puts the day first too, and date-fns' vi names the month "tháng
 * 11" (short "thg 11"), so "MMM d" left alone would read "thg 11 3". The
 * weekday is the short form Vietnamese calendars print — "T3" for thứ Ba — and
 * the clock is 24-hour, as a Vietnamese phone shows it.
 *
 * Unlike Spanish, "M/d" IS turned round. A Vietnamese guest reads "3/11" as
 * the 3rd of November whatever the page does, so the date box on the
 * Vietnamese page reads a slash day first (parseDateText's `dayFirst`), and
 * the page shows slashes the same way: what is shown, typed back, is the same
 * night.
 */
const VI_PATTERNS: Record<string, string> = {
  "d EEE": "EEEEE, d",
  "d MMM": "d MMM",
  "EEE d MMM": "EEEEE, d MMM",
  "EEE MMM d": "EEEEE, d MMM",
  "EEE MMM d, yyyy": "EEEEE, d MMM, yyyy",
  "EEE, MMM d": "EEEEE, d MMM",
  "EEE, MMM d · h:mma": "EEEEE, d MMM · HH:mm",
  "EEE, MMM d yyyy": "EEEEE, d MMM, yyyy",
  "EEE, MMMM d yyyy": "EEEE, d MMMM, yyyy",
  "EEEE, MMM d": "EEEE, d MMM",
  "EEEE, MMMM d": "EEEE, d MMMM",
  "EEEE, MMMM d, yyyy": "EEEE, d MMMM, yyyy",
  "M/d/yyyy": "d/M/yyyy",
  "M/d": "d/M",
  "MMM d EEE": "EEEEE, d MMM",
  "MMM d": "d MMM",
  "MMM d, yyyy": "d MMM, yyyy",
  "MMMM d": "d MMMM",
  "MMMM d, yyyy": "d MMMM, yyyy",
  "MMMM yyyy": "MMMM 'năm' yyyy",
  "h:mm a": "HH:mm",
  "h:mma": "HH:mm",
  "h a": "H'h'",
  "ha": "H'h'",
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
      : current === "ko"
        ? format(date, KO_PATTERNS[pattern] ?? pattern, { locale: koLocale })
        : current === "es"
          ? format(date, ES_PATTERNS[pattern] ?? pattern, { locale: esLocale })
          : current === "vi"
            ? format(date, VI_PATTERNS[pattern] ?? pattern, { locale: viLocale })
            : format(date, pattern);

/** For toLocaleString / Intl calls that build guest-facing text. */
export const localeTag = () =>
  current === "de" ? "de-DE" : current === "zh" ? "zh-CN" : current === "ko" ? "ko-KR" : current === "es" ? "es-US" : current === "vi" ? "vi-VN" : "en-US";

export const currentLang = () => current;

const TiBookLanguageContext = createContext<{ lang: LangName; setLang: (l: LangName) => void; suggestLang: OfferedLang | null }>({
  lang: "en",
  setLang: () => {},
  suggestLang: null,
});

export const TiBookLanguageProvider = ({ children }: { children: ReactNode }) => {
  const [lang, setLangState] = useState<LangName>(() => (current = startingLang()));
  // Worked out once, on arrival. Gone the moment the guest picks a language
  // anywhere — from the offer itself or from the Look menu.
  const [suggestLang, setSuggestLang] = useState(() => languageToSuggest(deviceLangs(), readStored()));
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
    suggestLang,
    setLang: (next: LangName) => {
      current = next;
      setLangState(next);
      setSuggestLang(null);
      try {
        localStorage.setItem(LANG_KEY, next);
      } catch {
        // Private browsing: kept for this visit, asked of the phone next time.
      }
    },
  }), [lang, suggestLang]);

  return <TiBookLanguageContext.Provider value={value}>{children}</TiBookLanguageContext.Provider>;
};

/*
 * Every component that shows the guest words calls this, even one that only
 * uses the module-level t(): calling it is what re-renders the component when
 * the language changes. A component that forgets keeps its old language until
 * something else re-renders it.
 */
export const useTiBookLang = () => {
  const { lang, setLang, suggestLang } = useContext(TiBookLanguageContext);
  return { lang, setLang, suggestLang, t, fmtDate, localeTag };
};
