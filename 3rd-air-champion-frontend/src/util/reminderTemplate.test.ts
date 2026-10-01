import { describe, expect, it } from "vitest";
import { DEFAULT_TEMPLATE, resolveTemplate } from "./reminderTemplate";
import type { bookingType } from "./types/bookingType";

// The house rules in a reminder: in the template where {{houseRules}} sits,
// appended for a template saved before the placeholder existed, and absent
// when the host took the placeholder out on purpose (2026-10-01).

const booking = {
  guest: { name: "Susan", alias: "" },
  alias: "",
  room: { name: "King", roomCode: "1224#" },
  startDate: "2026-10-19",
  endDate: "2026-10-20",
  duration: 2,
} as unknown as bookingType;

const RULES = "No smoking. Quiet after 10pm.";
const NO_PLACEHOLDER = "Hello {{name}}, see you on {{startDate}}. Door code {{doorCode}}.";

describe("house rules in a reminder", () => {
  it("land where the placeholder is", () => {
    const msg = resolveTemplate(DEFAULT_TEMPLATE, booking, "Oct 19", "4321", "", "", RULES, true);
    expect(msg.endsWith(RULES)).toBe(true);
    expect(msg).not.toContain("{{houseRules}}");
  });

  it("are appended for a template saved before the placeholder existed", () => {
    const msg = resolveTemplate(NO_PLACEHOLDER, booking, "Oct 19", "4321", "", "", RULES, false);
    expect(msg.endsWith(`\n\n${RULES}`)).toBe(true);
  });

  it("stay out when the host removed the placeholder on purpose", () => {
    const msg = resolveTemplate(NO_PLACEHOLDER, booking, "Oct 19", "4321", "", "", RULES, true);
    expect(msg).not.toContain(RULES);
    expect(msg).toBe("Hello Susan, see you on Oct 19. Door code 4321.");
  });

  it("leave no stray placeholder or blank lines when no rules are set", () => {
    const msg = resolveTemplate(DEFAULT_TEMPLATE, booking, "Oct 19", "4321", "", "", "", true);
    expect(msg).not.toContain("{{houseRules}}");
    expect(msg.endsWith("pleasant stay!")).toBe(true);
  });
});
