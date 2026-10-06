import { describe, expect, it } from "vitest";
import { splitForUpload } from "./pasteParts";

// The line that matters is outside this app: CloudFront drops any request body
// of 8,192 bytes or more. These pin that no part can reach it, whatever the
// text is made of, and that cutting loses nothing.
const weigh = (part: string) => new TextEncoder().encode(JSON.stringify({ text: part })).length;

describe("splitForUpload", () => {
  it("gives back exactly the text, in order, when joined", () => {
    const text = Array.from({ length: 5000 }, (_, i) => `Review ${i}: lovely, clean, quiet.\n`).join("");
    expect(splitForUpload(text).join("")).toBe(text);
  });

  it("keeps every part far under 8,192 bytes, even for text that weighs more than it looks", () => {
    const cases = [
      "A".repeat(100_000),
      "é".repeat(60_000), // 2 bytes each
      "好".repeat(60_000), // 3 bytes each
      "😊".repeat(30_000), // 4 bytes each, two UTF-16 units
      '"\\\n'.repeat(30_000), // every character escaped to two
    ];
    for (const text of cases) {
      const parts = splitForUpload(text);
      expect(parts.join("")).toBe(text);
      parts.forEach((p) => expect(weigh(p)).toBeLessThan(7000));
    }
  });

  it("sends nothing for no text, and one part for a short one", () => {
    expect(splitForUpload("")).toEqual([]);
    expect(splitForUpload("Great stay")).toEqual(["Great stay"]);
  });
});
