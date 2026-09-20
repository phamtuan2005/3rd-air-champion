import { beforeEach, describe, expect, it, vi } from "vitest";
import { markTiBookVisited, readTiBookVisited } from "./tibookReturning";

// vitest runs these in the `node` environment, which has no localStorage — the
// same as a browser that refuses it. Stubbed here so the rule can be tested;
// one case below removes it entirely, which is the private-mode path.
const makeStorage = () => {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
    key: (i: number) => [...map.keys()][i] ?? null,
    get length() {
      return map.size;
    },
  } as Storage;
};

beforeEach(() => {
  vi.stubGlobal("localStorage", makeStorage());
});

describe("tibookReturning", () => {
  it("treats a device it has never seen as a first look", () => {
    expect(readTiBookVisited()).toBe(false);
  });

  it("knows the device once TiBook has been open on it", () => {
    markTiBookVisited();
    expect(readTiBookVisited()).toBe(true);
  });

  // The day-one case. These guests have been booking here for months; the flag
  // is what is new, not them, and greeting them as strangers would be the app
  // failing to notice what it already knows.
  it.each([
    ["the visit counter's id", "tibookVisitorId", "abc12345"],
    ["a TiBook sign-in token", "tiBookToken", "jwt.value.here"],
    ["an answer about remembering their number", "tiBookRememberConsent", "denied"],
    ["a palette they picked", "tiBookTheme", "teal"],
  ])("counts %s from before the flag existed as having been here", (_what, key, value) => {
    localStorage.setItem(key, value);
    expect(readTiBookVisited()).toBe(true);
  });

  it("does not mistake an unrelated key for a previous visit", () => {
    localStorage.setItem("timagToken", "someone-elses-app");
    expect(readTiBookVisited()).toBe(false);
  });

  // Private browsing throws on access rather than returning null. The guest
  // gets the quiet white app every time, which is the harmless way round — the
  // alternative is a provider that throws before anything is drawn.
  it("reads as a first look, and does not throw, where storage is refused", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("private mode");
      },
      setItem: () => {
        throw new Error("private mode");
      },
    } as unknown as Storage);
    expect(() => markTiBookVisited()).not.toThrow();
    expect(readTiBookVisited()).toBe(false);
  });

  // The freeze is the part that keeps a first visit feeling like one visit. If
  // the answer were read live, writing the flag on arrival would turn the guest
  // into a returning one mid-visit, and any remount of the theme provider —
  // StrictMode does exactly that in development — would drop them out of
  // Classic and into Hero while they were using it.
  it("holds its answer for the page load, even after the visit is marked", async () => {
    vi.resetModules();
    const fresh = await import("./tibookReturning");
    expect(fresh.hasVisitedTiBookBefore()).toBe(false);
    fresh.markTiBookVisited();
    expect(fresh.readTiBookVisited()).toBe(true); // written
    expect(fresh.hasVisitedTiBookBefore()).toBe(false); // but not until next time
  });
});
