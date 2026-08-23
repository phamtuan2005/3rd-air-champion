import { describe, expect, it } from "vitest";
import { cancellationHeadline, formatCancellationPolicy } from "./cancellationPolicy";
import { formatPhone, toStoredPhone } from "./formatPhone";
import { decimalToHm, formatHrMin, hmToDecimal } from "./hoursFormat";

// Things a guest or a worker reads, and the shapes they are stored in.
//
// None of this looks fragile, which is the point: each one is a small function
// that an unfamiliar tidy-up would happily "simplify", and each simplification
// breaks something a person sees or is paid by.

describe("the cancellation policy a guest agrees to", () => {
  it("states the tiers without a gap or an overlap", () => {
    // 7 and 3: full at 7+, half at 3-6, none within 3. Every day is covered by
    // exactly one tier — a guest must never be able to read two answers.
    const text = formatCancellationPolicy(7, 3);
    expect(text).toContain("Full refund if you cancel 7+ days before check-in");
    expect(text).toContain("50% refund if 3–6 days before");
    expect(text).toContain("No refund within 3 days");
  });

  it("leads with the generous half", () => {
    // Read at booking time this is reassurance, not a warning.
    expect(formatCancellationPolicy(7, 3).indexOf("Full refund")).toBeLessThan(
      formatCancellationPolicy(7, 3).indexOf("No refund"),
    );
  });

  it("the headline names the free window", () => {
    expect(cancellationHeadline(7)).toBe("Free cancellation up to 7 days before check-in");
  });
});

describe("phone numbers", () => {
  it("keeps a typed + — it is the only thing marking a number as foreign", () => {
    // Stripping it turned a German +49 into a 13-digit US number the server
    // rejected. A guest could not be saved at all.
    expect(toStoredPhone("+49 151 12345678")).toBe("+4915112345678");
  });

  it("strips formatting from a domestic number", () => {
    expect(toStoredPhone("(408) 555-1234")).toBe("4085551234");
  });

  it("does not invent a + for a number typed without one", () => {
    expect(toStoredPhone("4085551234").startsWith("+")).toBe(false);
  });

  it("displays a US number the way people say it", () => {
    expect(formatPhone("4085551234")).toBe("(408) 555-1234");
    expect(formatPhone("14085551234")).toBe("+1 (408) 555-1234");
  });

  it("hands back anything it cannot format rather than mangling it", () => {
    expect(formatPhone("+49 1511 2345678")).toBe("+49 1511 2345678");
  });
});

describe("worked time", () => {
  it("never shows a decimal hour — nobody works 0.9166 hours", () => {
    expect(formatHrMin(0.9166666666)).toBe("55m");
    expect(formatHrMin(1.5833333)).toBe("1h 35m");
  });

  it("drops the half that is zero", () => {
    expect(formatHrMin(2)).toBe("2h");
    expect(formatHrMin(0.25)).toBe("15m");
  });

  it("survives the round trip a form does to it", () => {
    // Typed as hours and minutes, stored as decimal, reopened for editing.
    // A guest of an hour and thirty-five minutes must not come back as 1h 34m.
    const dec = hmToDecimal("1", "35");
    expect(decimalToHm(dec)).toEqual({ h: "1", m: "35" });
    expect(formatHrMin(dec)).toBe("1h 35m");
  });

  it("treats empty inputs as nothing worked, not NaN", () => {
    expect(hmToDecimal("", "")).toBe(0);
    expect(formatHrMin(0)).toBe("0m");
  });
});
