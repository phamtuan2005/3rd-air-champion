import express from "express";
import request from "supertest";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import authenticationRoute from "../authenticationRoute";

dotenv.config();

// Resolved exactly the way the route resolves them, so the test exercises the
// real configuration rather than a parallel one.
const SECRET_TOKEN =
  process.env.SECRET_TOKEN ||
  "509ea5f1fd64b855c9c372453b8f114593d1aabdb02653e880b4432f661d0eaee73bc06d631064b0ec8c0ecb4b77656b4fa0390dc0805812c365a7f15891efa1";
const REFRESH_SECRET_TOKEN =
  process.env.REFRESH_SECRET_TOKEN || `${SECRET_TOKEN}:refresh`;

const app = express();
app.use(express.json());
app.use("/auth", authenticationRoute);

const account = {
  cohostId: "cohost-1",
  cohostName: "Anh-Tuan",
  hostId: "host-1",
  role: "host",
};

const signRefresh = (
  payload: Record<string, any> = { ...account, typ: "refresh" },
  secret = REFRESH_SECRET_TOKEN,
  expiresIn = "60d",
) => jwt.sign(payload, secret, { expiresIn } as jwt.SignOptions);

// /auth/refresh is what keeps a signed-in session alive. Before it existed the
// access token simply died after an hour and every caller rendered the failure
// as empty data, so the app looked like it had lost its database.
describe("POST /auth/refresh", () => {
  it("rejects a request with no refresh token", async () => {
    const res = await request(app).post("/auth/refresh").send({});
    expect(res.status).toBe(400);
  });

  it("rejects a malformed token", async () => {
    const res = await request(app)
      .post("/auth/refresh")
      .send({ refreshToken: "not-a-jwt" });
    expect(res.status).toBe(401);
  });

  it("rejects an expired refresh token", async () => {
    const res = await request(app)
      .post("/auth/refresh")
      .send({ refreshToken: signRefresh(undefined, REFRESH_SECRET_TOKEN, "-1s") });
    expect(res.status).toBe(401);
  });

  // The separate secret is what stops a leaked ACCESS token from being spent as
  // a refresh token to mint an endless supply of new ones.
  it("rejects a token signed with the access secret", async () => {
    const res = await request(app)
      .post("/auth/refresh")
      .send({ refreshToken: signRefresh(undefined, SECRET_TOKEN) });
    expect(res.status).toBe(401);
  });

  // Belt and braces behind the separate secret.
  it("rejects a correctly-signed token that is not marked as a refresh", async () => {
    const res = await request(app)
      .post("/auth/refresh")
      .send({ refreshToken: signRefresh({ ...account }) });
    expect(res.status).toBe(401);
  });

  it("returns a usable access token for a valid refresh token", async () => {
    const res = await request(app)
      .post("/auth/refresh")
      .send({ refreshToken: signRefresh() });

    expect(res.status).toBe(200);
    const decoded: any = jwt.verify(res.body.token, SECRET_TOKEN);
    expect(decoded.hostId).toBe("host-1");
    expect(decoded.role).toBe("host");
    expect(decoded.cohostId).toBe("cohost-1");
  });

  // Re-issuing from a VERIFIED token is the trap here: the decoded payload still
  // carries iat/exp, and jwt.sign throws if either reaches it. accountClaims()
  // strips them — this test fails loudly if that stripping is ever removed.
  it("re-issues from a decoded token without choking on iat/exp", async () => {
    const incoming = signRefresh();
    const decoded: any = jwt.verify(incoming, REFRESH_SECRET_TOKEN);
    expect(decoded.iat).toBeDefined();
    expect(decoded.exp).toBeDefined();

    const res = await request(app)
      .post("/auth/refresh")
      .send({ refreshToken: incoming });
    expect(res.status).toBe(200);
  });

  it("rotates the refresh token so a stolen one has a bounded life", async () => {
    const res = await request(app)
      .post("/auth/refresh")
      .send({ refreshToken: signRefresh() });

    expect(res.status).toBe(200);
    expect(res.body.refreshToken).toBeDefined();
    const rotated: any = jwt.verify(res.body.refreshToken, REFRESH_SECRET_TOKEN);
    expect(rotated.typ).toBe("refresh");
    expect(rotated.hostId).toBe("host-1");
  });

  it("hands back the account so the client can restore its session", async () => {
    const res = await request(app)
      .post("/auth/refresh")
      .send({ refreshToken: signRefresh() });
    expect(res.body.account).toMatchObject(account);
  });
});
