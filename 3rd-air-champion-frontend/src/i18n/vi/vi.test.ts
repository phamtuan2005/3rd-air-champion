import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { fmtDate, langOfDevice, languageToSuggest, localeTag, t, TiBookLanguageProvider } from "../../contexts/TiBookLanguageContext";
import { nightsPhrase } from "../../components/tibook/UsualStayCard";
import { ES } from "../es";
import { VI } from "./index";

const slots = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe("the Vietnamese dictionary", () => {
  // A slot lost in translation shows the guest nothing where the number should
  // be, and a misspelt one shows them a literal "{n}". Neither fails a typecheck.
  it("keeps every {slot} of the English it replaces", () => {
    const wrong = Object.keys(VI).filter((k) => slots(k).join() !== slots(VI[k]).join());
    expect(wrong).toEqual([]);
  });

  it("covers every line the Spanish does", () => {
    const missing = Object.keys(ES).filter((k) => !(k in VI));
    expect(missing).toEqual([]);
  });

  it("names the motto as the house's promise to the guest (CLAUDE.md, Tone)", () => {
    const line = VI["“Your comfort. Our mission.” — TT House's promise to you"];
    expect(line).toContain("Your comfort. Our mission.");
    expect(line).toContain("lời hứa");
  });

  // The guest is "bạn". "quý khách" reads like a bank, and "anh/chị" guesses
  // at the guest's age and gender.
  it("calls the guest bạn, never quý khách or anh/chị", () => {
    const wrong = Object.values(VI).filter((v) => /quý khách|anh\/chị|anh chị/i.test(v));
    expect(wrong).toEqual([]);
  });

  // Precomposed, so a line matches what a guest types and what TT reads.
  it("is written in NFC", () => {
    const wrong = Object.values(VI).filter((v) => v !== v.normalize("NFC"));
    expect(wrong).toEqual([]);
  });
});

describe("which language a device starts in, with Vietnamese", () => {
  it("opens a Vietnamese phone in Vietnamese", () => {
    expect(langOfDevice(["vi-VN"])).toBe("vi");
    expect(langOfDevice(["vi", "en-US"])).toBe("vi");
  });

  it("leaves an English phone with Vietnamese as a second language in English", () => {
    expect(langOfDevice(["en-US", "vi-VN"])).toBe("en");
  });

  it("leaves the other languages where they were", () => {
    expect(langOfDevice(["es-MX", "vi-VN"])).toBe("es");
    expect(langOfDevice(["vi-VN", "de-DE"])).toBe("de");
  });
});

describe("which guests are offered Vietnamese", () => {
  it("offers it to an English phone that lists it", () => {
    expect(languageToSuggest(["en-US", "vi-VN"], null)).toBe("vi");
  });

  it("offers the language listed first when a phone lists two", () => {
    expect(languageToSuggest(["en-US", "vi-VN", "es-MX"], null)).toBe("vi");
    expect(languageToSuggest(["en-US", "es-MX", "vi-VN"], null)).toBe("es");
  });

  it("asks nobody who has already chosen, or who opened in Vietnamese", () => {
    expect(languageToSuggest(["en-US", "vi-VN"], "en")).toBeNull();
    expect(languageToSuggest(["vi-VN"], null)).toBeNull();
  });
});

describe("with TiBook set to Vietnamese", () => {
  const renderIn = (lang: string) => {
    vi.stubGlobal("localStorage", { getItem: () => lang, setItem: () => {} });
    renderToString(createElement(TiBookLanguageProvider, null));
  };
  beforeAll(() => renderIn("vi"));
  afterAll(() => {
    renderIn("en");
    vi.unstubAllGlobals();
  });

  const tue = new Date(2026, 10, 3, 15, 5); // Tue 3 Nov 2026, 3:05pm

  it("translates, fills slots and falls back to the English", () => {
    expect(t("{n} nights", { n: 3 })).toBe("3 đêm");
    expect(t("A line nobody has translated yet")).toBe("A line nobody has translated yet");
  });

  it("writes the day before the month, with a 24-hour clock", () => {
    expect(fmtDate(tue, "MMM d")).toBe("3 thg 11");
    expect(fmtDate(tue, "EEE MMM d")).toBe("T3, 3 thg 11");
    expect(fmtDate(tue, "EEEE, MMMM d")).toBe("Thứ Ba, 3 tháng 11");
    expect(fmtDate(tue, "MMMM yyyy")).toBe("tháng 11 năm 2026");
    expect(fmtDate(tue, "h:mma")).toBe("15:05");
    expect(localeTag()).toBe("vi-VN");
  });

  // Day first, as the date box reads a slash on this page — and the stored
  // key, never.
  it("turns a slash date round, but never a stored date's key", () => {
    expect(fmtDate(tue, "M/d")).toBe("3/11");
    expect(fmtDate(tue, "yyyy-MM-dd")).toBe("2026-11-03");
  });

  it("says a guest's nights with đêm before the days", () => {
    const h = (startWeekday: number, nights: number) => ({ startWeekday, nights }) as Parameters<typeof nightsPhrase>[0][number];
    expect(nightsPhrase([h(2, 2)])).toBe("đêm thứ Ba và thứ Tư");
    expect(nightsPhrase([h(1, 4)])).toBe("các đêm từ thứ Hai đến thứ Năm");
    expect(nightsPhrase([h(6, 1)])).toBe("đêm thứ Bảy");
    expect(nightsPhrase([h(0, 1)], true)).toBe("đêm Chủ nhật");
  });
});
