import express, { Request } from "express";
import TiBookVisit from "../model/tibookVisitSchema";
import { requireManager } from "../middleware/requireManager";
import { tibookVisitorStats, utcDay } from "../util/tibookVisitorStats";

// The host reading how TiBook is doing. Mounted AFTER the JWT gate, and then
// behind requireManager too, because TiBook's own guest session holds a valid
// token — see that middleware for why the gate alone does not keep guests out.
//
// Not in GraphQL, for the reason given at the top of tibookVisitRoute.
const router = express.Router();

router.use(requireManager as any); // same cast server.ts gives authenticateToken

router.get("/", async (req: Request, res: any) => {
  // The house comes from the TOKEN, never from the request. Taking a hostId
  // from the body would let any signed-in account read any other house's
  // numbers by changing one field.
  const hostId = (req as any).user.hostId;

  try {
    // Read whole and counted in memory, like the guest inbox: one row per
    // visitor per day at a five-room house is a small collection, and the
    // "came back" rule needs each visitor's first-ever day, which a date-bounded
    // aggregation would not see.
    const rows = await TiBookVisit.find(
      { host: hostId },
      { visitorId: 1, day: 1, continent: 1, _id: 0 }
    ).lean();

    res.status(200).json(tibookVisitorStats(rows as any, utcDay()));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
