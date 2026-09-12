import express from "express";
import request from "supertest";
import mongoose from "mongoose";
import cleanerRoute from "../cleanerRoute";
import Cleaner from "../../model/cleanerSchema";

// One tap, one payment — however many times the request arrives.
//
// Written after the real thing: Henry's record took seven identical $239.25
// payouts and seven $11 tips on one day, and his balance reported him about
// $1,700 overpaid. A guard in the browser was added first and stops one finger
// on one device; it cannot stop two phones, a reload mid-request, or a retry.
//
// If one of these fails, money can be recorded twice. Work out which case
// before changing it.

const app = express();
app.use(express.json());
app.use("/cleaner", cleanerRoute);

const makeCleaner = async () =>
  await new Cleaner({
    host: new mongoose.Types.ObjectId(),
    name: "Henry",
    payRate: 21,
  }).save();

const paymentsOf = async (id: string) => {
  const c: any = await Cleaner.findById(id);
  return c.payments as any[];
};

describe("recording a payment twice", () => {
  it("records one payment when the same request id arrives twice", async () => {
    const cleaner: any = await makeCleaner();
    const body = { id: String(cleaner._id), amount: 239.25, paidOn: "2026-09-06", requestId: "req-1" };

    const first = await request(app).post("/cleaner/pay").send(body);
    const second = await request(app).post("/cleaner/pay").send(body);

    expect(first.status).toBe(200);
    // The retry SUCCEEDS. A caller cannot tell a lost reply from a lost
    // request, so answering an error would push them to try again.
    expect(second.status).toBe(200);
    expect(second.body.duplicate).toBe(true);

    const payments = await paymentsOf(String(cleaner._id));
    expect(payments).toHaveLength(1);
    const after: any = await Cleaner.findById(cleaner._id);
    expect(after.paidAmount).toBeCloseTo(239.25);
  });

  it("records one payment when both requests arrive at once", async () => {
    // The check alone is not the guard: fired together, neither request has
    // saved when the other looks. Only the filtered write settles it.
    const cleaner: any = await makeCleaner();
    const body = { id: String(cleaner._id), amount: 100, paidOn: "2026-09-06", requestId: "req-race" };

    await Promise.all([
      request(app).post("/cleaner/pay").send(body),
      request(app).post("/cleaner/pay").send(body),
      request(app).post("/cleaner/pay").send(body),
    ]);

    expect(await paymentsOf(String(cleaner._id))).toHaveLength(1);
    const after: any = await Cleaner.findById(cleaner._id);
    expect(after.paidAmount).toBeCloseTo(100);
  });

  it("lets two genuinely different payments through under different ids", async () => {
    const cleaner: any = await makeCleaner();
    const base = { id: String(cleaner._id), paidOn: "2026-09-06" };

    await request(app).post("/cleaner/pay").send({ ...base, amount: 239.25, requestId: "a" });
    await request(app).post("/cleaner/pay").send({ ...base, amount: 11, tip: true, requestId: "b" });

    const payments = await paymentsOf(String(cleaner._id));
    expect(payments).toHaveLength(2);
    expect(payments.filter((p) => p.tip)).toHaveLength(1);
  });

  it("refuses an identical repeat from a client too old to send an id", async () => {
    // A cached bundle from before requestId existed. It cannot be fixed by
    // deploying, so the server catches the repeat by shape and recency.
    const cleaner: any = await makeCleaner();
    const body = { id: String(cleaner._id), amount: 239.25, paidOn: "2026-09-06" };

    const first = await request(app).post("/cleaner/pay").send(body);
    const second = await request(app).post("/cleaner/pay").send(body);

    expect(first.status).toBe(200);
    expect(second.status).toBe(409);
    expect(await paymentsOf(String(cleaner._id))).toHaveLength(1);
  });

  it("still allows an old client to record two DIFFERENT payments", async () => {
    const cleaner: any = await makeCleaner();
    const base = { id: String(cleaner._id), paidOn: "2026-09-06" };

    await request(app).post("/cleaner/pay").send({ ...base, amount: 239.25 });
    const tip = await request(app).post("/cleaner/pay").send({ ...base, amount: 11, tip: true });

    expect(tip.status).toBe(200);
    expect(await paymentsOf(String(cleaner._id))).toHaveLength(2);
  });

  it("never lets the paid total go negative on an undo", async () => {
    const cleaner: any = await makeCleaner();
    const base = { id: String(cleaner._id), paidOn: "2026-09-06" };

    await request(app).post("/cleaner/pay").send({ ...base, amount: 50, requestId: "p" });
    await request(app).post("/cleaner/pay").send({ ...base, amount: -80, requestId: "u" });

    const after: any = await Cleaner.findById(cleaner._id);
    expect(after.paidAmount).toBe(0);
  });
});
