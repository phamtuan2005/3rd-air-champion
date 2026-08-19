import express, { Request } from "express";
import Staff from "../model/staffSchema";
import Cleaner from "../model/cleanerSchema";
import CleaningAssignment from "../model/cleaningAssignmentSchema";
import WorkEntry from "../model/workEntrySchema";
import { findAssignments } from "../util/assignmentQuery";

// TiWork — the staff-facing app. Mounted PUBLIC, before the JWT middleware:
// staff have no TiMag login, the same way guests have none for TiBook.
//
// Every route therefore re-checks identifier + accessCode itself. There is no session
// to trust, so identity is proved on each call rather than assumed from a
// staffId in the body — which anyone could otherwise guess or copy.
const router = express.Router();

// Digits only, so "(408) 555-0100" and "4085550100" are the same person.
//
// Deliberately compared on the LAST 9 digits: staff work from anywhere, and the
// same number gets stored as +49 170…, 0049 170… or 0170… depending on who
// typed it. Comparing in full would reject the right person for a country code.
const normalizePhone = (p: string) => {
  const digits = String(p ?? "").replace(/\D/g, "");
  return digits.length > 9 ? digits.slice(-9) : digits;
};

const normalizeEmail = (e: string) => String(e ?? "").trim().toLowerCase();

// One shape for both kinds of worker, so TiWork does not need to know which it
// is talking to except where the screens genuinely differ (a cleaner has a
// schedule; an intern does not).
// The rate in force on a date. payRate is only the BASE — what someone started
// on — and every raise lives in rateHistory. Serializing payRate told a person
// who had been given a raise that they were still on their old rate, which is
// the worst possible field to get wrong on a screen about their own pay.
const rateOnDate = (w: any, dateKey: string): number => {
  const history = [...(w.rateHistory ?? [])]
    .filter((h: any) => h.effectiveFrom <= dateKey)
    .sort((a: any, b: any) => String(a.effectiveFrom).localeCompare(String(b.effectiveFrom)));
  return history.length > 0 ? history[history.length - 1].rate : (w.payRate ?? 0);
};

const serializeWorker = (w: any, kind: "staff" | "cleaner") => ({
  id: w._id,
  kind,
  name: w.name,
  title: kind === "cleaner" ? w.title || "Cleaner" : (w.title ?? ""),
  hiredOn: w.hiredOn ?? "",
  payType: kind === "cleaner" ? "hourly" : (w.payType ?? "hourly"),
  // The rate is theirs to see — it is what they are owed per hour.
  payRate: rateOnDate(w, new Date().toISOString().slice(0, 10)),
  paidAmount: w.paidAmount ?? 0,
  payments: (w.payments ?? [])
    .map((p: any) => ({ amount: p.amount, paidOn: p.paidOn, note: p.note ?? "" }))
    .sort((a: any, b: any) => String(b.paidOn).localeCompare(String(a.paidOn))),
  host: w.host,
});

const serializeEntry = (e: any) => ({
  id: e._id,
  date: e.date,
  hours: e.hours,
  report: e.report ?? "",
  status: e.status ?? "submitted",
  approvedRate: e.approvedRate ?? 0,
  approvedOn: e.approvedOn ?? "",
  hostNote: e.hostNote ?? "",
  rooms: e.rooms ?? [],
});

