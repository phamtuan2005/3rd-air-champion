import express from "express";
import request from "supertest";
import mongoose from "mongoose";
import ttGuestRoute, { resetQuestionLimits } from "../ttGuestRoute";
import ttHostRoute, { setReviewDrafter, setReviewSplitter } from "../ttHostRoute";
import TTQuestion from "../../model/ttQuestionSchema";
import TTReviews from "../../model/ttReviewsSchema";
import TTReviewSource from "../../model/ttReviewSourceSchema";
import TTReviewEntry from "../../model/ttReviewEntrySchema";
import Guest from "../../model/guestSchema";
import Cleaner from "../../model/cleanerSchema";
import CleaningAssignment from "../../model/cleaningAssignmentSchema";
import Room from "../../model/roomSchema";
import { createMockHost } from "../../model/test/util/mockHost";

// TiBook's TT: guests write questions and read published summaries; only the
// host reads the questions, drafts, and publishes. If a "who can" test fails,
// check who can now read guests' questions before changing it.

// Reviews already on file for a room, as a finished upload leaves them.
const keep = (host: string, room: string, text: string) =>
  TTReviewSource.updateOne({ host, room }, { $set: { name: "reviews.txt", chars: text.length, text } }, { upsert: true });

// One review on record, as the form or a split leaves it.
let onRecordN = 0;
const onRecord = (host: string, room: string, text: string, extra: Record<string, unknown> = {}) =>
  TTReviewEntry.create({ host, room, text, hash: `r${++onRecordN}`, ...extra });

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
      return { house: "Guests love it.", rooms: [{ roomId: king, summary: "Big bed.", latest: "", latestMonth: "", latestStars: null }], reviewsRead: 12 };
    });
    const hostApp = signedInAs({ hostId: host, role: "Host" });

    await onRecord(host, king, "Great stay! 5 stars");
    const started = await request(hostApp).post("/tt-host/reviews/draft").send({ rooms: [{ roomId: king }] });
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

  it("drafts each room's newest dated review as its latest, and guests see it only once published", async () => {
    const host = String((await createMockHost("latest-review@example.com"))._id);
    const king = String((await roomFor(host, "King"))._id);
    const chill = String((await roomFor(host, "Chill"))._id);
    let seen: any[] = [];
    setReviewDrafter(async (rooms) => {
      seen = rooms;
      return {
        house: "",
        rooms: [{ roomId: king, summary: "Big bed.", latest: "The latest guest loved the quiet.", latestMonth: "2026-09", latestStars: 5 }],
        reviewsRead: 3,
      };
    });
    const hostApp = signedInAs({ hostId: host, role: "Host" });

    await onRecord(host, king, "Older but added last", { reviewMonth: "2026-03", stars: 3 });
    await onRecord(host, king, "Newest by its date", { reviewMonth: "2026-09", stars: 5 });
    await onRecord(host, king, "No date at all");
    // Every Chill review is undated: none of them can be called the latest.
    await onRecord(host, chill, "Undated");

    expect((await request(hostApp).post("/tt-host/reviews/draft").send({})).status).toBe(202);
    const byId = new Map(seen.map((r) => [r.roomId, r]));
    expect(byId.get(king).latest).toEqual({ text: "Newest by its date", month: "2026-09", stars: 5 });
    expect(byId.get(chill).latest).toBeUndefined();

    await new Promise((r) => setTimeout(r, 50));
    const drafted = await request(hostApp).get("/tt-host/reviews");
    expect(drafted.body.draft.rooms[0]).toMatchObject({ latest: "The latest guest loved the quiet.", latestMonth: "2026-09", latestStars: 5 });
    expect((await request(guestApp).get(`/tt/reviews/${host}`)).body.rooms).toEqual([]);

    await request(hostApp)
      .put("/tt-host/reviews")
      .send({
        house: "",
        rooms: [
          { roomId: king, summary: "", latest: "The latest guest loved how quiet it was.", latestMonth: "2026-09", latestStars: 5 },
          // A latest without a real month is not published.
          { roomId: chill, summary: "", latest: "Sneaked in.", latestMonth: "recently" },
        ],
      });
    expect((await request(guestApp).get(`/tt/reviews/${host}`)).body.rooms).toEqual([
      { roomId: king, summary: "", latest: "The latest guest loved how quiet it was.", latestMonth: "2026-09", latestStars: 5 },
    ]);
  });

  it("drafts only from the host's own rooms, whatever ids are sent", async () => {
    const host = String((await createMockHost("own-rooms@example.com"))._id);
    const other = String((await createMockHost("other-rooms@example.com"))._id);
    const theirRoom = String((await roomFor(other, "King"))._id);
    setReviewDrafter(async () => ({ house: "", rooms: [], reviewsRead: 0 }));
    const res = await request(signedInAs({ hostId: host, role: "Host" }))
      .post("/tt-host/reviews/draft")
      .send({ rooms: [{ roomId: theirRoom }] });
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
            request(app).post("/tt-host/reviews/upload").send({ uploadId, roomId, index: idx, total, text: text.slice(idx * size, (idx + 1) * size), name: "reviews.txt" }),
          ),
      );
    }
  };

  it("keeps a long paste, sent in parts, whole and in order — and drafting reads the record, not the page", async () => {
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

    // Waiting, whole, to be split.
    const kept: any = await TTReviewSource.findOne({ host, room: king }).lean();
    expect(kept.text).toBe(text);
    expect(kept.name).toBe("reviews.txt");

    // A page is not the record: with no review on record there is nothing to draft.
    expect((await request(app).post("/tt-host/reviews/draft").send({ rooms: [{ roomId: king }] })).status).toBe(400);

    // The individual reviews are what a draft reads — every room when none is named.
    await onRecord(host, king, "Spotless.", { guestName: "Ann", stars: 5, reviewMonth: "2026-09" });
    expect((await request(app).post("/tt-host/reviews/draft").send({})).status).toBe(202);
    await new Promise((r) => setTimeout(r, 50));
    expect(seen).toBe("— Guest: Ann · Month: 2026-09 · 5 stars —\nSpotless.");
  });

  it("lists what is on file without the reviewers' words, replaces it on a new file, and lets the host remove it", async () => {
    const host = String((await createMockHost("on-file@example.com"))._id);
    const king = String((await roomFor(host, "King"))._id);
    const app = signedInAs({ hostId: host, role: "Host" });
    await sendInParts(app, "upload-eeee-5", king, "first set of reviews");
    await sendInParts(app, "upload-ffff-6", king, "second, newer set of reviews");

    const listed = await request(app).get("/tt-host/reviews");
    expect(listed.body.sources).toHaveLength(1);
    expect(listed.body.sources[0]).toMatchObject({ roomId: king, name: "reviews.txt", chars: "second, newer set of reviews".length });
    expect(JSON.stringify(listed.body)).not.toContain("newer set of reviews");

    expect((await request(app).delete(`/tt-host/reviews/source/${king}`)).status).toBe(200);
    expect(await TTReviewSource.countDocuments({ host })).toBe(0);
  });

  it("saves nothing from an upload that is missing a part, or aimed at another host's room", async () => {
    const host = String((await createMockHost("missing-part@example.com"))._id);
    const other = String((await createMockHost("not-yours@example.com"))._id);
    const king = String((await roomFor(host, "King"))._id);
    const theirs = String((await roomFor(other, "King"))._id);
    const app = signedInAs({ hostId: host, role: "Host" });

    await sendInParts(app, "upload-bbbb-2", king, "A".repeat(30_000), [2]);
    expect(await TTReviewSource.countDocuments({ host })).toBe(0);

    await sendInParts(app, "upload-cccc-3", theirs, "A".repeat(12_000));
    expect(await TTReviewSource.countDocuments({ room: theirs })).toBe(0);
  });

  it("will not draft from another host's kept reviews", async () => {
    const host = String((await createMockHost("reader@example.com"))._id);
    const other = String((await createMockHost("owner@example.com"))._id);
    const theirs = String((await roomFor(other, "King"))._id);
    await onRecord(other, theirs, "mine!");
    setReviewDrafter(async () => ({ house: "", rooms: [], reviewsRead: 0 }));
    const res = await request(signedInAs({ hostId: host, role: "Host" })).post("/tt-host/reviews/draft").send({ rooms: [{ roomId: theirs }] });
    expect(res.status).toBe(400);
  });

  it("keeps one guest's review per room, guest and stay — as its own record, in no page", async () => {
    const host = String((await createMockHost("entry@example.com"))._id);
    const king = String((await roomFor(host, "King"))._id);
    const guest = String((await Guest.create({ host, name: "Alcides", phone: "5550001111" }))._id);
    const app = signedInAs({ hostId: host, role: "Host" });

    const res = await request(app)
      .post("/tt-host/reviews/entry")
      .send({ roomId: king, guestId: guest, guestName: "Alcides", stayDate: "2025-02-10", stars: 5, text: "Spotless and quiet." });
    expect(res.body).toEqual({ added: true });

    const entry: any = await TTReviewEntry.findOne({ host, room: king }).lean();
    expect(entry).toMatchObject({ guestName: "Alcides", stayDate: "2025-02-10", stars: 5, text: "Spotless and quiet." });
    expect(String(entry.guest)).toBe(guest);

    // The record IS the store: no page is written alongside it.
    await request(app).post("/tt-host/reviews/entry").send({ roomId: king, guestName: "Maria", text: "Bed was comfy." });
    expect(await TTReviewSource.countDocuments({ host })).toBe(0);
    expect(await TTReviewEntry.countDocuments({ host, room: king })).toBe(2);
  });

  it("skips the same review pasted twice, and says so", async () => {
    const host = String((await createMockHost("dup@example.com"))._id);
    const king = String((await roomFor(host, "King"))._id);
    const app = signedInAs({ hostId: host, role: "Host" });
    await request(app).post("/tt-host/reviews/entry").send({ roomId: king, text: "Great  stay!" });
    const again = await request(app).post("/tt-host/reviews/entry").send({ roomId: king, text: "great stay!  " });
    expect(again.body).toEqual({ added: false, duplicate: true });
    expect(await TTReviewEntry.countDocuments({ host })).toBe(1);
  });

  it("refuses a review for another host's room or guest, an over-long one, and bad stars", async () => {
    const host = String((await createMockHost("strict@example.com"))._id);
    const other = String((await createMockHost("strict-other@example.com"))._id);
    const mine = String((await roomFor(host, "King"))._id);
    const theirs = String((await roomFor(other, "King"))._id);
    const theirGuest = String((await Guest.create({ host: other, name: "Their Guest", phone: "5550002222" }))._id);
    const app = signedInAs({ hostId: host, role: "Host" });
    expect((await request(app).post("/tt-host/reviews/entry").send({ roomId: theirs, text: "x" })).status).toBe(400);
    expect((await request(app).post("/tt-host/reviews/entry").send({ roomId: mine, guestId: theirGuest, text: "x" })).status).toBe(400);
    expect((await request(app).post("/tt-host/reviews/entry").send({ roomId: mine, text: "A".repeat(2001) })).status).toBe(400);
    expect((await request(app).post("/tt-host/reviews/entry").send({ roomId: mine, stars: 6, text: "x" })).status).toBe(400);
    expect((await request(app).post("/tt-host/reviews/entry").send({ roomId: mine, stayDate: "last Tuesday", text: "x" })).status).toBe(400);
    expect(await TTReviewEntry.countDocuments({})).toBe(0);
  });

  it("lists reviews newest first by their own date — a month counts, not only a stay date", async () => {
    const host = String((await createMockHost("order@example.com"))._id);
    const king = String((await roomFor(host, "King"))._id);
    // Added in the page's "most relevant" order, not by time.
    await onRecord(host, king, "a", { guestName: "Yofti", reviewMonth: "2025-10" });
    await onRecord(host, king, "b", { guestName: "Alexander", reviewMonth: "2026-02" });
    await onRecord(host, king, "c", { guestName: "Stay", stayDate: "2026-01-15" });
    await onRecord(host, king, "d", { guestName: "Undated" });
    const res = await request(signedInAs({ hostId: host, role: "Host" })).get("/tt-host/reviews/entries");
    expect(res.body.entries.map((e: any) => e.guestName)).toEqual(["Alexander", "Stay", "Yofti", "Undated"]);
  });

  it("lists the reviews on record, newest stay first, as snippets, for this host only", async () => {
    const host = String((await createMockHost("list@example.com"))._id);
    const other = String((await createMockHost("list-other@example.com"))._id);
    const king = String((await roomFor(host, "King"))._id);
    const theirs = String((await roomFor(other, "King"))._id);
    const app = signedInAs({ hostId: host, role: "Host" });
    await request(app).post("/tt-host/reviews/entry").send({ roomId: king, guestName: "A", stayDate: "2025-01-05", stars: 4, text: "x".repeat(500) });
    await request(app).post("/tt-host/reviews/entry").send({ roomId: king, guestName: "B", stayDate: "2025-03-05", stars: 5, text: "Lovely" });
    await TTReviewEntry.create({ host: other, room: theirs, text: "not yours", hash: "h" });
    const res = await request(app).get("/tt-host/reviews/entries");
    expect(res.body.entries.map((e: any) => e.guestName)).toEqual(["B", "A"]);
    expect(res.body.entries[1].snippet).toHaveLength(160);
  });

  // The split reads the room's kept file, shows what it found, and saves only
  // when told. These pin that nothing is saved before then, that the file is not
  // written to again (the reviews came OUT of it), and that the same review is
  // never kept twice.
  const waitFor = async (fn: () => Promise<boolean>) => {
    for (let i = 0; i < 40; i++) {
      if (await fn()) return;
      await new Promise((r) => setTimeout(r, 25));
    }
  };

  it("splits the room's file into reviews, previews them, and saves them only on Add", async () => {
    const host = String((await createMockHost("split@example.com"))._id);
    const king = String((await roomFor(host, "King"))._id);
    const maria = String((await Guest.create({ host, name: "Maria", phone: "5550003333" }))._id);
    await keep(host, king, "raw pasted page");
    setReviewSplitter(async (_text, onProgress) => {
      onProgress(1, 1);
      return [
        { guestName: "Maria", stars: 5, month: "2026-09", when: "1 week ago", text: "Lovely and clean." },
        { guestName: "Leidy Johanna", stars: null, month: "2025-02", when: "February 2025", text: "Perfectly organized." },
      ];
    });
    const app = signedInAs({ hostId: host, role: "Host" });

    expect((await request(app).post("/tt-host/reviews/split").send({ roomId: king })).status).toBe(202);
    let preview: any = {};
    await waitFor(async () => {
      preview = (await request(app).get(`/tt-host/reviews/split/${king}`)).body;
      return preview.status === "ready";
    });
    expect(preview.reviews.map((r: any) => [r.guestName, r.stars, r.month, r.onFile])).toEqual([
      ["Maria", 5, "2026-09", false],
      ["Leidy Johanna", null, "2025-02", false],
    ]);
    // Seen, not saved.
    expect(await TTReviewEntry.countDocuments({ host })).toBe(0);

    const done = await request(app).post(`/tt-host/reviews/split/${king}/add`);
    expect(done.body).toEqual({ added: 2, skipped: 0 });
    const kept: any[] = await TTReviewEntry.find({ host, room: king }).sort({ createdAt: 1 }).lean();
    expect(kept.map((e) => [e.guestName, e.stars ?? null, e.reviewMonth, e.stayDate])).toEqual([
      ["Maria", 5, "2026-09", ""],
      ["Leidy Johanna", null, "2025-02", ""],
    ]);
    // Matched to the guest on the list by exact name, and not otherwise.
    expect(String(kept[0].guest)).toBe(maria);
    expect(kept[1].guest).toBeUndefined();
    // The page was only the way in: cleared once its reviews are on record.
    expect(await TTReviewSource.countDocuments({ host, room: king })).toBe(0);
    // And the split is spent.
    expect((await request(app).get(`/tt-host/reviews/split/${king}`)).body.status).toBe("none");
  });

  it("marks reviews already on file, and skips them on Add rather than keeping them twice", async () => {
    const host = String((await createMockHost("split-dup@example.com"))._id);
    const king = String((await roomFor(host, "King"))._id);
    await keep(host, king, "raw");
    const app = signedInAs({ hostId: host, role: "Host" });
    await request(app).post("/tt-host/reviews/entry").send({ roomId: king, guestName: "Maria", text: "Lovely and clean." });
    setReviewSplitter(async () => [
      { guestName: "Maria", stars: 5, month: "", when: "", text: "lovely  and clean." },
      { guestName: "New", stars: 4, month: "", when: "", text: "A fresh one." },
    ]);
    await request(app).post("/tt-host/reviews/split").send({ roomId: king });
    let preview: any = {};
    await waitFor(async () => {
      preview = (await request(app).get(`/tt-host/reviews/split/${king}`)).body;
      return preview.status === "ready";
    });
    expect(preview.reviews.map((r: any) => r.onFile)).toEqual([true, false]);
    expect((await request(app).post(`/tt-host/reviews/split/${king}/add`)).body).toEqual({ added: 1, skipped: 1 });
    expect(await TTReviewEntry.countDocuments({ host, room: king })).toBe(2);
  });

  it("keeps a review posted twice as two, and adds nothing when the same page is split again", async () => {
    const host = String((await createMockHost("split-twice@example.com"))._id);
    const king = String((await roomFor(host, "King"))._id);
    await keep(host, king, "raw");
    const app = signedInAs({ hostId: host, role: "Host" });
    // Saved before the fix: one copy of Wan-Lin's words, under the bare hash.
    await request(app).post("/tt-host/reviews/entry").send({ roomId: king, guestName: "Wan-Lin", text: "Super friendly!" });
    setReviewSplitter(async () => [
      { guestName: "Wan-Lin", stars: 5, month: "", when: "", text: "Super friendly!" },
      { guestName: "Wan-Lin", stars: 5, month: "", when: "", text: "Super friendly!" },
      { guestName: "Adrian", stars: 5, month: "", when: "", text: "Amazing." },
    ]);
    const split = async () => {
      await request(app).post("/tt-host/reviews/split").send({ roomId: king });
      let preview: any = {};
      await waitFor(async () => {
        preview = (await request(app).get(`/tt-host/reviews/split/${king}`)).body;
        return preview.status === "ready";
      });
      return preview;
    };

    const first = await split();
    expect(first.reviews.map((r: any) => r.onFile)).toEqual([true, false, false]);
    expect((await request(app).post(`/tt-host/reviews/split/${king}/add`)).body).toEqual({ added: 2, skipped: 1 });
    expect(await TTReviewEntry.countDocuments({ host, room: king })).toBe(3);

    // The same page again (pasted anew — the last was cleared): every copy is on file, nothing is added.
    await keep(host, king, "raw");
    const again = await split();
    expect(again.reviews.map((r: any) => r.onFile)).toEqual([true, true, true]);
    expect((await request(app).post(`/tt-host/reviews/split/${king}/add`)).body).toEqual({ added: 0, skipped: 3 });
    expect(await TTReviewEntry.countDocuments({ host, room: king })).toBe(3);
  });

  it("does not guess which guest a first name is when two on the list share it", async () => {
    const host = String((await createMockHost("split-twins@example.com"))._id);
    const king = String((await roomFor(host, "King"))._id);
    await Guest.create({ host, name: "Alex", phone: "5550004444" });
    await Guest.create({ host, name: "Alex", phone: "5550005555" });
    await keep(host, king, "raw");
    setReviewSplitter(async () => [{ guestName: "Alex", stars: 5, month: "", when: "", text: "Great." }]);
    const app = signedInAs({ hostId: host, role: "Host" });
    await request(app).post("/tt-host/reviews/split").send({ roomId: king });
    await waitFor(async () => (await request(app).get(`/tt-host/reviews/split/${king}`)).body.status === "ready");
    await request(app).post(`/tt-host/reviews/split/${king}/add`);
    const e: any = await TTReviewEntry.findOne({ host, room: king }).lean();
    expect(e.guestName).toBe("Alex");
    expect(e.guest).toBeUndefined();
  });

  it("will not split a room with no reviews on file, or another host's room, and says a failure in words", async () => {
    const host = String((await createMockHost("split-refuse@example.com"))._id);
    const other = String((await createMockHost("split-refuse-other@example.com"))._id);
    const mine = String((await roomFor(host, "King"))._id);
    const theirs = String((await roomFor(other, "King"))._id);
    await keep(other, theirs, "their reviews");
    setReviewSplitter(async () => {
      throw new Error("Claude declined to read these reviews.");
    });
    const app = signedInAs({ hostId: host, role: "Host" });
    expect((await request(app).post("/tt-host/reviews/split").send({ roomId: mine })).status).toBe(400);
    expect((await request(app).post("/tt-host/reviews/split").send({ roomId: theirs })).status).toBe(400);

    await keep(host, mine, "raw");
    expect((await request(app).post("/tt-host/reviews/split").send({ roomId: mine })).status).toBe(202);
    let status: any = {};
    await waitFor(async () => {
      status = (await request(app).get(`/tt-host/reviews/split/${mine}`)).body;
      return status.status === "failed";
    });
    expect(status.error).toMatch(/declined/);
    expect((await request(app).post(`/tt-host/reviews/split/${mine}/add`)).status).toBe(400);
  });

  it("works out averages, low reviews and who cleaned those rooms, with no model", async () => {
    const host = String((await createMockHost("stats@example.com"))._id);
    const other = String((await createMockHost("stats-other@example.com"))._id);
    const king = String((await roomFor(host, "King"))._id);
    const queen = String((await roomFor(host, "Queen"))._id);
    const henry = String((await Cleaner.create({ host, name: "Henry", payRate: 20 }))._id);
    const maria = String((await Cleaner.create({ host, name: "Maria", payRate: 20 }))._id);
    const mk = (room: string, o: Record<string, unknown>, i: number) =>
      TTReviewEntry.create({ host, room, text: `review ${i} ${o.extra ?? ""}`, hash: `h${i}`, ...o });
    await mk(king, { guestName: "Ann", stars: 5, reviewMonth: "2026-08" }, 1);
    await mk(king, { guestName: "Bob", stars: 2, stayDate: "2026-09-10", extra: "the bathroom was dirty" }, 2);
    await mk(king, { guestName: "Cy", stars: 3, reviewMonth: "2026-08" }, 3);
    await mk(queen, { guestName: "Di", stars: 5 }, 4);
    await mk(queen, { guestName: "Ed" }, 5);
    // Henry cleaned King the morning Bob arrived; Maria cleaned King in August; the
    // other host's rota must never leak in.
    await CleaningAssignment.create({ host, date: "2026-09-10", room: king, cleaner: henry });
    await CleaningAssignment.create({ host, date: "2026-08-15", room: king, cleaner: maria });
    await CleaningAssignment.create({ host, date: "2026-08-20", room: queen, cleaner: maria });
    await CleaningAssignment.create({ host: other, date: "2026-09-10", room: king, cleaner: henry });

    const res = await request(signedInAs({ hostId: host, role: "Host" })).get("/tt-host/reviews/stats?topic=clean");
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(5);
    expect(res.body.rooms.map((r: any) => [r.name, r.reviews, r.withStars, r.average])).toEqual([
      ["King", 3, 3, 3.33],
      ["Queen", 2, 1, 5],
    ]);
    // Newest low review first: Bob (a night), then Cy (a month).
    expect(res.body.low.map((r: any) => [r.guestName, r.basis, r.cleaners])).toEqual([
      ["Bob", "night", ["Henry"]],
      ["Cy", "month", ["Maria"]],
    ]);
    // Same-named room, same dates, someone else's rota: not counted. And the
    // queen's August cleaning is not King's.
    expect(JSON.stringify(res.body.low)).not.toContain("review 4");
    expect(res.body.topic.rooms).toEqual([{ room: king, name: "King", count: 1 }]);
    // Nothing published yet: empty, not missing.
    expect(res.body.published).toMatchObject({ house: "", rooms: [] });

    // Once published, the same words TiBook's TT shows a guest.
    await TTReviews.create({ host, published: { house: "Guests love it.", rooms: [{ room: king, summary: "Big bed." }, { room: queen, summary: "" }], at: new Date() } });
    const after = await request(signedInAs({ hostId: host, role: "Host" })).get("/tt-host/reviews/stats");
    expect(after.body.published.house).toBe("Guests love it.");
    expect(after.body.published.rooms).toEqual([{ room: king, name: "King", summary: "Big bed." }]);
  });

  it("says no lead when a low review has no date, and never reads another host's reviews", async () => {
    const host = String((await createMockHost("stats-nodate@example.com"))._id);
    const other = String((await createMockHost("stats-nodate-other@example.com"))._id);
    const king = String((await roomFor(host, "King"))._id);
    const theirs = String((await roomFor(other, "King"))._id);
    await TTReviewEntry.create({ host, room: king, guestName: "Fay", stars: 1, text: "bad", hash: "a" });
    await TTReviewEntry.create({ host: other, room: theirs, guestName: "Gus", stars: 1, text: "theirs", hash: "b" });
    const res = await request(signedInAs({ hostId: host, role: "Host" })).get("/tt-host/reviews/stats");
    expect(res.body.total).toBe(1);
    expect(res.body.low).toHaveLength(1);
    expect(res.body.low[0]).toMatchObject({ guestName: "Fay", basis: "none", cleaners: [] });
    expect(res.body.topic).toBeNull();
  });

  it("deletes one review — and its words from a page the old form once wrote them into", async () => {
    const host = String((await createMockHost("del@example.com"))._id);
    const king = String((await roomFor(host, "King"))._id);
    const app = signedInAs({ hostId: host, role: "Host" });
    // As the form used to leave things (before the reviews became the one record).
    await keep(host, king, "— Guest: Ann · 5 stars —\nFirst one.\n\nLim 9 years on Airbnb whole block\n\n— Guest: Cy · Month: 2026-09 —\nThird one.");
    await onRecord(host, king, "First one.", { guestName: "Ann", stars: 5 });
    const bad = await onRecord(host, king, "Lim 9 years on Airbnb whole block");
    await onRecord(host, king, "Third one.", { guestName: "Cy", reviewMonth: "2026-09" });

    expect((await request(app).delete(`/tt-host/reviews/entry/${bad._id}`)).status).toBe(200);
    expect(await TTReviewEntry.countDocuments({ host })).toBe(2);
    const file: any = await TTReviewSource.findOne({ host, room: king }).lean();
    expect(file.text).toBe("— Guest: Ann · 5 stars —\nFirst one.\n\n— Guest: Cy · Month: 2026-09 —\nThird one.");
  });

  it("leaves a pasted page alone when deleting a review that came out of it", async () => {
    const host = String((await createMockHost("del-split@example.com"))._id);
    const king = String((await roomFor(host, "King"))._id);
    await keep(host, king, "Maria\nRating, 5 stars\nLovely and clean.\n\nBob\nOk.");
    const e = await TTReviewEntry.create({ host, room: king, guestName: "Maria", stars: 5, text: "Lovely and clean.", hash: "x", inFile: false });
    await request(signedInAs({ hostId: host, role: "Host" })).delete(`/tt-host/reviews/entry/${e._id}`);
    const file: any = await TTReviewSource.findOne({ host, room: king }).lean();
    expect(file.text).toBe("Maria\nRating, 5 stars\nLovely and clean.\n\nBob\nOk.");
  });

  it("opens one review in full — not the snippet — for this host only", async () => {
    const host = String((await createMockHost("full@example.com"))._id);
    const other = String((await createMockHost("full-other@example.com"))._id);
    const king = String((await roomFor(host, "King"))._id);
    const long = "word ".repeat(300).trim();
    const e = await TTReviewEntry.create({ host, room: king, guestName: "Ann", stars: 4, reviewMonth: "2026-09", text: long, hash: "f" });
    const res = await request(signedInAs({ hostId: host, role: "Host" })).get(`/tt-host/reviews/entry/${e._id}`);
    expect(res.body).toMatchObject({ guestName: "Ann", stars: 4, reviewMonth: "2026-09", text: long });
    expect((await request(signedInAs({ hostId: other, role: "Host" })).get(`/tt-host/reviews/entry/${e._id}`)).status).toBe(404);
  });

  it("will not delete another host's review", async () => {
    const host = String((await createMockHost("del-mine@example.com"))._id);
    const other = String((await createMockHost("del-theirs@example.com"))._id);
    const theirs = String((await roomFor(other, "King"))._id);
    const e = await TTReviewEntry.create({ host: other, room: theirs, text: "theirs", hash: "t" });
    expect((await request(signedInAs({ hostId: host, role: "Host" })).delete(`/tt-host/reviews/entry/${e._id}`)).status).toBe(404);
    expect(await TTReviewEntry.countDocuments({ _id: e._id })).toBe(1);
  });

  it("refuses a review month that is not a month", async () => {
    const host = String((await createMockHost("bad-month@example.com"))._id);
    const king = String((await roomFor(host, "King"))._id);
    const res = await request(signedInAs({ hostId: host, role: "Host" }))
      .post("/tt-host/reviews/entry")
      .send({ roomId: king, reviewMonth: "2 days ago", text: "x" });
    expect(res.status).toBe(400);
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
    await onRecord(host, king, "x");
    await request(hostApp).post("/tt-host/reviews/draft").send({ rooms: [{ roomId: king }] });
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

    await onRecord(host, king, "old reviews");
    await request(hostApp).post("/tt-host/reviews/draft").send({ rooms: [{ roomId: king }] });
    await request(hostApp).put("/tt-host/reviews").send({ house: "Written by hand.", rooms: [] });
    finish({ house: "Old draft", rooms: [], reviewsRead: 1 });
    await new Promise((r) => setTimeout(r, 50));

    const res = await request(hostApp).get("/tt-host/reviews");
    expect(res.body.published.house).toBe("Written by hand.");
    expect(res.body.draft.status).toBe("none");
  });
});
