import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";

const BACKEND_ENDPOINT = import.meta.env.VITE_BACKEND_ENDPOINT || "";

export const TOKEN_KEY = "token";
export const REFRESH_TOKEN_KEY = "refreshToken";
// TiBook (the guest-facing app) authenticates as its own principal under a
// different key. Its requests must pass through this layer untouched.
const TIBOOK_TOKEN_KEY = "tiBookToken";

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const getRefreshToken = () => localStorage.getItem(REFRESH_TOKEN_KEY);

export const setSession = (token: string, refreshToken?: string | null) => {
  localStorage.setItem(TOKEN_KEY, token);
  if (refreshToken) localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
};

export const clearSession = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
};

// One refresh at a time. A screen that fires five requests at once would
// otherwise mint five refresh tokens and — with rotation on — invalidate its own
// session in the race. Everyone waits on the same promise.
let refreshInFlight: Promise<string> | null = null;

export const refreshAccessToken = (): Promise<string> => {
  if (refreshInFlight) return refreshInFlight;

  const refreshToken = getRefreshToken();
  if (!refreshToken) return Promise.reject(new Error("No refresh token"));

  refreshInFlight = axios
    .post(`${BACKEND_ENDPOINT}/auth/refresh`, { refreshToken })
    .then((res) => {
      const { token, refreshToken: rotated } = res.data ?? {};
      // The refresh call is not immune to the CDN fallback either. Without this
      // an HTML "200" would store `undefined` as the token and every later
      // request would fail in a way that looks nothing like an expired session.
      if (typeof token !== "string" || !token) {
        throw new Error("Refresh returned no token");
      }
      setSession(token, rotated ?? refreshToken);
      return token as string;
    })
    .finally(() => {
      refreshInFlight = null;
    });

  return refreshInFlight;
};

const bearerOf = (config?: InternalAxiosRequestConfig | null): string => {
  const raw = (config?.headers?.Authorization ??
    (config?.headers as Record<string, unknown> | undefined)?.authorization) as
    | string
    | undefined;
  return typeof raw === "string" && raw.startsWith("Bearer ")
    ? raw.slice("Bearer ".length)
    : "";
};

type RetriableConfig = InternalAxiosRequestConfig & { __authRetried?: boolean };

// CloudFront's SPA fallback rewrites 403/404 into "200 + index.html", and that
// rule also covers /api/*. So a rejected token comes back as a successful HTML
// page rather than a 403, the app stores markup where it expected JSON, and the
// first `.filter` on it takes the whole screen down — a blank page with no clue
// why.
//
// Treat an HTML body on an API call as the auth failure it really is. The
// server-side fix is to stop applying that rule to /api/*, but this keeps the
// app honest regardless of how the CDN is configured.
const isHtmlBody = (data: unknown): boolean =>
  typeof data === "string" && data.trimStart().toLowerCase().startsWith("<!doctype html");

// Keeps a signed-in session alive without the user ever seeing it.
//
// Before this existed, the access token simply died after an hour and every
// call site turned the resulting 403 into empty data — so an expired session
// looked exactly like "no cleanings, no earnings, no hours". Nothing announced
// the expiry and nothing renewed it.
//
// On a 401/403 the failed request is retried ONCE with a fresh token. If the
// refresh itself fails, the session really is over and we clear it and return
// to login — which is the honest outcome, unlike silently showing zeros.
export const installAuthInterceptors = () => {
  axios.interceptors.response.use(
    (response) => {
      // A "successful" HTML response to an API call is a masked auth failure.
      // Convert it into the 401 it should have been so the refresh-and-retry
      // path below handles it, instead of letting markup reach React state.
      if (isHtmlBody(response.data) && (response.config?.url ?? "").includes("/api/")) {
        const masked = new AxiosError(
          "Auth failure masked by the CDN's SPA fallback",
          "ERR_MASKED_AUTH",
          response.config,
          response.request,
          { ...response, status: 401 },
        );
        throw masked;
      }
      return response;
    },
    async (error: AxiosError) => {
      const status = error.response?.status;
      const original = error.config as RetriableConfig | undefined;

      if (!original || (status !== 401 && status !== 403)) throw error;
      if (original.__authRetried) throw error; // already tried; don't loop
      // A failing /auth/refresh must never trigger another refresh.
      if ((original.url ?? "").includes("/auth/")) throw error;

      const sent = bearerOf(original);
      if (!sent) throw error; // unauthenticated call — nothing to renew
      // Not our principal. TiBook manages its own session.
      if (sent === localStorage.getItem(TIBOOK_TOKEN_KEY)) throw error;

      original.__authRetried = true;

      // Another request may already have refreshed while this one was in
      // flight. If so the stored token is newer than the one we sent, and a
      // plain retry is enough — no need to spend a refresh.
      const current = getToken();
      if (current && current !== sent) {
        original.headers.Authorization = `Bearer ${current}`;
        return axios(original);
      }

      try {
        const token = await refreshAccessToken();
        original.headers.Authorization = `Bearer ${token}`;
        return axios(original);
      } catch {
        clearSession();
        if (!window.location.pathname.startsWith("/login")) {
          window.location.assign("/login");
        }
        throw error;
      }
    },
  );
};
