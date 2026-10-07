import { HEAD_CHARS, lookupReviews, MAX_PASSAGES, ReviewFile } from "../reviewLookup";

// The agent must never be handed a whole review file — it would ride along on
// every later turn — and must always be told how much it did NOT see.

const file = (room: string, text: string): ReviewFile => ({ room, name: `${room}.txt`, chars: text.length, savedAt: null, text });

describe("lookupReviews", () => {
  it("gives the top of a long file and says it is only the top", () => {
    const [r]: any = lookupReviews([file("King", "N".repeat(HEAD_CHARS) + "OLDEST")], {});
    expect(r.excerpt).toHaveLength(HEAD_CHARS);
    expect(r.excerpt).not.toContain("OLDEST");
    expect(r.note).toMatch(/Showing the first/);
    expect(r.characters).toBe(HEAD_CHARS + 6);
  });

  it("says when it has shown the whole file", () => {
    const [r]: any = lookupReviews([file("King", "Great stay")], {});
    expect(r.excerpt).toBe("Great stay");
    expect(r.note).toBe("This is the whole file.");
  });

  it("narrows to the room asked for, by part of its name", () => {
    const out = lookupReviews([file("King", "a"), file("Queen", "b"), file("Cozy", "c")], { room: "qu" });
    expect(out.map((r) => r.room)).toEqual(["Queen"]);
  });

  it("finds passages around a word, case-insensitively, and counts every match", () => {
    const text = "Lovely. " + "x".repeat(2000) + " The bathroom was DIRTY on arrival. " + "y".repeat(2000) + " Bathroom spotless later.";
    const [r]: any = lookupReviews([file("King", text)], { search: "bathroom" });
    expect(r.matches).toBe(2);
    expect(r.passages).toHaveLength(2);
    expect(r.passages[0]).toContain("DIRTY");
  });

  it("caps the passages, but still reports how many matches there were", () => {
    const text = Array.from({ length: 30 }, () => "noise ".repeat(300) + "cold").join(" ");
    const [r]: any = lookupReviews([file("King", text)], { search: "cold" });
    expect(r.matches).toBe(30);
    expect(r.passages.length).toBe(MAX_PASSAGES);
    expect(r.note).toMatch(/30 matches; showing 8/);
  });

  it("says plainly when a word is not there", () => {
    const [r]: any = lookupReviews([file("King", "Great stay")], { search: "noise" });
    expect(r.matches).toBe(0);
    expect(r.note).toMatch(/does not appear/);
  });
});
