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
  availableDays: c.availableDays ?? [],
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
  const { host, name, phone, payRate, photo, character, availableDays } = req.body;
  if (!host || !name) return res.status(400).json({ error: "host and name are required" });
  try {
    const cleaner = await Cleaner.create({
      host,
      name,
      phone: phone ?? "",
      payRate: payRate ?? 0,
      photo: photo ?? "",
      character: character ?? "",
      availableDays: Array.isArray(availableDays) ? availableDays : [],
    });
    res.status(200).json(serializeCleaner(cleaner));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.patch("/update", async (req: Request, res: any) => {
  const { id, name, phone, payRate, photo, character, availableDays, baselineHours, baselineMonth } =
    req.body;
  if (!id) return res.status(400).json({ error: "id is required" });
  try {
    const update: Record<string, unknown> = {};
    if (name !== undefined) update.name = name;
    if (phone !== undefined) update.phone = phone;
    if (payRate !== undefined) update.payRate = payRate;
    if (photo !== undefined) update.photo = photo;
    if (character !== undefined) update.character = character;
    if (availableDays !== undefined) update.availableDays = availableDays;
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

// Auto-plan — a constraint-aware batch optimizer, not a frequency counter.
// Everything below is DERIVED from history, so it sharpens as data grows:
//   • speed  = recorded hours ÷ rooms  → window capacity = floor(3h / hrs-room)
//   • ceiling = min(window capacity, most rooms they've ever done in a day)
//              → a slow cleaner literally can't be handed 5 rooms; burnout-safe
//   • $/room = hrs-room × rate         → the efficiency we minimize (cost)
//   • availability = explicit availableDays if set (HARD), else inferred from
//              the weekdays they've historically worked
//   • affinity = decayed room history  → final tie-break only
// Per day it packs rooms into as FEW trips as possible (each worth the drive)
// without pushing anyone past their ceiling; the host's reassignments become
// tomorrow's history, so the plan self-corrects toward their real choices.
router.post("/autoplan", async (req: Request, res: any) => {
  const { host, targets } = req.body; // targets: [{ date: "yyyy-MM-dd", room }]
  if (!host || !Array.isArray(targets))
    return res.status(400).json({ error: "host and targets[] are required" });
  try {
    const cleaners = await Cleaner.find({ host });
    if (cleaners.length === 0) return res.status(200).json([]);

    const DAY = 86_400_000;
    const WINDOW_HOURS = 3; // 11am–2pm cleaning window
    const TRIP_FLOOR = 2; // rooms that make a cleaner's drive worthwhile
    const DEFAULT_HPR = 1; // assumed hours/room before we have their data
    const dow = (d: string) => new Date(`${d}T12:00:00Z`).getUTCDay();
    const decay = (d: string) =>
      Math.pow(2, -Math.max(0, (Date.now() - Date.parse(`${d}T12:00:00Z`)) / DAY) / 30);
    // Lexicographic "a beats b" over a tuple of higher-is-better numbers.
    const lexGt = (a: number[], b: number[]) => {
      for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) return a[i] > b[i];
      }
      return false;
    };

    // ── Derive each cleaner's profile from full history ──
    const all = await CleaningAssignment.find({ host }).select("cleaner room date hours");
    type Prof = {
      hours: number;
      rooms: number;
      perDay: Map<string, number>;
      dows: Set<number>;
      aff: Map<string, number>;
    };
    const prof = new Map<string, Prof>();
    cleaners.forEach((c: any) =>
      prof.set(String(c._id), {
        hours: 0,
        rooms: 0,
        perDay: new Map(),
        dows: new Set(),
        aff: new Map(),
      })
    );
    all.forEach((a: any) => {
      const p = prof.get(String(a.cleaner));
      if (!p) return;
      p.perDay.set(a.date, (p.perDay.get(a.date) ?? 0) + 1);
      p.dows.add(dow(a.date));
      p.aff.set(String(a.room), (p.aff.get(String(a.room)) ?? 0) + decay(a.date));
      if (a.hours != null) {
        p.hours += a.hours;
        p.rooms += 1;
      }
    });

    type Info = {
      ceiling: number;
      costPerRoom: number;
      aff: Map<string, number>;
      available: (w: number) => boolean;
    };
    const info = new Map<string, Info>();
    cleaners.forEach((c: any) => {
      const id = String(c._id);
      const p = prof.get(id)!;
      const hpr = p.rooms > 0 ? p.hours / p.rooms : DEFAULT_HPR;
      const windowCap = Math.max(1, Math.floor(WINDOW_HOURS / hpr));
      const revealed = p.perDay.size ? Math.max(...p.perDay.values()) : windowCap;
      const ceiling = Math.max(1, Math.min(windowCap, Math.max(revealed, TRIP_FLOOR)));
      const explicit: number[] = Array.isArray(c.availableDays) ? c.availableDays : [];
      info.set(id, {
        ceiling,
        costPerRoom: hpr * (c.payRate ?? 0),
        aff: p.aff,
        available: (w: number) =>
          explicit.length > 0 ? explicit.includes(w) : p.dows.size > 0 ? p.dows.has(w) : true,
      });
    });

    // ── Existing load in the target window (assignments we must plan around) ──
    const byDate = new Map<string, string[]>();
    targets.forEach((t: any) => {
      if (!t.date || !t.room) return;
      const arr = byDate.get(t.date) ?? [];
      arr.push(String(t.room));
      byDate.set(t.date, arr);
    });
    const existing = await CleaningAssignment.find({
      host,
      cleaner: { $ne: null },
      date: { $in: [...byDate.keys()] },
    }).select("cleaner date");
    const load = new Map<string, number>(); // `${date}|${id}` -> rooms already that day
    existing.forEach((a: any) => {
      const k = `${a.date}|${String(a.cleaner)}`;
      load.set(k, (load.get(k) ?? 0) + 1);
    });
    const loadOf = (date: string, id: string) => load.get(`${date}|${id}`) ?? 0;

    const results: any[] = [];
    for (const [date, rooms] of [...byDate.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
      const w = dow(date);
      const eligible = cleaners.filter((c: any) => info.get(String(c._id))!.available(w));
      const poolIds = (eligible.length ? eligible : cleaners).map((c: any) => String(c._id));

      // Who's already committed today (respect manual assignments) + total rooms.
      const mustInclude = poolIds.filter((id) => loadOf(date, id) > 0);
      const already = mustInclude.reduce((s, id) => s + loadOf(date, id), 0);
      const R = rooms.length + already;

      // Day affinity (how much this crew "knows" today's rooms) for choosing extras.
      const dayAff = (id: string) =>
        rooms.reduce((s, r) => s + (info.get(id)!.aff.get(r) ?? 0), 0);
      // Add the FEWEST extra cleaners (cheapest per room first) whose ceilings
      // cover the day — minimizing trips while never exceeding anyone's ceiling.
      const extras = poolIds
        .filter((id) => !mustInclude.includes(id))
        .sort((a, b) => {
          const d = info.get(a)!.costPerRoom - info.get(b)!.costPerRoom;
          return d !== 0 ? d : dayAff(b) - dayAff(a);
        });
      const crew = [...mustInclude];
      const capacity = () => crew.reduce((s, id) => s + info.get(id)!.ceiling, 0);
      let ei = 0;
      while (capacity() < R && ei < extras.length) crew.push(extras[ei++]);
      if (crew.length === 0 && poolIds.length) crew.push(extras[0] ?? poolIds[0]);

      // Distribute today's rooms across the crew, balanced by fill-ratio so no one
      // is overloaded, tie-broken by room affinity then lowest $/room.
      for (const room of rooms) {
        const withRoom = crew.filter((id) => loadOf(date, id) < info.get(id)!.ceiling);
        const cand = withRoom.length ? withRoom : crew;
        let best: string | null = null;
        let bestKey: number[] | null = null;
        for (const id of cand) {
          const m = info.get(id)!;
          const key = [-(loadOf(date, id) / m.ceiling), m.aff.get(room) ?? 0, -m.costPerRoom];
          if (!bestKey || lexGt(key, bestKey)) {
            best = id;
            bestKey = key;
          }
        }
        if (!best) continue;
        const assignment = await CleaningAssignment.findOneAndUpdate(
          { host, date, room },
          { host, date, room, cleaner: best },
          { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
        );
        load.set(`${date}|${best}`, loadOf(date, best) + 1);
        const populated = await assignment.populate([
          { path: "room", select: "name" },
          { path: "cleaner" },
        ]);
        results.push(serializeAssignment(populated));
      }
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
