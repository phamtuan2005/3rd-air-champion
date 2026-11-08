import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { fmtDate, langOfDevice, languageToSuggest, localeTag, t, TiBookLanguageProvider } from "../../contexts/TiBookLanguageContext";
import { nightsPhrase } from "../../components/tibook/UsualStayCard";
import { ZH } from "../zh";
import { KO } from "./index";

const slots = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe("the Korean dictionary", () => {
  // A slot lost in translation shows the guest nothing where the number should
  // be, and a misspelt one shows them a literal "{n}". Neither fails a typecheck.
  it("keeps every {slot} of the English it replaces", () => {
    const wrong = Object.keys(KO).filter((k) => slots(k).join() !== slots(KO[k]).join());
    expect(wrong).toEqual([]);
  });

  it("covers every line the Chinese does", () => {
    // Chinese's "." is the one key Korean does not need: it uses an ASCII stop.
    const missing = Object.keys(ZH).filter((k) => k !== "." && !(k in KO));
    expect(missing).toEqual([]);
  });

  it("names the motto as the house's promise to the guest (CLAUDE.md, Tone)", () => {
    const line = KO["“Your comfort. Our mission.” — TT House's promise to you"];
    expect(line).toContain("Your comfort. Our mission.");
    expect(line).toContain("약속");
  });

  it("never puts a sound-dependent particle straight after a slot", () => {
    // "{host}이" or "{host}가" is a guess at how a Latin name ends, and a
    // wrong guess reads like a machine wrote it. Anchor the slot instead:
    // "{host} 님이", "{room} 객실은".
    const wrong = Object.values(KO).filter((v) => /\{(?:host|room|name|who|rooms|thing)\}(?:은|는|이|가|을|를|과|와|으로|로)(?![가-힣])/.test(v));
    expect(wrong).toEqual([]);
  });

  it("never calls the guest 당신", () => {
    expect(Object.values(KO).filter((v) => v.includes("당신"))).toEqual([]);
  });
});

describe("which language a device starts in, with Korean", () => {
  it("opens a Korean phone in Korean", () => {
    expect(langOfDevice(["ko-KR"])).toBe("ko");
    expect(langOfDevice(["ko", "en-US"])).toBe("ko");
  });

  it("leaves an English phone with Korean as a second language in English", () => {
    expect(langOfDevice(["en-US", "ko-KR"])).toBe("en");
  });

  it("leaves the other languages where they were", () => {
    expect(langOfDevice(["zh-CN"])).toBe("zh");
    expect(langOfDevice(["ko-KR", "de-DE"])).toBe("de");
    expect(langOfDevice(["zh-TW", "ko-KR"])).toBe("en");
  });
});

describe("which guests are offered their own language", () => {
  // The guests langOfDevice leaves in English on purpose, and only them.
  it("offers Korean or Chinese to an English phone that lists it", () => {
    expect(languageToSuggest(["en-US", "ko-KR"], null)).toBe("ko");
    expect(languageToSuggest(["en-US", "zh-CN"], null)).toBe("zh");
    expect(languageToSuggest(["en-US", "fr-FR", "ko"], null)).toBe("ko");
  });

  it("offers Simplified to a Traditional phone, which starts in English", () => {
    expect(languageToSuggest(["zh-TW"], null)).toBe("zh");
  });

  it("asks nobody who has already chosen, either way", () => {
    expect(languageToSuggest(["en-US", "ko-KR"], "en")).toBeNull();
    expect(languageToSuggest(["en-US", "ko-KR"], "ko")).toBeNull();
  });

  it("asks nobody TiBook already opened in their language, or who has none of its own", () => {
    expect(languageToSuggest(["ko-KR"], null)).toBeNull();
    expect(languageToSuggest(["en-US", "de-DE"], null)).toBeNull();
    expect(languageToSuggest(["en-US"], null)).toBeNull();
    expect(languageToSuggest(["en-US", "fr-FR"], null)).toBeNull();
  });
});

describe("with TiBook set to Korean", () => {
  const renderIn = (lang: string) => {
    vi.stubGlobal("localStorage", { getItem: () => lang, setItem: () => {} });
    renderToString(createElement(TiBookLanguageProvider, null));
  };
  beforeAll(() => renderIn("ko"));
  afterAll(() => {
    renderIn("en");
    vi.unstubAllGlobals();
  });

  const tue = new Date(2026, 10, 3, 15, 5); // Tue 3 Nov 2026, 3:05pm

  it("translates, fills slots and falls back to the English", () => {
    expect(t("Your bookings")).toBe("내 예약");
    expect(t("{n} nights", { n: 3 })).toBe("3박");
    expect(t("A line nobody has translated yet")).toBe("A line nobody has translated yet");
  });

  it("writes dates largest first, with the weekday in brackets", () => {
    expect(fmtDate(tue, "MMM d")).toBe("11월 3일");
    expect(fmtDate(tue, "EEE MMM d")).toBe("11월 3일 (화)");
    expect(fmtDate(tue, "EEE MMM d, yyyy")).toBe("2026년 11월 3일 (화)");
    expect(fmtDate(tue, "MMMM yyyy")).toBe("2026년 11월");
    expect(fmtDate(tue, "EEEE, MMMM d, yyyy")).toBe("2026년 11월 3일 화요일");
    expect(fmtDate(tue, "h:mma")).toBe("오후 3:05");
    expect(localeTag()).toBe("ko-KR");
  });

  it("never touches a stored date's key", () => {
    expect(fmtDate(tue, "yyyy-MM-dd")).toBe("2026-11-03");
  });

  it("has a Korean form of every date pattern TiBook shows", () => {
    // A pattern missing from the table comes out as "11월 3", with no 일.
    for (const p of ["d EEE", "d MMM", "EEE d MMM", "EEE, MMM d", "EEE, MMM d · h:mma", "EEE, MMM d yyyy", "EEE, MMMM d yyyy", "EEEE, MMM d", "MMM d EEE", "MMMM d", "MMMM d, yyyy"]) {
      expect(fmtDate(tue, p), p).toMatch(/일/);
    }
  });

  it("gives each weekday its own one-letter header", () => {
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    expect(days.map((d) => t(d)[0]).join("")).toBe("일월화수목금토");
  });

  it("says a guest's usual nights with 밤 once, at the end", () => {
    const h = (startWeekday: number, nights: number) => ({ startWeekday, nights }) as Parameters<typeof nightsPhrase>[0][number];
    expect(nightsPhrase([h(2, 2)])).toBe("화요일과 수요일 밤");
    expect(nightsPhrase([h(1, 4)])).toBe("월요일~목요일 밤");
    expect(nightsPhrase([h(1, 1), h(3, 1), h(5, 1)])).toBe("월요일, 수요일, 금요일 밤");
    expect(nightsPhrase([h(3, 1)])).toBe("수요일 밤");
  });
});
