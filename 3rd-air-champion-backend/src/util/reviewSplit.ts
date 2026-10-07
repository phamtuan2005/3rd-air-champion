import Anthropic from "@anthropic-ai/sdk";
import { createHash } from "crypto";

// Claude reads a page of reviews copied from AirBnB and hands back each review
// on its own: who wrote it, how many stars, which month, and the words.
//
// Why a model and not a parser: what select-all-and-copy gives depends on
// AirBnB's page, which changes, and on whether the stars survive the copy as
// text or vanish. A parser written against one layout fails quietly the day it
// changes; a model is told what to look for and copes with a different layout.
// The host SEES what it found before anything is saved (a preview), so a wrong
// split is caught by eye, not trusted.

const MODEL = "claude-opus-5-5";

export interface SplitReview {
  guestName: string;
  /** 1-5, or null when the pasted text did not say. */
  stars: number | null;
  /** yyyy-MM, or "" when the review shows no usable date. APPROXIMATE for a relative date. */
  month: string;
  /** The date exactly as the page showed it: "1 week ago", "February 2025". */
  when: string;
  text: string;
}

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

const ym = (year: number, month0: number) => `${year}-${String(month0 + 1).padStart(2, "0")}`;

/**
 * The month a review's date points at, as yyyy-MM, from the date as AirBnB
 * printed it. Two shapes:
 *  - "February 2025": exact, taken as it is.
 *  - "1 week ago", "3 months ago", "2 years ago", "yesterday": counted back from
 *    `today` - the day the host pastes, which is the day he copied, so it is
 *    right to within the unit it was given in (a week, a month).
 * Anything else is "": better no month than an invented one.
 *
 * Calendar arithmetic on the UTC fields, as everywhere in this app (dates are
 * keyed by UTC day), never through a local timezone.
 */
export const monthFromShown = (shown: string, today: Date): string => {
  const t = shown.trim().toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
  const exact = t.match(/^([a-z]+) (\d{4})$/);
  if (exact) {
    const m = MONTHS.indexOf(exact[1]);
    return m >= 0 ? ym(Number(exact[2]), m) : "";
  }
  if (t === "today" || t === "yesterday") {
    const d = new Date(today.getTime() - (t === "yesterday" ? 86_400_000 : 0));
    return ym(d.getUTCFullYear(), d.getUTCMonth());
  }
  const rel = t.match(/^(a|an|\d+) (day|week|month|year)s? ago$/);
  if (!rel) return "";
  const n = rel[1] === "a" || rel[1] === "an" ? 1 : Number(rel[1]);
  const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  if (rel[2] === "day") d.setUTCDate(d.getUTCDate() - n);
  else if (rel[2] === "week") d.setUTCDate(d.getUTCDate() - 7 * n);
  else if (rel[2] === "month") d.setUTCMonth(d.getUTCMonth() - n);
  else d.setUTCFullYear(d.getUTCFullYear() - n);
  return ym(d.getUTCFullYear(), d.getUTCMonth());
};

// One review per request would be hundreds of calls; the whole page in one
// would overrun the reply. About 24,000 characters in, about as much out, fits.
export const CHUNK_CHARS = 24_000;
// Each chunk starts this far back into the last, so a review the cut fell
// through the middle of appears whole in the next one. The repeat is removed by
// hashOf below.
export const OVERLAP_CHARS = 2_000;

export const hashOf = (text: string) =>
  createHash("sha1").update(text.toLowerCase().replace(/\s+/g, " ").trim()).digest("hex");

/** The text in chunks cut at line ends, each overlapping the one before. */
export const chunkText = (text: string): string[] => {
  const lines = text.split("\n");
  const chunks: string[] = [];
  let i = 0;
  while (i < lines.length) {
    let size = 0;
    let end = i;
    while (end < lines.length && (size + lines[end].length + 1 <= CHUNK_CHARS || end === i)) {
      size += lines[end].length + 1;
      end++;
    }
    chunks.push(lines.slice(i, end).join("\n"));
    if (end >= lines.length) break;
    // Step back by the overlap, but always forward overall.
    let back = end;
    let kept = 0;
    while (back > i + 1 && kept + lines[back - 1].length + 1 <= OVERLAP_CHARS) {
      kept += lines[back - 1].length + 1;
      back--;
    }
    i = back;
  }
  return chunks;
};

