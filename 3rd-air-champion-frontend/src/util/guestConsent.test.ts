import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  forgetGuest,
  getConsent,
  readRememberedGuest,
  rememberGuest,
  revokeConsent,
  setConsent,
} from "./guestConsent";

// vitest runs these in the `node` environment, which has no localStorage — the
// same as a browser that refuses it. Stubbed here so the rules can be tested;
// one case below removes it entirely, which is the Safari-private-mode path.
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

describe("guestConsent", () => {
  it("has no answer on file until the guest gives one", () => {
    expect(getConsent()).toBeNull();
  });

  it("does not save the number until the guest has said yes", () => {
    // The whole point of the disclaimer: a guest who has not answered has
    // nothing written down about them.
    rememberGuest("4085551234", "Ann");
    expect(readRememberedGuest()).toEqual({ phone: "", name: "" });
  });

  it("saves and reads back the number once allowed", () => {
    setConsent("allowed");
    rememberGuest("4085551234", "Ann");
    expect(readRememberedGuest()).toEqual({ phone: "4085551234", name: "Ann" });
  });

  it("never saves the number after a no", () => {
    setConsent("denied");
    rememberGuest("4085551234", "Ann");
    expect(readRememberedGuest()).toEqual({ phone: "", name: "" });
  });

  it("erases an already-saved number when the guest changes to no", () => {
    setConsent("allowed");
    rememberGuest("4085551234", "Ann");
    setConsent("denied");
    // Withdrawing consent has to take the data with it, or "no" only applies to
    // numbers we have not collected yet.
    expect(localStorage.getItem("tiBookGuestPhone")).toBeNull();
    expect(localStorage.getItem("tiBookGuestName")).toBeNull();
  });

  it("ignores a number left in storage from before the guest was ever asked", () => {
    // Guests who used TiBook before this prompt existed have a number on disk
    // with no answer beside it. Reading it back would be acting on a consent
    // nobody ever gave.
    localStorage.setItem("tiBookGuestPhone", "4085551234");
    localStorage.setItem("tiBookGuestName", "Ann");
    expect(getConsent()).toBeNull();
    expect(readRememberedGuest()).toEqual({ phone: "", name: "" });
  });

  it("remembers the no, so the guest is asked once and not on every visit", () => {
    setConsent("denied");
    expect(getConsent()).toBe("denied");
  });

  it("clears the stored answer along with the number on 'Not you?'", () => {
    // The disclaimer tells the guest this button clears it from this device.
    // It used to keep the "allowed", so the next number they typed was saved
    // silently with no prompt — the dialog pointing at a control that did not
    // do what it said. Nothing about them may survive this.
    setConsent("allowed");
    rememberGuest("4085551234", "Ann");
    revokeConsent();
    expect(getConsent()).toBeNull();
    expect(readRememberedGuest()).toEqual({ phone: "", name: "" });
    expect(localStorage.getItem("tiBookRememberConsent")).toBeNull();
  });

  it("asks again after 'Not you?' rather than assuming a no", () => {
    // Back to unasked, not "denied": they said "this is not me", which is not
    // the same as "never remember me". The next number gets a fresh ask.
    setConsent("allowed");
    rememberGuest("4085551234", "Ann");
    revokeConsent();
    expect(getConsent()).toBeNull();

    setConsent("allowed");
    rememberGuest("4085559999", "Bea");
    expect(readRememberedGuest()).toEqual({ phone: "4085559999", name: "Bea" });
  });

  it("does not write a blank over a good number", () => {
    setConsent("allowed");
    rememberGuest("4085551234", "Ann");
    rememberGuest("", "");
    expect(readRememberedGuest()).toEqual({ phone: "4085551234", name: "Ann" });
  });

  it("carries on when the browser refuses storage entirely", () => {
    // Private browsing throws on access rather than returning null, and that
    // guest is precisely the one who cares. Nothing here may throw into the
    // render — the visit works, it just is not remembered.
    vi.stubGlobal("localStorage", {
      get length(): number {
        throw new Error("denied");
      },
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("denied");
      },
      removeItem: () => {
        throw new Error("denied");
      },
      clear: () => {
        throw new Error("denied");
      },
      key: () => {
        throw new Error("denied");
      },
    } as unknown as Storage);

    expect(() => setConsent("allowed")).not.toThrow();
    expect(() => rememberGuest("4085551234", "Ann")).not.toThrow();
    expect(() => forgetGuest()).not.toThrow();
    expect(getConsent()).toBeNull();
    expect(readRememberedGuest()).toEqual({ phone: "", name: "" });
  });
});
