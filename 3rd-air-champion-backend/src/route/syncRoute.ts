import express, { Request } from "express";
import { runAirbnbSync } from "../jobs/airbnbSync";

const router = express.Router();

router.post("/sync", async (req: Request, res: any) => {
  if (!("user" in req))
    return res.status(401).json({ error: "Invalid or expired token" });

  const { data, calendar, guest } = req.body;

  try {
    const result = await runAirbnbSync({ calendar, guest, data });
    res.status(200).json({ success: true, ...result });
  } catch (error: any) {
    console.error("Error during AirBnB sync:", error.message);
    res.status(500).json({ error: error.message });
  }
});

export default router;