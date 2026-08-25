import express, { Request } from "express";
import Charge from "../model/chargeSchema";

// Guest charges not attached to a stay (cancellation fees, damage, …).
// REST, like /misc and /cleaner — no GraphQL layer.
// All routes here are mounted behind the JWT middleware in server.ts.
const router = express.Router();

const serialize = (c: any) => ({
  id: c._id,
  // Populated where the guest still exists; a deleted guest leaves the id only,
  // and the charge stays visible rather than vanishing with them.
  guest: c.guest?._id
    ? { id: c.guest._id, name: c.guest.name, phone: c.guest.phone ?? "" }
    : { id: c.guest, name: "(guest removed)", phone: "" },
  label: c.label,
  amount: c.amount,
  date: c.date,
  note: c.note ?? "",
  paid: !!c.paid,
  roomName: c.roomName ?? "",
  stayStart: c.stayStart ?? "",
  stayNights: c.stayNights ?? 0,
});

router.get("/list", async (req: Request, res: any) => {
  const { hostId, start, end } = req.query;
  if (!hostId) return res.status(400).json({ error: "hostId is required" });
  try {
    const query: Record<string, unknown> = { host: hostId };
    // Optional yyyy-MM-dd window — string comparison is safe because dates are
    // stored zero-padded.
    if (start && end) query.date = { $gte: String(start), $lte: String(end) };
    const items = await Charge.find(query).populate("guest", "name phone").sort({ date: -1 });
    res.status(200).json(items.map(serialize));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/create", async (req: Request, res: any) => {
  const { host, guest, label, amount, date, note, paid, roomName, stayStart, stayNights } =
    req.body;
  if (!host || !guest || amount == null || !date)
    return res.status(400).json({ error: "host, guest, amount and date are required" });
  try {
    const item = await Charge.create({
      host,
      guest,
      label: label || "Other",
      amount,
      date,
      note: note ?? "",
      paid: !!paid,
      roomName: roomName ?? "",
      stayStart: stayStart ?? "",
      stayNights: stayNights ?? 0,
    });
    await item.populate("guest", "name phone");
    res.status(200).json(serialize(item));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.patch("/update", async (req: Request, res: any) => {
  const { id, label, amount, date, note, paid } = req.body;
  if (!id) return res.status(400).json({ error: "id is required" });
  try {
    const update: Record<string, unknown> = {};
    if (label !== undefined) update.label = label;
    if (amount !== undefined) update.amount = amount;
    if (date !== undefined) update.date = date;
    if (note !== undefined) update.note = note;
    if (paid !== undefined) update.paid = paid;
    const item = await Charge.findByIdAndUpdate(id, update, {
      new: true,
      runValidators: true,
    }).populate("guest", "name phone");
    if (!item) return res.status(404).json({ error: "Charge not found" });
    res.status(200).json(serialize(item));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete("/:id", async (req: Request, res: any) => {
  const { id } = req.params;
  try {
    await Charge.findOneAndDelete({ _id: id });
    res.status(200).json({ ok: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
