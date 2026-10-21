import { dropUsCountryCode, phoneKey, phoneRegex } from "../usPhone";

// "+1 408 306 2219" is "408 306 2219" (host, 2026-10-20): the +1 made the same
// guest a stranger to every lookup that compares digits.
describe("dropUsCountryCode", () => {
  it("drops a typed +1, keeping the rest as typed", () => {
    expect(dropUsCountryCode("+1 408 306 2219")).toBe("408 306 2219");
    expect(dropUsCountryCode("+1 (408) 306-2219")).toBe("(408) 306-2219");
    expect(dropUsCountryCode("+14083062219")).toBe("4083062219");
    expect(dropUsCountryCode("  +1-408-306-2219")).toBe("408-306-2219");
  });

  it("keeps every other country code", () => {
    expect(dropUsCountryCode("+49 151 12345678")).toBe("+49 151 12345678");
    expect(dropUsCountryCode("+44 20 7946 0958")).toBe("+44 20 7946 0958");
  });

  it("leaves a bare 1 alone — that is also a Chinese mobile typed without +86", () => {
    expect(dropUsCountryCode("13812345678")).toBe("13812345678");
    expect(dropUsCountryCode("14083062219")).toBe("14083062219");
  });

  it("leaves a +1 still being typed", () => {
    expect(dropUsCountryCode("+1")).toBe("+1");
    expect(dropUsCountryCode("+1 408 306")).toBe("+1 408 306");
  });
});

describe("phoneKey / phoneRegex", () => {
  it("gives a +1 number and the bare one the same key", () => {
    expect(phoneKey("+1 408 306 2219")).toBe(phoneKey("(408) 306-2219"));
  });

  it("still finds a row stored with the +1 before it was dropped", () => {
    expect(phoneRegex("408 306 2219").test("+14083062219")).toBe(true);
    expect(phoneRegex("+1 408 306 2219").test("(408) 306-2219")).toBe(true);
  });
});
