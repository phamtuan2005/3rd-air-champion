import { parseReviewSearch, starsFit } from "../reviewSearch";

// Star ranges typed into the Guest reviews search (host, 2026-10-10: "when I
// need, I can type review 3 stars and below").
describe("parseReviewSearch", () => {
  it.each([
    ["review 3 stars and below", { maxStars: 3 }],
    ["3 stars or lower", { maxStars: 3 }],
    ["3 star and less", { maxStars: 3 }],
    ["below 4 stars", { maxStars: 3 }],
    ["under 4", { maxStars: 3 }],
    ["<= 3 stars", { maxStars: 3 }],
    ["4 stars and up", { minStars: 4 }],
    ["4 stars or more", { minStars: 4 }],
    ["4+ stars", { minStars: 4 }],
    ["above 3 stars", { minStars: 4 }],
    ["5 stars", { minStars: 5, maxStars: 5 }],
  ])("reads %s", (q, range) => {
    expect(parseReviewSearch(q)).toEqual({ words: [], ...range });
  });

  it("keeps the other words to search for", () => {
    expect(parseReviewSearch("3 stars and below bathroom")).toEqual({ words: ["bathroom"], maxStars: 3 });
  });

  it("leaves a search with no stars as words alone", () => {
    expect(parseReviewSearch("Han mattress")).toEqual({ words: ["han", "mattress"] });
    // A month is not a star rating.
    expect(parseReviewSearch("2026-09")).toEqual({ words: ["2026-09"] });
  });
});

describe("starsFit", () => {
  it("fits the range, and a review without stars fits only no range", () => {
    expect(starsFit(3, { words: [], maxStars: 3 })).toBe(true);
    expect(starsFit(4, { words: [], maxStars: 3 })).toBe(false);
    expect(starsFit(null, { words: [], maxStars: 3 })).toBe(false);
    expect(starsFit(null, { words: [] })).toBe(true);
  });
});
