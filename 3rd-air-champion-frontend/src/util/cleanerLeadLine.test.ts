import { describe, expect, it } from "vitest";
import { cleanerLeadLine } from "./ttQuestionLog";

// The sentence under a review about who cleaned the room — shared by TT's
// answers and the Guest reviews list (2026-10-10). Plainly what is on record.
describe("cleanerLeadLine", () => {
  it("names who prepared the room for a known stay", () => {
    expect(cleanerLeadLine("night", ["Henry"])).toBe("Room prepared by Henry");
  });
  it("lists everyone who cleaned the room in a month-only review", () => {
    expect(cleanerLeadLine("month", ["Henry", "Mai"])).toBe("Cleaned that month by Henry, Mai");
  });
  it("says why there is no one, rather than leave a gap", () => {
    expect(cleanerLeadLine("night", [])).toBe("No cleaning recorded for this room then.");
    expect(cleanerLeadLine("none")).toMatch(/No date on this review/);
    expect(cleanerLeadLine("before")).toMatch(/Before cleaning was recorded/);
  });
});
