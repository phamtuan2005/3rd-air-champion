import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { fmtDate, langOfDevice, languageToSuggest, localeTag, t, TiBookLanguageProvider } from "../../contexts/TiBookLanguageContext";
import { nightsPhrase } from "../../components/tibook/UsualStayCard";
import { KO } from "../ko";
import { ES } from "./index";

const slots = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe("the Spanish dictionary", () => {
  // A slot lost in translation shows the guest nothing where the number should
  // be, and a misspelt one shows them a literal "{n}". Neither fails a typecheck.
  it("keeps every {slot} of the English it replaces", () => {
    const wrong = Object.keys(ES).filter((k) => slots(k).join() !== slots(ES[k]).join());
    expect(wrong).toEqual([]);
  });

  it("covers every line the Korean does", () => {
    const missing = Object.keys(KO).filter((k) => !(k in ES));
    expect(missing).toEqual([]);
  });

  it("names the motto as the house's promise to the guest (CLAUDE.md, Tone)", () => {
    const line = ES["“Your comfort. Our mission.” — TT House's promise to you"];
    expect(line).toContain("Your comfort. Our mission.");
    expect(line).toContain("promesa");
  });

  // TiBook's Spanish is Latin American with "tú". Spain's vosotros and "vos"
  // from Argentina would each read as the wrong country to most guests here.
  it("never says vosotros or vos", () => {
    const wrong = Object.values(ES).filter((v) => /(?<!\p{L})(?:vosotr[oa]s|os\s+\p{L}+[aá]is|vos)(?!\p{L})/iu.test(v));
    expect(wrong).toEqual([]);
  });

  // Every Spanish question and exclamation opens with its own mark. A line
  // missing one reads like a machine wrote it.
  it("opens every question with ¿ and every exclamation with ¡", () => {
    const sentences = Object.values(ES).flatMap((v) => v.split(/(?<=[.?!])\s+/));
    const wrong = sentences.filter((s) => (/\?$/.test(s) && !s.includes("¿")) || (/!$/.test(s) && !s.includes("¡")));
    expect(wrong).toEqual([]);
  });
});

describe("which language a device starts in, with Spanish", () => {
  it("opens a Spanish phone in Spanish", () => {
    expect(langOfDevice(["es-MX"])).toBe("es");
    expect(langOfDevice(["es", "en-US"])).toBe("es");
    expect(langOfDevice(["es-419"])).toBe("es");
  });

  it("leaves an English phone with Spanish as a second language in English", () => {
    expect(langOfDevice(["en-US", "es-US"])).toBe("en");
  });

  it("leaves the other languages where they were", () => {
    expect(langOfDevice(["ko-KR", "es-MX"])).toBe("ko");
    expect(langOfDevice(["es-ES", "de-DE"])).toBe("de");
  });
});

describe("which guests are offered Spanish", () => {
  it("offers it to an English phone that lists it", () => {
    expect(languageToSuggest(["en-US", "es-US"], null)).toBe("es");
    expect(languageToSuggest(["en-US", "fr-FR", "es"], null)).toBe("es");
  });

  it("offers the language listed first when a phone lists two", () => {
    expect(languageToSuggest(["en-US", "es-MX", "ko-KR"], null)).toBe("es");
    expect(languageToSuggest(["en-US", "ko-KR", "es-MX"], null)).toBe("ko");
  });

  it("asks nobody who has already chosen, or who opened in Spanish", () => {
    expect(languageToSuggest(["en-US", "es-US"], "en")).toBeNull();
    expect(languageToSuggest(["es-MX"], null)).toBeNull();
  });
});

describe("with TiBook set to Spanish", () => {
  const renderIn = (lang: string) => {
    vi.stubGlobal("localStorage", { getItem: () => lang, setItem: () => {} });
    renderToString(createElement(TiBookLanguageProvider, null));
  };
  beforeAll(() => renderIn("es"));
  afterAll(() => {
    renderIn("en");
    vi.unstubAllGlobals();
  });

  const tue = new Date(2026, 10, 3, 15, 5); // Tue 3 Nov 2026, 3:05pm

  it("translates, fills slots and falls back to the English", () => {
    expect(t("Your bookings")).toBe("Tus reservas");
    expect(t("{n} nights", { n: 3 })).toBe("3 noches");
    expect(t("A line nobody has translated yet")).toBe("A line nobody has translated yet");
  });

  it("writes the day before the month, in lowercase as Spanish does", () => {
    expect(fmtDate(tue, "MMM d")).toBe("3 nov");
    expect(fmtDate(tue, "EEE MMM d")).toBe("mar 3 nov");
    expect(fmtDate(tue, "MMMM d")).toBe("3 de noviembre");
    expect(fmtDate(tue, "MMMM yyyy")).toBe("noviembre de 2026");
    expect(fmtDate(tue, "EEEE, MMMM d, yyyy")).toBe("martes, 3 de noviembre de 2026");
    expect(fmtDate(tue, "h:mma")).toBe("3:05 PM");
    expect(localeTag()).toBe("es-US");
  });

  it("never touches a stored date's key, nor a slash date the date box reads month first", () => {
    expect(fmtDate(tue, "yyyy-MM-dd")).toBe("2026-11-03");
    expect(fmtDate(tue, "M/d")).toBe("11/3");
  });

  it("says a guest's habit and their last stay the way Spanish does", () => {
    const h = (startWeekday: number, nights: number) => ({ startWeekday, nights }) as Parameters<typeof nightsPhrase>[0][number];
    expect(nightsPhrase([h(2, 2)])).toBe("los martes y miércoles por la noche");
    expect(nightsPhrase([h(1, 4)])).toBe("de lunes a jueves por la noche");
    expect(nightsPhrase([h(6, 1)])).toBe("los sábados por la noche");
    expect(nightsPhrase([h(2, 2)], true)).toBe("las noches del martes y el miércoles");
    expect(nightsPhrase([h(3, 1)], true)).toBe("la noche del miércoles");
  });
});
