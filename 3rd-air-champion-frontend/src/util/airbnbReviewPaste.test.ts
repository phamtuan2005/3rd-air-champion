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

// AirBnB's later layout, as the host pasted it for Gail (Cozy, 2026-10-09):
// stars "out of 5", the name once, above the city.
const GAIL = `Gail
Waco, TX
Rating 5 out of 5
,·
Today
Anh was friendly, proactive and responsive, provided thorough instructions throughout the process until I was checked-in.`;

describe("parseAirbnbReview", () => {
  // As stored on record: the same copies flattened onto one line by a phone paste.
  it("reads Gail's review flattened onto one line", () => {
    expect(parseAirbnbReview(GAIL.replace(/\n/g, " "), today)).toEqual({
      guestName: "Gail",
      stars: 5,
      when: "Today",
      reviewMonth: "2026-10",
      text: "Anh was friendly, proactive and responsive, provided thorough instructions throughout the process until I was checked-in.",
    });
  });

  it("reads Lim's review flattened onto one line", () => {
    expect(parseAirbnbReview(LIM.replace(/\n/g, " "), today)).toEqual({
      guestName: "Lim",
      stars: 5,
      when: "2 days ago",
      reviewMonth: "2026-10",
      text: "Clean and quiet, great host. Would stay again.",
    });
  });

  it("reads Leidy Johanna's review flattened, taking the repeated whole name", () => {
    const r = parseAirbnbReview(LEIDY.replace(/\n/g, " "), today) as any;
    expect(r).toMatchObject({ guestName: "Leidy Johanna", stars: 5, when: "1 week ago" });
    expect(r.text.startsWith("From the moment we opened the door")).toBe(true);
  });

  it("says a flattened page is several reviews", () => {
    expect(parseAirbnbReview(`${LEIDY}\n${GAIL}`.replace(/\n/g, " "), today)).toBe("several");
  });

  it("reads the 'Rating 5 out of 5' layout, taking the name above the city", () => {
    expect(parseAirbnbReview(GAIL, today)).toEqual({
      guestName: "Gail",
      stars: 5,
      when: "Today",
      reviewMonth: "2026-10",
      text: "Anh was friendly, proactive and responsive, provided thorough instructions throughout the process until I was checked-in.",
    });
  });


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

  // Copied on a phone, the repeat of the name is the guest's picture, which
  // pastes as an empty line (Han, King, 2026-10-10). The form took "3 years
  // on" for the name.
  it("takes the name from above '3 years on Airbnb' when the picture stood where the repeat was", () => {
    const han = [
      "Han",
      "3 years on Airbnb",
      "",
      "Rating, 5 stars",
      ",·",
      "1 week ago",
      ",·",
      "Stayed a few nights",
      "This house is very quiet and private. The stay was very comfortable.",
    ].join("\n");
    expect(parseAirbnbReview(han, today)).toMatchObject({
      guestName: "Han",
      stars: 5,
      when: "1 week ago",
      text: "This house is very quiet and private. The stay was very comfortable.",
    });
    // The same review copied on a computer, with the name repeated, still reads.
    expect(parseAirbnbReview(han.replace("\n\n", "\nHan\n"), today)).toMatchObject({ guestName: "Han", stars: 5 });
  });

  // Every way the header arrives: copied on a computer (name repeated) or a
  // phone (the picture pastes as nothing), with a city or "N years on Airbnb",
  // in the old layout or the later one. The name must come out whole each time.
  it.each([
    ["phone, years", ["Han", "3 years on Airbnb", "", "Rating, 5 stars"]],
    ["computer, years", ["Han", "3 years on Airbnb", "Han", "Rating, 5 stars"]],
    ["phone, two-word city", ["Han", "San Jose, CA", "", "Rating, 5 stars"]],
    ["computer, two-word city", ["Han", "San Jose, CA", "Han", "Rating, 5 stars"]],
    ["later layout, two-word city", ["Han", "San Jose, CA", "Rating 5 out of 5"]],
    ["later layout, phone", ["Han", "San Jose, CA", "", "Rating 5 out of 5"]],
  ])("finds the name: %s", (_, header) => {
    const block = [...header, ",·", "1 week ago", ",·", "Stayed a few nights", "Quiet and private."].join("\n");
    expect(parseAirbnbReview(block, today)).toMatchObject({ guestName: "Han", stars: 5, text: "Quiet and private." });
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
