import axios from "axios";
import { getToken } from "./authSession";
import { ConsentState, getConsent, readRememberedGuest } from "./guestConsent";
const BACKEND_ENDPOINT = import.meta.env.VITE_BACKEND_ENDPOINT || "";

/* ---- Guest side (TiBook): counting that someone opened it. No token. ---- */

const VISITOR_KEY = "tibookVisitorId";
// The shape the backend accepts. A stored value that is anything else (hand
// edited, truncated) is replaced rather than sent to be refused on every visit.
const VISITOR_ID = /^[A-Za-z0-9-]{8,64}$/;

type KeyValueStore = Pick<Storage, "getItem" | "setItem">;

// randomUUID only exists in a SECURE context — https or localhost. TiBook on a
// phone over the LAN (http://192.168.x.x:5173) is neither, and it threw there.
// getRandomValues has no such limit.
export const newVisitorId = (): string => {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
};

// This device's visitor id: a random string it keeps for itself, and nothing
// else — no name, no phone. That is why it needs no ask like the remembered
// phone number does (see guestConsent): it cannot say who anyone is.
//
// Where storage is refused (some private windows) every visit gets a fresh id
// and so counts as a new person. Accepted; the alternative is not counting them.
export const visitorIdFrom = (
  store: KeyValueStore | null,
  make: () => string = newVisitorId,
): string => {
  try {
    const existing = store?.getItem(VISITOR_KEY);
    if (existing && VISITOR_ID.test(existing)) return existing;
    const id = make();
    store?.setItem(VISITOR_KEY, id);
    return id;
  } catch {
    return make();
  }
};

// Whose look counts: EVERYONE's, whoever they are.
//
// This first shipped skipping any device signed in to TiMag, on the reasoning
// that the host previewing TiBook is not a guest. The house wants the opposite
// and said so plainly -- "every access to TiBook will count, no matter who".
// Anh-Tuan and Cindy opened it on a desktop and a phone, saw nothing arrive, and
// that was the rule working as written. So there is deliberately NO login check
// here. Do not add one back to "clean up" the numbers.
//
// The one exception is not a person: `npm run dev` proxies /api to the
// PRODUCTION backend, so a developer's local reloads would land in the real
// numbers. Set VITE_COUNT_TIBOOK_VISITS_IN_DEV=true in .env.development.local
// when testing this against a local backend.
export const shouldCountVisit = ({
  dev,
  countInDev,
}: {
  dev: boolean;
  countInDev: boolean;
}): boolean => !dev || countInDev;

const safeStorage = (): Storage | null => {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

// The last UTC day this page load reported. The server keeps one row per device
// per day anyway; this only saves the request when TiBook is brought back to
// the front for the tenth time on the same afternoon.
let lastCountedDay: string | null = null;

const readTimeZone = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? "";
  } catch {
    return ""; // An old browser with no Intl zone: counted, as Unknown.
  }
};

const skippedHere = () =>
  !shouldCountVisit({
    dev: import.meta.env.DEV,
    countInDev: import.meta.env.VITE_COUNT_TIBOOK_VISITS_IN_DEV === "true",
  });

// The guest's number for a visit, and ONLY with their yes on file.
//
// The house wants to see which guests visit. A guest who agreed to TiBook
// remembering their number has agreed to be recognised; one who said no, or was
// never asked, has not, and their visit stays a count. This is the single place
// that decision is made, so no call site can send a number past it -- the same
// shape as rememberGuest, which callers may fire without checking first.
export const consentedPhone = (consent: ConsentState, phone: string): string =>
  consent === "allowed" ? phone.trim() : "";

// Fire and forget. Nothing a guest is doing waits on this, and a failure to
// count must never show them an error.
export const recordTiBookVisit = (hostId: string | undefined) => {
  if (!hostId) return;
  const today = new Date().toISOString().slice(0, 10);
  if (lastCountedDay === today) return;
  if (skippedHere()) return;
  lastCountedDay = today;

  // A returning guest who already said yes is named from their first look of
  // the day. Everyone else sends NO guestPhone at all -- not "" -- because ""
  // means "unlink", and an anonymous reload must never undo a link a guest
  // made earlier the same day.
  const phone = consentedPhone(getConsent(), readRememberedGuest().phone);

  axios
    .post(`${BACKEND_ENDPOINT}/tibook-visit`, {
      host: hostId,
      visitorId: visitorIdFrom(safeStorage()),
      timeZone: readTimeZone(),
      ...(phone ? { guestPhone: phone } : {}),
    })
    .catch(() => {
      lastCountedDay = null; // try again next time the page comes forward
    });
};

// A guest has just said who they are, with their yes on file: tie TODAY's
// visit to them. Past the once-a-day guard on purpose -- today's anonymous look
// was already counted when the page opened, and without this a guest who agrees
// mid-visit would not appear until tomorrow.
export const linkTiBookVisitToGuest = (hostId: string | undefined, phone: string) => {
  const guestPhone = consentedPhone(getConsent(), phone);
  if (!hostId || !guestPhone || skippedHere()) return;
  axios
    .post(`${BACKEND_ENDPOINT}/tibook-visit`, {
      host: hostId,
      visitorId: visitorIdFrom(safeStorage()),
      timeZone: readTimeZone(),
      guestPhone,
    })
    .catch(() => {});
};

// "Not you?": the guest withdrew, so today's visit is no longer theirs. Earlier
// days keep the link they agreed to at the time; this stops it going forward.
export const unlinkTiBookVisitGuest = (hostId: string | undefined) => {
  if (!hostId || skippedHere()) return;
  axios
    .post(`${BACKEND_ENDPOINT}/tibook-visit`, {
      host: hostId,
      visitorId: visitorIdFrom(safeStorage()),
      timeZone: readTimeZone(),
      guestPhone: "",
    })
    .catch(() => {});
};

/* ---- Host side (TiMag): reading the numbers. Behind the JWT gate. ---- */

export type SpanKey = "today" | "week" | "month" | "year" | "all";

export interface SeriesPoint {
  start: string; // yyyy-MM-dd, or yyyy-MM for a month
  visitors: number;
  cameBack: number;
}

export interface SpanStats {
  key: SpanKey;
  label: string;
  from: string | null;
  to: string;
  visitors: number;
  cameBack: number;
  // Null when there is nothing fair to compare with — see tibookVisitorStats.
  previousVisitors: number | null;
  continents: { continent: string; visitors: number }[];
  // Guests who let TiBook remember them. `name` comes from the house's own guest
  // records; null for a number nobody has booked under yet.
  guests: { phone: string; name: string | null; days: number; lastDay: string }[];
  seriesUnit: "day" | "month" | null;
  series: SeriesPoint[];
}

export interface TiBookVisitorStats {
  since: string | null;
  today: string;
  spans: SpanStats[];
}

export const fetchTiBookVisitorStats = async (): Promise<TiBookVisitorStats> => {
  const response = await axios.get(`${BACKEND_ENDPOINT}/tibook-stats`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  // CloudFront answers some failures with index.html and a 200 (see
  // authenticateJWT). Without this the modal would try to draw a web page.
  if (!Array.isArray(response.data?.spans)) {
    throw new Error("The visitor numbers did not come back");
  }
  return response.data;
};
