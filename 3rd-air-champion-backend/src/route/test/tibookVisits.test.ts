import express from "express";
import request from "supertest";
import mongoose from "mongoose";
import tibookVisitRoute from "../tibookVisitRoute";
import tibookStatsRoute from "../tibookStatsRoute";
import TiBookVisit from "../../model/tibookVisitSchema";
import Guest from "../../model/guestSchema";
import { createMockHost } from "../../model/test/util/mockHost";

// TiBook's visitor numbers: guests write them, only the host reads them.
//
// The stats half is the one that matters most. TiBook signs in and holds a
// valid token, so "behind the JWT gate" alone would hand these to any guest who
// opened devtools. If a test in the second block fails, check who can now read
// the numbers before changing it.

// Stands in for authenticateToken, which has already verified the token by the
// time a real request reaches these routes.
const signedInAs = (user: Record<string, any> | null) => {
  const app = express();
  app.use(express.json());
  app.use("/tibook-visit", tibookVisitRoute);
  app.use((req, _res, next) => {
    if (user) (req as any).user = user;
    next();
  });
  app.use("/tibook-stats", tibookStatsRoute);
  return app;
};

const guestApp = signedInAs(null);

describe("recording that someone opened TiBook", () => {
  it("records one row per device per day, however often it opens", async () => {
    const host = String((await createMockHost("visits@example.com"))._id);
    const body = { host, visitorId: "3f0c9a1e-6b1d-4c1e-9d42-1b2f3c4d5e6f", timeZone: "Europe/Paris" };

    const first = await request(guestApp).post("/tibook-visit").send(body);
    await request(guestApp).post("/tibook-visit").send(body);
    await request(guestApp).post("/tibook-visit").send(body);

    expect(first.status).toBe(204);
    const rows = await TiBookVisit.find({ host });
    expect(rows).toHaveLength(1);
    expect(rows[0].continent).toBe("Europe");
    expect(rows[0].day).toBe(new Date().toISOString().slice(0, 10));
  });

  it("needs no login — the visitor is a guest", async () => {
    const host = String((await createMockHost("public@example.com"))._id);
    const res = await request(guestApp)
      .post("/tibook-visit")
      .send({ host, visitorId: "abcdefgh-1234", timeZone: "" });
    expect(res.status).toBe(204);
    expect((await TiBookVisit.findOne({ host }))!.continent).toBe("Unknown");
  });

  it("refuses a made-up host or a visitor id that is not an id", async () => {
    const host = String((await createMockHost("refuse@example.com"))._id);
    const nobody = String(new mongoose.Types.ObjectId());

    expect((await request(guestApp).post("/tibook-visit").send({ host: nobody, visitorId: "abcdefgh-1234" })).status).toBe(404);
    expect((await request(guestApp).post("/tibook-visit").send({ host, visitorId: "<script>alert(1)</script>" })).status).toBe(400);
    expect((await request(guestApp).post("/tibook-visit").send({ host: "not-an-id", visitorId: "abcdefgh-1234" })).status).toBe(400);
    expect(await TiBookVisit.countDocuments()).toBe(0);
  });
});

describe("who can read the numbers", () => {
  const seed = async (host: string) => {
    await request(guestApp).post("/tibook-visit").send({ host, visitorId: "visitor-one-1", timeZone: "Asia/Tokyo" });
    await request(guestApp).post("/tibook-visit").send({ host, visitorId: "visitor-two-2", timeZone: "America/Chicago" });
  };

  it("shows the host their own house's visitors", async () => {
    const host = String((await createMockHost("reader@example.com"))._id);
    await seed(host);

    const res = await request(signedInAs({ hostId: host, role: "Host" })).get("/tibook-stats");
    expect(res.status).toBe(200);
    const today = res.body.spans.find((s: any) => s.key === "today");
    expect(today.visitors).toBe(2);
    expect(today.continents.map((c: any) => c.continent).sort()).toEqual(["Asia", "North America"]);
  });

  it("lets a cohost read them too", async () => {
    const host = String((await createMockHost("cohost-reader@example.com"))._id);
    const res = await request(signedInAs({ hostId: host, cohostId: "c1", role: "Cohost" })).get("/tibook-stats");
    expect(res.status).toBe(200);
  });

  // The whole reason requireManager exists.
  it("refuses TiBook's own guest session, token and all", async () => {
    const host = String((await createMockHost("tibook-token@example.com"))._id);
    await seed(host);
    const res = await request(signedInAs({ hostId: host, role: "TiBook" })).get("/tibook-stats");
    expect(res.status).toBe(403);
    expect(res.body.spans).toBeUndefined();
  });

  it("refuses a request with no signed-in account", async () => {
    expect((await request(guestApp).get("/tibook-stats")).status).toBe(401);
  });

  // The house comes from the token. A hostId in the query is ignored, or any
  // signed-in account could read any other house by editing one field.
  it("reads only the house the token belongs to", async () => {
    const mine = String((await createMockHost("mine@example.com"))._id);
    const theirs = String((await createMockHost("theirs@example.com"))._id);
    await seed(theirs);

    const res = await request(signedInAs({ hostId: mine, role: "Host" })).get(`/tibook-stats?hostId=${theirs}`);
    expect(res.status).toBe(200);
    expect(res.body.spans.find((s: any) => s.key === "all").visitors).toBe(0);
  });
});

