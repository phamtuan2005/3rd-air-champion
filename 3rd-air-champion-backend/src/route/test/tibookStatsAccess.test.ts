import express from "express";
import request from "supertest";
import tibookVisitRoute from "../tibookVisitRoute";
import tibookStatsAccessRoute, { hashStatsCode, newStatsCode } from "../tibookStatsAccessRoute";
import tibookStatsViewerRoute, { resetViewerMisses } from "../tibookStatsViewerRoute";
import TiBookStatsGrant from "../../model/tibookStatsGrantSchema";
import Guest from "../../model/guestSchema";
import { createMockHost } from "../../model/test/util/mockHost";
import TTQuestion from "../../model/ttQuestionSchema";

// A guest the host chose reading TiBook's visitor numbers, to help develop it.
//
// Two things matter more than anything else here, and if a test below fails,
// check them before changing it:
//  - only the host (or a cohost) can give the right, and only on purpose;
//  - the guest who has it never sees another guest — no names, no numbers.

// authenticateToken has verified the token by the time a request reaches the
// access route; this stands in for it, as in tibookVisits.test.
const app = (user: Record<string, any> | null) => {
  const a = express();
  a.use(express.json());
  a.use("/tibook-visit", tibookVisitRoute);
  a.use("/tibook-stats-viewer", tibookStatsViewerRoute);
  a.use((req, _res, next) => {
    if (user) (req as any).user = user;
    next();
  });
  a.use("/tibook-stats-access", tibookStatsAccessRoute);
  return a;
};
const publicApp = app(null);

const houseWithGuests = async (email: string) => {
  const host = String((await createMockHost(email))._id);
  const mai = await Guest.create({ name: "Mai Tran", phone: "408-555-0101", host });
  const eddie = await Guest.create({ name: "Eddie Lo", phone: "408-555-0202", host });
  return { host, mai: String(mai._id), eddie: String(eddie._id), asHost: app({ hostId: host, role: "Host" }) };
};

const give = (a: express.Express, guestId: string) =>
  request(a).post("/tibook-stats-access").send({ guestId, confirm: true });

beforeEach(() => resetViewerMisses());

describe("giving a guest access", () => {
  it("lets the host give it, and hands the code back once", async () => {
    const { mai, asHost } = await houseWithGuests("give@example.com");
    const res = await give(asHost, mai);
    expect(res.status).toBe(200);
    expect(res.body.code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);

    // Only the hash is kept.
    const grant = await TiBookStatsGrant.findOne({ guest: mai }).lean();
    expect(grant!.codeHash).toBe(hashStatsCode(res.body.code));
    expect(JSON.stringify(grant)).not.toContain(res.body.code);
  });

  // TiMag asks twice; the server refuses a request that did not.
  it("refuses without the confirmation", async () => {
    const { mai, asHost } = await houseWithGuests("noconfirm@example.com");
    expect((await request(asHost).post("/tibook-stats-access").send({ guestId: mai })).status).toBe(400);
    expect((await request(asHost).post("/tibook-stats-access").send({ guestId: mai, confirm: "true" })).status).toBe(400);
    expect(await TiBookStatsGrant.countDocuments()).toBe(0);
  });

  it("lets a cohost give it, and refuses TiBook's own account", async () => {
    const { host, mai } = await houseWithGuests("roles@example.com");
    expect((await give(app({ hostId: host, role: "Cohost", cohostName: "Cindy" }), mai)).status).toBe(200);
    expect((await TiBookStatsGrant.findOne({ guest: mai }))!.grantedBy).toBe("Cindy");
    expect((await give(app({ hostId: host, role: "TiBook" }), mai)).status).toBe(403);
    expect((await give(publicApp, mai)).status).toBe(401);
  });

  it("will not give access to another house's guest", async () => {
    const { mai } = await houseWithGuests("theirs@example.com");
    const { asHost } = await houseWithGuests("mine@example.com");
    expect((await give(asHost, mai)).status).toBe(404);
  });

  it("replaces the code when given again, and the old one stops working", async () => {
    const { mai, asHost } = await houseWithGuests("again@example.com");
    const first = (await give(asHost, mai)).body.code;
    const second = (await give(asHost, mai)).body.code;
    expect(second).not.toBe(first);
    expect(await TiBookStatsGrant.countDocuments({ guest: mai })).toBe(1);
    expect((await request(publicApp).post("/tibook-stats-viewer").send({ code: first })).status).toBe(401);
    expect((await request(publicApp).post("/tibook-stats-viewer").send({ code: second })).status).toBe(200);
  });

  it("lists who has it, and takes it away", async () => {
    const { mai, asHost } = await houseWithGuests("list@example.com");
    const code = (await give(asHost, mai)).body.code;
    const list = await request(asHost).get("/tibook-stats-access");
    expect(list.body).toEqual([expect.objectContaining({ guestId: mai, name: "Mai Tran" })]);

    expect((await request(asHost).delete(`/tibook-stats-access/${mai}`)).status).toBe(204);
    expect((await request(publicApp).post("/tibook-stats-viewer").send({ code })).status).toBe(401);
  });

  it("drops the access of a guest who is deleted", async () => {
    const { mai, asHost } = await houseWithGuests("deleted@example.com");
    const code = (await give(asHost, mai)).body.code;
    await Guest.deleteOne({ _id: mai });
    expect((await request(publicApp).post("/tibook-stats-viewer").send({ code })).status).toBe(401);
    expect((await request(asHost).get("/tibook-stats-access")).body).toEqual([]);
  });
});

