import express from "express";
import request from "supertest";
import mongoose from "mongoose";
import cleanerRoute from "../cleanerRoute";
import Cleaner from "../../model/cleanerSchema";
import CleaningAssignment from "../../model/cleaningAssignmentSchema";
import CleaningExtra from "../../model/cleaningExtraSchema";

// Extra jobs — windows, baseboards — scheduled onto a cleaner's visit, so the
// cleaner knows the visit is longer and Cindy sees why the hours are what they
// are. The host's rules these pin: an extra only rides on a visit WITH rooms;
// it goes when the visit goes; the same job typed twice is one job; and taking
// a job off the list never rewrites what a past visit says was done.

const app = express();
app.use(express.json());
app.use("/cleaner", cleanerRoute);

const host = () => String(new mongoose.Types.ObjectId());
const room = () => String(new mongoose.Types.ObjectId());
const cleaner = async (h: string, name: string) => String((await Cleaner.create({ host: h, name, payRate: 20 }))._id);
const job = async (h: string, name: string) => (await request(app).post("/cleaner/jobs").send({ host: h, name })).body;
const toggle = (h: string, date: string, c: string, j: string, on: boolean) =>
  request(app).post("/cleaner/extras/toggle").send({ host: h, date, cleaner: c, job: j, on });

describe("the list of extra jobs", () => {
  it("keeps one job however it is typed, and lists them by name", async () => {
    const h = host();
    const a = await job(h, "Windows");
    const b = await job(h, "  windows ");
    await job(h, "Baseboards");
    expect(b.id).toBe(a.id);
    const list = await request(app).get(`/cleaner/jobs?host=${h}`);
    expect(list.body.map((j: any) => j.name)).toEqual(["Baseboards", "Windows"]);
  });

  it("keeps a removed job's name on the visits it was already on", async () => {
    const h = host();
    const henry = await cleaner(h, "Henry");
    const r = room();
    await request(app).post("/cleaner/assign").send({ host: h, date: "2026-10-10", room: r, cleaner: henry });
    const w = await job(h, "Windows");
    await toggle(h, "2026-10-10", henry, w.id, true);
    await request(app).delete(`/cleaner/jobs/${w.id}?host=${h}`);
    const extras = await request(app).get(`/cleaner/extras?host=${h}&start=2026-10-01&end=2026-10-31`);
    expect(extras.body.map((e: any) => e.name)).toEqual(["Windows"]);
    expect((await request(app).get(`/cleaner/jobs?host=${h}`)).body).toEqual([]);
  });
});

