import { describe, expect, it } from "vitest";
import { firstName } from "./firstName";

describe("firstName", () => {
  it("keeps the first word of a full name", () => {
    expect(firstName("Irina Vaysertreyger")).toBe("Irina");
    expect(firstName("  Cindy   Wang ")).toBe("Cindy");
  });
  it("leaves a one-word name, and AirBnB, as it is", () => {
    expect(firstName("Shuhui")).toBe("Shuhui");
    expect(firstName("AirBnB")).toBe("AirBnB");
  });
  it("gives an empty string for no name", () => {
    expect(firstName(undefined)).toBe("");
    expect(firstName("")).toBe("");
  });
});
