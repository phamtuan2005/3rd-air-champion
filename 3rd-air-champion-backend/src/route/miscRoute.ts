import express, { Request } from "express";
import Misc from "../model/miscSchema";

// All routes here are mounted behind the JWT middleware in server.ts.
const router = express.Router();

const serialize = (m: any) => ({
  id: m._id,
  category: m.category,
  label: m.label ?? "",
  amount: m.amount,
  date: m.date,
  recurring: m.recurring ?? false,
  endMonth: m.endMonth ?? "",
  note: m.note ?? "",
});

router.get("/list", async (req: Request, res: any) => {
  const { hostId } = req.query;
  if (!hostId) return res.status(400).json({ error: "hostId is required" });
  try {
    const items = await Misc.find({ host: hostId }).sort({ date: -1 });
    res.status(200).json(items.map(serialize));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/create", async (req: Request, res: any) => {
  const { host, category, label, amount, date, recurring, endMonth, note } = req.body;
  if (!host || amount == null || !date)
    return res.status(400).json({ error: "host, amount and date are required" });
  try {
    const item = await Misc.create({
      host,
      category: category ?? "Other",
      label: label ?? "",
      amount,
      date,
      recurring: !!recurring,
      endMonth: endMonth ?? "",
      note: note ?? "",
    });
    res.status(200).json(serialize(item));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.patch("/update", async (req: Request, res: any) => {
  const { id, category, label, amount, date, recurring, endMonth, note } = req.body;
  if (!id) return res.status(400).json({ error: "id is required" });
  try {
    const update: Record<string, unknown> = {};
    if (category !== undefined) update.category = category;
    if (label !== undefined) update.label = label;
    if (amount !== undefined) update.amount = amount;
    if (date !== undefined) update.date = date;
    if (recurring !== undefined) update.recurring = recurring;
    if (endMonth !== undefined) update.endMonth = endMonth;
    if (note !== undefined) update.note = note;
    const item = await Misc.findByIdAndUpdate(id, update, { new: true, runValidators: true });
    if (!item) return res.status(404).json({ error: "Expense not found" });
    res.status(200).json(serialize(item));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete("/:id", async (req: Request, res: any) => {
  const { id } = req.params;
  try {
    await Misc.findOneAndDelete({ _id: id });
    res.status(200).json({ ok: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
