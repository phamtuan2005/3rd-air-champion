import { describe, expect, it } from "vitest";
import { dropUsCountryCode, formatPhone, toStoredPhone } from "./formatPhone";

// "+1 408 306 2219" is "408 306 2219" (host, 2026-10-20). Same rule as the
// backend's util/usPhone.ts — the two must agree.
describe("dropUsCountryCode", () => {
  it("drops a typed +1 once the number is complete", () => {
    expect(dropUsCountryCode("+1 408 306 2219")).toBe("408 306 2219");
    expect(dropUsCountryCode("+1 (408) 306-2219")).toBe("(408) 306-2219");
    expect(dropUsCountryCode("+14083062219")).toBe("4083062219");
  });

  it("waits while the guest is still typing", () => {
    expect(dropUsCountryCode("+1 408")).toBe("+1 408");
  });

  it("keeps any other country code, and a bare 1 that may be a Chinese mobile", () => {
    expect(dropUsCountryCode("+49 151 12345678")).toBe("+49 151 12345678");
    expect(dropUsCountryCode("13812345678")).toBe("13812345678");
  });

  it("is what gets stored and shown", () => {
    expect(toStoredPhone("+1 408 306 2219")).toBe("4083062219");
    expect(toStoredPhone("+49 151 12345678")).toBe("+4915112345678");
    expect(formatPhone("+1 408 306 2219")).toBe("(408) 306-2219");
  });
});
