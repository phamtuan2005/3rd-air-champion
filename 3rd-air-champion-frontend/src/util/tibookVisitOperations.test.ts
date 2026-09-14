import { describe, expect, it } from "vitest";
import { shouldCountVisit, visitorIdFrom } from "./tibookVisitOperations";

// Who TiBook counts as a visitor. Both rules here protect the host's numbers
// from reading higher than the truth.

const memoryStore = (initial: Record<string, string> = {}) => {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    data,
  };
};

describe("a device's visitor id", () => {
  // If this breaks, every visit is a new person and "came back" reads zero.
  it("is the same id on every visit from the same device", () => {
    const store = memoryStore();
    let n = 0;
    const make = () => `visitor-${++n}-abcdef`;
    const first = visitorIdFrom(store, make);
    expect(visitorIdFrom(store, make)).toBe(first);
    expect(n).toBe(1);
  });

  it("replaces a stored value the server would refuse", () => {
    const store = memoryStore({ tibookVisitorId: "<oops>" });
    expect(visitorIdFrom(store, () => "fresh-id-123")).toBe("fresh-id-123");
    expect(store.data.get("tibookVisitorId")).toBe("fresh-id-123");
  });

  it("still counts the visit when storage is refused", () => {
    const refusing = {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("denied");
      },
    };
    expect(visitorIdFrom(refusing, () => "one-off-id-1")).toBe("one-off-id-1");
    expect(visitorIdFrom(null, () => "one-off-id-2")).toBe("one-off-id-2");
  });
});

describe("whose look is counted", () => {
  it("counts a guest on the live site", () => {
    expect(shouldCountVisit({ dev: false, countInDev: false, managerSignedIn: false })).toBe(true);
  });

  // The host previewing TiBook is not a guest.
  it("does not count a device signed in to TiMag", () => {
    expect(shouldCountVisit({ dev: false, countInDev: false, managerSignedIn: true })).toBe(false);
  });

  // The dev server proxies /api to production; a developer's reloads would
  // otherwise land in the real numbers.
  it("does not count the dev server unless asked to", () => {
    expect(shouldCountVisit({ dev: true, countInDev: false, managerSignedIn: false })).toBe(false);
    expect(shouldCountVisit({ dev: true, countInDev: true, managerSignedIn: false })).toBe(true);
  });
});