describe("extra jobs on a visit", () => {
  it("goes on only a visit with rooms, and comes off again", async () => {
    const h = host();
    const henry = await cleaner(h, "Henry");
    const w = await job(h, "Windows");
    // No room that morning: refused, in words.
    const refused = await toggle(h, "2026-10-10", henry, w.id, true);
    expect(refused.status).toBe(400);
    expect(refused.body.error).toMatch(/visit with rooms/);

    await request(app).post("/cleaner/assign").send({ host: h, date: "2026-10-10", room: room(), cleaner: henry });
    expect((await toggle(h, "2026-10-10", henry, w.id, true)).body).toMatchObject({ on: true, name: "Windows" });
    // Ticking it twice is still one extra.
    await toggle(h, "2026-10-10", henry, w.id, true);
    expect(await CleaningExtra.countDocuments({ host: h })).toBe(1);

    await toggle(h, "2026-10-10", henry, w.id, false);
    expect(await CleaningExtra.countDocuments({ host: h })).toBe(0);
  });

  it("carries the host's note for this visit, and lets it change", async () => {
    const h = host();
    const henry = await cleaner(h, "Henry");
    await request(app).post("/cleaner/assign").send({ host: h, date: "2026-10-10", room: room(), cleaner: henry });
    await request(app).post("/cleaner/assign").send({ host: h, date: "2026-10-17", room: room(), cleaner: henry });
    const b = await job(h, "Baseboard");
    await request(app).post("/cleaner/extras/toggle").send({ host: h, date: "2026-10-10", cleaner: henry, job: b.id, on: true, note: " in Cute & King " });
    // The same job, another visit, another note.
    await request(app).post("/cleaner/extras/toggle").send({ host: h, date: "2026-10-17", cleaner: henry, job: b.id, on: true });
    await request(app).patch("/cleaner/extras/note").send({ host: h, date: "2026-10-17", cleaner: henry, job: b.id, note: "Chill & Cozy" });
    const rows = (await request(app).get(`/cleaner/extras?host=${h}&start=2026-10-01&end=2026-10-31`)).body;
    expect(rows.map((r: any) => [r.date, r.name, r.note])).toEqual([
      ["2026-10-10", "Baseboard", "in Cute & King"],
      ["2026-10-17", "Baseboard", "Chill & Cozy"],
    ]);
    // Ticking it again without a note leaves the note as it was.
    await request(app).post("/cleaner/extras/toggle").send({ host: h, date: "2026-10-10", cleaner: henry, job: b.id, on: true });
    const again = (await request(app).get(`/cleaner/extras?host=${h}&start=2026-10-10&end=2026-10-10`)).body;
    expect(again[0].note).toBe("in Cute & King");
    // A note for a job not on the visit is refused.
    expect((await request(app).patch("/cleaner/extras/note").send({ host: h, date: "2026-10-11", cleaner: henry, job: b.id, note: "x" })).status).toBe(404);
  });

  it("stays while the cleaner still has a room that morning, and goes with the last one", async () => {
    const h = host();
    const henry = await cleaner(h, "Henry");
    const [r1, r2] = [room(), room()];
    await request(app).post("/cleaner/assign").send({ host: h, date: "2026-10-10", room: r1, cleaner: henry });
    await request(app).post("/cleaner/assign").send({ host: h, date: "2026-10-10", room: r2, cleaner: henry });
    const w = await job(h, "Windows");
    await toggle(h, "2026-10-10", henry, w.id, true);

    await request(app).post("/cleaner/unassign").send({ host: h, date: "2026-10-10", room: r1 });
    expect(await CleaningExtra.countDocuments({ host: h })).toBe(1);
    await request(app).post("/cleaner/unassign").send({ host: h, date: "2026-10-10", room: r2 });
    expect(await CleaningExtra.countDocuments({ host: h })).toBe(0);
  });

  it("goes when the cleaner's only room is given to someone else — and only theirs", async () => {
    const h = host();
    const henry = await cleaner(h, "Henry");
    const vu = await cleaner(h, "Vu");
    const r = room();
    await request(app).post("/cleaner/assign").send({ host: h, date: "2026-10-10", room: r, cleaner: henry });
    await request(app).post("/cleaner/assign").send({ host: h, date: "2026-10-10", room: room(), cleaner: vu });
    const w = await job(h, "Windows");
    await toggle(h, "2026-10-10", henry, w.id, true);
    await toggle(h, "2026-10-10", vu, w.id, true);

    await request(app).post("/cleaner/assign").send({ host: h, date: "2026-10-10", room: r, cleaner: vu });
    const left: any[] = await CleaningExtra.find({ host: h }).lean();
    expect(left.map((e) => String(e.cleaner))).toEqual([vu]);
  });

  it("goes with the cleaner when the cleaner is deleted", async () => {
    const h = host();
    const henry = await cleaner(h, "Henry");
    await request(app).post("/cleaner/assign").send({ host: h, date: "2026-10-10", room: room(), cleaner: henry });
    const w = await job(h, "Windows");
    await toggle(h, "2026-10-10", henry, w.id, true);
    await Cleaner.findOneAndDelete({ _id: henry });
    expect(await CleaningAssignment.countDocuments({ cleaner: henry })).toBe(0);
    expect(await CleaningExtra.countDocuments({ cleaner: henry })).toBe(0);
  });

  it("will not schedule another host's job", async () => {
    const h = host();
    const henry = await cleaner(h, "Henry");
    await request(app).post("/cleaner/assign").send({ host: h, date: "2026-10-10", room: room(), cleaner: henry });
    const theirs = await job(host(), "Windows");
    expect((await toggle(h, "2026-10-10", henry, theirs.id, true)).status).toBe(404);
  });
});
