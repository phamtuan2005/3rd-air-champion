import express, { Request } from "express";
import Cleaner from "../model/cleanerSchema";
import CleaningAssignment from "../model/cleaningAssignmentSchema";
import SentSchedule from "../model/sentScheduleSchema";

// All routes here are mounted behind the JWT middleware in server.ts.
const router = express.Router();

// The hourly rate in effect for a cleaner ON a given date (yyyy-MM-dd). Walk the
// scheduled changes newest-applicable wins; dates before any change use the base
// payRate. So a cleaning is always billed at its historical rate — a raise never
// re-prices past work.
const rateOn = (c: any, dateStr: string): number => {
  let rate = c.payRate ?? 0;
  const hist = [...(c.rateHistory ?? [])].sort((a, b) =>
    a.effectiveFrom < b.effectiveFrom ? -1 : 1,
  );
  for (const h of hist) {
    if (h.effectiveFrom <= dateStr) rate = h.rate;
    else break;
  }
  return rate;
};

const serializeCleaner = (c: any) => ({
  id: c._id,
  name: c.name,
  phone: c.phone,
  payRate: c.payRate,
  rateHistory: (c.rateHistory ?? []).map((h: any) => ({ rate: h.rate, effectiveFrom: h.effectiveFrom })),
  photo: c.photo ?? "",
  character: c.character ?? "",
  availableDays: c.availableDays ?? [],
  paused: c.paused ?? false,
  priority: c.priority ?? 3,
  isOwner: c.isOwner ?? false,
  minRooms: c.minRooms ?? 1,
  maxRooms: c.maxRooms ?? 0,
  baselineHours: c.baselineHours ?? 0,
  baselineMonth: c.baselineMonth ?? "",
  // TiWork sign-in, same as Staff. Cleaners log their own hours now.
  accessCode: c.accessCode ?? "",
  paidAmount: c.paidAmount ?? 0,
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
  const { host, name, phone, payRate, rateHistory, photo, character, availableDays, paused, priority, isOwner, minRooms, maxRooms } =
    req.body;
  if (!host || !name) return res.status(400).json({ error: "host and name are required" });
  try {
    const cleaner = await Cleaner.create({
      host,
      name,
      phone: phone ?? "",
      payRate: payRate ?? 0,
      rateHistory: Array.isArray(rateHistory) ? rateHistory : [],
      photo: photo ?? "",
      character: character ?? "",
      availableDays: Array.isArray(availableDays) ? availableDays : [],
      paused: !!paused,
      priority: typeof priority === "number" ? priority : 3,
      isOwner: !!isOwner,
      minRooms: typeof minRooms === "number" ? minRooms : 1,
      maxRooms: typeof maxRooms === "number" ? maxRooms : 0,
    });
    res.status(200).json(serializeCleaner(cleaner));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.patch("/update", async (req: Request, res: any) => {
  const {
    id, name, phone, payRate, rateHistory, photo, character, availableDays, paused, priority, isOwner,
    minRooms, maxRooms, baselineHours, baselineMonth, accessCode,
  } = req.body;
  if (!id) return res.status(400).json({ error: "id is required" });
  try {
    const update: Record<string, unknown> = {};
    if (name !== undefined) update.name = name;
    if (phone !== undefined) update.phone = phone;
    if (payRate !== undefined) update.payRate = payRate;
    if (rateHistory !== undefined) update.rateHistory = rateHistory;
    if (photo !== undefined) update.photo = photo;
    if (character !== undefined) update.character = character;
    if (availableDays !== undefined) update.availableDays = availableDays;
    if (paused !== undefined) update.paused = paused;
    if (priority !== undefined) update.priority = priority;
    if (isOwner !== undefined) update.isOwner = isOwner;
    if (minRooms !== undefined) update.minRooms = minRooms;
    if (maxRooms !== undefined) update.maxRooms = maxRooms;
    if (baselineHours !== undefined) update.baselineHours = baselineHours;
    if (baselineMonth !== undefined) update.baselineMonth = baselineMonth;
    if (accessCode !== undefined) update.accessCode = accessCode;
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

// All-time earnings ledger per cleaner: Σ over recorded cleanings of
// hours × (rate on that cleaning's DATE), plus baseline hours × baseline-month
// rate, minus payments already made. Billing each cleaning at its historical
// rate means a raise never re-prices past work. Cleaners claim on different
// schedules, so the owed balance must span months.
router.get("/summary", async (req: Request, res: any) => {
  const { hostId } = req.query;
  if (!hostId) return res.status(400).json({ error: "hostId is required" });
  try {
    const cleaners = await Cleaner.find({ host: hostId }).sort({ name: 1 });
    const cleanerById = new Map(cleaners.map((c: any) => [String(c._id), c]));
    const assigns = await CleaningAssignment.find({
      host: hostId,
      hours: { $ne: null },
    }).select("cleaner date hours");

    const agg = new Map<string, { hours: number; earned: number }>();
    // Per-cleaner work, oldest first — needed to work out which days a running
    // paidAmount has already covered (see unpaid calculation below).
    const daysByCleaner = new Map<string, { date: string; hours: number; earned: number }[]>();
    for (const a of assigns as any[]) {
      const cid = String(a.cleaner);
      const c = cleanerById.get(cid);
      if (!c) continue;
      const earned = a.hours * rateOn(c, a.date);
      const e = agg.get(cid) ?? { hours: 0, earned: 0 };
      e.hours += a.hours;
      e.earned += earned;
      agg.set(cid, e);
      const list = daysByCleaner.get(cid) ?? [];
      list.push({ date: a.date, hours: a.hours, earned });
      daysByCleaner.set(cid, list);
    }

    res.status(200).json(
      cleaners.map((c: any) => {
        const cid = String(c._id);
        const a = agg.get(cid) ?? { hours: 0, earned: 0 };
        const baseHrs = c.baselineHours ?? 0;
        const baseDate = c.baselineMonth ? `${c.baselineMonth}-01` : new Date().toISOString().slice(0, 10);
        const hours = a.hours + baseHrs;
        const earned = a.earned + baseHrs * rateOn(c, baseDate);
        const paid = c.paidAmount ?? 0;

        // What the host actually needs when paying someone: the work NOT yet
        // covered by payments. paidAmount is a running total with no dates, so
        // recover the boundary by consuming days oldest-first until payments run
        // out — everything after that is unpaid. A payment landing mid-day
        // pro-rates that day's hours rather than dropping or double-counting it.
        const timeline = [
          ...(baseHrs > 0
            ? [{ date: baseDate, hours: baseHrs, earned: baseHrs * rateOn(c, baseDate) }]
            : []),
          ...(daysByCleaner.get(cid) ?? []).sort((x, y) => x.date.localeCompare(y.date)),
        ];
        let remainingPaid = paid;
        let unpaidHours = 0;
        let unpaidSince: string | null = null;
        for (const d of timeline) {
          if (remainingPaid >= d.earned - 1e-9) {
            remainingPaid -= d.earned; // fully covered by earlier payments
            continue;
          }
          const uncovered = d.earned - Math.max(0, remainingPaid);
          const fraction = d.earned > 0 ? uncovered / d.earned : 1;
          unpaidHours += d.hours * fraction;
          if (!unpaidSince) unpaidSince = d.date;
          remainingPaid = 0;
        }

        // Itemised payouts, newest first. Anything paid before logging existed
        // shows as one opening figure rather than being invented as entries.
        const payments = [...(c.payments ?? [])]
          .map((p: any) => ({
            id: String(p._id),
            amount: p.amount,
            paidOn: p.paidOn,
            note: p.note ?? "",
          }))
          .sort((x, y) => (x.paidOn < y.paidOn ? 1 : -1));
        const logged = payments.reduce((s: number, p: any) => s + p.amount, 0);

        return {
          id: c._id,
          name: c.name,
          hours,
          earned,
          paid,
          balance: earned - paid,
          unpaidHours,
          unpaidSince,
          payments,
          openingPaid: Math.round((paid - logged) * 100) / 100,
        };
      }),
    );
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Record a payout — adjusts the cleaner's running paid total. Negative
// amounts correct a mis-recorded payout; the total never drops below zero.
router.post("/pay", async (req: Request, res: any) => {
  const { id, amount, paidOn, note } = req.body;
  if (!id || typeof amount !== "number" || !isFinite(amount) || amount === 0)
    return res.status(400).json({ error: "id and a non-zero numeric amount are required" });
  try {
    const cleaner: any = await Cleaner.findById(id);
    if (!cleaner) return res.status(404).json({ error: "Cleaner not found" });
    // Log the payout itself, not just its effect on the total — so a duplicate
    // or a wrong figure can be seen and removed later rather than guessed at.
    // paidOn comes from the client: the server runs UTC and would date an
    // evening payout in California to the following day.
    cleaner.payments.push({
      amount,
      paidOn: paidOn || new Date().toISOString().slice(0, 10),
      note: note || "",
    });
    cleaner.paidAmount = Math.max(0, (cleaner.paidAmount ?? 0) + amount);
    await cleaner.save();
    res.status(200).json({ id: cleaner._id, paid: cleaner.paidAmount });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Remove ONE logged payout. Undoing a specific mistake beats adding a negative
// correction, which leaves both the error and the fix in the history.
router.post("/pay/remove", async (req: Request, res: any) => {
  const { id, paymentId } = req.body;
  if (!id || !paymentId)
    return res.status(400).json({ error: "id and paymentId are required" });
  try {
    const cleaner: any = await Cleaner.findById(id);
    if (!cleaner) return res.status(404).json({ error: "Cleaner not found" });
    const entry = cleaner.payments.id(paymentId);
    if (!entry) return res.status(404).json({ error: "Payment not found" });
    const amount = entry.amount;
    entry.deleteOne();
    cleaner.paidAmount = Math.max(0, (cleaner.paidAmount ?? 0) - amount);
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
      minRooms: number; // fewest rooms worth a trip (host-tuned); below this we don't bring them in
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
      // Owners (explicit isOwner flag, or the legacy $0-rate fallback) are
      // EXCLUDED from the auto-draft — they exist to be spared, not maximized.
      // The host assigns themselves by hand only. paused = temporarily out.
      const reserve = !!c.isOwner || (c.payRate ?? 0) <= 0;
      const paused = !!c.paused;
      const priority = typeof c.priority === "number" ? c.priority : 3;
      // Ceiling follows DEMONSTRATED capacity — the most rooms they've actually
      // done in a day. That already reflects the host's willingness calls and
      // arrangements like "take a 15-min break after 3, then finish 2." The 11–2
      // window is only a cold-start PRIOR for a brand-new cleaner, NOT a hard
      // clamp on a willing one who can stretch. A light helper still stays light,
      // because their demonstrated max stays low until the host grows it.
      // Owners are last-resort reserve — keep their ceiling minimal (their
      // demonstrated max, or just 1 if they've never cleaned) so even when tapped
      // they take very little. Paid cleaners get the full window-based prior.
      const derivedCeiling = p.perDay.size ? revealed : reserve ? 1 : windowCap;
      // Host-tuned caps win over the derived guess: maxRooms > 0 sets an explicit
      // ceiling ("no more than N"); minRooms sets the fewest rooms worth a trip.
      const ceiling = c.maxRooms && c.maxRooms > 0 ? c.maxRooms : derivedCeiling;
      const minRooms = Math.max(1, typeof c.minRooms === "number" ? c.minRooms : 1);
      const explicit: number[] = Array.isArray(c.availableDays) ? c.availableDays : [];
      info.set(id, {
        ceiling,
        minRooms,
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
      // Owners as a LAST RESORT — tapped only when no paid cleaner can take a
      // room ("owner sometimes cleans, but only when there's no other choice").
      const ownerPool = cleaners
        .filter((c: any) => {
          const m = info.get(String(c._id))!;
          return m.reserve && !m.paused && m.available(w);
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
      while (capacity() < R && ei < extras.length) {
        const id = extras[ei++];
        // Only bring a cleaner in if at least their minRooms are still uncovered —
        // a sub-minimum trip isn't worth it ("won't come for < min"). Skipping them
        // may leave rooms UNASSIGNED, which is the intended short-staffed signal.
        if (R - capacity() >= info.get(id)!.minRooms) crew.push(id);
      }

      // Distribute today's rooms across the crew, balanced by fill-ratio so no one
      // is overloaded, tie-broken by room affinity then lowest $/room.
      for (const { room, critical } of rooms) {
        // Paid crew still under their ceiling. If none can take it, fall back to
        // an owner (last resort); only if owners are maxed/unavailable too does
        // the room stay UNASSIGNED (the signal that you're short a cleaner).
        let cand = crew.filter((id) => loadOf(date, id) < info.get(id)!.ceiling);
        if (cand.length === 0)
          cand = ownerPool.filter((id) => loadOf(date, id) < info.get(id)!.ceiling);
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
          // Stamp what the algorithm suggested; a later manual reassign changes
          // only `cleaner`, so the two diverge → a measurable correction.
          { host, date, room, cleaner: best, suggestedCleaner: best, suggestedAt: new Date() },
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

// ── Sent-schedule tracking (drift detection) ─────────────────────────────────

const serializeSent = (d: any) => ({
  cleaner: String(d.cleaner),
  weekMonday: d.weekMonday,
  signature: d.signature ?? "",
  sentAt: d.updatedAt,
});

// Record what was just texted to a cleaner for a week (upsert per cleaner+week).
router.post("/schedule-sent", async (req: Request, res: any) => {
  const { host, cleaner, weekMonday, signature } = req.body;
  if (!host || !cleaner || !weekMonday)
    return res.status(400).json({ error: "host, cleaner, and weekMonday are required" });
  try {
    const doc = await SentSchedule.findOneAndUpdate(
      { host, cleaner, weekMonday },
      { host, cleaner, weekMonday, signature: signature ?? "" },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );
    res.status(200).json(serializeSent(doc));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// All sent-schedule snapshots for the host — the frontend compares each to the
// live schedule to flag drift ("changed since sent → re-send").
router.get("/schedule-sent", async (req: Request, res: any) => {
  const { hostId } = req.query;
  if (!hostId) return res.status(400).json({ error: "hostId is required" });
  try {
    const docs = await SentSchedule.find({ host: hostId });
    res.status(200).json(docs.map(serializeSent));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
