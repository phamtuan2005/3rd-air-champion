import express, { Request } from "express";
import mongoose from "mongoose";
import Room from "../model/roomSchema";
import TTQuestion from "../model/ttQuestionSchema";
import TTReviews from "../model/ttReviewsSchema";
import { requireManager } from "../middleware/requireManager";
import { questionStats } from "../util/ttQuestions";
import { draftReviewSummaries, MAX_TOTAL_PASTE, PastedRoom, ReviewDraft } from "../util/reviewDraft";

// The host's side of TiBook's TT: what guests have been asking it, and the
// review summaries it shows them.
//
// Mounted AFTER the JWT gate, and behind requireManager too, because TiBook's
// own guest session holds a valid token (see that middleware). The house always
// comes from the TOKEN, never from the request body.
const router = express.Router();

router.use(requireManager as any); // same cast server.ts gives authenticateToken

const hostOf = (req: Request) => String((req as any).user.hostId);

// ── What guests asked TT ─────────────────────────────────────────────────────

// The spans the screen offers, in days. "all" is no bound.
const SPANS: Record<string, number | null> = { week: 7, month: 30, year: 365, all: null };

router.get("/questions", async (req: Request, res: any) => {
  const span = String(req.query.span ?? "month");
  const days = span in SPANS ? SPANS[span] : SPANS.month;
  const filter: Record<string, unknown> = { host: hostOf(req) };
  if (days != null) filter.createdAt = { $gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000) };
  try {
    // Read whole and grouped in memory, like the visitor numbers: a five-room
    // house's guests ask a few questions a day, not millions.
    const rows = await TTQuestion.find(filter, { question: 1, answered: 1, category: 1, returning: 1, createdAt: 1, _id: 0 })
      .sort({ createdAt: -1 })
      .limit(5000)
      .lean();
    res.status(200).json({ span: span in SPANS ? span : "month", ...questionStats(rows as any) });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ── Review summaries ─────────────────────────────────────────────────────────

// A draft that has said "drafting" for this long died with the process that
// was writing it (a deploy, a crash). Reported as failed so the host can try
// again instead of watching a spinner forever.
const STALE_DRAFT_MS = 5 * 60 * 1000;

const view = (doc: any) => {
  const d = doc?.draft ?? {};
  const stale = d.status === "drafting" && d.startedAt && Date.now() - new Date(d.startedAt).getTime() > STALE_DRAFT_MS;
  const rooms = (set: any) => (set?.rooms ?? []).map((r: any) => ({ roomId: String(r.room), summary: r.summary ?? "" }));
  return {
    published: { house: doc?.published?.house ?? "", rooms: rooms(doc?.published), at: doc?.published?.at ?? null },
    draft: {
      status: stale ? "failed" : (d.status ?? "none"),
      error: stale ? "The draft stopped part way — the server restarted. Try again." : (d.error ?? ""),
      house: d.house ?? "",
      rooms: rooms(d),
      reviewsRead: d.reviewsRead ?? 0,
      startedAt: d.startedAt ?? null,
    },
  };
};

router.get("/reviews", async (req: Request, res: any) => {
  try {
    const hostId = hostOf(req);
    // The rooms to paste for, with their listing link so the screen can open
    // each listing's reviews in one tap. Name, id and link only — never the
    // door code the room record also carries.
    const rooms = await Room.find({ host: hostId, active: { $ne: false } }, { name: 1, airbnbUrl: 1 }).sort({ name: 1 }).lean();
    res.status(200).json({
      ...view(await TTReviews.findOne({ host: hostId }).lean()),
      houseRooms: rooms.map((r: any) => ({ roomId: String(r._id), name: r.name ?? "", airbnbUrl: r.airbnbUrl ?? "" })),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Swapped in tests; the real one calls Claude.
let draft: (rooms: PastedRoom[]) => Promise<ReviewDraft> = (rooms) => draftReviewSummaries(rooms);
let drafterNeedsKey = true;
export const setReviewDrafter = (fn: typeof draft) => {
  draft = fn;
  drafterNeedsKey = false;
};

// Starts a draft and answers at once. The model reading hundreds of reviews
// can take longer than CloudFront waits for a first byte (30 seconds — see
// aiRoute), so the work carries on after the response and TiMag polls
// GET /reviews until it says ready or failed.
// A whole review history in one request. server.ts leaves this path out of its
// 2 MB parser (anything over that was refused with a bare error, and the host
// saw only "The draft didn't start"), and it is read here instead — AFTER the
// manager check this router sits behind, so nobody who is not signed in can make
// the server read a body this size. 16 MB covers MAX_TOTAL_PASTE characters even
// at four bytes each.
router.post("/reviews/draft", express.json({ limit: "16mb" }), async (req: Request, res: any) => {
  const hostId = hostOf(req);
  if (drafterNeedsKey && !process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({ error: "Drafting needs ANTHROPIC_API_KEY on the server." });
  }
  const pasted = Array.isArray(req.body?.rooms) ? req.body.rooms : [];
  try {
    // Only this house's rooms, named as the house names them. A room id from
    // the body that is not the host's is dropped, not trusted.
    const ids = pasted.map((r: any) => r?.roomId).filter((id: any) => mongoose.isValidObjectId(id));
    const owned = await Room.find({ _id: { $in: ids }, host: hostId }, { name: 1 }).lean();
    const names = new Map(owned.map((r: any) => [String(r._id), String(r.name ?? "")]));
    const rooms: PastedRoom[] = pasted
      .filter((r: any) => names.has(String(r?.roomId)) && typeof r?.text === "string" && r.text.trim())
      .map((r: any) => ({ roomId: String(r.roomId), name: names.get(String(r.roomId))!, text: r.text.trim() }));
    if (rooms.length === 0) return res.status(400).json({ error: "Paste at least one room's reviews first." });
    const total = rooms.reduce((sum, r) => sum + r.text.length, 0);
    if (total > MAX_TOTAL_PASTE) {
      return res.status(400).json({
        error: `That is ${total.toLocaleString()} characters in all — more than Claude can read at once (${MAX_TOTAL_PASTE.toLocaleString()}). Draft some rooms now and the rest after.`,
      });
    }

    const existing: any = await TTReviews.findOne({ host: hostId }, { draft: 1 }).lean();
    const d = existing?.draft;
    if (d?.status === "drafting" && d.startedAt && Date.now() - new Date(d.startedAt).getTime() < STALE_DRAFT_MS) {
      return res.status(409).json({ error: "A draft is already being written." });
    }

    const started = new Date();
    await TTReviews.updateOne(
      { host: hostId },
      { $set: { draft: { status: "drafting", startedAt: started, error: "", house: "", rooms: [], reviewsRead: 0 } } },
      { upsert: true },
    );
    res.status(202).json({ status: "drafting" });

    // Written back only onto THIS run's draft. A draft that outlived the
    // stale mark, was replaced by a newer one, or was overtaken by the host
    // publishing must not land on top of what came after it.
    const thisRun = { host: hostId, "draft.status": "drafting", "draft.startedAt": started };
    draft(rooms)
      .then((result) =>
        TTReviews.updateOne(
          thisRun,
          {
            $set: {
              draft: {
                status: "ready",
                startedAt: started,
                error: "",
                house: result.house,
                rooms: result.rooms.map((r) => ({ room: r.roomId, summary: r.summary })),
                reviewsRead: result.reviewsRead,
              },
            },
          },
        ),
      )
      .catch((error: any) =>
        TTReviews.updateOne(
          thisRun,
          { $set: { "draft.status": "failed", "draft.error": String(error?.message ?? "The draft failed.").slice(0, 300) } },
        ).catch(() => undefined),
      );
  } catch (error: any) {
    if (!res.headersSent) res.status(500).json({ error: error.message });
  }
});

// Publishing: what the host read, edited and approved becomes what guests see.
// Takes the TEXT from the request, not the stored draft, because the host's
// edits are the point of the step.
const MAX_SUMMARY = 1500;

router.put("/reviews", async (req: Request, res: any) => {
  const hostId = hostOf(req);
  const house = typeof req.body?.house === "string" ? req.body.house.trim().slice(0, MAX_SUMMARY) : "";
  const given = Array.isArray(req.body?.rooms) ? req.body.rooms : [];
  try {
    const ids = given.map((r: any) => r?.roomId).filter((id: any) => mongoose.isValidObjectId(id));
    const owned = new Set((await Room.find({ _id: { $in: ids }, host: hostId }, { _id: 1 }).lean()).map((r: any) => String(r._id)));
    const rooms = given
      .filter((r: any) => owned.has(String(r?.roomId)) && typeof r?.summary === "string" && r.summary.trim())
      .map((r: any) => ({ room: String(r.roomId), summary: r.summary.trim().slice(0, MAX_SUMMARY) }));

    await TTReviews.updateOne(
      { host: hostId },
      // Publishing clears the draft: it has become the published text.
      { $set: { published: { house, rooms, at: new Date() }, draft: { status: "none", house: "", rooms: [], error: "", reviewsRead: 0 } } },
      { upsert: true },
    );
    res.status(200).json(view(await TTReviews.findOne({ host: hostId }).lean()));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
