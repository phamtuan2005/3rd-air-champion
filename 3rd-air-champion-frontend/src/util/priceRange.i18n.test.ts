import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { afterAll, describe, expect, it, vi } from "vitest";
import { t, TiBookLanguageProvider } from "../contexts/TiBookLanguageContext";
import { askTT, AskTTContext, toTTRoom } from "./askTT";
import { summaryLines } from "./ttBooking";
import { roomType } from "./types/roomType";

// The price range is a new line on screens a guest reads in any of TiBook's
// five languages. A line missing from one dictionary shows that guest English
// mid-page, and a slot lost in translation shows them no price at all — and
// neither fails a typecheck. So every range line is rendered in every language.

// Each line exactly as the code passes it to t(), with the slots it fills.
const RANGE_LINES: [string, Record<string, string>][] = [
  ["Prices are flexible nightly ranges. Open a room to find one that works for you and {name}.", { name: "Anh-Tuan" }],
  ["Your agreed prices are shown; the others are ranges. Open a room to ask {name}.", { name: "Anh-Tuan" }],
  ["/ night · flexible", {}],
  ["This room is {range} a night. Tell {name} your dates and you'll find a price that works for you both.", { range: "$55–$65", name: "Anh-Tuan" }],
  ["{room}: {range} a night.", { room: "Cozy", range: "$55–$65" }],
  ["Prices a night are flexible — {host} will find one that works for you both:", { host: "Anh-Tuan" }],
  ["The price is flexible within {range} a night; {host} will text you one that works for you both.", { range: "$55–$65", host: "Anh-Tuan" }],
];

const renderIn = (lang: string) => {
  vi.stubGlobal("localStorage", { getItem: () => lang, setItem: () => {} });
  renderToString(createElement(TiBookLanguageProvider, null));
};
afterAll(() => {
  renderIn("en");
  vi.unstubAllGlobals();
});

const cozy: roomType = {
  id: "z",
  name: "Cozy",
  price: 55,
  roomCode: "1224#",
  active: true,
  airbnbUrl: "https://www.airbnb.com/rooms/1177648203505001777",
};
const ctx = (): AskTTContext => ({
  today: new Date(2026, 9, 2),
  rooms: [toTTRoom(cozy)],
  freeRoomsOn: () => [toTTRoom(cozy)],
  myRates: new Map(),
  hostFirstName: "Anh-Tuan",
  cancellationFullRefundDays: 14,
  cancellationHalfRefundDays: 7,
});

describe.each(["en", "de", "zh", "ko", "es"])("the price range in %s", (lang) => {
  it("has every line, translated, with its slots filled", () => {
    renderIn(lang);
    for (const [en, vars] of RANGE_LINES) {
      const shown = t(en, vars);
      expect(shown, en).not.toMatch(/\{\w+\}/);
      for (const v of Object.values(vars)) expect(shown, en).toContain(v);
      // Every language but English must have its own wording, not the fallback.
      if (lang !== "en") expect(shown, en).not.toBe(fallback(en, vars));
    }
  });

  it("is what TT says when a new guest asks the price, and in the booking read-back", () => {
    renderIn(lang);
    const said = askTT("how much is a room", ctx()).lines.join("\n");
    expect(said).toContain("$55–$65");
    expect(said).not.toMatch(/\{\w+\}/);
    const readBack = summaryLines(
      { id: 1, roomId: "z", dates: ["2026-10-10", "2026-10-11"], party: 1, name: "Mai", phone: "4085550123" } as Parameters<typeof summaryLines>[0],
      toTTRoom(cozy),
      ctx(),
    ).join("\n");
    expect(readBack).toContain("$55–$65");
    expect(readBack).not.toMatch(/\{\w+\}/);
  });
});

// The English a line falls back to when a dictionary is missing it.
const fallback = (en: string, vars: Record<string, string>) => en.replace(/\{(\w+)\}/g, (_, k: string) => vars[k]);
