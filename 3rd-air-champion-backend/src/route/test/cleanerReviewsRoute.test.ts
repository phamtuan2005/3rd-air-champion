import express from "express";
import request from "supertest";
import mongoose from "mongoose";
import workRoute from "../workRoute";
import Cleaner from "../../model/cleanerSchema";
import Room from "../../model/roomSchema";
import Staff from "../../model/staffSchema";
import CleaningAssignment from "../../model/cleaningAssignmentSchema";
import TTReviewEntry from "../../model/ttReviewEntrySchema";

// TiWork's "what guests said about rooms you cleaned". The review records are
// otherwise manager-only, so what this pins is mostly what does NOT leak: a
// review reaches only the cleaner who prepared that stay, carries the guest's
// first name only, and never crosses to another host's cleaners.

const app = express();
app.use(express.json());
app.use("/work", workRoute);

const setup = async () => {
  const host = String(new mongoose.Types.ObjectId());
  const room = String((await Room.create({ host, name: "King", price: 80 }))._id);
  const henry = await Cleaner.create({ host, name: "Henry", phone: "4085550101", accessCode: "HNRY7" });
  const mai = await Cleaner.create({ host, name: "Mai", phone: "4085550102", accessCode: "MAI42" });
  await CleaningAssignment.create({ host, date: "2026-09-10", room, cleaner: henry._id, hours: 2 });
  await CleaningAssignment.create({ host, date: "2026-09-20", room, cleaner: mai._id, hours: 2 });
  await TTReviewEntry.create({ host, room, hash: "a", guestName: "Sarah Johnson", stayDate: "2026-09-10", stars: 5, text: "Spotless and cosy." });
  await TTReviewEntry.create({ host, room, hash: "b", guestName: "Tom", stayDate: "2026-09-20", stars: 4, text: "Fresh towels and a tidy room." });
  return { host, room };
};

const reviewsFor = (identifier: string, code: string) =>
  request(app).post("/work/reviews").send({ identifier, code });

describe("POST /work/reviews", () => {
  it("gives each cleaner the reviews of the stays they prepared, and no others", async () => {
    await setup();
    const henry = await reviewsFor("4085550101", "HNRY7");
    expect(henry.status).toBe(200);
    expect(henry.body.reviews).toEqual([
      expect.objectContaining({ cleanDate: "2026-09-10", roomName: "King", guestFirstName: "Sarah", stars: 5, workWords: ["Spotless"] }),
    ]);
    const mai = await reviewsFor("4085550102", "MAI42");
    expect(mai.body.reviews.map((r: any) => r.guestFirstName)).toEqual(["Tom"]);
  });

  it("never sends the guest's full name or the record's other fields", async () => {
    await setup();
    const body = JSON.stringify((await reviewsFor("4085550101", "HNRY7")).body);
    expect(body).not.toContain("Johnson");
    expect(body).not.toContain("hash");
  });

  it("does not reach another host's cleaner with the same room name", async () => {
    await setup();
    const other = String(new mongoose.Types.ObjectId());
    await Cleaner.create({ host: other, name: "Henry", phone: "4085550199", accessCode: "OTHR1" });
    expect((await reviewsFor("4085550199", "OTHR1")).body.reviews).toEqual([]);
  });

  it("refuses a wrong code, and gives office staff nothing", async () => {
    const { host } = await setup();
    expect((await reviewsFor("4085550101", "WRONG")).status).toBe(401);
    await Staff.create({ host, name: "Ana", email: "ana@example.com", accessCode: "ANA11", hiredOn: "2026-08-01", payType: "hourly", payRate: 20 });
    expect((await reviewsFor("ana@example.com", "ANA11")).body).toEqual({ reviews: [], praise: null });
  });
});
