import { describe, expect, it } from "vitest";
import { cleanerLeadLine } from "./ttQuestionLog";

// The sentence under a review about who cleaned the room — shared by TT's
// answers and the Guest reviews list (2026-10-10). Always a lead, never proof.
describe("cleanerLeadLine", () => {
  it("names the cleaner of a known night as a lead", () => {
    expect(cleanerLeadLine("night", ["Henry"])).toBe("Cleaned for that stay by Henry — a lead, not proof.");
  });
  it("lists everyone who cleaned the room in a month-only review", () => {
    expect(cleanerLeadLine("month", ["Henry", "Mai"])).toBe("Cleaned this room that month: Henry, Mai — a lead, not proof.");
  });
  it("says why there is no one, rather than leave a gap", () => {
    expect(cleanerLeadLine("night", [])).toBe("No cleaning recorded for this room then.");
    expect(cleanerLeadLine("none")).toMatch(/No date on this review/);
    expect(cleanerLeadLine("before")).toMatch(/Before cleaning was recorded/);
  });
});
