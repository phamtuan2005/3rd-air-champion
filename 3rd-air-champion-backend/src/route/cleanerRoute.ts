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
  photo: c.photo ?? "",
  character: c.character ?? "",
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
  const { host, name, phone, payRate, photo, character } = req.body;
  if (!host || !name) return res.status(400).json({ error: "host and name are required" });
  try {
    const cleaner = await Cleaner.create({
      host,
      name,
      phone: phone ?? "",
      payRate: payRate ?? 0,
      photo: photo ?? "",
      character: character ?? "",
    });
    res.status(200).json(serializeCleaner(cleaner));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.patch("/update", async (req: Request, res: any) => {
  const { id, name, phone, payRate, photo, character, baselineHours, baselineMonth } = req.body;
  if (!id) return res.status(400).json({ error: "id is required" });
  try {
    const update: Record<string, unknown> = {};
    if (name !== undefined) update.name = name;
    if (phone !== undefined) update.phone = phone;
    if (payRate !== undefined) update.payRate = payRate;
    if (photo !== undefined) update.photo = photo;
    if (character !== undefined) update.character = character;
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

// Auto-plan — draft a cleaner for each unassigned room from HISTORY. No ML:
// score every active cleaner by how often + how RECENTLY they've cleaned that
// room (and that weekday), balance the batch so nobody is overloaded, and upsert
// the assignments. Because the host's own reassignments become tomorrow's
// history (recency-weighted), the draft self-corrects toward their choices.
router.post("/autoplan", async (req: Request, res: any) => {
  const { host, targets } = req.body; // targets: [{ date: "yyyy-MM-dd", room }]
  if (!host || !Array.isArray(targets))
    return res.status(400).json({ error: "host and targets[] are required" });
  try {
    const cleaners = await Cleaner.find({ host });
    if (cleaners.length === 0) return res.status(200).json([]);
    const activeIds = new Set(cleaners.map((c: any) => String(c._id)));

    // Deterministic, TZ-safe weekday + recency decay (half-life 30 days).
    const DAY = 86_400_000;
    const dow = (d: string) => new Date(`${d}T12:00:00Z`).getUTCDay();
    const decay = (d: string) =>
      Math.pow(2, -Math.max(0, (Date.now() - Date.parse(`${d}T12:00:00Z`)) / DAY) / 30);

    const history = await CleaningAssignment.find({ host, cleaner: { $ne: null } }).select(
      "cleaner room date"
    );
    const roomScore = new Map<string, Map<string, number>>();
    const roomDowScore = new Map<string, Map<string, number>>();
    const bump = (m: Map<string, Map<string, number>>, k: string, c: string, v: number) => {
      const inner = m.get(k) ?? new Map<string, number>();
      inner.set(c, (inner.get(c) ?? 0) + v);
      m.set(k, inner);
    };
    history.forEach((a: any) => {
      const c = String(a.cleaner);
      if (!activeIds.has(c)) return;
      const room = String(a.room);
      const w = decay(a.date);
      bump(roomScore, room, c, w);
      bump(roomDowScore, `${room}|${dow(a.date)}`, c, w);
    });

    // Seed balance with existing load in the target window so the draft evens out.
    const batchLoad = new Map<string, number>(cleaners.map((c: any) => [String(c._id), 0]));
    const dates = targets.map((t: any) => t.date).filter(Boolean);
    if (dates.length) {
      const lo = dates.reduce((a: string, b: string) => (a < b ? a : b));
      const hi = dates.reduce((a: string, b: string) => (a > b ? a : b));
      const existing = await CleaningAssignment.find({
        host,
        cleaner: { $ne: null },
        date: { $gte: lo, $lte: hi },
      }).select("cleaner");
      existing.forEach((a: any) => {
        const c = String(a.cleaner);
        if (batchLoad.has(c)) batchLoad.set(c, (batchLoad.get(c) ?? 0) + 1);
      });
    }

    const BALANCE = 0.2; // how strongly to spread work vs. follow room affinity
    const results: any[] = [];
    // Earliest first, so balancing is stable across the week.
    const sorted = [...targets].sort((a: any, b: any) => String(a.date).localeCompare(b.date));
    for (const t of sorted) {
      if (!t.date || !t.room) continue;
      const room = String(t.room);
      const rs = roomScore.get(room);
      const rds = roomDowScore.get(`${room}|${dow(t.date)}`);
      let best: string | null = null;
      let bestScore = -Infinity;
      for (const c of cleaners) {
        const id = String(c._id);
        const base = (rs?.get(id) ?? 0) + 0.5 * (rds?.get(id) ?? 0);
        const score = base - BALANCE * (batchLoad.get(id) ?? 0);
        if (score > bestScore) {
          bestScore = score;
          best = id;
        }
      }
      if (!best) continue;
      const assignment = await CleaningAssignment.findOneAndUpdate(
        { host, date: t.date, room: t.room },
        { host, date: t.date, room: t.room, cleaner: best },
        { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
      );
      batchLoad.set(best, (batchLoad.get(best) ?? 0) + 1);
      const populated = await assignment.populate([
        { path: "room", select: "name" },
        { path: "cleaner" },
      ]);
      results.push(serializeAssignment(populated));
    }
    res.status(200).json(results);
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
