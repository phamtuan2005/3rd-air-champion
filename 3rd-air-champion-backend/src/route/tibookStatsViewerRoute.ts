import express, { Request } from "express";
import mongoose from "mongoose";
import { redirectHost } from "../util/hostRedirect";
import TiBookVisit from "../model/tibookVisitSchema";
import Guest from "../model/guestSchema";
import TiBookStatsGrant from "../model/tibookStatsGrantSchema";
import { hashStatsCode } from "./tibookStatsAccessRoute";
import { tibookVisitorStats, utcDay } from "../util/tibookVisitorStats";
import TTQuestion from "../model/ttQuestionSchema";
import { questionStats } from "../util/ttQuestions";

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

// Whether the guest TiBook has recognised by phone was given access — so
// "Your Bookings" can offer the numbers to them and to nobody else, rather than
// the host's link being the only way in.
//
// This opens NOTHING. It answers yes or no, and a yes only shows the row that
// leads to the code screen; the code is still the proof, checked by the route
// below. All anyone typing someone else's number learns is that they help with
// TiBook — less than the name and discount guest-by-phone already hands back
// for the same number.
//
// Matched the way guestByPhone matches (digits, any punctuation between), so
// the guest the sheet greets is the guest checked here. At least seven digits:
// that regex is unanchored, and "4" would match half the guest list.
router.post("/has-access", async (req: Request, res: any) => {
  const host = String(req.body?.host ?? "");
  const digits = String(req.body?.phone ?? "").replace(/\D/g, "");
  if (!mongoose.isValidObjectId(redirectHost(host)) || digits.length < 7) {
    return res.status(200).json({ hasAccess: false });
  }
  try {
    const hostId = redirectHost(host);
    const guests = await Guest.find(
      { host: hostId, phone: { $regex: new RegExp(digits.split("").join("\\D*")) } },
      { _id: 1 }
    ).lean();
    const hasAccess =
      guests.length > 0 &&
      (await TiBookStatsGrant.exists({ host: hostId, guest: { $in: guests.map((g: any) => g._id) } })) != null;
    res.status(200).json({ hasAccess });
  } catch {
    res.status(200).json({ hasAccess: false });
  }
});

// The code check every route here goes through: the grant and its guest, or
// null with the refusal already sent. One function, so the TT questions below
// cannot be opened by a weaker check than the visitor numbers.
const grantFor = async (req: Request, res: any): Promise<{ grant: any; guest: any } | null> => {
  const ip = req.ip || "unknown";
  if (tooManyMisses(ip)) {
    res.status(429).json({ error: "Too many tries. Wait a few minutes and try again." });
    return null;
  }
  const code = String(req.body?.code ?? "");
  if (code.replace(/[^A-Za-z0-9]/g, "").length < 8) {
    recordMiss(ip);
    res.status(401).json({ error: "That code isn't right." });
    return null;
  }
  const grant: any = await TiBookStatsGrant.findOne({ codeHash: hashStatsCode(code) }).lean();
  // A grant outlives nothing it depends on: a deleted guest's code stops
  // working, the same as a revoked one.
  const guest: any = grant
    ? await Guest.findOne({ _id: grant.guest, host: grant.host }, { name: 1 }).lean()
    : null;
  if (!grant || !guest) {
    recordMiss(ip);
    res.status(401).json({ error: "That code isn't right." });
    return null;
  }
  return { grant, guest };
};

// POST, so the code travels in the body rather than in a URL that lands in
// server logs and browser history.
router.post("/", async (req: Request, res: any) => {
  try {
    const found = await grantFor(req, res);
    if (!found) return;
    const { grant, guest } = found;

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

// What guests asked TiBook's TT, for the same people: the house gave them the
// code to help develop TiBook, and TT is part of TiBook. The questions are
// already scrubbed of phone numbers, emails and links when stored (ttGuestRoute)
// and carry no guest id; `returning` is a count, never who.
const SPANS: Record<string, number | null> = { week: 7, month: 30, year: 365, all: null };

router.post("/tt-questions", async (req: Request, res: any) => {
  try {
    const found = await grantFor(req, res);
    if (!found) return;
    const span = String(req.body?.span ?? "month");
    const days = span in SPANS ? SPANS[span] : SPANS.month;
    const filter: Record<string, unknown> = { host: found.grant.host };
    if (days != null) filter.createdAt = { $gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000) };
    const rows = await TTQuestion.find(filter, { question: 1, answered: 1, category: 1, returning: 1, createdAt: 1, _id: 0 })
      .sort({ createdAt: -1 })
      .limit(5000)
      .lean();
    res.status(200).json({ span: span in SPANS ? span : "month", ...questionStats(rows as any) });
  } catch {
    res.status(500).json({ error: "The questions didn't load." });
  }
});

export default router;
