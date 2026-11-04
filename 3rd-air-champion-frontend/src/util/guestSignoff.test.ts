import { describe, expect, it } from "vitest";
import { guestSignoff } from "./cleanerMessage";

// The booking confirmation ended with no name at all (host, 2026-11-03).
describe("guestSignoff", () => {
  it("signs with the sender's first name, and names the motto as a promise to the guest", () => {
    expect(guestSignoff("Cindy Wang")).toBe(
      `Best,\nCindy\nTT House — "Your comfort. Our mission." is our promise to you.`,
    );
  });

  it("falls back to Anh-Tuan when the sender is unknown", () => {
    expect(guestSignoff("")).toContain("\nAnh-Tuan\n");
  });
});
