import express, { Request } from "express";
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

// Record hours worked after the cleaning is done
router.patch("/hours", async (req: Request, res: any) => {
  const { id, hours } = req.body;
  if (!id || hours == null) return res.status(400).json({ error: "id and hours are required" });
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
