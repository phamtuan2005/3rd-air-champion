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
      const { token, refreshToken: rotated } = res.data;
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
    (response) => response,
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
