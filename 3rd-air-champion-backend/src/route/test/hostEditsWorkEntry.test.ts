import express from "express";
import request from "supertest";
import mongoose from "mongoose";
import staffRoute from "../staffRoute";
import Staff from "../../model/staffSchema";
import Cleaner from "../../model/cleanerSchema";
import WorkEntry from "../../model/workEntrySchema";
import CleaningAssignment from "../../model/cleaningAssignmentSchema";

// The host correcting a work entry in TiMag.
//
// Written for the day a staff member logged the wrong date and it was
// approved: the worker is locked out of an approved entry, and the host had no
// edit at all, so nobody could fix it. The host can now — and every case below
// is a way that correction could leave pay wrong if it were done carelessly.
//
// If one of these fails, somebody is paid the wrong amount for a corrected
// day. Work out which case before changing it.

const app = express();
app.use(express.json());
app.use("/staff", staffRoute);

const host = new mongoose.Types.ObjectId();

const makeStaff = async () =>
  await new Staff({
    host,
    name: `Intern ${new mongoose.Types.ObjectId()}`,
    hiredOn: "2026-08-18",
    payType: "hourly",
    payRate: 20,
    // A raise on the 1st of October.
    rateHistory: [{ rate: 25, effectiveFrom: "2026-10-01" }],
  }).save();

const makeCleaner = async () =>
  await new Cleaner({ host, name: `Cleaner ${new mongoose.Types.ObjectId()}`, payRate: 21 }).save();

const scheduleRooms = async (cleaner: any, date: string, rooms: number) => {
  const made = [];
  for (let i = 0; i < rooms; i++)
    made.push(
      await new CleaningAssignment({ host, cleaner: cleaner._id, date, room: new mongoose.Types.ObjectId() }).save(),
    );
  return made;
};

const hoursOn = async (cleaner: any, date: string) =>
  (await CleaningAssignment.find({ cleaner: cleaner._id, date }).sort({ _id: 1 })).map((a: any) => a.hours);

const edit = (body: Record<string, unknown>) => request(app).patch("/staff/hours/edit").send(body);

describe("the host corrects a staff entry", () => {
  it("changes the day, the hours and the report of a waiting entry", async () => {
    const s: any = await makeStaff();
    const e: any = await new WorkEntry({ host, staff: s._id, date: "2026-09-29", hours: 3, report: "prompts" }).save();

    const res = await edit({ id: String(e._id), date: "2026-09-28", hours: 3.5, report: "prompts, review" });

    expect(res.status).toBe(200);
    const after: any = await WorkEntry.findById(e._id);
    expect(after.date).toBe("2026-09-28");
    expect(after.hours).toBe(3.5);
    expect(after.report).toBe("prompts, review");
    // Still a claim: correcting it does not approve it.
    expect(after.status).toBe("submitted");
    expect(after.approvedRate).toBe(0);
  });

  it("re-prices an approved entry at the rate in force on the corrected day", async () => {
    const s: any = await makeStaff();
    // Logged against 1 Oct by mistake and approved there, at the new $25.
    const e: any = await new WorkEntry({
      host, staff: s._id, date: "2026-10-01", hours: 4, status: "approved", approvedRate: 25, approvedOn: "2026-10-01",
    }).save();

    // The work was really done on 30 Sep, before the raise.
    const res = await edit({ id: String(e._id), date: "2026-09-30" });

    expect(res.status).toBe(200);
    const after: any = await WorkEntry.findById(e._id);
    expect(after.date).toBe("2026-09-30");
    expect(after.status).toBe("approved");
    expect(after.approvedRate).toBe(20);
  });

  it("refuses a day before they were hired", async () => {
    const s: any = await makeStaff();
    const e: any = await new WorkEntry({ host, staff: s._id, date: "2026-09-29", hours: 3 }).save();

    const res = await edit({ id: String(e._id), date: "2026-08-01" });

    expect(res.status).toBe(400);
    expect((await WorkEntry.findById(e._id) as any).date).toBe("2026-09-29");
  });

  it("refuses hours that are not a real day's work, and changes nothing", async () => {
    const s: any = await makeStaff();
    const e: any = await new WorkEntry({ host, staff: s._id, date: "2026-09-29", hours: 3 }).save();

    expect((await edit({ id: String(e._id), hours: 0 })).status).toBe(400);
    expect((await edit({ id: String(e._id), hours: 30 })).status).toBe(400);
    expect((await WorkEntry.findById(e._id) as any).hours).toBe(3);
  });

  it("refuses a day that is not a date", async () => {
    const s: any = await makeStaff();
    const e: any = await new WorkEntry({ host, staff: s._id, date: "2026-09-29", hours: 3 }).save();

    expect((await edit({ id: String(e._id), date: "yesterday" })).status).toBe(400);
  });
});

