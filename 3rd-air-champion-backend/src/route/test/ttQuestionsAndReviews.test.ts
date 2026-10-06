import express from "express";
import request from "supertest";
import mongoose from "mongoose";
import ttGuestRoute, { resetQuestionLimits } from "../ttGuestRoute";
import ttHostRoute, { setReviewDrafter } from "../ttHostRoute";
import TTQuestion from "../../model/ttQuestionSchema";
import TTReviews from "../../model/ttReviewsSchema";
import Room from "../../model/roomSchema";
import { createMockHost } from "../../model/test/util/mockHost";

// TiBook's TT: guests write questions and read published summaries; only the
// host reads the questions, drafts, and publishes. If a "who can" test fails,
// check who can now read guests' questions before changing it.

const signedInAs = (user: Record<string, any> | null) => {
  const app = express();
  app.use(express.json());
  app.use("/tt", ttGuestRoute);
  app.use((req, _res, next) => {
    if (user) (req as any).user = user;
    next();
  });
  app.use("/tt-host", ttHostRoute);
  return app;
};
const guestApp = signedInAs(null);

beforeEach(() => resetQuestionLimits());

describe("logging what guests ask TT", () => {
  it("keeps the question, whether it was answered, and its category", async () => {
    const host = String((await createMockHost("ask@example.com"))._id);
    const res = await request(guestApp)
      .post("/tt/question")
      .send({ host, question: "Is there a gym nearby?", answered: false, category: "other", returning: true });
    expect(res.status).toBe(204);
    const row: any = await TTQuestion.findOne({ host }).lean();
    expect(row).toMatchObject({ question: "Is there a gym nearby?", answered: false, category: "other", returning: true });
  });

  it("scrubs a guest's own number and email out before storing — the route does not trust TiBook", async () => {
    const host = String((await createMockHost("scrub@example.com"))._id);
    await request(guestApp)
      .post("/tt/question")
      .send({ host, question: "text me at 415 555 0100 or a@b.com, is King free?", answered: true, category: "availability" });
    const row: any = await TTQuestion.findOne({ host }).lean();
    expect(row.question).not.toMatch(/555|a@b\.com/);
    expect(row.question).toContain("is King free?");
  });

  it("stores a category it does not know as 'other' rather than whatever was sent", async () => {
    const host = String((await createMockHost("cat@example.com"))._id);
    await request(guestApp).post("/tt/question").send({ host, question: "hi", answered: true, category: "<b>pwned</b>" });
    expect(((await TTQuestion.findOne({ host }).lean()) as any).category).toBe("other");
  });

  it("refuses a made-up host or a missing question", async () => {
    const host = String((await createMockHost("refuse-q@example.com"))._id);
    const nobody = String(new mongoose.Types.ObjectId());
    expect((await request(guestApp).post("/tt/question").send({ host: nobody, question: "hi", answered: true })).status).toBe(404);
    expect((await request(guestApp).post("/tt/question").send({ host, question: "   ", answered: true })).status).toBe(400);
    expect((await request(guestApp).post("/tt/question").send({ host, question: "hi" })).status).toBe(400);
    expect(await TTQuestion.countDocuments({ host })).toBe(0);
  });

  it("stops a script filling the log, without telling it so", async () => {
    const host = String((await createMockHost("flood@example.com"))._id);
    for (let i = 0; i < 210; i++) {
      const res = await request(guestApp).post("/tt/question").send({ host, question: `spam ${i}`, answered: false });
      expect(res.status).toBe(204);
    }
    expect(await TTQuestion.countDocuments({ host })).toBe(200);
  });
});

describe("who can read the questions", () => {
  it("shows the host their questions, split into answered and not, by category", async () => {
    const host = String((await createMockHost("reader-q@example.com"))._id);
    const ask = (question: string, answered: boolean, category: string) =>
      request(guestApp).post("/tt/question").send({ host, question, answered, category });
    await ask("Is there parking?", true, "parking");
    await ask("is there parking", true, "parking");
    await ask("Is there a gym nearby?", false, "other");

    const res = await request(signedInAs({ hostId: host, role: "Host" })).get("/tt-host/questions?span=all");
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(3);
    expect(res.body.answered.count).toBe(2);
    // Asked twice, worded twice: one question to the host, counted twice.
    expect(res.body.answered.categories[0]).toMatchObject({ category: "parking", count: 2 });
    expect(res.body.answered.categories[0].questions).toHaveLength(1);
    expect(res.body.answered.categories[0].questions[0].count).toBe(2);
    expect(res.body.unanswered.categories[0].questions[0].question).toBe("Is there a gym nearby?");
  });

  it("turns TiBook's own token away, and never shows one house another's questions", async () => {
    const mine = String((await createMockHost("mine-q@example.com"))._id);
    const theirs = String((await createMockHost("theirs-q@example.com"))._id);
    await request(guestApp).post("/tt/question").send({ host: theirs, question: "secret?", answered: false });

    expect((await request(signedInAs({ hostId: theirs, role: "TiBook" })).get("/tt-host/questions")).status).toBe(403);
    expect((await request(guestApp).get("/tt-host/questions")).status).toBe(401);
    const res = await request(signedInAs({ hostId: mine, role: "Host" })).get("/tt-host/questions?span=all");
    expect(res.body.total).toBe(0);
  });
});

