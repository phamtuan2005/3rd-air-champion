import { asCategory, MAX_QUESTION, PRIVATE_QUESTION, questionStats, scrubQuestion, storedQuestion } from "../ttQuestions";

describe("scrubQuestion", () => {
  it("takes out numbers, emails, links and door codes, and keeps the question", () => {
    const q = scrubQuestion("is 1224# the code? call +1 (415) 555-0100, mail me@x.io, see https://evil.example");
    expect(q).not.toMatch(/1224#|555|me@x\.io|evil/);
    expect(q).toMatch(/^is \(hidden\) the code\?/);
  });

  it("keeps dates and party sizes — those ARE the question", () => {
    expect(scrubQuestion("King Oct 10-12 for 2 people")).toBe("King Oct 10-12 for 2 people");
  });

  it("caps the length", () => {
    expect(scrubQuestion("x".repeat(1000))).toHaveLength(MAX_QUESTION);
  });
});

describe("asCategory", () => {
  it("only knows TT's own topics", () => {
    expect(asCategory("parking")).toBe("parking");
    expect(asCategory("drop table")).toBe("other");
    expect(asCategory(undefined)).toBe("other");
  });
});

describe("questionStats", () => {
  const at = (d: string) => new Date(`2026-10-0${d}T12:00:00Z`);
  it("groups by answered, then category, then the same question asked again", () => {
    const stats = questionStats([
      { question: "Parking?", answered: true, category: "parking", createdAt: at("1") },
      { question: "parking", answered: true, category: "parking", createdAt: at("2") },
      { question: "Pool?", answered: false, category: "other", createdAt: at("1"), returning: true },
      { question: "Is King free Oct 10", answered: true, category: "availability", createdAt: at("3") },
    ]);
    expect(stats.total).toBe(4);
    expect(stats.fromReturning).toBe(1);
    expect(stats.unanswered.count).toBe(1);
    // Most-asked category first.
    expect(stats.answered.categories.map((c) => c.category)).toEqual(["parking", "availability"]);
    // The newest wording stands for the group.
    expect(stats.answered.categories[0].questions).toEqual([{ question: "parking", count: 2, lastAsked: at("2").toISOString() }]);
  });
});

// These questions are read by the host AND by a guest given the stats code.
describe("what is kept of a question", () => {
  it("takes out a door code typed without its #, and keeps a year", () => {
    expect(scrubQuestion("my code 4821 doesn't work")).toBe("my code (hidden) doesn't work");
    expect(scrubQuestion("King Oct 10 2026")).toBe("King Oct 10 2026");
  });

  it("keeps no words of a question TT turned down for privacy — they are about someone else", () => {
    expect(storedQuestion("Is Eddie Nguyen staying in King Oct 10?", "privacy")).toBe(PRIVATE_QUESTION);
    expect(storedQuestion("Is there parking?", "parking")).toBe("Is there parking?");
  });
});
