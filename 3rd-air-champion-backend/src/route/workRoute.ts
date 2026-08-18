import express, { Request } from "express";
import Staff from "../model/staffSchema";
import WorkEntry from "../model/workEntrySchema";

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

const serializeStaff = (s: any) => ({
  id: s._id,
  name: s.name,
  title: s.title ?? "",
  hiredOn: s.hiredOn,
  payType: s.payType ?? "hourly",
  // The rate is theirs to see — it is what they are owed per hour.
  payRate: s.payRate ?? 0,
  host: s.host,
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
  staffId: e.staff?._id ?? e.staff,
  staffName: e.staff?.name ?? "",
});

// Resolve a caller from credentials. Returns null rather than throwing so every
// caller can answer with the SAME message whether the identifier or the code was
// wrong — saying which one is right is giving away half the secret.
//
// The identifier is an EMAIL OR A PHONE, whichever the person actually has. The
// first hire works remotely from Germany: she may have no US number at all, and
// an email is the thing a remote worker reliably owns and types correctly.
const authenticate = async (identifier: string, code: string) => {
  const raw = String(identifier ?? "").trim();
  if (!raw || !code) return null;
  const asEmail = normalizeEmail(raw);
  const asPhone = normalizePhone(raw);
  // Narrow by code first: it is the secret, and matching it server-side keeps
  // the candidate set to the handful of people who share that code (normally one).
  const candidates = await Staff.find({ accessCode: code });
  return (
    candidates.find((s: any) => {
      if ((s.accessCode ?? "") === "") return false;
      if (raw.includes("@")) return normalizeEmail(s.email) === asEmail;
      return !!asPhone && normalizePhone(s.phone) === asPhone;
    }) ?? null
  );
};

router.post("/signin", async (req: Request, res: any) => {
  const { identifier, code } = req.body;
  try {
    const staff = await authenticate(identifier, code);
    if (!staff)
      return res.status(401).json({ error: "That email or phone and code don't match." });
    if (staff.endedOn && staff.endedOn !== "")
      return res.status(403).json({ error: "This account is no longer active." });
    res.status(200).json(serializeStaff(staff));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Their own entries, newest first. Credentials travel with the request because
// there is no session — see the note at the top.
router.post("/entries", async (req: Request, res: any) => {
  const { identifier, code } = req.body;
  try {
    const staff = await authenticate(identifier, code);
    if (!staff) return res.status(401).json({ error: "Not signed in." });
    const entries = await WorkEntry.find({ staff: staff._id }).sort({ date: -1 });
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
    const staff = await authenticate(identifier, code);
    if (!staff) return res.status(401).json({ error: "Not signed in." });
    if (date < staff.hiredOn)
      return res
        .status(400)
        .json({ error: "That day is before your start date." });
    const entry = await WorkEntry.create({
      host: staff.host,
      staff: staff._id,
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
    const staff = await authenticate(identifier, code);
    if (!staff) return res.status(401).json({ error: "Not signed in." });
    const entry: any = await WorkEntry.findById(id);
    if (!entry || String(entry.staff) !== String(staff._id))
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
    const staff = await authenticate(identifier, code);
    if (!staff) return res.status(401).json({ error: "Not signed in." });
    const entry: any = await WorkEntry.findById(id);
    if (!entry || String(entry.staff) !== String(staff._id))
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

export default router;
