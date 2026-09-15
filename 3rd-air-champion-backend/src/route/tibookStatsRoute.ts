import express, { Request } from "express";
import TiBookVisit from "../model/tibookVisitSchema";
import Guest from "../model/guestSchema";
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
      { visitorId: 1, day: 1, continent: 1, guestPhone: 1, _id: 0 }
    ).lean();

    const stats = tibookVisitorStats(rows as any, utcDay());

    // Put names to the numbers from the house's OWN guest records. Scoped by
    // host from the token, like everything on this route: an unscoped lookup
    // would show one house the name another house keeps for the same number.
    // Equality works because visits and guest records both go through
    // normalizePhone. A number nobody has booked under yet comes back unnamed.
    const phones = [...new Set(stats.spans.flatMap((s) => s.guests.map((g) => g.phone)))];
    const names = new Map<string, string>();
    if (phones.length > 0) {
      const found = await Guest.find({ host: hostId, phone: { $in: phones } }, { name: 1, phone: 1 }).lean();
      for (const g of found as any[]) names.set(g.phone, g.name);
    }

    res.status(200).json({
      ...stats,
      spans: stats.spans.map((s) => ({
        ...s,
        guests: s.guests.map((g) => ({ ...g, name: names.get(g.phone) ?? null })),
      })),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
