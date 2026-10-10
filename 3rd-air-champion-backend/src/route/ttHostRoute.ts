import express, { Request } from "express";
import mongoose from "mongoose";
import Room from "../model/roomSchema";
import TTQuestion from "../model/ttQuestionSchema";
import TTReviews from "../model/ttReviewsSchema";
import TTReviewSource from "../model/ttReviewSourceSchema";
import TTReviewEntry from "../model/ttReviewEntrySchema";
import { fileBlock, latestFromEntries, MAX_ENTRY_CHARS, newestFirst, roomTextsFromEntries, saveEntry, withoutBlock } from "../util/reviewEntries";
import { occurrenceKey, occurrences, splitReviews, SplitReview } from "../util/reviewSplit";
import { lowReviews, recentReviews, roomAverages, ReviewRow, topicMentions } from "../util/reviewStats";
import { cleanerLeads } from "../util/reviewCleaners";
import Guest from "../model/guestSchema";
import { requireManager } from "../middleware/requireManager";
import { questionStats } from "../util/ttQuestions";
import { draftReviewSummaries, MAX_TOTAL_PASTE, PastedRoom, ReviewDraft } from "../util/reviewDraft";
import { addPart, dropUpload, peekUpload, UploadError } from "../util/pasteUploads";
import { lookupReviewStay } from "../util/reviewStayLookup";

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
  const rooms = (set: any) =>
    (set?.rooms ?? []).map((r: any) => ({
      roomId: String(r.room),
      summary: r.summary ?? "",
      latest: r.latest ?? "",
      latestMonth: r.latestMonth ?? "",
      latestStars: r.latestStars ?? null,
    }));
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
    // Pages waiting to be split, WITHOUT their text: the screen needs the name,
    // size and date, and nothing needs the reviewers' words.
    const sources = await TTReviewSource.find({ host: hostId }, { room: 1, name: 1, chars: 1, updatedAt: 1 }).lean();
    // The rooms to paste for, with their listing link so the screen can open
    // each listing's reviews in one tap, and its colour so the room looks the
    // same here as everywhere else in Ti. Name, id, link and colour only — never the
    // door code the room record also carries.
    const rooms = await Room.find({ host: hostId, active: { $ne: false } }, { name: 1, airbnbUrl: 1, color: 1 }).sort({ name: 1 }).lean();
    // How many reviews each room has on record — what a draft reads.
    const counts = await TTReviewEntry.aggregate([
      { $match: { host: new mongoose.Types.ObjectId(hostId) } },
      { $group: { _id: "$room", count: { $sum: 1 } } },
    ]);
    res.status(200).json({
      onRecord: counts.map((c: any) => ({ roomId: String(c._id), count: c.count })),
      ...view(await TTReviews.findOne({ host: hostId }).lean()),
      sources: sources.map((r: any) => ({ roomId: String(r.room), name: r.name ?? "", chars: r.chars ?? 0, savedAt: r.updatedAt ?? null })),
      houseRooms: rooms.map((r: any) => ({ roomId: String(r._id), name: r.name ?? "", airbnbUrl: r.airbnbUrl ?? "", color: r.color ?? "" })),
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
router.post("/reviews/entry", async (req: Request, res: any) => {
  const hostId = hostOf(req);
  try {
    const { roomId, guestId, guestName, stayDate, stars, reviewMonth } = req.body ?? {};
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
    if (reviewMonth && !/^\d{4}-(0[1-9]|1[0-2])$/.test(String(reviewMonth))) {
      return res.status(400).json({ error: "The review month should be a month." });
    }
    // A guest id is only believed if it is on THIS host's list.
    let guest: string | undefined;
    if (guestId) {
      if (!mongoose.isValidObjectId(guestId) || !(await Guest.exists({ _id: guestId, host: hostId }))) {
        return res.status(400).json({ error: "That guest isn't on your list." });
      }
      guest = String(guestId);
    }

    const { added } = await saveEntry(
      hostId,
      {
        roomId: String(roomId),
        guest,
        guestName: String(guestName ?? "").trim().slice(0, 120),
        stayDate: stayDate ? String(stayDate) : "",
        reviewMonth: reviewMonth ? String(reviewMonth) : "",
        stars: stars ?? null,
        text,
      },
      // The individual reviews are the record; nothing reads a page now.
      { appendToFile: false },
    );
    res.status(200).json(added ? { added: true } : { added: false, duplicate: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ── Splitting a pasted page into individual reviews ───────────────────────────
//
// The host pastes a whole page of reviews (select all, copy, on AirBnB), it is
// kept as the room's review file, and this has Claude find the reviews in it:
// who, how many stars, which month, the words. Nothing is saved until the host
// has seen what was found and says so. Held in memory (a restart loses a split
// the host can simply run again) and dropped after an hour.
interface SplitJob {
  status: "running" | "ready" | "failed";
  done: number;
  total: number;
  reviews: SplitReview[];
  error: string;
  at: number;
}
const splitJobs = new Map<string, SplitJob>();
const JOB_TTL_MS = 60 * 60 * 1000;
const jobKey = (host: string, room: string) => `${host}:${room}`;
const sweepJobs = () => {
  const cutoff = Date.now() - JOB_TTL_MS;
  for (const [k, j] of splitJobs) if (j.at < cutoff) splitJobs.delete(k);
};

// Swapped in tests; the real one calls Claude.
let splitter: (text: string, onProgress: (done: number, total: number) => void) => Promise<SplitReview[]> = (text, onProgress) =>
  splitReviews(text, onProgress);
let splitterNeedsKey = true;
export const setReviewSplitter = (fn: typeof splitter) => {
  splitter = fn;
  splitterNeedsKey = false;
};

router.post("/reviews/split", async (req: Request, res: any) => {
  const hostId = hostOf(req);
  try {
    if (splitterNeedsKey && !process.env.ANTHROPIC_API_KEY) {
      return res.status(503).json({ error: "Splitting needs ANTHROPIC_API_KEY on the server." });
    }
    sweepJobs();
    const roomId = String(req.body?.roomId ?? "");
    if (!mongoose.isValidObjectId(roomId) || !(await Room.exists({ _id: roomId, host: hostId }))) {
      return res.status(400).json({ error: "Which of your rooms?" });
    }
    const file: any = await TTReviewSource.findOne({ host: hostId, room: roomId }, { text: 1 }).lean();
    if (!file?.text?.trim()) return res.status(400).json({ error: "Choose or paste this room's reviews first." });
    const key = jobKey(hostId, roomId);
    if (splitJobs.get(key)?.status === "running") return res.status(409).json({ error: "Already reading this room's reviews." });

    const job: SplitJob = { status: "running", done: 0, total: 0, reviews: [], error: "", at: Date.now() };
    splitJobs.set(key, job);
    res.status(202).json({ status: "running" });

    splitter(String(file.text), (done, total) => {
      job.done = done;
      job.total = total;
    })
      .then((reviews) => {
        job.reviews = reviews;
        job.status = "ready";
      })
      .catch((error: any) => {
        job.status = "failed";
        job.error = String(error?.message ?? "The split failed.").slice(0, 300);
      })
      .finally(() => {
        job.at = Date.now();
      });
  } catch (error: any) {
    if (!res.headersSent) res.status(500).json({ error: error.message });
  }
});

// Where the split has got to, and — once ready — what it found, each marked if
// the same words are already on file for the room (the host sees what an Add all
// would skip before pressing it).
router.get("/reviews/split/:roomId", async (req: Request, res: any) => {
  const hostId = hostOf(req);
  try {
    sweepJobs();
    const job = splitJobs.get(jobKey(hostId, req.params.roomId));
    if (!job) return res.status(200).json({ status: "none" });
    if (job.status !== "ready") {
      return res.status(200).json({ status: job.status, done: job.done, total: job.total, error: job.error });
    }
    const have = new Set(
      (await TTReviewEntry.find({ host: hostId, room: req.params.roomId }, { hash: 1 }).lean()).map((e: any) => e.hash),
    );
    const copy = occurrences(job.reviews.map((r) => r.text));
    res.status(200).json({
      status: "ready",
      done: job.done,
      total: job.total,
      reviews: job.reviews.map((r, i) => ({
        guestName: r.guestName,
        stars: r.stars,
        month: r.month,
        when: r.when,
        snippet: r.text.slice(0, 160),
        onFile: have.has(occurrenceKey(r.text, copy[i])),
      })),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Keeps what the split found. Every review, none a second time: the ones
// already on file are counted as skipped, not added again.
router.post("/reviews/split/:roomId/add", async (req: Request, res: any) => {
  const hostId = hostOf(req);
  try {
    const roomId = req.params.roomId;
    const key = jobKey(hostId, roomId);
    const job = splitJobs.get(key);
    if (!job || job.status !== "ready") return res.status(400).json({ error: "There is nothing to add. Split the reviews first." });
    if (!mongoose.isValidObjectId(roomId) || !(await Room.exists({ _id: roomId, host: hostId }))) {
      return res.status(400).json({ error: "Which of your rooms?" });
    }
    // Matched to the host's guest list by exact name, where there is one. A
    // first name that matches two guests is NOT guessed at — it stays a name.
    const guests: any[] = await Guest.find({ host: hostId }, { name: 1 }).lean();
    const byName = new Map<string, string[]>();
    for (const g of guests) {
      const k = String(g.name ?? "").trim().toLowerCase();
      if (k) byName.set(k, [...(byName.get(k) ?? []), String(g._id)]);
    }
    let added = 0;
    let skipped = 0;
    const copy = occurrences(job.reviews.map((r) => r.text));
    for (const [i, r] of job.reviews.entries()) {
      const ids = byName.get(r.guestName.trim().toLowerCase()) ?? [];
      const { added: ok } = await saveEntry(
        hostId,
        {
          roomId,
          guest: ids.length === 1 ? ids[0] : undefined,
          guestName: r.guestName,
          stayDate: "",
          reviewMonth: r.month,
          stars: r.stars,
          text: r.text.slice(0, MAX_ENTRY_CHARS),
          occurrence: copy[i],
        },
        // The reviews came OUT of the room's file; writing them back would
        // put each in it twice.
        { appendToFile: false },
      );
      if (ok) added++;
      else skipped++;
    }
    splitJobs.delete(key);
    // The page was only the way in: its reviews are on record now, each on its
    // own, so the page is cleared — the reviewers' words are kept once. The
    // host's own copy (King.txt and the like) is untouched.
    await TTReviewSource.deleteOne({ host: hostId, room: roomId });
    res.status(200).json({ added, skipped });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Drops a split the host does not want to keep.
router.delete("/reviews/split/:roomId", (req: Request, res: any) => {
  splitJobs.delete(jobKey(hostOf(req), req.params.roomId));
  res.status(200).json({ ok: true });
});

// What the reviews add up to — averages, the low ones and who cleaned those
// rooms, and how many mention a topic. Worked out here from the records, by
// arithmetic and a lookup in the cleaning rota: TiMag's TT box shows it with no
// model involved, so a simple question costs nothing and answers at once.
router.get("/reviews/stats", async (req: Request, res: any) => {
  const hostId = hostOf(req);
  try {
    const [entries, rooms, reviews]: [any[], any[], any] = await Promise.all([
      TTReviewEntry.find({ host: hostId }).lean() as any,
      Room.find({ host: hostId }, { name: 1 }).lean() as any,
      TTReviews.findOne({ host: hostId }, { published: 1 }).lean(),
    ]);
    const nameOf = new Map(rooms.map((r) => [String(r._id), String(r.name ?? "")]));
    const rows: ReviewRow[] = entries.map((e) => ({
      room: String(e.room),
      roomName: nameOf.get(String(e.room)) ?? "a room",
      guestName: e.guestName ?? "",
      stars: e.stars ?? null,
      stayDate: e.stayDate ?? "",
      reviewMonth: e.reviewMonth ?? "",
      text: String(e.text ?? ""),
    }));

    const low = lowReviews(rows);
    const recent = recentReviews(rows);
    // Who cleaned each listed review's room around then: one read of the rota
    // across the whole span, then matched in memory. A LEAD, not proof — a month
    // (or a night) is all a review says — so each row says which it was.
    const listed = [...low, ...recent];
    const leads = await cleanerLeads(hostId, listed);
    const withLead = (r: ReviewRow, i: number) => {
      return {
        roomName: r.roomName,
        guestName: r.guestName,
        stars: r.stars,
        stayDate: r.stayDate,
        reviewMonth: r.reviewMonth,
        snippet: r.text.slice(0, 160),
        // The whole review, for a tap that opens it in TiMag — the snippet cut
        // a long one off mid-word with no way to read on (host, 2026-10-08).
        // Entries are capped at 2,000 characters when saved.
        text: r.text,
        // Who cleaned the room then, and on what basis (util/reviewCleaners).
        ...leads[i],
      };
    };
    const lowOut = low.map((r, i) => withLead(r, i));
    const recentOut = recent.map((r, i) => withLead(r, low.length + i));

    res.status(200).json({
      total: rows.length,
      rooms: roomAverages(rows),
      low: lowOut,
      recent: recentOut,
      topic: req.query.topic ? topicMentions(rows, String(req.query.topic)) : null,
      // What TiBook's TT tells guests, word for word — so the host reads in TiMag
      // exactly what a guest is shown. Already written and published; no model.
      published: {
        house: reviews?.published?.house ?? "",
        rooms: (reviews?.published?.rooms ?? [])
          .filter((r: any) => String(r.summary ?? "").trim())
          .map((r: any) => ({ room: String(r.room), name: nameOf.get(String(r.room)) ?? "a room", summary: String(r.summary) })),
        at: reviews?.published?.at ?? null,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// The reviews on record, one per guest per room per stay — the structured copy
// the host reads back and Ask TiMag counts. A short snippet of each, not the
// whole text: the screen needs to recognise a review, not reread it.
// The stay a review is about, from the bookings: the guest's first name, the
// room, and the review's month (util/reviewStay has the rules). The one-guest
// form asks as soon as a pasted review gives it a name, and fills the stay
// date — the host only checks it (host, 2026-10-10).
router.get("/reviews/stay", async (req: Request, res: any) => {
  const roomId = String(req.query.roomId ?? "");
  const name = String(req.query.name ?? "").trim();
  const month = String(req.query.month ?? "");
  if (!mongoose.isValidObjectId(roomId) || !name || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    return res.status(200).json(null);
  }
  try {
    res.status(200).json(await lookupReviewStay(hostOf(req), roomId, name, month));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/reviews/entries", async (req: Request, res: any) => {
  try {
    // Sorted here, by the review's own date (newestFirst), because most reviews
    // carry only a month — a database sort on stayDate left them unordered.
    // `q`: a search (host, 2026-10-10: "some tool to search for a review").
    // Every word must appear — in the guest's name, the review's words or its
    // dates — and the full text is searched here, since the list carries only
    // the first 160 characters of each.
    const words = String(req.query.q ?? "").toLowerCase().split(/\s+/).filter(Boolean).slice(0, 8);
    const hay = (r: any) => `${r.guestName ?? ""} ${r.text ?? ""} ${r.stayDate ?? ""} ${r.reviewMonth ?? ""}`.toLowerCase();
    const rows: any[] = (await TTReviewEntry.find({ host: hostOf(req) }).lean())
      .filter((r) => words.every((w) => hay(r).includes(w)))
      .sort(newestFirst)
      .slice(0, 2000);
    // On a search, the preview starts near the first match in the words, so the
    // host sees WHY the review came up rather than its unrelated first line.
    const snippetOf = (text: string) => {
      const at = words.length ? text.toLowerCase().indexOf(words[0]) : -1;
      if (at < 60) return text.slice(0, 160);
      return `…${text.slice(at - 40, at + 120)}`;
    };
    // Who cleaned each review's room then — the same lead TT gives (host,
    // 2026-10-10: "show under each review who the cleaner was").
    const leads = await cleanerLeads(
      hostOf(req),
      rows.map((r) => ({ room: String(r.room), stayDate: r.stayDate ?? "", reviewMonth: r.reviewMonth ?? "" })),
    );
    res.status(200).json({
      entries: rows.map((r, i) => ({
        ...leads[i],
        id: String(r._id),
        roomId: String(r.room),
        guestName: r.guestName ?? "",
        stayDate: r.stayDate ?? "",
        reviewMonth: r.reviewMonth ?? "",
        stars: r.stars ?? null,
        snippet: snippetOf(String(r.text ?? "")),
        // The whole review: the list shows each one in full rather than a
        // line and a tap to open (host, 2026-10-10). At most 2,000 characters
        // each when saved, and a host has a few hundred.
        text: String(r.text ?? ""),
        addedAt: r.createdAt ?? null,
      })),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// One review in full, for the host who taps it in the list (which carries only
// a snippet of each, so the list stays small however many there are).
router.get("/reviews/entry/:id", async (req: Request, res: any) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: "Which review?" });
    const e: any = await TTReviewEntry.findOne({ _id: req.params.id, host: hostOf(req) }).lean();
    if (!e) return res.status(404).json({ error: "That review is not on file." });
    res.status(200).json({
      id: String(e._id),
      roomId: String(e.room),
      guestName: e.guestName ?? "",
      stayDate: e.stayDate ?? "",
      reviewMonth: e.reviewMonth ?? "",
      stars: e.stars ?? null,
      text: String(e.text ?? ""),
      addedAt: e.createdAt ?? null,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Corrects ONE review: the guest's name, the stars, the month, the words. A
// pasted AirBnB review can arrive without the reviewer's name — the copy picked
// up "Sacramento, California" where the name should be (host, 2026-10-08) — and
// deleting and re-adding it would lose when it was added.
//
// The duplicate key (`hash`) is left as it was: it is what stops the same
// review being added twice when the page is pasted again, and that page still
// carries the words as first saved.
router.patch("/reviews/entry/:id", async (req: Request, res: any) => {
  const hostId = hostOf(req);
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: "Which review?" });
    const entry: any = await TTReviewEntry.findOne({ _id: req.params.id, host: hostId }).lean();
    if (!entry) return res.status(404).json({ error: "That review is not on file." });
    const { guestName, stars, reviewMonth } = req.body ?? {};
    const text = String(req.body?.text ?? "").trim();
    if (!text) return res.status(400).json({ error: "A review needs its words." });
    if (text.length > MAX_ENTRY_CHARS) {
      return res.status(400).json({ error: `One review can be up to ${MAX_ENTRY_CHARS.toLocaleString()} characters.` });
    }
    if (stars != null && !(Number.isInteger(stars) && stars >= 1 && stars <= 5)) {
      return res.status(400).json({ error: "Stars are 1 to 5." });
    }
    if (reviewMonth && !/^\d{4}-(0[1-9]|1[0-2])$/.test(String(reviewMonth))) {
      return res.status(400).json({ error: "The review month should be a month." });
    }
    // The stay date, when sent: editing now happens in the add form, which
    // finds and shows it (host, 2026-10-10). Left as it was when not sent.
    const sentStay = req.body && "stayDate" in req.body;
    const stayDate = sentStay ? String(req.body.stayDate ?? "") : String(entry.stayDate ?? "");
    if (stayDate && !/^\d{4}-\d{2}-\d{2}$/.test(stayDate)) {
      return res.status(400).json({ error: "The stay date should be a date." });
    }
    const next = {
      guestName: String(guestName ?? "").trim().slice(0, 120),
      stars: stars ?? null,
      reviewMonth: reviewMonth ? String(reviewMonth) : "",
      stayDate,
      text,
    };
    await TTReviewEntry.updateOne({ _id: entry._id, host: hostId }, { $set: next });

    // Old reviews were also written into the room's file; keep that copy in
    // step, and only by swapping the exact block the form wrote.
    if (entry.inFile !== false) {
      const file: any = await TTReviewSource.findOne({ host: hostId, room: entry.room }, { text: 1 }).lean();
      const before = fileBlock({
        guestName: entry.guestName ?? "",
        stayDate: entry.stayDate ?? "",
        reviewMonth: entry.reviewMonth ?? "",
        stars: entry.stars ?? null,
        text: String(entry.text ?? ""),
      });
      const after = fileBlock(next);
      const t = file?.text ? String(file.text) : "";
      if (t.includes(before)) {
        const updated = t.replace(before, after);
        await TTReviewSource.updateOne({ host: hostId, room: entry.room }, { $set: { text: updated, chars: updated.length } });
      }
    }
    res.status(200).json({
      id: String(entry._id),
      roomId: String(entry.room),
      addedAt: entry.createdAt ?? null,
      ...next,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Takes ONE review off the record — one saved wrong (a whole copied block where
// a review should be, the wrong room). Its words come back out of the room's
// file too when they were written into it, and only as the whole block that was
// written, so a pasted page is never cut into.
router.delete("/reviews/entry/:id", async (req: Request, res: any) => {
  const hostId = hostOf(req);
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: "Which review?" });
    const entry: any = await TTReviewEntry.findOne({ _id: req.params.id, host: hostId }).lean();
    if (!entry) return res.status(404).json({ error: "That review is not on file." });
    await TTReviewEntry.deleteOne({ _id: entry._id, host: hostId });

    // Old reviews carry no inFile flag; the block test below is what keeps
    // those safe — it only matches what the form itself wrote.
    if (entry.inFile !== false) {
      const file: any = await TTReviewSource.findOne({ host: hostId, room: entry.room }, { text: 1 }).lean();
      const block = fileBlock({
        guestName: entry.guestName ?? "",
        stayDate: entry.stayDate ?? "",
        reviewMonth: entry.reviewMonth ?? "",
        stars: entry.stars ?? null,
        text: String(entry.text ?? ""),
      });
      const next = file?.text ? withoutBlock(String(file.text), block) : null;
      if (next != null) {
        if (next.trim()) await TTReviewSource.updateOne({ host: hostId, room: entry.room }, { $set: { text: next, chars: next.length } });
        else await TTReviewSource.deleteOne({ host: hostId, room: entry.room });
      }
    }
    res.status(200).json({ ok: true });
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
    // No rooms named = every room. A named room that is not the host's is
    // dropped, not trusted.
    const ids = pasted.map((r: any) => r?.roomId).filter((id: any) => mongoose.isValidObjectId(id));
    const owned = await Room.find({ host: hostId, ...(ids.length ? { _id: { $in: ids } } : {}) }, { name: 1 }).lean();
    const names = new Map(owned.map((r: any) => [String(r._id), String(r.name ?? "")]));
    // Drafted from the INDIVIDUAL reviews on record — the house's one record of
    // what guests said — never from a pasted page, which can drift from it.
    const texts = await roomTextsFromEntries(hostId, [...names.keys()]);
    const latest = await latestFromEntries(hostId, [...names.keys()]);
    const rooms: PastedRoom[] = [...texts]
      .map(([roomId, text]) => ({
        roomId,
        name: names.get(roomId)!,
        text: text.trim(),
        ...(latest.has(roomId) ? { latest: latest.get(roomId) } : {}),
      }))
      .filter((r: PastedRoom) => r.text);
    if (rooms.length === 0) return res.status(400).json({ error: "There are no reviews on record yet. Add them first." });
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
                rooms: result.rooms.map((r) => ({
                  room: r.roomId,
                  summary: r.summary,
                  latest: r.latest,
                  latestMonth: r.latestMonth,
                  ...(r.latestStars != null ? { latestStars: r.latestStars } : {}),
                })),
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
    const text = (v: unknown) => (typeof v === "string" ? v.trim().slice(0, MAX_SUMMARY) : "");
    const rooms = given
      .filter((r: any) => owned.has(String(r?.roomId)) && (text(r?.summary) || text(r?.latest)))
      .map((r: any) => {
        // The latest review's month and stars came from the record with the
        // draft and ride back with the host's edit. A latest with no valid
        // month is not published: TT would be calling an undated review the
        // latest.
        const month = typeof r.latestMonth === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(r.latestMonth) ? r.latestMonth : "";
        const latest = month ? text(r.latest) : "";
        const stars = Number.isInteger(r.latestStars) && r.latestStars >= 1 && r.latestStars <= 5 ? r.latestStars : null;
        return {
          room: String(r.roomId),
          summary: text(r.summary),
          latest,
          latestMonth: latest ? month : "",
          ...(latest && stars != null ? { latestStars: stars } : {}),
        };
      });

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
