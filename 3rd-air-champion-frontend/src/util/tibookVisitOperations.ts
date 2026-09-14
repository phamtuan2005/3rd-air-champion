import axios from "axios";
import { getToken } from "./authSession";
import { isTokenValid } from "./validateJWT";
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

// Whose look counts.
//
//  · Not the house's own. A device signed in to TiMag belongs to the host or a
//    cohost checking how TiBook looks, and every preview would read as a guest.
//  · Not the dev server, unless asked. `npm run dev` proxies /api to the
//    PRODUCTION backend, so every local reload would land in the real numbers.
//    Set VITE_COUNT_TIBOOK_VISITS_IN_DEV=true in .env.development.local when
//    testing this against a local backend.
export const shouldCountVisit = ({
  dev,
  countInDev,
  managerSignedIn,
}: {
  dev: boolean;
  countInDev: boolean;
  managerSignedIn: boolean;
}): boolean => !managerSignedIn && (!dev || countInDev);

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

// Fire and forget. Nothing a guest is doing waits on this, and a failure to
// count must never show them an error.
export const recordTiBookVisit = (hostId: string | undefined) => {
  if (!hostId) return;
  const today = new Date().toISOString().slice(0, 10);
  if (lastCountedDay === today) return;

  const count = shouldCountVisit({
    dev: import.meta.env.DEV,
    countInDev: import.meta.env.VITE_COUNT_TIBOOK_VISITS_IN_DEV === "true",
    managerSignedIn: isTokenValid(),
  });
  if (!count) return;
  lastCountedDay = today;

  let timeZone = "";
  try {
    timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? "";
  } catch {
    // An old browser with no Intl zone: counted, as Unknown.
  }

  axios
    .post(`${BACKEND_ENDPOINT}/tibook-visit`, {
      host: hostId,
      visitorId: visitorIdFrom(safeStorage()),
      timeZone,
    })
    .catch(() => {
      lastCountedDay = null; // try again next time the page comes forward
    });
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
