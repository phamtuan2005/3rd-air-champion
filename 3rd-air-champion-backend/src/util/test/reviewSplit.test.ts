import { chunkText, CHUNK_CHARS, monthFromShown, OVERLAP_CHARS, splitReviews } from "../reviewSplit";

// What comes back is the model's; what is DONE with it is ours. These pin the
// parts the model cannot be trusted with: that no line is lost in chunking,
// that a review seen twice (the overlap) is kept once, and that a made-up star
// count or month is not believed.

const fake = (replies: any[]) => {
  let n = 0;
  return {
    beta: {
      messages: {
        create: async () => ({
          stop_reason: "end_turn",
          content: [{ type: "text", text: JSON.stringify(replies[Math.min(n++, replies.length - 1)]) }],
        }),
      },
    },
  } as any;
};

describe("chunkText", () => {
  it("is one chunk for a short page", () => {
    expect(chunkText("a\nb\nc")).toEqual(["a\nb\nc"]);
  });

  it("cuts a long page at line ends, loses no line, and overlaps so a split review reappears whole", () => {
    const lines = Array.from({ length: 4000 }, (_, i) => `line ${i} ${"x".repeat(20)}`);
    const chunks = chunkText(lines.join("\n"));
    expect(chunks.length).toBeGreaterThan(1);
    chunks.forEach((c) => expect(c.length).toBeLessThanOrEqual(CHUNK_CHARS));
    // Every line appears in some chunk.
    const all = new Set(chunks.flatMap((c) => c.split("\n")));
    lines.forEach((l) => expect(all.has(l)).toBe(true));
    // And each chunk starts back inside the one before.
    const firstOfSecond = chunks[1].split("\n")[0];
    expect(chunks[0]).toContain(firstOfSecond);
    expect(chunks[0].length - chunks[0].indexOf(firstOfSecond)).toBeLessThanOrEqual(OVERLAP_CHARS + 200);
  });

  it("makes progress even when one line is longer than a chunk", () => {
    const chunks = chunkText(["short", "L".repeat(CHUNK_CHARS + 500), "tail"].join("\n"));
    expect(chunks.join("\n")).toContain("tail");
    expect(chunks.length).toBeLessThan(10);
  });
});

describe("splitReviews", () => {
  it("returns each review with its name, stars, month and exact words", async () => {
    const client = fake([
      { reviews: [{ guestName: "Alcides", stars: 5, when: "February 2025", text: "Spotless and quiet." }] },
    ]);
    expect(await splitReviews("anything", undefined, client)).toEqual([
      { guestName: "Alcides", stars: 5, month: "2025-02", when: "February 2025", text: "Spotless and quiet." },
    ]);
  });

  it("keeps a review that two overlapping chunks both returned once", async () => {
    const lines = Array.from({ length: 4000 }, (_, i) => `line ${i} ${"x".repeat(20)}`).join("\n");
    const same = { guestName: "A", stars: 4, when: "", text: "Same words  here" };
    const client = fake([{ reviews: [same] }, { reviews: [{ ...same, text: "same words here" }] }, { reviews: [] }]);
    const out = await splitReviews(lines, undefined, client);
    expect(out).toHaveLength(1);
  });

  it("does not believe a star count outside 1–5 or a month that is not a month", async () => {
    const client = fake([
      {
        reviews: [
          { guestName: "B", stars: 0, when: "", text: "no stars given" },
          { guestName: "C", stars: 9, when: "sometime", text: "nonsense" },
        ],
      },
    ]);
    const out = await splitReviews("x", undefined, client);
    expect(out.map((r) => [r.stars, r.month])).toEqual([[null, ""], [null, ""]]);
  });

  it("drops an empty review and reports progress", async () => {
    const seen: string[] = [];
    const client = fake([{ reviews: [{ guestName: "D", stars: 3, when: "", text: "   " }] }]);
    const out = await splitReviews("x", (d, t) => seen.push(`${d}/${t}`), client);
    expect(out).toEqual([]);
    expect(seen).toEqual(["0/1", "1/1"]);
  });

  it("says so when Claude declines, rather than returning nothing quietly", async () => {
    const client = { beta: { messages: { create: async () => ({ stop_reason: "refusal", content: [] }) } } } as any;
    await expect(splitReviews("x", undefined, client)).rejects.toThrow(/declined/);
  });
});

describe("monthFromShown", () => {
  // Mid-month, so a week back stays in the month and a month back does not.
  const today = new Date("2026-10-07T12:00:00Z");

  it("takes 'Month YYYY' as printed", () => {
    expect(monthFromShown("February 2025", today)).toBe("2025-02");
    expect(monthFromShown(" december 2024 ", today)).toBe("2024-12");
  });

  it("counts a relative date back from the day it was pasted", () => {
    expect(monthFromShown("1 week ago", today)).toBe("2026-09");
    expect(monthFromShown("a week ago", today)).toBe("2026-09");
    expect(monthFromShown("3 days ago", today)).toBe("2026-10");
    expect(monthFromShown("3 months ago", today)).toBe("2026-07");
    expect(monthFromShown("2 years ago", today)).toBe("2024-10");
    expect(monthFromShown("yesterday", today)).toBe("2026-10");
  });

  it("crosses a year end correctly", () => {
    expect(monthFromShown("2 months ago", new Date("2026-01-15T12:00:00Z"))).toBe("2025-11");
  });

  it("gives no month rather than an invented one", () => {
    expect(monthFromShown("", today)).toBe("");
    expect(monthFromShown("sometime", today)).toBe("");
    expect(monthFromShown("Smarch 2025", today)).toBe("");
  });
});
