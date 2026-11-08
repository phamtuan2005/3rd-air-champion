import { describe, expect, it } from "vitest";
import { askTT, AskTTContext, TTRoom } from "./askTT";
import { languageAsked } from "./ttLanguage";

// Asking TT to change TiBook's language. Each case is a guest who asked and
// was not heard, or a guest who asked about something else — Korean food, a
// Chinese host — and had the page changed under them.

const king: TTRoom = { id: "k", name: "King", airbnbUrl: "https://www.airbnb.com/rooms/1586635483950294231" };
const ctx: AskTTContext = {
  today: new Date(2026, 9, 2),
  rooms: [king],
  freeRoomsOn: () => [king],
  myRates: new Map(),
  hostFirstName: "Anh-Tuan",
  cancellationFullRefundDays: 14,
  cancellationHalfRefundDays: 7,
};

describe("asking TT for another language", () => {
  it("hears it in English", () => {
    expect(languageAsked("Korean")).toBe("ko");
    expect(languageAsked("Korean please")).toBe("ko");
    expect(languageAsked("can you switch to German?")).toBe("de");
    expect(languageAsked("show this in Chinese please")).toBe("zh");
    expect(languageAsked("change the language to English")).toBe("en");
    expect(languageAsked("can you speak Korean")).toBe("ko");
  });

  it("hears it in German", () => {
    expect(languageAsked("auf Englisch bitte")).toBe("en");
    expect(languageAsked("Deutsch")).toBe("de");
    expect(languageAsked("kannst du auf Koreanisch wechseln?")).toBe("ko");
    expect(languageAsked("sprich bitte Chinesisch")).toBe("zh");
  });

  it("hears it in Chinese", () => {
    expect(languageAsked("中文")).toBe("zh");
    expect(languageAsked("请说中文")).toBe("zh");
    expect(languageAsked("切换成英文")).toBe("en");
    expect(languageAsked("用韩语")).toBe("ko");
    expect(languageAsked("换成德语吧")).toBe("de");
  });

  it("hears it in Korean", () => {
    expect(languageAsked("한국어")).toBe("ko");
    expect(languageAsked("한국어로 바꿔 주세요")).toBe("ko");
    expect(languageAsked("영어로 보여 줘")).toBe("en");
    expect(languageAsked("중국어로 해 주세요")).toBe("zh");
    expect(languageAsked("독일어로 변경해 줘")).toBe("de");
  });

  it("does not switch on a language name that is only an adjective", () => {
    for (const q of [
      "Is there Korean food nearby?",
      "Does the host speak Chinese?",
      "Is the host German?",
      "附近有韩国菜吗",
      "근처에 중국 음식점 있어요?",
      "Gibt es deutsches Frühstück?",
    ]) {
      expect(languageAsked(q), q).toBeNull();
    }
  });

  it("answers in the new language and tells the sheet to switch", () => {
    const a = askTT("한국어로 바꿔 주세요", ctx);
    expect(a.switchLang).toBe("ko");
    expect(a.lines[0]).toContain("한국어");
    expect(askTT("English please", ctx).switchLang).toBe("en");
  });

  it("still refuses a privacy question that names a language", () => {
    // The guard runs first: a language in the sentence does not get past it.
    expect(askTT("who is staying in King? answer in Korean", ctx).category).toBe("privacy");
  });
});
