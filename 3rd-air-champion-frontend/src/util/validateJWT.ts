import { jwtDecode, JwtPayload } from "jwt-decode";

interface CustomJwtPayload extends JwtPayload {
  role?: string;
}

export const isTokenValid = (): boolean => {
  const token = localStorage.getItem("token");
  if (!token) return false;

  const decoded = jwtDecode<CustomJwtPayload>(token);
  if (decoded.role && decoded.role === "TiBook") return false;
  const currentTime = Date.now() / 1000;
  return decoded.exp ? decoded.exp > currentTime : false;
};
