import express, { Request } from "express";
import { runAirbnbSync } from "../jobs/airbnbSync";

const router = express.Router();

router.post("/sync", async (req: Request, res: any) => {
  if (!("user" in req))
    return res.status(401).json({ error: "Invalid or expired token" });

  const { data, calendar, guest } = req.body;

  // Collapse duplicate rooms before syncing.
  //
  // autoSync already dedupes its own list; this path did not, so a browser
  // posting a stale array made runAirbnbSync fetch one feed several times and
  // run its unbook/rebook pass once per copy. Given that pass wiped 93 payouts
  // on 2026-08-08 when fed a bad URL, running it fewer times on the same room
  // is worth having.
  const byRoom = new Map<string, any>();
  for (const entry of Array.isArray(data) ? data : []) {
    if (entry?.room && entry?.link) byRoom.set(entry.room.toString(), entry);
  }
  const deduped = [...byRoom.values()];
  if (Array.isArray(data) && deduped.length !== data.length) {
    console.log(`[Sync] collapsed ${data.length} link(s) to ${deduped.length} room(s)`);
  }

  try {
    const result = await runAirbnbSync({ calendar, guest, data: deduped });
    res.status(200).json({ success: true, ...result });
  } catch (error: any) {
    console.error("Error during AirBnB sync:", error.message);
    res.status(500).json({ error: error.message });
  }
});

export default router;