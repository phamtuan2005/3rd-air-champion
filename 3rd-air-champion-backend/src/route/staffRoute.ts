import express, { Request } from "express";
import Staff from "../model/staffSchema";

// All routes here are mounted behind the JWT middleware in server.ts.
// REST rather than GraphQL, matching /cleaner and /misc.
const router = express.Router();

const serialize = (s: any) => ({
  id: s._id,
  name: s.name,
  title: s.title ?? "",
  phone: s.phone ?? "",
  email: s.email ?? "",
  character: s.character ?? "",
  hiredOn: s.hiredOn,
  endedOn: s.endedOn ?? "",
  payType: s.payType ?? "hourly",
  payRate: s.payRate ?? 0,
  rateHistory: (s.rateHistory ?? []).map((r: any) => ({
    rate: r.rate,
    effectiveFrom: r.effectiveFrom,
  })),
  reviews: (s.reviews ?? []).map((r: any) => ({
    id: r._id,
    date: r.date,
    rating: r.rating,
    note: r.note ?? "",
  })),
  paidAmount: s.paidAmount ?? 0,
  payments: (s.payments ?? []).map((p: any) => ({
    id: p._id,
    amount: p.amount,
    paidOn: p.paidOn,
    note: p.note ?? "",
  })),
  note: s.note ?? "",
});

router.get("/list", async (req: Request, res: any) => {
  const { hostId } = req.query;
  if (!hostId) return res.status(400).json({ error: "hostId is required" });
  try {
    const items = await Staff.find({ host: hostId }).sort({ hiredOn: -1 });
    res.status(200).json(items.map(serialize));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/create", async (req: Request, res: any) => {
  const { host, name, title, phone, email, character, hiredOn, payType, payRate, note } =
    req.body;
  if (!host || !name || !hiredOn)
    return res.status(400).json({ error: "host, name and hiredOn are required" });
  try {
    const item = await Staff.create({
      host,
      name,
      title: title ?? "",
      phone: phone ?? "",
      email: email ?? "",
      character: character ?? "",
      hiredOn,
      payType: payType === "biweekly" ? "biweekly" : "hourly",
      payRate: payRate ?? 0,
      note: note ?? "",
    });
    res.status(200).json(serialize(item));
  } catch (error: any) {
    // The host+name unique index — a clearer message than the raw driver text.
    if (error?.code === 11000)
      return res.status(400).json({ error: "Someone with that name is already on the team" });
    res.status(500).json({ error: error.message });
  }
});

router.patch("/update", async (req: Request, res: any) => {
  const {
    id,
    name,
    title,
    phone,
    email,
    character,
    hiredOn,
    endedOn,
    payType,
    payRate,
    rateHistory,
    note,
  } = req.body;
  if (!id) return res.status(400).json({ error: "id is required" });
  try {
    const update: Record<string, unknown> = {};
    if (name !== undefined) update.name = name;
    if (title !== undefined) update.title = title;
    if (phone !== undefined) update.phone = phone;
    if (email !== undefined) update.email = email;
    if (character !== undefined) update.character = character;
    if (hiredOn !== undefined) update.hiredOn = hiredOn;
    if (endedOn !== undefined) update.endedOn = endedOn;
    if (payType !== undefined) update.payType = payType === "biweekly" ? "biweekly" : "hourly";
    if (payRate !== undefined) update.payRate = payRate;
    if (rateHistory !== undefined) update.rateHistory = rateHistory;
    if (note !== undefined) update.note = note;
    const item = await Staff.findByIdAndUpdate(id, update, {
      new: true,
      runValidators: true,
    });
    if (!item) return res.status(404).json({ error: "Staff member not found" });
    res.status(200).json(serialize(item));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Performance is appended, never replaced — a review is a dated observation and
// overwriting the last one loses the history that makes it worth anything.
router.post("/review", async (req: Request, res: any) => {
  const { id, date, rating, note } = req.body;
  if (!id || !date || rating == null)
    return res.status(400).json({ error: "id, date and rating are required" });
  try {
    const item = await Staff.findByIdAndUpdate(
      id,
      { $push: { reviews: { date, rating, note: note ?? "" } } },
      { new: true, runValidators: true }
    );
    if (!item) return res.status(404).json({ error: "Staff member not found" });
    res.status(200).json(serialize(item));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete("/review", async (req: Request, res: any) => {
  const { id, reviewId } = req.body;
  if (!id || !reviewId) return res.status(400).json({ error: "id and reviewId are required" });
  try {
    const item = await Staff.findByIdAndUpdate(
      id,
      { $pull: { reviews: { _id: reviewId } } },
      { new: true }
    );
    if (!item) return res.status(404).json({ error: "Staff member not found" });
    res.status(200).json(serialize(item));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// A payment both appends to the log and moves the running total, in one write,
// so the two can never disagree — the lesson already learned on Cleaner.
router.post("/pay", async (req: Request, res: any) => {
  const { id, amount, paidOn, note } = req.body;
  if (!id || amount == null || !paidOn)
    return res.status(400).json({ error: "id, amount and paidOn are required" });
  try {
    const item = await Staff.findByIdAndUpdate(
      id,
      {
        $push: { payments: { amount, paidOn, note: note ?? "" } },
        $inc: { paidAmount: amount },
      },
      { new: true, runValidators: true }
    );
    if (!item) return res.status(404).json({ error: "Staff member not found" });
    res.status(200).json(serialize(item));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete("/:id", async (req: Request, res: any) => {
  const { id } = req.params;
  try {
    await Staff.findOneAndDelete({ _id: id });
    res.status(200).json({ ok: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