describe("review summaries", () => {
  const roomFor = (host: string, name: string) => Room.create({ host, name, price: 100 });

  it("drafts in the background, then guests see only what the host published", async () => {
    const host = String((await createMockHost("reviews@example.com"))._id);
    const king = String((await roomFor(host, "King"))._id);
    let seen: any[] = [];
    setReviewDrafter(async (rooms) => {
      seen = rooms;
      return { house: "Guests love it.", rooms: [{ roomId: king, summary: "Big bed." }], reviewsRead: 12 };
    });
    const hostApp = signedInAs({ hostId: host, role: "Host" });

    const started = await request(hostApp).post("/tt-host/reviews/draft").send({ rooms: [{ roomId: king, text: "Great stay! 5 stars" }] });
    expect(started.status).toBe(202);
    expect(seen).toEqual([{ roomId: king, name: "King", text: "Great stay! 5 stars" }]);

    // Let the background write land.
    await new Promise((r) => setTimeout(r, 50));
    const drafted = await request(hostApp).get("/tt-host/reviews");
    expect(drafted.body.draft).toMatchObject({ status: "ready", house: "Guests love it.", reviewsRead: 12 });

    // A draft is the host's work in progress — no guest sees it yet.
    expect((await request(guestApp).get(`/tt/reviews/${host}`)).body).toEqual({ house: "", rooms: [] });

    // The host edits before publishing, and the EDIT is what goes out.
    const pub = await request(hostApp)
      .put("/tt-host/reviews")
      .send({ house: "Guests love the quiet.", rooms: [{ roomId: king, summary: "A big, comfortable bed." }] });
    expect(pub.status).toBe(200);
    expect(pub.body.draft.status).toBe("none");
    expect((await request(guestApp).get(`/tt/reviews/${host}`)).body).toEqual({
      house: "Guests love the quiet.",
      rooms: [{ roomId: king, summary: "A big, comfortable bed." }],
    });
  });

  it("drafts only from the host's own rooms, whatever ids are sent", async () => {
    const host = String((await createMockHost("own-rooms@example.com"))._id);
    const other = String((await createMockHost("other-rooms@example.com"))._id);
    const theirRoom = String((await roomFor(other, "King"))._id);
    setReviewDrafter(async () => ({ house: "", rooms: [], reviewsRead: 0 }));
    const res = await request(signedInAs({ hostId: host, role: "Host" }))
      .post("/tt-host/reviews/draft")
      .send({ rooms: [{ roomId: theirRoom, text: "reviews" }] });
    expect(res.status).toBe(400);
  });

  // A request body of 8,192 bytes or more never reaches the server (CloudFront
  // answers it with the website's home page), so a long paste travels as many
  // small parts. These pin that the parts come back together intact, that the
  // text is read whole, and that nobody can read another host's upload.
  const sendInParts = async (app: any, uploadId: string, roomId: string, text: string, skip: number[] = []) => {
    const size = 6000;
    const total = Math.ceil(text.length / size);
    for (let i = 0; i < total; i += 20) {
      await Promise.all(
        Array.from({ length: Math.min(20, total - i) }, (_, k) => i + k)
          .filter((idx) => !skip.includes(idx))
          .map((idx) =>
            request(app).post("/tt-host/reviews/upload").send({ uploadId, roomId, index: idx, total, text: text.slice(idx * size, (idx + 1) * size) }),
          ),
      );
    }
  };

  it("reads a long paste, sent in parts, whole and in order", async () => {
    const host = String((await createMockHost("parts@example.com"))._id);
    const king = String((await roomFor(host, "King"))._id);
    let seen = "";
    setReviewDrafter(async (rooms) => {
      seen = rooms[0].text;
      return { house: "", rooms: [], reviewsRead: 0 };
    });
    const app = signedInAs({ hostId: host, role: "Host" });
    const text = Array.from({ length: 100_000 }, (_, i) => `r${i % 10}`).join("") + "OLDEST";
    await sendInParts(app, "upload-aaaa-1", king, text);
    const res = await request(app).post("/tt-host/reviews/draft").send({ rooms: [{ roomId: king, uploadId: "upload-aaaa-1" }] });
    expect(res.status).toBe(202);
    await new Promise((r) => setTimeout(r, 50));
    expect(seen).toBe(text);

    // Read out of memory once the draft began: drafting again from it fails.
    await TTReviews.updateOne({ host }, { $set: { "draft.status": "none" } });
    const again = await request(app).post("/tt-host/reviews/draft").send({ rooms: [{ roomId: king, uploadId: "upload-aaaa-1" }] });
    expect(again.status).toBe(400);
  });

  it("refuses an upload with a part missing, and one that is another host's", async () => {
    const host = String((await createMockHost("missing-part@example.com"))._id);
    const other = String((await createMockHost("not-yours@example.com"))._id);
    const king = String((await roomFor(host, "King"))._id);
    setReviewDrafter(async () => ({ house: "", rooms: [], reviewsRead: 0 }));
    const app = signedInAs({ hostId: host, role: "Host" });
    await sendInParts(app, "upload-bbbb-2", king, "A".repeat(30_000), [2]);
    const incomplete = await request(app).post("/tt-host/reviews/draft").send({ rooms: [{ roomId: king, uploadId: "upload-bbbb-2" }] });
    expect(incomplete.status).toBe(400);
    expect(incomplete.body.error).toMatch(/did not finish/);

    await sendInParts(app, "upload-cccc-3", king, "A".repeat(12_000));
    const theirs = await request(signedInAs({ hostId: other, role: "Host" }))
      .post("/tt-host/reviews/draft")
      .send({ rooms: [{ roomId: king, uploadId: "upload-cccc-3" }] });
    expect(theirs.status).toBe(400);
  });

  it("refuses a part too large to travel, rather than carrying a body CloudFront drops", async () => {
    const host = String((await createMockHost("fat-part@example.com"))._id);
    const king = String((await roomFor(host, "King"))._id);
    const res = await request(signedInAs({ hostId: host, role: "Host" }))
      .post("/tt-host/reviews/upload")
      .send({ uploadId: "upload-dddd-4", roomId: king, index: 0, total: 1, text: "A".repeat(6001) });
    expect(res.status).toBe(400);
  });

  it("says a draft failed, so the host is not left watching a spinner", async () => {
    const host = String((await createMockHost("fail@example.com"))._id);
    const king = String((await roomFor(host, "King"))._id);
    setReviewDrafter(async () => {
      throw new Error("Too many requests just now");
    });
    const hostApp = signedInAs({ hostId: host, role: "Host" });
    await request(hostApp).post("/tt-host/reviews/draft").send({ rooms: [{ roomId: king, text: "x" }] });
    await new Promise((r) => setTimeout(r, 50));
    const res = await request(hostApp).get("/tt-host/reviews");
    expect(res.body.draft).toMatchObject({ status: "failed", error: "Too many requests just now" });
  });

  it("keeps TiBook's token out of drafting and publishing", async () => {
    const host = String((await createMockHost("guard-rev@example.com"))._id);
    const tibook = signedInAs({ hostId: host, role: "TiBook" });
    expect((await request(tibook).put("/tt-host/reviews").send({ house: "Spam" })).status).toBe(403);
    expect((await request(tibook).post("/tt-host/reviews/draft").send({ rooms: [] })).status).toBe(403);
    expect(await TTReviews.countDocuments({ host })).toBe(0);
  });
});