// Resolve a caller from credentials. Returns null rather than throwing so every
// caller can answer with the SAME message whether the identifier or the code was
// wrong — saying which one is right is giving away half the secret.
//
// The identifier is an EMAIL OR A PHONE, whichever the person actually has. The
// first hire works remotely from Germany: she may have no US number at all, and
// an email is the thing a remote worker reliably owns and types correctly.
const authenticate = async (
  identifier: string,
  code: string,
): Promise<{ doc: any; kind: "staff" | "cleaner" } | null> => {
  const raw = String(identifier ?? "").trim();
  if (!raw || !code) return null;
  const asEmail = normalizeEmail(raw);
  const asPhone = normalizePhone(raw);
  const matches = (w: any, hasEmail: boolean) => {
    if ((w.accessCode ?? "") === "") return false;
    if (raw.includes("@")) return hasEmail && normalizeEmail(w.email) === asEmail;
    return !!asPhone && normalizePhone(w.phone) === asPhone;
  };
  // Narrow by code first: it is the secret, and matching it server-side keeps
  // the candidate set to the handful of people who share that code (normally one).
  const staff = (await Staff.find({ accessCode: code })).find((w: any) => matches(w, true));
  if (staff) return { doc: staff, kind: "staff" };
  // Cleaners carry no email field, so only a phone can identify one.
  const cleaner = (await Cleaner.find({ accessCode: code })).find((w: any) => matches(w, false));
  if (cleaner) return { doc: cleaner, kind: "cleaner" };
  return null;
};

