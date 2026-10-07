import express, { Request } from "express";
import mongoose from "mongoose";
import Room from "../model/roomSchema";
import TTQuestion from "../model/ttQuestionSchema";
import TTReviews from "../model/ttReviewsSchema";
import TTReviewSource from "../model/ttReviewSourceSchema";
import TTReviewEntry from "../model/ttReviewEntrySchema";
import Guest from "../model/guestSchema";
import { createHash } from "crypto";
import { requireManager } from "../middleware/requireManager";
import { questionStats } from "../util/ttQuestions";
import { draftReviewSummaries, MAX_TOTAL_PASTE, PastedRoom, ReviewDraft } from "../util/reviewDraft";
import { addPart, dropUpload, peekUpload, UploadError } from "../util/pasteUploads";

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
    // The kept review files, WITHOUT their text: the screen needs the name, size
    // and date to show what is on file, and nothing needs the reviewers' words.
    const sources = await TTReviewSource.find({ host: hostId }, { room: 1, name: 1, chars: 1, updatedAt: 1 }).lean();
    // The rooms to paste for, with their listing link so the screen can open
    // each listing's reviews in one tap. Name, id and link only — never the
    // door code the room record also carries.
    const rooms = await Room.find({ host: hostId, active: { $ne: false } }, { name: 1, airbnbUrl: 1 }).sort({ name: 1 }).lean();
    res.status(200).json({
      ...view(await TTReviews.findOne({ host: hostId }).lean()),
      sources: sources.map((r: any) => ({ roomId: String(r.room), name: r.name ?? "", chars: r.chars ?? 0, savedAt: r.updatedAt ?? null })),
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
// One small part of a review history. See util/pasteUploads: a request body of
// 8,192 bytes or more never reaches this server (CloudFront answers it with the
// website's home page), so a long paste is sent as many parts and assembled here.
router.post("/reviews/upload", async (req: Request, res: any) => {
  const hostId = hostOf(req);
  try {
    const { complete } = addPart(hostId, req.body ?? {});
    if (!complete) return res.status(200).json({ ok: true, saved: false });

    // The last part has landed: the whole text is kept as this room's review
    // file, replacing the last one (it is the newest set). Only for a room that
    // is this host's — the id in the body is not trusted.
    const up = peekUpload(hostId, String(req.body.uploadId));
    if (!mongoose.isValidObjectId(up.roomId) || !(await Room.exists({ _id: up.roomId, host: hostId }))) {
      dropUpload(hostId, String(req.body.uploadId));
      throw new UploadError("That is not one of your rooms.");
    }
    const text = up.text.trim();
    if (!text) {
      dropUpload(hostId, String(req.body.uploadId));
      throw new UploadError("That file is empty.");
    }
    if (text.length > MAX_TOTAL_PASTE) {
      dropUpload(hostId, String(req.body.uploadId));
      throw new UploadError(
        `That is ${text.length.toLocaleString()} characters — more than Claude can read at once (${MAX_TOTAL_PASTE.toLocaleString()}). Send fewer reviews for this room.`,
      );
    }
    await TTReviewSource.updateOne(
      { host: hostId, room: up.roomId },
      { $set: { name: up.name, chars: text.length, text } },
      { upsert: true },
    );
    dropUpload(hostId, String(req.body.uploadId));
    res.status(200).json({ ok: true, saved: true });
  } catch (error: any) {
    if (error instanceof UploadError) return res.status(400).json({ error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// ONE guest's review, passed in on its own. Small by design — 2,000 characters
// at most, so the request body stays under the 8 KB CloudFront will carry even
// when every character weighs three bytes (see util/pasteUploads).
//
// Kept twice, on purpose: as its own record (guest, stay, stars — the part a
// complaint or a 5-star reward is traced through) and appended to the room's
// review file, which is what drafting and Ask TiMag read. The same words pasted
// again are skipped, not added twice.
export const MAX_ENTRY_CHARS = 2000;

const hashOf = (text: string) => createHash("sha1").update(text.toLowerCase().replace(/\s+/g, " ").trim()).digest("hex");

router.post("/reviews/entry", async (req: Request, res: any) => {
  const hostId = hostOf(req);
  try {
    const { roomId, guestId, guestName, stayDate, stars } = req.body ?? {};
    const text = String(req.body?.text ?? "").trim();
    if (!text) return res.status(400).json({ error: "Paste the review first." });
    if (text.length > MAX_ENTRY_CHARS) {
      return res.status(400).json({
        error: `That review is ${text.length.toLocaleString()} characters; one review can be up to ${MAX_ENTRY_CHARS.toLocaleString()}. Trim it, or send it as a file.`,
      });
    }
    if (!mongoose.isValidObjectId(roomId) || !(await Room.exists({ _id: roomId, host: hostId }))) {
      return res.status(400).json({ error: "Which of your rooms is this review for?" });
    }
    if (stars != null && !(Number.isInteger(stars) && stars >= 1 && stars <= 5)) {
      return res.status(400).json({ error: "Stars are 1 to 5." });
    }
    if (stayDate && !/^\d{4}-\d{2}-\d{2}$/.test(String(stayDate))) {
      return res.status(400).json({ error: "The stay date should be a date." });
    }
    // A guest id is only believed if it is on THIS host's list.
    let guest: string | undefined;
    if (guestId) {
      if (!mongoose.isValidObjectId(guestId) || !(await Guest.exists({ _id: guestId, host: hostId }))) {
        return res.status(400).json({ error: "That guest isn't on your list." });
      }
      guest = String(guestId);
    }

    const hash = hashOf(text);
    if (await TTReviewEntry.exists({ host: hostId, room: roomId, hash })) {
      return res.status(200).json({ added: false, duplicate: true });
    }
    const who = String(guestName ?? "").trim().slice(0, 120);
    await TTReviewEntry.create({
      host: hostId,
      room: roomId,
      ...(guest ? { guest } : {}),
      guestName: who,
      stayDate: stayDate ? String(stayDate) : "",
      ...(stars != null ? { stars } : {}),
      text,
      hash,
    });

    // Appended to the room's file, headed with what is known about it, so a
    // draft or Ask TiMag reads it with its context.
    const head = [who && `Guest: ${who}`, stayDate && `Stay: ${stayDate}`, stars != null && `${stars} stars`]
      .filter(Boolean)
      .join(" · ");
    const block = head ? `— ${head} —\n${text}` : text;
    const file: any = await TTReviewSource.findOne({ host: hostId, room: roomId }, { text: 1 }).lean();
    const next = file?.text ? `${file.text}\n\n${block}` : block;
    if (next.length <= MAX_TOTAL_PASTE) {
      await TTReviewSource.updateOne(
        { host: hostId, room: roomId },
        { $set: { text: next, chars: next.length }, $setOnInsert: { name: "Guest reviews" } },
        { upsert: true },
      );
    }
    res.status(200).json({ added: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// The reviews on record, one per guest per room per stay — the structured copy
// the host reads back and Ask TiMag counts. A short snippet of each, not the
// whole text: the screen needs to recognise a review, not reread it.
router.get("/reviews/entries", async (req: Request, res: any) => {
  try {
    const rows: any[] = await TTReviewEntry.find({ host: hostOf(req) }).sort({ stayDate: -1, createdAt: -1 }).limit(500).lean();
    res.status(200).json({
      entries: rows.map((r) => ({
        id: String(r._id),
        roomId: String(r.room),
        guestName: r.guestName ?? "",
        stayDate: r.stayDate ?? "",
        stars: r.stars ?? null,
        snippet: String(r.text ?? "").slice(0, 160),
        addedAt: r.createdAt ?? null,
      })),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Takes a room's kept review file away. The host's call, any time.
router.delete("/reviews/source/:roomId", async (req: Request, res: any) => {
  try {
    if (!mongoose.isValidObjectId(req.params.roomId)) return res.status(400).json({ error: "Which room?" });
    await TTReviewSource.deleteOne({ host: hostOf(req), room: req.params.roomId });
    res.status(200).json({ ok: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/reviews/draft", async (req: Request, res: any) => {
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
    // Drafted from the review files KEPT for these rooms — sent earlier, in
    // parts (see /reviews/upload) — never from text in this request, which could
    // not carry them past CloudFront's 8 KB limit anyway. Only this host's own.
    const sources = await TTReviewSource.find({ host: hostId, room: { $in: [...names.keys()] } }, { room: 1, text: 1 }).lean();
    const rooms: PastedRoom[] = sources
      .map((r: any) => ({ roomId: String(r.room), name: names.get(String(r.room))!, text: String(r.text ?? "").trim() }))
      .filter((r: PastedRoom) => r.text);
    if (rooms.length === 0) return res.status(400).json({ error: "Choose or paste at least one room's reviews first." });
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
    // A missing, expired or foreign upload is the host's to fix, with words.
    if (error instanceof UploadError) return res.status(400).json({ error: error.message });
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