describe("privacy of the log, and drafts that finish late", () => {
  it("stores only the topic of a question about other people", async () => {
    const host = String((await createMockHost("private-q@example.com"))._id);
    await request(guestApp).post("/tt/question").send({ host, question: "Is Eddie Nguyen staying in King?", answered: true, category: "privacy" });
    const row: any = await TTQuestion.findOne({ host }).lean();
    expect(row.category).toBe("privacy");
    expect(row.question).not.toMatch(/Eddie|Nguyen|King/);
  });

  it("does not let a draft that finished late overwrite what the host published since", async () => {
    const host = String((await createMockHost("late-draft@example.com"))._id);
    const king = String((await Room.create({ host, name: "King", price: 100 }))._id);
    let finish: (v: any) => void = () => undefined;
    setReviewDrafter(() => new Promise((resolve) => (finish = resolve)));
    const hostApp = signedInAs({ hostId: host, role: "Host" });

    await request(hostApp).post("/tt-host/reviews/draft").send({ rooms: [{ roomId: king, text: "old reviews" }] });
    await request(hostApp).put("/tt-host/reviews").send({ house: "Written by hand.", rooms: [] });
    finish({ house: "Old draft", rooms: [], reviewsRead: 1 });
    await new Promise((r) => setTimeout(r, 50));

    const res = await request(hostApp).get("/tt-host/reviews");
    expect(res.body.published.house).toBe("Written by hand.");
    expect(res.body.draft.status).toBe("none");
  });
});
