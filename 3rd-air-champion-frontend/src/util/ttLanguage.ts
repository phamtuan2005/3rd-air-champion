import type { LangName } from "../contexts/TiBookLanguageContext";

/*
 * "한국어로 바꿔 주세요", "auf Deutsch bitte", "说中文", "English please" — a guest
 * asking TT to change TiBook's language, in any language TiBook speaks.
 *
 * The switch also sits in the Look menu, but a guest who cannot read the page
 * is exactly the one who will not find it there, and TT is where they already
 * type. So TT does it itself rather than explaining where the menu is.
 *
 * Each language is named the way all four languages name it: a German guest on
 * a Korean page types "Deutsch", a Korean guest on a Chinese page "한국어".
 *
 * Careful, not eager. A language name is also an adjective — "Korean food
 * nearby?", "is the host Chinese?" — and switching the page on a question about
 * dinner would be TT not listening. So a name counts only on its own ("中文",
 * "Korean please") or with a word that asks for the switch ("in Korean",
 * "auf Deutsch", "用中文", "한국어로 바꿔").
 */
const NAMES: Record<LangName, string> = {
  en: "english|englisch|英语|英文|영어",
  de: "german|deutsch|德语|德文|독일어",
  zh: "chinese|mandarin|chinesisch|中文|汉语|普通话|중국어",
  ko: "korean|koreanisch|韩语|韩文|韩国语|韓語|한국어|한국말|한글",
};

const asking = (name: string): RegExp[] => [
  // The name alone, give or take a please in any of the four languages.
  new RegExp(
    `^\\W*(?:please\\s+|pls\\s+|bitte\\s+|请)?(?:${name})(?:\\s*(?:please|pls|bitte|version|language|mode))?` +
      `(?:으로|로)?\\s*(?:해\\s*주세요|해줘|부탁해요|부탁합니다|주세요|吧)?[\\s.!?？！。~]*$`,
    "i",
  ),
  // English: "switch to Korean", "can you show it in Korean", "speak Korean".
  // Not "does the host speak Korean" — that asks about the host.
  new RegExp(`\\b(?:switch|change|set|put|turn|translate)\\b.{0,30}\\b(?:to|into|in)\\s+(?:${name})\\b`, "i"),
  new RegExp(`\\b(?:in|into)\\s+(?:${name})\\s*(?:please|pls)?[\\s.!?]*$`, "i"),
  new RegExp(`(?:^|\\b(?:you|please|pls)\\s+)speak\\s+(?:${name})\\b`, "i"),
  // German: "auf Deutsch", "sprich Koreanisch", "stell auf Englisch um".
  new RegExp(`\\bauf\\s+(?:${name})\\b`, "i"),
  new RegExp(`\\b(?:sprich|sprechen|wechsel\\w*|stell\\w*)\\b.{0,30}\\b(?:${name})\\b`, "i"),
  // Chinese: "说中文", "用韩语", "切换成英文", "换成德语".
  new RegExp(`(?:说|讲|用|切换|换成|换到|改成|改为|调成|设为|设置为|显示)\\s*(?:成|为|到)?\\s*(?:${name})`, "i"),
  // Korean: "한국어로 바꿔 주세요", "영어로 보여 줘", "중국어로 해 줘".
  new RegExp(`(?:${name})\\s*(?:으로|로)\\s*(?:바꿔|바꾸|변경|보여|말해|설정|전환|보기|볼\\s*수|안내|해\\s*줘|해\\s*주|해요|부탁)`, "i"),
];

const READERS = (Object.keys(NAMES) as LangName[]).map((lang) => ({ lang, res: asking(NAMES[lang]) }));

/** The language a guest asked TT to switch TiBook to, or null if they did not. */
export const languageAsked = (q: string): LangName | null => {
  const text = q.trim();
  if (!text || text.length > 80) return null;
  return READERS.find((r) => r.res.some((re) => re.test(text)))?.lang ?? null;
};

/*
 * What TT says once it has switched — in the NEW language, written out here
 * rather than through t(), which would still answer in the old one: the
 * answer is built before the page changes.
 */
export const SWITCHED: Record<LangName, string> = {
  en: "Sure — TiBook is in English now. Ask me anything about staying here.",
  // Informal "du", as the rest of TiBook's German.
  de: "Gerne – TiBook ist jetzt auf Deutsch. Frag mich alles rund um deinen Aufenthalt.",
  zh: "好的，TiBook 已切换为中文。关于入住的任何问题，都可以问我。",
  // 을, not 를: TiBook ends on a consonant (북).
  ko: "네, 이제 TiBook을 한국어로 보여 드릴게요. 숙박에 관해 무엇이든 물어보세요.",
};
