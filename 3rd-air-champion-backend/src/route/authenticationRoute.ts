import express, { Request, Response } from "express";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { sendGraphQLRequest } from "./util/sendToGraphQL";

dotenv.config();

const router = express.Router();
const SECRET_TOKEN =
  process.env.SECRET_TOKEN ||
  "509ea5f1fd64b855c9c372453b8f114593d1aabdb02653e880b4432f661d0eaee73bc06d631064b0ec8c0ecb4b77656b4fa0390dc0805812c365a7f15891efa1";

// Refresh tokens are signed with a DIFFERENT secret so an access token can
// never be replayed as a refresh token (or the reverse) even if one leaks.
const REFRESH_SECRET_TOKEN =
  process.env.REFRESH_SECRET_TOKEN || `${SECRET_TOKEN}:refresh`;

const ACCESS_TOKEN_TTL = "1h";
const REFRESH_TOKEN_TTL = "60d";

// Only the account claims. A decoded token still carries iat/exp, and jwt.sign
// throws if either is present in the payload — so re-issuing from a verified
// token must go through this rather than spreading the decoded object.
const accountClaims = (payload: Record<string, any>) => ({
  cohostId: payload.cohostId,
  cohostName: payload.cohostName,
  hostId: payload.hostId,
  role: payload.role,
});

// Helper to generate JWT
const generateToken = (payload: Record<string, any>) => {
  return jwt.sign(accountClaims(payload), SECRET_TOKEN, {
    expiresIn: ACCESS_TOKEN_TTL,
  });
};

// `typ` marks this as a refresh token — belt and braces alongside the separate
// secret, so /refresh cannot be driven by anything but a real refresh token.
const generateRefreshToken = (payload: Record<string, any>) => {
  return jwt.sign(
    { ...accountClaims(payload), typ: "refresh" },
    REFRESH_SECRET_TOKEN,
    { expiresIn: REFRESH_TOKEN_TTL },
  );
};

// Login Route
router.post("/login", async (req: Request, res: Response) => {
  const { email, password } = req.body;

  const query = `
        query Login($email: String!, $password: String!) {
            login(email: $email, password: $password) {
                cohostId
                cohostName
                hostId
                role
            }
        }`;

  sendGraphQLRequest(query, { email, password })
    .then((result: any) => {
      if (result.errors) {
        return res.status(400).json({ errors: result.errors[0].message });
      }
      const account = result.data.login;
      const token = generateToken(account);
      const refreshToken = generateRefreshToken(account);

      // Send the successful login response
      res.status(200).json({ account, token, refreshToken });
    })
    .catch((error: any) => {
      // Handle errors from the helper function
      res.status(500).json({ error: error.message });
    });
});

// Register route
router.post("/register", async (req: Request, res: Response) => {
  const { email, password, name, host } = req.body;

  let query = ``;
  let variables: Record<string, any> = { email, password, name };

  // Regist cohost
  if (host) {
    query = `
            mutation RegisterCohost($host: String!, $email: String!, $password: String!, $name: String!) {
                registerCohost(host: $host, email: $email, password: $password, name: $name) {
                    cohostId
                    hostId
                    role
                }
            }
        `;
    variables.host = host;
  } else {
    query = `
            mutation RegisterHost($email: String!, $password: String!, $name: String!) {
                registerHost(email: $email, password: $password, name: $name) {
                    cohostId
                    hostId
                    role
                }
            }
        `;
  }

  sendGraphQLRequest(query, variables)
    .then((result: any) => {
      if (result.errors) {
        return res.status(400).json({ errors: result.errors[0].message });
      }
      const account = host
        ? result.data.registerCohost
        : result.data.registerHost;
      const token = generateToken(account);
      const refreshToken = generateRefreshToken(account);

      // Send the successful login response
      res.status(200).json({ account, token, refreshToken });
    })
    .catch((error: any) => {
      // Handle errors from the helper function
      res.status(500).json({ error: error.message });
    });
});

// Refresh Route — trade a valid refresh token for a fresh access token.
//
// Public by necessity: it is called precisely when the access token has expired,
// so it cannot sit behind authenticateToken. Mounted under /auth, which the
// server registers before the JWT middleware.
//
// Returns 401 — distinct from the 403 an expired ACCESS token produces — so the
// client can tell "your session is genuinely over" apart from "that request
// just needs a retry", and never loops trying to refresh a refresh.
router.post("/refresh", async (req: Request, res: Response) => {
  const { refreshToken } = req.body ?? {};

  if (!refreshToken) {
    res.status(400).json({ error: "Refresh token missing" });
    return;
  }

  jwt.verify(refreshToken, REFRESH_SECRET_TOKEN, (err: any, decoded: any) => {
    if (err || !decoded || decoded.typ !== "refresh") {
      res.status(401).json({ error: "Invalid or expired refresh token" });
      return;
    }

    const account = accountClaims(decoded);
    // Rotate: every refresh hands back a new refresh token, so a stolen one has
    // a bounded life rather than lasting the full TTL.
    res.status(200).json({
      account,
      token: generateToken(account),
      refreshToken: generateRefreshToken(account),
    });
  });
});

export default router;
