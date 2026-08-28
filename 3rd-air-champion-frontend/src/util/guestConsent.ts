// Whether TiBook may remember a guest on THIS device.
//
// Their phone number is what identifies a guest to us — it pulls up their
// stays, their wish list, and their own agreed rate. Keeping it means the next
// visit costs them no typing. But it is their number, kept on their phone, and
// we were keeping it without ever saying so. This module is where we ask.
//
// Everything that saves guest identity goes through here rather than touching
// localStorage directly. Two rules for "may we keep this" would eventually
// disagree, and the guest would be the one to find out.

const CONSENT_KEY = "tiBookRememberConsent";
const PHONE_KEY = "tiBookGuestPhone";
const NAME_KEY = "tiBookGuestName";

export type ConsentChoice = "allowed" | "denied";

// null = never asked. Distinct from "denied" on purpose: an unanswered guest
// should see the disclaimer, a guest who said no should never be nagged again.
export type ConsentState = ConsentChoice | null;

// Safari in private mode throws on localStorage rather than returning null, and
// a guest browsing privately is exactly the guest who cares about this. Every
// access is wrapped: not being able to remember is a normal outcome here, not
// an error worth breaking the page over.
const readKey = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

const writeKey = (key: string, value: string): void => {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage unavailable — the session still works, it just won't outlive it */
  }
};

const removeKey = (key: string): void => {
  try {
    localStorage.removeItem(key);
  } catch {
    /* nothing to do: if we cannot reach storage, there is nothing stored */
  }
};

export const getConsent = (): ConsentState => {
  const raw = readKey(CONSENT_KEY);
  return raw === "allowed" || raw === "denied" ? raw : null;
};

// The choice itself is kept on the device, including "denied". Storing a no is
// the only way to honour it without asking again on every visit — so it holds
// no phone number, no name, nothing that identifies anyone. A guest who clears
// their browser data clears this too and gets asked again, which is right.
export const setConsent = (choice: ConsentChoice): void => {
  writeKey(CONSENT_KEY, choice);
  if (choice === "denied") forgetGuest();
};

export const readRememberedGuest = (): { phone: string; name: string } => {
  // Guard on consent rather than trusting what is on disk. A number left over
  // from before this prompt existed, or from a guest who has since said no, is
  // not ours to read back at them.
  if (getConsent() !== "allowed") return { phone: "", name: "" };
  return { phone: readKey(PHONE_KEY) ?? "", name: readKey(NAME_KEY) ?? "" };
};

// Saves only with a yes on file. Callers may fire this on every phone
// confirmation without checking first — a guest who said no simply is not
// written down, and their current visit carries on from React state.
export const rememberGuest = (phone: string, name?: string): void => {
  if (getConsent() !== "allowed") return;
  if (phone.trim()) writeKey(PHONE_KEY, phone);
  if (name?.trim()) writeKey(NAME_KEY, name);
};

export const forgetGuest = (): void => {
  removeKey(PHONE_KEY);
  removeKey(NAME_KEY);
};

// "Not you?" — the guest changing their mind. Takes the stored ANSWER with the
// data, so nothing about them is left on the device at all.
//
// This used to keep the "allowed" on file, on the reasoning that fixing a typo
// is not withdrawing consent. But the disclaimer tells the guest that "Not
// you?" clears it from this device, and it did not: the next number they typed
// was saved again silently, with no prompt, because the yes was still sitting
// there. A consent dialog that points at a control which does not do what it
// says is worse than no dialog.
//
// Back to unasked rather than "denied" on purpose. They said "this is not me",
// not "never remember me" — so the next number they confirm gets a fresh ask
// and their real choice, instead of a no they never actually gave.
export const revokeConsent = (): void => {
  removeKey(CONSENT_KEY);
  forgetGuest();
};
