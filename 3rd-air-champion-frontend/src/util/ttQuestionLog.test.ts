import { describe, expect, it } from "vitest";
import { loggedQuestion } from "./ttQuestionLog";

// The question a guest typed leaves the phone for the host's log. Their own
// number and email must not go with it; the question itself must.
describe("loggedQuestion", () => {
  it("takes out a phone number and an email, and keeps what was asked", () => {
    const q = loggedQuestion("Is King free Oct 10? Text me on 415-555-0100 or jo@mail.com");
    expect(q).not.toMatch(/555|jo@mail\.com/);
    expect(q).toContain("Is King free Oct 10?");
  });

  it("caps a very long question", () => {
    expect(loggedQuestion("a ".repeat(500)).length).toBeLessThanOrEqual(300);
  });
});

describe("loggedQuestion and door codes", () => {
  it("takes out a door code typed without its #, and keeps a year", () => {
    expect(loggedQuestion("my code 4821 doesn't work")).toBe("my code (hidden) doesn't work");
    expect(loggedQuestion("Is King free Oct 10 2026?")).toBe("Is King free Oct 10 2026?");
  });
});
