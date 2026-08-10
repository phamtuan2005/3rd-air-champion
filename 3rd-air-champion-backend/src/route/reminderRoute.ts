import express, { Request } from "express";
import SentReminder from "../model/sentReminderSchema";

// Which check-in reminders have already been texted, shared across the account.
// All routes here are mounted behind the JWT middleware in server.ts.
const router = express.Router();

const serialize = (r: any) => ({
  taskId: r.taskId,
  sentBy: r.sentBy ?? "",
  sentAt: r.createdAt,
});

router.get("/list", async (req: Request, res: any) => {
  const { hostId } = req.query;
  if (!hostId) return res.status(400).json({ error: "hostId is required" });
  try {
    const items = await SentReminder.find({ host: hostId });
    res.status(200).json(items.map(serialize));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Idempotent: both the Send Reminder button and the checkbox call this, and a
// second press must not create a duplicate or move the original sent time.
router.post("/mark", async (req: Request, res: any) => {
  const { host, taskId, sentBy } = req.body;
  if (!host || !taskId)
    return res.status(400).json({ error: "host and taskId are required" });
  try {
    const existing = await SentReminder.findOne({ host, taskId });
    if (existing) {
      res.status(200).json(serialize(existing));
      return;
    }
    const created = await SentReminder.create({
      host,
      taskId,
      sentBy: sentBy ?? "",
    });
    res.status(200).json(serialize(created));
  } catch (error: any) {
    // A concurrent mark loses the unique-index race; the outcome it wanted is
    // already true, so report success rather than an error.
    if (error?.code === 11000) {
      const existing = await SentReminder.findOne({ host, taskId });
      if (existing) {
        res.status(200).json(serialize(existing));
        return;
      }
    }
    res.status(500).json({ error: error.message });
  }
});

// Un-ticking the box — the reminder was not actually sent, or needs re-sending.
router.post("/unmark", async (req: Request, res: any) => {
  const { host, taskId } = req.body;
  if (!host || !taskId)
    return res.status(400).json({ error: "host and taskId are required" });
  try {
    await SentReminder.deleteOne({ host, taskId });
    res.status(200).json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;