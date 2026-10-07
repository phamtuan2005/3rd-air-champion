import { describe, expect, it } from "vitest";
import { monthFromShown, parseAirbnbReview } from "./airbnbReviewPaste";

// The host's own copies from AirBnB (2026-10-07). A copied review saved as it
// came — header lines and all, with no guest and no stars — is what these
// protect against.

const today = new Date("2026-10-07T12:00:00Z");

const LEIDY = `eidy Johanna
Medellín, Colombia
Leidy Johanna
Rating, 5 stars
,·
1 week ago
,·
Stayed one night
From the moment we opened the door of the house, my husband and I were greeted by Anh with a warm welcome, a friendly smile, and a complete willingness to help us check in and find our way to the assigned room. We found a room that was perfectly organized and clean, with state-of-the-art bedroom and bathroom fixtures. It looks like a newly built room with everything new. A highly recommended place. Thank you, Anh.`;

const LIM = `Lim
9 years on Airbnb
Lim
Rating, 5 stars
,·
2 days ago
,·
Stayed a few nights
Clean and quiet, great host.
Would stay again.`;

describe("parseAirbnbReview", () => {
  it("takes Leidy Johanna's review apart, using the whole name, not the cut first line", () => {
    const r = parseAirbnbReview(LEIDY, today);
    expect(r).toMatchObject({ guestName: "Leidy Johanna", stars: 5, when: "1 week ago", reviewMonth: "2026-09" });
    expect((r as any).text.startsWith("From the moment we opened the door")).toBe(true);
    expect((r as any).text).not.toContain("Rating");
    expect((r as any).text).not.toContain("Stayed one night");
  });

  it("reads the '9 years on Airbnb' variant and keeps a review's own line breaks", () => {
    expect(parseAirbnbReview(LIM, today)).toEqual({
      guestName: "Lim",
      stars: 5,
      when: "2 days ago",
      reviewMonth: "2026-10",
      text: "Clean and quiet, great host.\nWould stay again.",
    });
  });

  it("leaves the host's reply out", () => {
    const r = parseAirbnbReview(`${LIM}\nResponse from Anh-Tuan\nThank you Lim!`, today) as any;
    expect(r.text).toBe("Clean and quiet, great host.\nWould stay again.");
  });

  it("says a whole page is several reviews, for the big box to split", () => {
    expect(parseAirbnbReview(`${LEIDY}\n${LIM}`, today)).toBe("several");
  });

  it("leaves text that is not a copied review alone", () => {
    expect(parseAirbnbReview("Great stay, very clean.", today)).toBeNull();
    expect(parseAirbnbReview("", today)).toBeNull();
  });
});

describe("monthFromShown", () => {
  it("matches the server's rule", () => {
    expect(monthFromShown("February 2025", today)).toBe("2025-02");
    expect(monthFromShown("1 week ago", today)).toBe("2026-09");
    expect(monthFromShown("3 months ago", today)).toBe("2026-07");
    expect(monthFromShown("2 months ago", new Date("2026-01-15T12:00:00Z"))).toBe("2025-11");
    expect(monthFromShown("sometime", today)).toBe("");
  });
});
