import { describe, expect, it } from "vitest";
import { guestsFromAlias, tidyAlias } from "./airbnbAlias";

describe("the count AirBnB already wrote in the name", () => {
  it('reads "Isaac’s group of 2" as exactly 2', () => {
    expect(guestsFromAlias("Isaac’s group of 2")).toEqual({ count: 2, exact: true });
  });

  it("reads a larger party exactly too", () => {
    expect(guestsFromAlias("Isaac’s group of 3")).toEqual({ count: 3, exact: true });
    expect(guestsFromAlias("Mai’s group of 4")).toEqual({ count: 4, exact: true });
  });

  it("takes the straight apostrophe a paste may have converted", () => {
    expect(guestsFromAlias("Isaac's group of 2")).toEqual({ count: 2, exact: true });
  });

  it("is not fussy about case or spacing", () => {
    expect(guestsFromAlias("Isaac’s Group Of 2")).toEqual({ count: 2, exact: true });
  });
});

describe("a possessive with no number", () => {
  // Two is the FLOOR, not a guess at the real figure — it can only under-count,
  // which the host corrects, rather than promise a sofa bed nobody needs.
  it("gives 2, marked as not exact", () => {
    expect(guestsFromAlias("Isaac’s")).toEqual({ count: 2, exact: false });
    expect(guestsFromAlias("David's")).toEqual({ count: 2, exact: false });
  });
});

describe("names that must be left alone", () => {
  // The whole risk of this heuristic: every guest called Chris gains a guest
  // who does not exist.
  it("does not read a plain name ending in s as a possessive", () => {
    expect(guestsFromAlias("Chris")).toBeNull();
    expect(guestsFromAlias("James")).toBeNull();
    expect(guestsFromAlias("Desmond")).toBeNull();
    expect(guestsFromAlias("Isaacs")).toBeNull();
  });

  it("leaves an ordinary single name alone", () => {
    expect(guestsFromAlias("Isaac")).toBeNull();
    expect(guestsFromAlias("Sean Yoo")).toBeNull();
  });

  it("has nothing to say about an empty box", () => {
    expect(guestsFromAlias("")).toBeNull();
    expect(guestsFromAlias("   ")).toBeNull();
  });
});

describe("a party larger than the form offers", () => {
  // Clamped rather than dropped: the count still moves off 1, so the host sees
  // it needs attention instead of the number silently staying wrong.
  it("clamps to 4 and still reports exact", () => {
    expect(guestsFromAlias("Isaac’s group of 7")).toEqual({ count: 4, exact: true });
  });
});

describe("tidying the pasted line down to a name", () => {
  // The host pastes the whole AirBnB line rather than retyping half of it; the
  // bar it ends up on has a day column to fit.
  it("drops the group tail and the possessive", () => {
    expect(tidyAlias("Isaac’s group of 2")).toBe("Isaac");
    expect(tidyAlias("Isaac's group of 3")).toBe("Isaac");
    expect(tidyAlias("Isaac’s")).toBe("Isaac");
  });

  it("leaves an ordinary name exactly as it is", () => {
    expect(tidyAlias("Isaac")).toBe("Isaac");
    expect(tidyAlias("Sean Yoo")).toBe("Sean Yoo");
    expect(tidyAlias("Chris")).toBe("Chris");
    expect(tidyAlias("Isaacs")).toBe("Isaacs");
  });

  it("keeps a two-part name whole", () => {
    expect(tidyAlias("Mai Linh’s group of 2")).toBe("Mai Linh");
  });

  it("copes with an empty box", () => {
    expect(tidyAlias("")).toBe("");
  });
});
