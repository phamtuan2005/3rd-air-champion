import { jwtDecode, JwtPayload } from "jwt-decode";
import { getRefreshToken, getToken } from "./authSession";

interface CustomJwtPayload extends JwtPayload {
  role?: string;
}

// Decode without throwing. A truncated or hand-edited value in localStorage
// would otherwise crash the route guard and leave a blank screen.
const decode = (token: string | null): CustomJwtPayload | null => {
  if (!token) return null;
  try {
    return jwtDecode<CustomJwtPayload>(token);
  } catch {
    return null;
  }
};

const isUnexpired = (payload: CustomJwtPayload | null): boolean =>
  !!payload?.exp && payload.exp > Date.now() / 1000;

// Whether this browser still holds a usable manager session.
//
// An EXPIRED access token is no longer grounds for eviction: the refresh token
// outlives it by design, and the axios layer renews on the first call. Without
// this, reloading the page an hour after signing in would bounce you to the
// login screen while a perfectly valid session sat in storage.
export const isTokenValid = (): boolean => {
  const access = decode(getToken());
  // TiBook guests are not manager sessions, however fresh their token.
  if (access?.role === "TiBook") return false;
  if (isUnexpired(access)) return true;

  // Access token dead or missing — the refresh token decides. It is only read
  // here, never trusted: the server verifies it against its own secret.
  const refresh = decode(getRefreshToken());
  if (refresh?.role === "TiBook") return false;
  return isUnexpired(refresh);
};
