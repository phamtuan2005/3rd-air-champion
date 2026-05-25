import express, { Request } from "express";
import WishList from "../model/wishListSchema";

const router = express.Router();

// Public — set (replace) all wish list dates for a guest at once
router.post("/set", async (req: Request, res: any) => {
  const { host, guestPhone, guestName, dates } = req.body;
  if (!host || !guestPhone || !guestName || !Array.isArray(dates)) {
    return res.status(400).json({ error: "host, guestPhone, guestName, and dates[] are required" });
  }

  const targetDates = dates.map((d: string) => {
    const date = new Date(`${d}T12:00:00Z`);
    date.setUTCHours(0, 0, 0, 0);
    return date;
  });

  try {
    const setDigits = guestPhone.replace(/\D/g, "");
    const setPhoneRegex = new RegExp(setDigits.split("").join("\\D*"));
    let entry = await WishList.findOne({ host, guestPhone: { $regex: setPhoneRegex } });
    if (!entry) {
      entry = await WishList.create({ host, guestPhone, guestName, dates: targetDates });
    } else {
      entry.dates = targetDates as any;
      if (entry.guestName !== guestName) entry.guestName = guestName;
      await entry.save();
    }
    const dateStrings = entry.dates.map((d) => new Date(d).toISOString().split("T")[0]);
    res.status(200).json({ dates: dateStrings });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Public — toggle a single date in/out of a guest's wish list
router.post("/toggle", async (req: Request, res: any) => {
  const { host, guestPhone, guestName, date } = req.body;
  if (!host || !guestPhone || !guestName || !date) {
    return res.status(400).json({ error: "host, guestPhone, guestName, and date are required" });
  }

  const targetDate = new Date(date);
  targetDate.setUTCHours(0, 0, 0, 0);

  try {
    const digits = guestPhone.replace(/\D/g, "");
    const phoneRegex = new RegExp(digits.split("").join("\\D*"));
    let entry = await WishList.findOne({ host, guestPhone: { $regex: phoneRegex } });

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
    const digits = guestPhone.replace(/\D/g, "");
    const phoneRegex = new RegExp(digits.split("").join("\\D*"));
    const entry = await WishList.findOne({ host, guestPhone: { $regex: phoneRegex } });
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
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const result = [];
    for (const e of entries) {
      const futureDates = e.dates.filter((d) => new Date(d) >= today);
      if (futureDates.length === 0) {
        await WishList.findByIdAndDelete(e._id);
        continue;
      }
      if (futureDates.length !== e.dates.length) {
        e.dates = futureDates as any;
        await e.save();
      }
      result.push({
        id: e._id,
        guestPhone: e.guestPhone,
        guestName: e.guestName,
        dates: futureDates.map((d) => new Date(d).toISOString().split("T")[0]),
        status: (e as any).status ?? "waiting",
        createdAt: e.createdAt,
        updatedAt: e.updatedAt,
      });
    }
    res.status(200).json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update status of a wish list entry
router.patch("/status", async (req: Request, res: any) => {
  const { id, status } = req.body;
  if (!id || !status) return res.status(400).json({ error: "id and status are required" });
  if (!["waiting", "notified", "booked"].includes(status))
    return res.status(400).json({ error: "status must be waiting, notified, or booked" });
  try {
    const entry = await WishList.findByIdAndUpdate(id, { status }, { new: true });
    if (!entry) return res.status(404).json({ error: "Entry not found" });
    res.status(200).json({ status: (entry as any).status });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Delete a wish list entry
router.delete("/:id", async (req: Request, res: any) => {
  const { id } = req.params;
  try {
    await WishList.findByIdAndDelete(id);
    res.status(200).json({ ok: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;