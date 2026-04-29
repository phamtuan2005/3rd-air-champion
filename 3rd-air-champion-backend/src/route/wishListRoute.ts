import express, { Request, Response } from "express";
import WishList from "../model/wishListSchema";

const router = express.Router();

// Public — toggle a single date in/out of a guest's wish list
router.post("/toggle", async (req: Request, res: any) => {
  const { host, guestPhone, guestName, date } = req.body;
  if (!host || !guestPhone || !guestName || !date) {
    return res.status(400).json({ error: "host, guestPhone, guestName, and date are required" });
  }

  const targetDate = new Date(date);
  targetDate.setUTCHours(0, 0, 0, 0);

  try {
    let entry = await WishList.findOne({ host, guestPhone });

    if (!entry) {
      entry = await WishList.create({ host, guestPhone, guestName, dates: [targetDate] });
    } else {
      const alreadyIn = entry.dates.some(
        (d) => new Date(d).toISOString().split("T")[0] === targetDate.toISOString().split("T")[0]
      );
      if (alreadyIn) {
        entry.dates = entry.dates.filter(
          (d) => new Date(d).toISOString().split("T")[0] !== targetDate.toISOString().split("T")[0]
        ) as any;
      } else {
        entry.dates.push(targetDate as any);
      }
      if (entry.guestName !== guestName) entry.guestName = guestName;
      await entry.save();
    }

    const dateStrings = entry.dates.map((d) => new Date(d).toISOString().split("T")[0]);
    res.status(200).json({ dates: dateStrings });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Public — get a guest's wish list by phone
router.post("/get/guest", async (req: Request, res: any) => {
  const { host, guestPhone } = req.body;
  if (!host || !guestPhone) {
    return res.status(400).json({ error: "host and guestPhone are required" });
  }

  try {
    const entry = await WishList.findOne({ host, guestPhone });
    const dates = entry ? entry.dates.map((d) => new Date(d).toISOString().split("T")[0]) : [];
    res.status(200).json({ dates });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Protected (JWT checked by server.ts middleware) — get all wish lists for a host
router.get("/get/host", async (req: Request, res: any) => {
  const { hostId } = req.query;
  if (!hostId) {
    return res.status(400).json({ error: "hostId is required" });
  }

  try {
    const entries = await WishList.find({ host: hostId }).sort({ updatedAt: -1 });
    const result = entries.map((e) => ({
      id: e._id,
      guestPhone: e.guestPhone,
      guestName: e.guestName,
      dates: e.dates.map((d) => new Date(d).toISOString().split("T")[0]),
      createdAt: e.createdAt,
      updatedAt: e.updatedAt,
    }));
    res.status(200).json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;