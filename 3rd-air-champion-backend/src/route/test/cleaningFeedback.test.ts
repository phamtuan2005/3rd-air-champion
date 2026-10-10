import express from "express";
import request from "supertest";
import mongoose from "mongoose";
import cleanerRoute from "../cleanerRoute";
import workRoute from "../workRoute";
import Cleaner from "../../model/cleanerSchema";
import Room from "../../model/roomSchema";
import CleaningAssignment from "../../model/cleaningAssignmentSchema";

// Feedback on a cleaner's visit: Cindy writes it in TiMag's Clean screen, the
// cleaner reads it in TiWork (2026-10-09). What these pin: it only goes on a
// visit that was scheduled; it reaches the cleaner who did the visit and no
// one else; it shows as New until they have seen it, and new again once it is
// changed; emptying it takes it away.

const app = express();
app.use(express.json());
app.use("/cleaner", cleanerRoute);
app.use("/work", workRoute);

const DAY = "2026-10-08";

const setup = async () => {
  const host = String(new mongoose.Types.ObjectId());
  const room = String((await Room.create({ host, name: "Queen", price: 60 }))._id);
  const henry = await Cleaner.create({ host, name: "Henry", phone: "4085550101", accessCode: "HNRY7" });
  const mai = await Cleaner.create({ host, name: "Mai", phone: "4085550102", accessCode: "MAI42" });
  await CleaningAssignment.create({ host, date: DAY, room, cleaner: henry._id, hours: 2 });
  return { host, henry: String(henry._id), mai: String(mai._id) };
};

const write = (host: string, cleaner: string, body: Record<string, unknown>, date = DAY) =>
  request(app).put("/cleaner/feedback").send({ host, date, cleaner, ...body });

const henrysDay = async () => {
  const res = await request(app)
    .post("/work/schedule")
    .send({ identifier: "4085550101", code: "HNRY7", from: "2026-10-01", to: "2026-10-31" });
  expect(res.status).toBe(200);
  return res.body.find((d: any) => d.date === DAY);
};

describe("feedback on a cleaner's visit", () => {
  it("reaches the cleaner in TiWork as New, until they have seen it", async () => {
    const { host, henry } = await setup();
    const saved = await write(host, henry, { verdict: "great", text: "Queen: mirror had streaks." });
    expect(saved.status).toBe(200);

    expect((await henrysDay()).feedback).toEqual({ verdict: "great", text: "Queen: mirror had streaks.", isNew: true });

    await request(app).post("/work/feedback/seen").send({ identifier: "4085550101", code: "HNRY7", dates: [DAY] });
    expect((await henrysDay()).feedback.isNew).toBe(false);

    // Changed words are new words.
    await write(host, henry, { verdict: "good", text: "Queen: mirror had streaks, and under the bed." });
    expect((await henrysDay()).feedback).toEqual({ verdict: "good", text: "Queen: mirror had streaks, and under the bed.", isNew: true });
  });

  it("lists for the host what was written, by visit", async () => {
    const { host, henry } = await setup();
    await write(host, henry, { verdict: "fix", text: "Towels." });
    const list = await request(app).get(`/cleaner/feedback?host=${host}&start=2026-10-01&end=2026-10-31`);
    expect(list.body).toEqual([expect.objectContaining({ date: DAY, cleaner: henry, verdict: "fix", text: "Towels.", seenAt: null })]);
  });

  it("goes only on a visit that was scheduled", async () => {
    const { host, mai } = await setup();
    const res = await write(host, mai, { verdict: "great" });
    expect(res.status).toBe(400);
  });

  it("is taken away when both the verdict and the comment are emptied", async () => {
    const { host, henry } = await setup();
    await write(host, henry, { verdict: "great", text: "Lovely." });
    await write(host, henry, { verdict: "", text: "  " });
    expect((await henrysDay()).feedback).toBeNull();
  });

  it("does not let another cleaner mark it seen", async () => {
    const { host, henry } = await setup();
    await write(host, henry, { text: "Thank you!" });
    await request(app).post("/work/feedback/seen").send({ identifier: "4085550102", code: "MAI42", dates: [DAY] });
    expect((await henrysDay()).feedback.isNew).toBe(true);
  });

  it("ignores a verdict it does not know", async () => {
    const { host, henry } = await setup();
    await write(host, henry, { verdict: "terrible", text: "Hm." });
    expect((await henrysDay()).feedback.verdict).toBe("");
  });
});