const systemPrompt = [
  "You split text copied from an AirBnB listing's reviews into the individual reviews in it.",
  "",
  "As copied, each review usually looks like this (the first line may be cut short):",
  "  Leidy Johanna",
  "  Medellin, Colombia",
  "  Leidy Johanna",
  "  Rating, 5 stars",
  "  ,.",
  "  1 week ago",
  "  ,.",
  "  Stayed one night",
  "  From the moment we opened the door ... Thank you, Anh.",
  "That is: the reviewer's name, their city, the name again, the star line, the date, how long they stayed, then the review itself.",
  "Treat that as a guide, not a rule; the order can differ and parts can be missing.",
  "",
  "For each guest review return:",
  "- guestName: the reviewer's name as written (the first name or full name on the name line). Empty if none.",
  "- stars: 1 to 5 ONLY if the text for that review says so ('Rating, 5 stars', '5 stars', or star symbols). Otherwise 0. Never guess.",
  "- when: the date exactly as printed for that review, such as '1 week ago', '3 months ago' or 'February 2025'. Empty if none is shown.",
  "- text: what the guest wrote, copied exactly, character for character. Do not paraphrase, correct, translate or shorten it.",
  "",
  "Leave out everything that is not a guest's own words: the host's replies ('Response from ...'), buttons and labels ('Show more', 'Translate'), the city and country, the stray punctuation marks, the star line, the date, and the line that says how long they stayed.",
  "The text may begin or end part-way through a review. Skip a review that is cut off at the very start or very end - it will appear whole elsewhere.",
  "If there are no reviews in the text, return an empty list.",
].join("\n");

const outputSchema = {
  type: "object",
  properties: {
    reviews: {
      type: "array",
      items: {
        type: "object",
        properties: {
          guestName: { type: "string" },
          stars: { type: "integer" },
          when: { type: "string" },
          text: { type: "string" },
        },
        required: ["guestName", "stars", "when", "text"],
        additionalProperties: false,
      },
    },
  },
  required: ["reviews"],
  additionalProperties: false,
};

const readChunk = async (chunk: string, client: Pick<Anthropic, "beta">, today: Date): Promise<SplitReview[]> => {
  const response = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 16000,
    // Copying text out is routine; low effort is enough and keeps it cheap.
    output_config: { effort: "low", format: { type: "json_schema", schema: outputSchema } },
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: systemPrompt,
    messages: [{ role: "user", content: chunk }],
  });
  if (response.stop_reason === "refusal") throw new Error("Claude declined to read these reviews.");
  if (response.stop_reason === "max_tokens") throw new Error("A part of the page held too many reviews to read at once.");
  const raw = (response.content ?? [])
    .filter((b: any) => b.type === "text")
    .map((b: any) => b.text)
    .join("");
  const parsed = JSON.parse(raw);
  return (Array.isArray(parsed.reviews) ? parsed.reviews : []).map((r: any) => {
    const when = String(r?.when ?? "").trim().slice(0, 40);
    return {
      guestName: String(r?.guestName ?? "").trim().slice(0, 120),
      stars: Number.isInteger(r?.stars) && r.stars >= 1 && r.stars <= 5 ? r.stars : null,
      // The model reports the date as printed; the month is worked out HERE, so
      // a wrong guess at arithmetic cannot become a wrong month.
      month: monthFromShown(when, today),
      when,
      text: String(r?.text ?? "").trim(),
    };
  });
};

/**
 * Every review in the text, once each, in the order they appear.
 *
 * `client` is injectable so this can be tested without the network.
 * `onProgress` hears how many parts are done of how many.
 */
export const splitReviews = async (
  text: string,
  onProgress?: (done: number, total: number) => void,
  client: Pick<Anthropic, "beta"> = new Anthropic(),
  today: Date = new Date(),
): Promise<SplitReview[]> => {
  const chunks = chunkText(text);
  const seen = new Set<string>();
  const out: SplitReview[] = [];
  onProgress?.(0, chunks.length);
  for (let i = 0; i < chunks.length; i++) {
    for (const r of await readChunk(chunks[i], client, today)) {
      if (!r.text) continue;
      // The overlap shows the same review twice; keep the first.
      const h = hashOf(r.text);
      if (seen.has(h)) continue;
      seen.add(h);
      out.push(r);
    }
    onProgress?.(i + 1, chunks.length);
  }
  return out;
};
