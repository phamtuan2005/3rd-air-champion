import express, { Request } from "express";
import TiBookVisit from "../model/tibookVisitSchema";
import Guest from "../model/guestSchema";
import TiBookStatsGrant from "../model/tibookStatsGrantSchema";
import { hashStatsCode } from "./tibookStatsAccessRoute";
import { tibookVisitorStats, utcDay } from "../util/tibookVisitorStats";

// A guest the host chose reading TiBook's visitor numbers, with the code TiMag
// gave them (see tibookStatsAccessRoute).
//
// PUBLIC — outside the JWT gate — because the guest has no login. The code IS
// the proof, checked on every request, as TiWork's access code is. TiBook's
// own idea of who a guest is (a phone number anyone can type) is never
// trusted here: a right keyed on a phone number would belong to everybody who
// knows it.
//
// What the viewer gets is the host's numbers with EVERY guest identity taken
// out — no names, no phone numbers, not even how many named guests there are.
// The counts, the trend and the continents are what developing TiBook needs;
// who visited is the other guests' business, and they agreed to be remembered
// by the house, not to be shown to another guest.
const router = express.Router();

// Slows anyone guessing. The codes are not guessable anyway (~2^59), so this is
// about not letting a script hammer the database, not about the odds.
const WINDOW_MS = 15 * 60 * 1000;
const MAX_MISSES = 10;
const misses = new Map<string, { count: number; since: number }>();
export const resetViewerMisses = () => misses.clear(); // for tests

const tooManyMisses = (ip: string) => {
  const m = misses.get(ip);
  if (!m) return false;
  if (Date.now() - m.since > WINDOW_MS) {
    misses.delete(ip);
    return false;
  }
  return m.count >= MAX_MISSES;
};
const recordMiss = (ip: string) => {
  const m = misses.get(ip);
  if (!m || Date.now() - m.since > WINDOW_MS) misses.set(ip, { count: 1, since: Date.now() });
  else m.count += 1;
};

// POST, so the code travels in the body rather than in a URL that lands in
// server logs and browser history.
router.post("/", async (req: Request, res: any) => {
  const ip = req.ip || "unknown";
  if (tooManyMisses(ip)) {
    return res.status(429).json({ error: "Too many tries. Wait a few minutes and try again." });
  }
  const code = String(req.body?.code ?? "");
  if (code.replace(/[^A-Za-z0-9]/g, "").length < 8) {
    recordMiss(ip);
    return res.status(401).json({ error: "That code isn't right." });
  }

  try {
    const grant: any = await TiBookStatsGrant.findOne({ codeHash: hashStatsCode(code) }).lean();
    // A grant outlives nothing it depends on: a deleted guest's code stops
    // working, the same as a revoked one.
    const guest: any = grant
      ? await Guest.findOne({ _id: grant.guest, host: grant.host }, { name: 1 }).lean()
      : null;
    if (!grant || !guest) {
      recordMiss(ip);
      return res.status(401).json({ error: "That code isn't right." });
    }

    // Only the fields the counts need. guestPhone is not even read, so it
    // cannot reach the response by a later edit to the mapping below.
    const rows = await TiBookVisit.find(
      { host: grant.host },
      { visitorId: 1, day: 1, continent: 1, _id: 0 }
    ).lean();
    const stats = tibookVisitorStats(rows as any, utcDay());

    res.status(200).json({
      // The viewer's own first name, so TiBook can greet them — nobody else's.
      viewer: String(guest.name ?? "").trim().split(/\s+/)[0] ?? "",
      since: stats.since,
      today: stats.today,
      spans: stats.spans.map((s) => ({ ...s, guests: [] })),
    });
  } catch (error: any) {
    res.status(500).json({ error: "The numbers didn't load." });
  }
});

export default router;