router.post("/signin", async (req: Request, res: any) => {
  const { identifier, code } = req.body;
  try {
    const who = await authenticate(identifier, code);
    if (!who)
      return res.status(401).json({ error: "That email or phone and code don't match." });
    if (who.kind === "staff" && who.doc.endedOn && who.doc.endedOn !== "")
      return res.status(403).json({ error: "This account is no longer active." });
    if (who.kind === "cleaner" && who.doc.paused)
      return res.status(403).json({ error: "You're marked as on leave — check with Anh-Tuan." });
    res.status(200).json(serializeWorker(who.doc, who.kind));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Their own entries, newest first. Credentials travel with the request because
// there is no session — see the note at the top.
router.post("/entries", async (req: Request, res: any) => {
  const { identifier, code } = req.body;
  try {
    const who = await authenticate(identifier, code);
    if (!who) return res.status(401).json({ error: "Not signed in." });
    const entries = await WorkEntry.find(
      who.kind === "staff" ? { staff: who.doc._id } : { cleaner: who.doc._id },
    ).sort({ date: -1 });
    res.status(200).json(entries.map(serializeEntry));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/entry", async (req: Request, res: any) => {
  const { identifier, code, date, hours, report } = req.body;
  if (!date || hours == null)
    return res.status(400).json({ error: "date and hours are required" });
  try {
    const who = await authenticate(identifier, code);
    if (!who) return res.status(401).json({ error: "Not signed in." });
    if (who.kind === "staff" && who.doc.hiredOn && date < who.doc.hiredOn)
      return res.status(400).json({ error: "That day is before your start date." });

    // A cleaner claims a DAY, not a room — several rooms in one visit, paid for
    // the visit. And only a day the system gave them: hours are a claim on the
    // business, so the day they are claimed for has to be one it scheduled.
    // Otherwise a cleaning could be invented that never appeared on any rota.
    if (who.kind === "cleaner") {
      const scheduled = await CleaningAssignment.countDocuments({
        host: who.doc.host,
        cleaner: who.doc._id,
        date,
      });
      if (scheduled === 0)
        return res.status(400).json({
          error: "You weren't scheduled that day — ask Anh-Tuan to add it first.",
        });
    }

    const entry = await WorkEntry.create({
      host: who.doc.host,
      ...(who.kind === "staff" ? { staff: who.doc._id } : { cleaner: who.doc._id }),
      date,
      hours,
      report: report ?? "",
    });
    res.status(200).json(serializeEntry(entry));
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Editing is allowed only while still "submitted". Once the host has approved
// it, the figure has been counted — changing it underneath them would silently
// alter what is owed.
router.patch("/entry", async (req: Request, res: any) => {
  const { identifier, code, id, date, hours, report } = req.body;
  if (!id) return res.status(400).json({ error: "id is required" });
  try {
    const who = await authenticate(identifier, code);
    if (!who) return res.status(401).json({ error: "Not signed in." });
    const entry: any = await WorkEntry.findById(id);
    const ownerId = who.kind === "staff" ? entry?.staff : entry?.cleaner;
    if (!entry || String(ownerId) !== String(who.doc._id))
      return res.status(404).json({ error: "Entry not found." });
    if (entry.status !== "submitted")
      return res
        .status(400)
        .json({ error: "This one has already been reviewed and can't be changed." });
    if (date !== undefined) entry.date = date;
    if (hours !== undefined) entry.hours = hours;
    if (report !== undefined) entry.report = report;
    await entry.save();
    res.status(200).json(serializeEntry(entry));
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.delete("/entry", async (req: Request, res: any) => {
  const { identifier, code, id } = req.body;
  if (!id) return res.status(400).json({ error: "id is required" });
  try {
    const who = await authenticate(identifier, code);
    if (!who) return res.status(401).json({ error: "Not signed in." });
    const entry: any = await WorkEntry.findById(id);
    const ownerId = who.kind === "staff" ? entry?.staff : entry?.cleaner;
    if (!entry || String(ownerId) !== String(who.doc._id))
      return res.status(404).json({ error: "Entry not found." });
    if (entry.status !== "submitted")
      return res
        .status(400)
        .json({ error: "This one has already been reviewed and can't be removed." });
    await WorkEntry.findByIdAndDelete(id);
    res.status(200).json({ ok: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// A cleaner's own rota: what is coming, and what they have already done.
//
// Windowed rather than everything: the point of this screen is "what am I doing
// next, and did last week's hours go in" — a year of history would bury both.
router.post("/schedule", async (req: Request, res: any) => {
  const { identifier, code, from, to } = req.body;
  try {
    const who = await authenticate(identifier, code);
    if (!who) return res.status(401).json({ error: "Not signed in." });
    if (who.kind !== "cleaner") return res.status(200).json([]);

    // The SAME query TiMag's calendar and Clean panel run — host-scoped and all.
    // TiWork's own version omitted `host`, so it read across every host document
    // in the database and told Henry he had cleaned a room the calendar had
    // given to Cindy. One implementation now, so the two cannot disagree.
    const assignments = await findAssignments({
      host: who.doc.host,
      cleaner: who.doc._id,
      start: String(from ?? "0000-01-01"),
      end: String(to ?? "9999-12-31"),
    });

    // Grouped into DAYS, the unit a cleaner is paid in. The Clean panel records
    // one total per cleaner-day and spreads it across that day's rooms (whole
    // total on the first, 0 on the rest), so a per-room figure here would be a
    // number the host never entered.
    //
    // Assigned days WITHOUT hours are still sent: they are the only thing a
    // cleaner is allowed to log against, since a claim on the business has to
    // name a day the business scheduled. TiWork keeps them apart from the work
    // that actually happened — Henry was drafted onto the Cozy room for a day he
    // never came, and the fault was calling that draft "done", not sending it.
    const byDate = new Map<string, any>();
    for (const a of assignments as any[]) {
      const g = byDate.get(a.date) ?? { date: a.date, rooms: [], recordedHours: 0, hasHours: false };
      g.rooms.push({ name: a.room?.name ?? "", color: a.room?.color ?? "" });
      if (a.hours != null) {
        g.recordedHours += a.hours;
        g.hasHours = true;
      }
      byDate.set(a.date, g);
    }

    const claims = await WorkEntry.find({
      cleaner: who.doc._id,
      date: { $in: [...byDate.keys()] },
    });
    const byDay = new Map(claims.map((c: any) => [c.date, c]));

    res.status(200).json(
      [...byDate.values()].map((g: any) => {
        const claim = byDay.get(g.date);
        return {
          date: g.date,
          rooms: g.rooms,
          // What the host has on record for the whole visit.
          recordedHours: g.hasHours ? g.recordedHours : null,
          claim: claim
            ? {
                id: claim._id,
                hours: claim.hours,
                status: claim.status,
                report: claim.report ?? "",
                hostNote: claim.hostNote ?? "",
              }
            : null,
        };
      }),
    );
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// What they have earned, been paid and are owed — the Pay tab's answer, for one
// person and from their side.
//
// Reported for the YEAR, not for all time. Nobody is told what they have been
// paid across thirteen years at a job; a payslip shows the period and the year
// to date. The only cumulative figure that survives is `owed`, because a balance
// IS cumulative — it is whatever has not been settled yet, whenever it was
// earned — and it is the one number here the worker can act on.
//
// Billed at the rate in force on each cleaning's OWN DATE, and including the
// baseline hours from before tracking began, because that is exactly how the
// host's summary computes it. Any other arithmetic here would have TiWork and
// the Clean panel quote different numbers to the two people in the same
// conversation.
router.post("/pay-summary", async (req: Request, res: any) => {
  try {
    const who = await authenticate(req.body?.identifier, req.body?.code);
    if (!who) return res.status(401).json({ error: "Not signed in." });

    const year = new Date().toISOString().slice(0, 4);
    const paidThisYear = (who.doc.payments ?? [])
      .filter((p: any) => String(p.paidOn ?? "").startsWith(year))
      .reduce((sum: number, p: any) => sum + (p.amount ?? 0), 0);

    if (who.kind === "staff") {
      // Office staff earn from approved entries, each already carrying the rate
      // frozen when it was approved.
      const entries = await WorkEntry.find({ staff: who.doc._id, status: "approved" });
      const earnedAllTime = entries.reduce(
        (sum: number, e: any) => sum + e.hours * (e.approvedRate || 0),
        0,
      );
      const ofYear = entries.filter((e: any) => String(e.date).startsWith(year));
      return res.status(200).json({
        owed: Math.max(0, earnedAllTime - (who.doc.paidAmount ?? 0)),
        year,
        hours: ofYear.reduce((sum: number, e: any) => sum + e.hours, 0),
        earned: ofYear.reduce(
          (sum: number, e: any) => sum + e.hours * (e.approvedRate || 0),
          0,
        ),
        paid: paidThisYear,
      });
    }

    const assigns = await CleaningAssignment.find({
      host: who.doc.host,
      cleaner: who.doc._id,
      hours: { $ne: null },
    }).select("date hours");

    // Lifetime feeds the BALANCE; the year is what gets reported.
    let earnedAllTime = 0;
    let hours = 0;
    let earned = 0;
    const datesFromAssignments = new Set<string>();
    const add = (dateKey: string, hrs: number) => {
      const value = hrs * rateOnDate(who.doc, dateKey);
      earnedAllTime += value;
      if (String(dateKey).startsWith(year)) {
        hours += hrs;
        earned += value;
      }
    };
    for (const a of assigns as any[]) {
      add(a.date, a.hours);
      datesFromAssignments.add(a.date);
    }
    // Approved days the planner never drafted. Their hours live on the entry
    // because there was no assignment to write them to, and leaving them out
    // would tell a cleaner an approved visit earned nothing.
    const orphans = await WorkEntry.find({
      cleaner: who.doc._id,
      status: "approved",
    }).select("date hours");
    for (const e of orphans as any[]) {
      if (datesFromAssignments.has(e.date)) continue;
      add(e.date, e.hours);
    }
    // Work done before assignment tracking began, priced at its own month's rate.
    const baseHrs = who.doc.baselineHours ?? 0;
    if (baseHrs > 0) {
      const baseDate = who.doc.baselineMonth
        ? `${who.doc.baselineMonth}-01`
        : new Date().toISOString().slice(0, 10);
      add(baseDate, baseHrs);
    }
    res.status(200).json({
      owed: Math.max(0, earnedAllTime - (who.doc.paidAmount ?? 0)),
      year,
      hours,
      earned,
      paid: paidThisYear,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
