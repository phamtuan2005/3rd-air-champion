import express, { Request } from "express";
import mongoose from "mongoose";
import Host from "../model/hostSchema";
import TTQuestion from "../model/ttQuestionSchema";
import TTReviews from "../model/ttReviewsSchema";
import { asCategory, scrubQuestion, storedQuestion } from "../util/ttQuestions";

// TiBook's TT talking to the server — PUBLIC, because the guest has no login.
//
//   POST /question  — a question a guest asked, and whether TT answered it.
//   GET  /reviews/:host — the review summaries the host PUBLISHED.
//
// The host's side (reading the questions, drafting and publishing summaries)
// is ttHostRoute, behind the JWT gate and requireManager.
//
// Not in GraphQL, for the reason tibookVisitRoute gives: /graphql has no login
// in front of it, and anything added to the schema can be read by anyone.
const router = express.Router();

// Anyone can write questions, so anyone can try to fill the log. Capped per
// address the way the stats viewer caps wrong codes: generous for a guest
// having a real conversation, a wall for a script.
//
// Generous because the "address" is not always one person: the app sets no
// `trust proxy`, so behind CloudFront `req.ip` is the edge the request came
// through, which many guests can share. Reaching the cap only stops LOGGING
// for the hour — no guest ever sees it.
const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_WINDOW = 200;
const recent = new Map<string, { count: number; since: number }>();
export const resetQuestionLimits = () => recent.clear(); // for tests

const overLimit = (ip: string) => {
  const now = Date.now();
  // Forget addresses whose hour is over, so the map holds at most an hour of
  // callers rather than every address that ever asked.
  if (recent.size > 1000) for (const [k, v] of recent) if (now - v.since > WINDOW_MS) recent.delete(k);
  const r = recent.get(ip);
  if (!r || now - r.since > WINDOW_MS) {
    recent.set(ip, { count: 1, since: now });
    return false;
  }
  r.count += 1;
  return r.count > MAX_PER_WINDOW;
};

router.post("/question", async (req: Request, res: any) => {
  const { host, question, answered, category, returning } = req.body ?? {};
  if (!mongoose.isValidObjectId(host) || typeof question !== "string" || typeof answered !== "boolean") {
    return res.status(400).json({ error: "host, question and answered are required" });
  }
  if (!scrubQuestion(question)) return res.status(400).json({ error: "An empty question is not kept" });
  const cat = asCategory(category);
  const text = storedQuestion(question, cat);

  // 204 rather than 429: TiBook fires and forgets, and the guest must never
  // see a log failing. The script hammering the route learns nothing either.
  if (overLimit(req.ip ?? "")) return res.status(204).end();

  try {
    // A made-up house would fill the collection with rows no screen shows.
    if (!(await Host.exists({ _id: host }))) return res.status(404).json({ error: "Unknown host" });
    await TTQuestion.create({
      host,
      question: text,
      answered,
      category: cat,
      returning: returning === true,
    });
    return res.status(204).end();
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

router.get("/reviews/:host", async (req: Request, res: any) => {
  const { host } = req.params;
  if (!mongoose.isValidObjectId(host)) return res.status(400).json({ error: "Unknown host" });
  try {
    // `published` only. The draft is the host's work in progress and may
    // still say something the host is about to take out.
    const doc: any = await TTReviews.findOne({ host }, { published: 1 }).lean();
    const p = doc?.published;
    return res.status(200).json({
      house: p?.house ?? "",
      rooms: (p?.rooms ?? [])
        .filter((r: any) => r?.room && r.summary)
        .map((r: any) => ({ roomId: String(r.room), summary: r.summary })),
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