describe("what the guest with access sees", () => {
  it("sees the counts and never another guest", async () => {
    const { host, mai, asHost } = await houseWithGuests("viewer@example.com");
    // Eddie let TiBook remember him; the host would see his name. Mai must not.
    await request(publicApp).post("/tibook-visit").send({ host, visitorId: "eddie-device-1", timeZone: "Asia/Tokyo", guestPhone: "408-555-0202" });
    await request(publicApp).post("/tibook-visit").send({ host, visitorId: "stranger-dev-2", timeZone: "Europe/Paris" });
    const code = (await give(asHost, mai)).body.code;

    // Typed loosely, as on a phone.
    const res = await request(publicApp).post("/tibook-stats-viewer").send({ code: code.toLowerCase().replace(/-/g, " ") });
    expect(res.status).toBe(200);
    expect(res.body.viewer).toBe("Mai");
    const today = res.body.spans.find((s: any) => s.key === "today");
    expect(today.visitors).toBe(2);
    expect(res.body.spans.every((s: any) => s.guests.length === 0)).toBe(true);

    const body = JSON.stringify(res.body);
    expect(body).not.toMatch(/Eddie|555|0202|408/);
  });

  it("refuses a wrong code, and slows down someone guessing", async () => {
    const tries = Array.from({ length: 10 }, () =>
      request(publicApp).post("/tibook-stats-viewer").send({ code: newStatsCode() }),
    );
    for (const t of tries) expect((await t).status).toBe(401);
    expect((await request(publicApp).post("/tibook-stats-viewer").send({ code: newStatsCode() })).status).toBe(429);
  });
});

// The same code opens what guests asked TiBook's TT: the house gave it to help
// develop TiBook, and TT is part of TiBook. Never by a weaker check than the
// visitor numbers, and never another house's questions.
describe("the TT questions, with the same code", () => {
  const ask = (host: string, question: string, answered: boolean, category: string) =>
    TTQuestion.create({ host, question, answered, category });

  it("opens the questions, split answered and not, for the code's house only", async () => {
    const { host, mai, asHost } = await houseWithGuests("tt-view@example.com");
    const other = await houseWithGuests("tt-other@example.com");
    await ask(host, "Is there parking?", true, "parking");
    await ask(host, "Can I store a bike?", false, "other");
    await ask(other.host, "Another house's question", false, "other");
    const { code } = (await give(asHost, mai)).body;

    const res = await request(publicApp).post("/tibook-stats-viewer/tt-questions").send({ code, span: "all" });
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    expect(res.body.unanswered.categories[0].questions[0].question).toBe("Can I store a bike?");
    expect(JSON.stringify(res.body)).not.toContain("Another house");
  });

  it("refuses a wrong code, and one the host has taken back", async () => {
    const { mai, asHost } = await houseWithGuests("tt-revoked@example.com");
    const { code } = (await give(asHost, mai)).body;
    expect((await request(publicApp).post("/tibook-stats-viewer/tt-questions").send({ code: "AAAA-BBBB-CCCC" })).status).toBe(401);
    await request(asHost).delete(`/tibook-stats-access/${mai}`);
    expect((await request(publicApp).post("/tibook-stats-viewer/tt-questions").send({ code })).status).toBe(401);
  });

  it("counts wrong codes here toward the same limit as the visitor numbers", async () => {
    for (let i = 0; i < 10; i++) {
      await request(publicApp).post("/tibook-stats-viewer/tt-questions").send({ code: "WRONG-CODE-XXXX" });
    }
    expect((await request(publicApp).post("/tibook-stats-viewer").send({ code: "WRONG-CODE-XXXX" })).status).toBe(429);
  });
});
