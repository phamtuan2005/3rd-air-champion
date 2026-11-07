import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { fmtDate, langOfDevice, localeTag, t, TiBookLanguageProvider } from "../../contexts/TiBookLanguageContext";
import { nightsPhrase } from "../../components/tibook/UsualStayCard";
import { ZH } from "./index";

const slots = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe("the dictionary", () => {
  // A slot lost in translation shows the guest nothing where the number should
  // be, and a misspelt one shows them a literal "{n}". Neither fails a typecheck.
  it("keeps every {slot} of the English it replaces", () => {
    const wrong = Object.keys(ZH).filter((k) => slots(k).join() !== slots(ZH[k]).join());
    expect(wrong).toEqual([]);
  });

  it("names the motto as the house's promise to the guest (CLAUDE.md, Tone)", () => {
    const line = ZH["“Your comfort. Our mission.” — TT House's promise to you"];
    expect(line).toContain("Your comfort. Our mission.");
    expect(line).toContain("对您的承诺");
  });
});

describe("which language a device starts in", () => {
  it("opens a Simplified Chinese phone in Chinese", () => {
    expect(langOfDevice(["zh-CN"])).toBe("zh");
    expect(langOfDevice(["zh-Hans-US", "en-US"])).toBe("zh");
    expect(langOfDevice(["zh"])).toBe("zh");
  });

  it("leaves an English phone with Chinese as a second language in English", () => {
    // Common in Silicon Valley, and those guests did not ask TiBook to change.
    expect(langOfDevice(["en-US", "zh-CN"])).toBe("en");
  });

  it("leaves a Traditional Chinese phone in English until the guest chooses", () => {
    expect(langOfDevice(["zh-TW"])).toBe("en");
    expect(langOfDevice(["zh-HK", "en-US"])).toBe("en");
    expect(langOfDevice(["zh-Hant-US"])).toBe("en");
  });

  it("still opens a phone with German anywhere in its list in German", () => {
    expect(langOfDevice(["en-US", "de-DE"])).toBe("de");
    expect(langOfDevice(["fr-FR"])).toBe("en");
    expect(langOfDevice([])).toBe("en");
  });
});

describe("with TiBook set to Chinese", () => {
  // The provider sets the module's language while it renders, and the stored
  // choice is what it reads first — the same way a returning guest gets there.
  const renderIn = (lang: string) => {
    vi.stubGlobal("localStorage", { getItem: () => lang, setItem: () => {} });
    renderToString(createElement(TiBookLanguageProvider, null));
  };
  beforeAll(() => renderIn("zh"));
  afterAll(() => {
    renderIn("en");
    vi.unstubAllGlobals();
  });

  const tue = new Date(2026, 10, 3); // Tue 3 Nov 2026

  it("translates, fills slots and falls back to the English", () => {
    expect(t("Your bookings")).toBe("您的预订");
    expect(t("{n} nights", { n: 3 })).toBe("3晚");
    expect(t("A line nobody has translated yet")).toBe("A line nobody has translated yet");
  });

  it("writes dates largest first, without losing the day", () => {
    expect(fmtDate(tue, "MMM d")).toBe("11月3日");
    expect(fmtDate(tue, "EEE MMM d")).toBe("11月3日 周二");
    expect(fmtDate(tue, "EEE MMM d, yyyy")).toBe("2026年11月3日 周二");
    expect(fmtDate(tue, "MMMM yyyy")).toBe("2026年11月");
    expect(fmtDate(tue, "EEEE, MMMM d, yyyy")).toBe("2026年11月3日 星期二");
    expect(localeTag()).toBe("zh-CN");
  });

  it("never touches a stored date's key", () => {
    expect(fmtDate(tue, "yyyy-MM-dd")).toBe("2026-11-03");
  });

  it("has a Chinese form of every date pattern TiBook shows", () => {
    // A pattern missing from the table comes out in English word order.
    for (const p of ["d EEE", "d MMM", "EEE d MMM", "EEE, MMM d", "EEE, MMM d · h:mma", "EEE, MMM d yyyy", "EEE, MMMM d yyyy", "EEEE, MMM d", "MMM d EEE", "MMMM d", "MMMM d, yyyy", "MMMM"]) {
      expect(fmtDate(tue, p), p).toMatch(/[日月]/);
    }
  });

  it("gives each weekday its own short header", () => {
    // t("Sunday")[0], which the phone's calendar header uses in the other
    // languages, is 星 for every day of the week here.
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    expect(days.map((d) => t(d).slice(-1)).join("")).toBe("日一二三四五六");
  });

  it("says a guest's usual nights with 晚 once, at the end", () => {
    const h = (startWeekday: number, nights: number) => ({ startWeekday, nights }) as Parameters<typeof nightsPhrase>[0][number];
    expect(nightsPhrase([h(2, 2)])).toBe("周二和周三晚");
    expect(nightsPhrase([h(1, 4)])).toBe("周一至周四晚");
    expect(nightsPhrase([h(1, 1), h(3, 1), h(5, 1)])).toBe("周一、周三和周五晚");
    expect(nightsPhrase([h(3, 1)])).toBe("周三晚");
  });
});

describe("Chinese punctuation", () => {
  it("is full-width in every sentence", () => {
    // ASCII marks look thin and wrong in Chinese. Only the typed example
    // "Mai, 408 555 0123" keeps its comma, because it is an example to type.
    const wrong = Object.values(ZH).filter((v) => /[?!:()]|,(?! )/.test(v.replace(/\{\w+\}/g, "")));
    expect(wrong).toEqual([]);
  });
});
