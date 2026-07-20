import express, { Request } from "express";
import mongoose from "mongoose";
import Cleaner from "../model/cleanerSchema";
import CleaningAssignment from "../model/cleaningAssignmentSchema";

// All routes here are mounted behind the JWT middleware in server.ts.
const router = express.Router();

const serializeCleaner = (c: any) => ({
  id: c._id,
  name: c.name,
  phone: c.phone,
  payRate: c.payRate,
  baselineHours: c.baselineHours ?? 0,
  baselineMonth: c.baselineMonth ?? "",
});

const serializeAssignment = (a: any) => ({
  id: a._id,
  date: a.date,
  room: a.room ? { id: a.room._id, name: a.room.name } : null,
  cleaner: a.cleaner ? serializeCleaner(a.cleaner) : null,
  hours: a.hours,
});

// ── Cleaners ────────────────────────────────────────────────────────────────

router.get("/list", async (req: Request, res: any) => {
  const { hostId } = req.query;
  if (!hostId) return res.status(400).json({ error: "hostId is required" });
  try {
    const cleaners = await Cleaner.find({ host: hostId }).sort({ name: 1 });
    res.status(200).json(cleaners.map(serializeCleaner));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/create", async (req: Request, res: any) => {
  const { host, name, phone, payRate } = req.body;
  if (!host || !name) return res.status(400).json({ error: "host and name are required" });
  try {
    const cleaner = await Cleaner.create({ host, name, phone: phone ?? "", payRate: payRate ?? 0 });
    res.status(200).json(serializeCleaner(cleaner));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.patch("/update", async (req: Request, res: any) => {
  const { id, name, phone, payRate, baselineHours, baselineMonth } = req.body;
  if (!id) return res.status(400).json({ error: "id is required" });
  try {
    const update: Record<string, unknown> = {};
    if (name !== undefined) update.name = name;
    if (phone !== undefined) update.phone = phone;
    if (payRate !== undefined) update.payRate = payRate;
    if (baselineHours !== undefined) update.baselineHours = baselineHours;
    if (baselineMonth !== undefined) update.baselineMonth = baselineMonth;
    const cleaner = await Cleaner.findByIdAndUpdate(id, update, { new: true, runValidators: true });
    if (!cleaner) return res.status(404).json({ error: "Cleaner not found" });
    res.status(200).json(serializeCleaner(cleaner));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete("/:id", async (req: Request, res: any) => {
  const { id } = req.params;
  try {
    await Cleaner.findOneAndDelete({ _id: id });
    res.status(200).json({ ok: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// All-time earnings ledger per cleaner: hours (recorded + baseline) × rate,
// minus payments already made. Cleaners claim on different schedules, so the
// owed balance must span months.
router.get("/summary", async (req: Request, res: any) => {
  const { hostId } = req.query;
  if (!hostId) return res.status(400).json({ error: "hostId is required" });
  try {
    const cleaners = await Cleaner.find({ host: hostId }).sort({ name: 1 });
    const sums = await CleaningAssignment.aggregate([
      {
        $match: {
          host: new mongoose.Types.ObjectId(hostId as string),
          hours: { $ne: null },
        },
      },
      { $group: { _id: "$cleaner", hours: { $sum: "$hours" } } },
    ]);
    const hoursByCleaner = new Map(sums.map((s) => [String(s._id), s.hours]));
    res.status(200).json(
      cleaners.map((c: any) => {
        const hours = (hoursByCleaner.get(String(c._id)) ?? 0) + (c.baselineHours ?? 0);
        const earned = hours * (c.payRate ?? 0);
        const paid = c.paidAmount ?? 0;
        return { id: c._id, name: c.name, hours, earned, paid, balance: earned - paid };
      })
    );
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Record a payout — adjusts the cleaner's running paid total. Negative
// amounts correct a mis-recorded payout; the total never drops below zero.
router.post("/pay", async (req: Request, res: any) => {
  const { id, amount } = req.body;
  if (!id || typeof amount !== "number" || !isFinite(amount) || amount === 0)
    return res.status(400).json({ error: "id and a non-zero numeric amount are required" });
  try {
    const cleaner: any = await Cleaner.findById(id);
    if (!cleaner) return res.status(404).json({ error: "Cleaner not found" });
    cleaner.paidAmount = Math.max(0, (cleaner.paidAmount ?? 0) + amount);
    await cleaner.save();
    res.status(200).json({ id: cleaner._id, paid: cleaner.paidAmount });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ── Assignments ─────────────────────────────────────────────────────────────

// Assignments in [start, end] inclusive (yyyy-MM-dd strings compare correctly)
router.get("/assignments", async (req: Request, res: any) => {
  const { hostId, start, end } = req.query;
  if (!hostId || !start || !end)
    return res.status(400).json({ error: "hostId, start, and end are required" });
  try {
    const assignments = await CleaningAssignment.find({
      host: hostId,
      date: { $gte: start, $lte: end },
    })
      .populate("room", "name")
      .populate("cleaner")
      .sort({ date: 1 });
    res.status(200).json(assignments.map(serializeAssignment));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Upsert — assigning a different cleaner to the same room+morning replaces it
router.post("/assign", async (req: Request, res: any) => {
  const { host, date, room, cleaner } = req.body;
  if (!host || !date || !room || !cleaner)
    return res.status(400).json({ error: "host, date, room, and cleaner are required" });
  try {
    const assignment = await CleaningAssignment.findOneAndUpdate(
      { host, date, room },
      { host, date, room, cleaner },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );
    const populated = await assignment.populate([
      { path: "room", select: "name" },
      { path: "cleaner" },
    ]);
    res.status(200).json(serializeAssignment(populated));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/unassign", async (req: Request, res: any) => {
  const { host, date, room } = req.body;
  if (!host || !date || !room)
    return res.status(400).json({ error: "host, date, and room are required" });
  try {
    await CleaningAssignment.findOneAndDelete({ host, date, room });
    res.status(200).json({ ok: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Record hours worked after the cleaning is done. hours === null clears the
// entry back to unrecorded (the amber "Record hours" pending card) — that's
// how a 0-hour day is expressed: the cleaner didn't work, nothing to pay.
router.patch("/hours", async (req: Request, res: any) => {
  const { id, hours } = req.body;
  if (!id || hours === undefined) return res.status(400).json({ error: "id and hours are required" });
  try {
    const assignment = await CleaningAssignment.findByIdAndUpdate(
      id,
      { hours },
      { new: true, runValidators: true }
    )
      .populate("room", "name")
      .populate("cleaner");
    if (!assignment) return res.status(404).json({ error: "Assignment not found" });
    res.status(200).json(serializeAssignment(assignment));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