describe("tying a visit to a guest who agreed", () => {
  const post = (body: Record<string, any>) => request(guestApp).post("/tibook-visit").send(body);

  it("stores the number the way guest records store it", async () => {
    const host = String((await createMockHost("link@example.com"))._id);
    await post({ host, visitorId: "link-device-01", timeZone: "", guestPhone: "408-555-1234" });
    expect((await TiBookVisit.findOne({ host }))!.guestPhone).toBe("(408) 555-1234");
  });

  // Anonymous page loads send no guestPhone at all. If "absent" meant "clear",
  // every reload after a guest agreed would quietly undo the link.
  it("leaves an earlier link alone when a later look says nothing about the guest", async () => {
    const host = String((await createMockHost("keep-link@example.com"))._id);
    await post({ host, visitorId: "keep-device-01", timeZone: "", guestPhone: "4085551234" });
    await post({ host, visitorId: "keep-device-01", timeZone: "" });
    expect((await TiBookVisit.findOne({ host }))!.guestPhone).toBe("(408) 555-1234");
  });

  it("unlinks the visit when the guest says Not you", async () => {
    const host = String((await createMockHost("unlink@example.com"))._id);
    await post({ host, visitorId: "unlink-device-1", timeZone: "", guestPhone: "4085551234" });
    await post({ host, visitorId: "unlink-device-1", timeZone: "", guestPhone: "" });
    expect((await TiBookVisit.findOne({ host }))!.guestPhone).toBe("");
  });

  it("still counts the visit when the number does not parse", async () => {
    const host = String((await createMockHost("bad-number@example.com"))._id);
    const res = await post({ host, visitorId: "bad-number-dev1", timeZone: "", guestPhone: "hello" });
    expect(res.status).toBe(204);
    const row = await TiBookVisit.findOne({ host });
    expect(row).not.toBeNull();
    expect(row!.guestPhone).toBe("");
  });
});

describe("naming the guests who visited", () => {
  it("names a guest from the house's own records", async () => {
    const host = String((await createMockHost("names@example.com"))._id);
    await new Guest({ name: "Mai", phone: "408-555-1234", host }).save();
    await request(guestApp)
      .post("/tibook-visit")
      .send({ host, visitorId: "names-device-01", timeZone: "", guestPhone: "4085551234" });

    const res = await request(signedInAs({ hostId: host, role: "Host" })).get("/tibook-stats");
    const all = res.body.spans.find((s: any) => s.key === "all");
    expect(all.guests).toEqual([
      { phone: "(408) 555-1234", days: 1, lastDay: new Date().toISOString().slice(0, 10), name: "Mai" },
    ]);
  });

  // The lookup is scoped by the token's house. Unscoped, one house would see
  // the name another house keeps for the same number.
  it("does not borrow a name from another house's guest records", async () => {
    const mine = String((await createMockHost("names-mine@example.com"))._id);
    const theirs = String((await createMockHost("names-theirs@example.com"))._id);
    await new Guest({ name: "Someone Else", phone: "650-555-0001", host: theirs }).save();
    await request(guestApp)
      .post("/tibook-visit")
      .send({ host: mine, visitorId: "names-device-02", timeZone: "", guestPhone: "6505550001" });

    const res = await request(signedInAs({ hostId: mine, role: "Host" })).get("/tibook-stats");
    const all = res.body.spans.find((s: any) => s.key === "all");
    expect(all.guests).toHaveLength(1);
    expect(all.guests[0].name).toBeNull();
  });
});