describe("the host corrects a cleaner entry", () => {
  it("moves an approved day's hours onto the corrected day's rooms and clears the day it left", async () => {
    const c: any = await makeCleaner();
    await scheduleRooms(c, "2026-09-20", 2);
    await scheduleRooms(c, "2026-09-21", 3);
    // Approved against the 20th: the total sits on the first room, 0 on the rest.
    const e: any = await new WorkEntry({
      host, cleaner: c._id, date: "2026-09-20", hours: 2.5, status: "approved", approvedRate: 21,
    }).save();
    const first = await CleaningAssignment.find({ cleaner: c._id, date: "2026-09-20" }).sort({ _id: 1 });
    await CleaningAssignment.findByIdAndUpdate(first[0]._id, { hours: 2.5 });
    await CleaningAssignment.findByIdAndUpdate(first[1]._id, { hours: 0 });

    const res = await edit({ id: String(e._id), date: "2026-09-21", hours: 3 });

    expect(res.status).toBe(200);
    // The day it left earns nothing any more.
    expect(await hoursOn(c, "2026-09-20")).toEqual([null, null]);
    // The whole total on the first room, 0 on the rest — never the total on
    // every room, which would pay the day three times.
    expect(await hoursOn(c, "2026-09-21")).toEqual([3, 0, 0]);
  });

  it("rewrites the same day's rooms when only the hours of an approved day change", async () => {
    const c: any = await makeCleaner();
    const rooms = await scheduleRooms(c, "2026-09-22", 2);
    await CleaningAssignment.findByIdAndUpdate(rooms[0]._id, { hours: 2 });
    await CleaningAssignment.findByIdAndUpdate(rooms[1]._id, { hours: 0 });
    const e: any = await new WorkEntry({
      host, cleaner: c._id, date: "2026-09-22", hours: 2, status: "approved", approvedRate: 21,
    }).save();

    expect((await edit({ id: String(e._id), hours: 2.75 })).status).toBe(200);
    expect(await hoursOn(c, "2026-09-22")).toEqual([2.75, 0]);
  });

  it("leaves the rooms alone when the entry is still only a claim", async () => {
    const c: any = await makeCleaner();
    await scheduleRooms(c, "2026-09-23", 2);
    const e: any = await new WorkEntry({ host, cleaner: c._id, date: "2026-09-23", hours: 2 }).save();

    expect((await edit({ id: String(e._id), hours: 3 })).status).toBe(200);
    // Hours reach the rooms at approval, not before.
    expect(await hoursOn(c, "2026-09-23")).toEqual([null, null]);
  });

  it("refuses a day they were not scheduled", async () => {
    const c: any = await makeCleaner();
    await scheduleRooms(c, "2026-09-24", 1);
    const e: any = await new WorkEntry({ host, cleaner: c._id, date: "2026-09-24", hours: 2 }).save();

    const res = await edit({ id: String(e._id), date: "2026-09-25" });

    expect(res.status).toBe(400);
    expect((await WorkEntry.findById(e._id) as any).date).toBe("2026-09-24");
  });

  it("refuses a day they have already claimed", async () => {
    const c: any = await makeCleaner();
    await scheduleRooms(c, "2026-09-26", 1);
    await scheduleRooms(c, "2026-09-27", 1);
    const e: any = await new WorkEntry({ host, cleaner: c._id, date: "2026-09-26", hours: 2 }).save();
    await new WorkEntry({ host, cleaner: c._id, date: "2026-09-27", hours: 1 }).save();

    const res = await edit({ id: String(e._id), date: "2026-09-27" });

    expect(res.status).toBe(400);
    expect((await WorkEntry.findById(e._id) as any).date).toBe("2026-09-26");
  });
});
