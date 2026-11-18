import { describe, expect, it } from "vitest";
import { readHostView, tibookHostViewHref } from "./tibookHostView";

const hashOf = (href: string) => href.slice(href.indexOf("#"));

describe("TiBook as one guest sees it", () => {
  it("carries the guest in the hash, so the server never sees the number", () => {
    const href = tibookHostViewHref("(408) 555-1234", "Susan Lee");
    expect(href.startsWith("/book#")).toBe(true);
    expect(href).not.toContain("?");
    expect(readHostView(hashOf(href), true)).toEqual({ phone: "4085551234", name: "Susan Lee" });
  });

  it("is plain TiBook on a browser without TiMag signed in — a forwarded link opens nobody's stays", () => {
    expect(readHostView(hashOf(tibookHostViewHref("4085551234", "Susan")), false)).toBeNull();
  });

  it("does without a name", () => {
    expect(readHostView(hashOf(tibookHostViewHref("4085551234", "")), true)).toEqual({ phone: "4085551234", name: "" });
  });

  it("ignores a hash that is not a guest", () => {
    expect(readHostView("", true)).toBeNull();
    expect(readHostView("#top", true)).toBeNull();
    expect(readHostView("#as=123", true)).toBeNull();
  });
});
