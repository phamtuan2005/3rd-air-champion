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
  paused: c.paused ?? false,
  priority: c.priority ?? 3,
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
  const { host, name, phone, payRate, photo, character, availableDays, paused, priority } = req.body;
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
      paused: !!paused,
      priority: typeof priority === "number" ? priority : 3,
    });
    res.status(200).json(serializeCleaner(cleaner));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.patch("/update", async (req: Request, res: any) => {
  const {
    id, name, phone, payRate, photo, character, availableDays, paused, priority,
    baselineHours, baselineMonth,
  } = req.body;
  if (!id) return res.status(400).json({ error: "id is required" });
  try {
    const update: Record<string, unknown> = {};
    if (name !== undefined) update.name = name;
    if (phone !== undefined) update.phone = phone;
    if (payRate !== undefined) update.payRate = payRate;
    if (photo !== undefined) update.photo = photo;
    if (character !== undefined) update.character = character;
    if (availableDays !== undefined) update.availableDays = availableDays;
    if (paused !== undefined) update.paused = paused;
    if (priority !== undefined) update.priority = priority;
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
        // Recency-weighted so an IMPROVING cleaner (e.g. Henry — weak now but
        // flexible and learning) is judged on current form, not a rookie average.
        const wt = decay(a.date);
        p.hours += a.hours * wt;
        p.rooms += wt;
      }
    });

    type Info = {
      ceiling: number;
      costPerRoom: number;
      aff: Map<string, number>;
      available: (w: number) => boolean;
      reserve: boolean; // owner / $0 labor — excluded from the auto-draft
      paused: boolean; // temporarily out (e.g. vacation) — excluded
      priority: number; // favorability 1–5 (host's quality/preference judgment)
    };
    const info = new Map<string, Info>();
    cleaners.forEach((c: any) => {
      const id = String(c._id);
      const p = prof.get(id)!;
      const hpr = p.rooms > 0 ? p.hours / p.rooms : DEFAULT_HPR;
      const windowCap = Math.max(1, Math.floor(WINDOW_HOURS / hpr));
      const revealed = p.perDay.size ? Math.max(...p.perDay.values()) : windowCap;
      // A $0 rate = owner labor. Owners hire a team precisely so THEY don't
      // clean — a principal engineer's hour is not "free," and the goal is to
      // spare them (and Cindy). So owners are EXCLUDED from the auto-draft; the
      // host assigns themselves by hand only when they choose. paused = out now.
      const reserve = (c.payRate ?? 0) <= 0;
      const paused = !!c.paused;
      const priority = typeof c.priority === "number" ? c.priority : 3;
      // Ceiling follows DEMONSTRATED capacity — the most rooms they've actually
      // done in a day. That already reflects the host's willingness calls and
      // arrangements like "take a 15-min break after 3, then finish 2." The 11–2
      // window is only a cold-start PRIOR for a brand-new cleaner, NOT a hard
      // clamp on a willing one who can stretch. A light helper still stays light,
      // because their demonstrated max stays low until the host grows it.
      const ceiling = p.perDay.size ? revealed : windowCap;
      const explicit: number[] = Array.isArray(c.availableDays) ? c.availableDays : [];
      info.set(id, {
        ceiling,
        costPerRoom: hpr * (c.payRate ?? 0),
        aff: p.aff,
        reserve,
        paused,
        priority,
        available: (w: number) =>
          explicit.length > 0 ? explicit.includes(w) : p.dows.size > 0 ? p.dows.has(w) : true,
      });
    });

    // ── Existing load in the target window (assignments we must plan around) ──
    const byDate = new Map<string, { room: string; critical: boolean }[]>();
    targets.forEach((t: any) => {
      if (!t.date || !t.room) return;
      const arr = byDate.get(t.date) ?? [];
      arr.push({ room: String(t.room), critical: !!t.critical });
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
      // Draftable = PAID, present, available this weekday. Owners ($0) and paused
      // cleaners are never auto-assigned — the host pitches in by hand if needed.
      const poolIds = cleaners
        .filter((c: any) => {
          const m = info.get(String(c._id))!;
          return !m.reserve && !m.paused && m.available(w);
        })
        .map((c: any) => String(c._id));

      // Who's already committed today (respect manual assignments) + total rooms.
      const mustInclude = poolIds.filter((id) => loadOf(date, id) > 0);
      const already = mustInclude.reduce((s, id) => s + loadOf(date, id), 0);
      const R = rooms.length + already;

      // Day affinity (how much this crew "knows" today's rooms) for choosing extras.
      const dayAff = (id: string) =>
        rooms.reduce((s, r) => s + (info.get(id)!.aff.get(r.room) ?? 0), 0);
      // Bring in the fewest extra cleaners whose ceilings cover the day —
      // favored (most trusted) first, then cheapest per room, then who knows
      // today's rooms — minimizing trips while never exceeding a ceiling.
      const extras = poolIds
        .filter((id) => !mustInclude.includes(id))
        .sort((a, b) => {
          const pd = info.get(b)!.priority - info.get(a)!.priority;
          if (pd !== 0) return pd;
          const d = info.get(a)!.costPerRoom - info.get(b)!.costPerRoom;
          return d !== 0 ? d : dayAff(b) - dayAff(a);
        });
      const crew = [...mustInclude];
      const capacity = () => crew.reduce((s, id) => s + info.get(id)!.ceiling, 0);
      let ei = 0;
      while (capacity() < R && ei < extras.length) crew.push(extras[ei++]);

      // Distribute today's rooms across the crew, balanced by fill-ratio so no one
      // is overloaded, tie-broken by room affinity then lowest $/room.
      for (const { room, critical } of rooms) {
        // Only crew still under their honest ceiling. If none, the room is left
        // UNASSIGNED — the signal that you're short a cleaner — rather than
        // burning someone out or dumping it on the owners.
        const cand = crew.filter((id) => loadOf(date, id) < info.get(id)!.ceiling);
        let best: string | null = null;
        let bestKey: number[] | null = null;
        for (const id of cand) {
          const m = info.get(id)!;
          const favorNorm = (m.priority - 1) / 4; // 0..1
          // High-stakes same-day turnover → your best AVAILABLE cleaner wins
          // outright (quality where revenue is on the line). Routine room →
          // gently prefer favored cleaners, balanced by how full they already are.
          const primary = critical
            ? m.priority
            : 0.5 * favorNorm - loadOf(date, id) / m.ceiling;
          const key = [primary, m.aff.get(room) ?? 0, -m.costPerRoom];
          if (!bestKey || lexGt(key, bestKey)) {
            best = id;
            bestKey = key;
          }
        }
        if (!best) continue; // no healthy paid capacity → stays unassigned
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
