import { describe, expect, it } from "vitest";
import { welcomeMessage } from "./welcomeMessage";

// The welcome a new guest is texted from TiMag, with the rates set for them
// (host, 2026-11-03).
describe("welcomeMessage", () => {
  const url = "https://example.com/book";

  it("greets by first name, lists each room's rate, says where to book, and is signed", () => {
    const text = welcomeMessage({
      guestName: "Mitt Romney",
      rates: [
        { room: "Chill", price: 60 },
        { room: "Cozy", price: 55 },
      ],
      bookUrl: url,
      sender: "Cindy Wang",
    });
    expect(text).toBe(
      [
        "Hi Mitt, welcome to TT House! I am so glad to have you as a loyal returning guest.",
        "",
        "Your nightly rates:",
        "* Chill: $60",
        "* Cozy: $55",
        "",
        "You can see open nights and request a stay any time at TiBook:",
        url,
        "",
        "Best,",
        "Cindy",
        `TT House — "Your comfort. Our mission." is our promise to you.`,
      ].join("\n"),
    );
  });

  // Family are on deliberate $0 rates (CLAUDE.md); "$0" reads like a mistake.
  it("says a comped room is on the house, never $0", () => {
    const text = welcomeMessage({ guestName: "Lory", rates: [{ room: "King", price: 0 }], bookUrl: url });
    expect(text).toContain("Your nightly rate:\n* King: on the house");
    expect(text).not.toContain("$0");
  });

  it("leaves the rate list out when no rate was set", () => {
    expect(welcomeMessage({ guestName: "Ana", rates: [], bookUrl: url })).not.toContain("nightly");
  });
});
