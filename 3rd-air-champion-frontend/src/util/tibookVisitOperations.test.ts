import { describe, expect, it } from "vitest";
import { consentedPhone, shouldCountVisit, visitorIdFrom } from "./tibookVisitOperations";

// Who TiBook counts as a visitor: everyone who opens it, once a day per device.
//
// There used to be a rule here that a device signed in to TiMag was not counted.
// The house reversed it -- every access counts, no matter who -- so the only
// thing still kept out is the dev server, which is not a person at all.

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
  // Guest, host, cohost -- the live site counts whoever opens it. The decision
  // takes no login at all: that absence IS the rule, and a login input
  // reappearing here would be the old skip coming back.
  it("counts every visit on the live site, whoever is looking", () => {
    expect(shouldCountVisit({ dev: false, countInDev: false })).toBe(true);
  });

  // The dev server proxies /api to production; a developer's reloads would
  // otherwise land in the real numbers.
  it("does not count the dev server unless asked to", () => {
    expect(shouldCountVisit({ dev: true, countInDev: false })).toBe(false);
    expect(shouldCountVisit({ dev: true, countInDev: true })).toBe(true);
  });
});

describe("whose number a visit may carry", () => {
  // The whole privacy promise rests on this: a visit names a guest only after
  // they agreed to be remembered. If this breaks, TiMag lists guests who said no.
  it("carries the guest's number only once they have said yes", () => {
    expect(consentedPhone("allowed", " (408) 555-1234 ")).toBe("(408) 555-1234");
  });

  it("carries nothing for a guest who said no, or was never asked", () => {
    expect(consentedPhone("denied", "(408) 555-1234")).toBe("");
    expect(consentedPhone(null, "(408) 555-1234")).toBe("");
  });
});

