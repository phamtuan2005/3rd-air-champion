import Anthropic from "@anthropic-ai/sdk";
import crypto from "crypto";
import mongoose from "mongoose";
import Room from "../model/roomSchema";
import TTReviews from "../model/ttReviewsSchema";
import TTTranslation from "../model/ttTranslationSchema";
import { latestFromEntries } from "./reviewEntries";

// TiBook's review texts in the guest's language. See ttTranslationSchema for
// why: translated once, when the HOST changes the reviews, and read by guests.

// TiBook's languages besides English (frontend src/i18n). A guest in any
// other language gets the English.
export const REVIEW_LANGS: Record<string, string> = {
  zh: "Simplified Chinese",
  vi: "Vietnamese",
  ko: "Korean",
  es: "Spanish",
  de: "German",
};

const MODEL = "claude-opus-5-5";

export const textKey = (text: string) => crypto.createHash("sha1").update(text.trim()).digest("hex");

// The latest review as TiBook shows it: capped, so a long review stays a chat
// message. The guest route and the translator both cut it HERE, so what gets
// translated is exactly what a guest is shown.
const LATEST_CHARS = 600;
export const guestLatestText = (text: string) => {
  const t = text.trim();
  return t.length > LATEST_CHARS ? `${t.slice(0, LATEST_CHARS).replace(/\s+\S*$/, "")}…` : t;
};

// Every review text a guest of this host can be shown.
export const guestReviewTexts = async (hostId: string): Promise<string[]> => {
  const [doc, newest]: [any, Awaited<ReturnType<typeof latestFromEntries>>] = await Promise.all([
    TTReviews.findOne({ host: hostId }, { published: 1 }).lean(),
    latestFromEntries(hostId),
  ]);
  const p = doc?.published;
  const texts = [
    p?.house ?? "",
    ...(p?.rooms ?? []).map((r: any) => r?.summary ?? ""),
    ...[...newest.values()].map((l) => guestLatestText(l.text)),
  ];
  return [...new Set(texts.map((t) => String(t).trim()).filter(Boolean))];
};

export type ReviewTranslator = (texts: string[], language: string, roomNames: string[]) => Promise<string[]>;

/** One call per language, carrying every text that language is still missing. */
export const translateWithClaude = async (
  texts: string[],
  language: string,
  roomNames: string[],
  client: Pick<Anthropic, "beta"> = new Anthropic(),
): Promise<string[]> => {
  const response = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 16000,
    // Translation is routine work; low effort, said out loud so a later model
    // change does not silently move it.
    output_config: {
      effort: "low",
      format: {
        type: "json_schema",
        schema: {
          type: "object",
          properties: { translations: { type: "array", items: { type: "string" } } },
          required: ["translations"],
          additionalProperties: false,
        },
      },
    },
    // Reviews can quote anything; a decline retries on the default fallback
    // model inside the same call rather than leaving guests on English.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system:
      `You translate guest reviews of a small guest house, and the host's summaries of them, into ${language}, for guests reading them on the house's booking page. ` +
      `Translate faithfully: keep the meaning and the tone, add nothing, soften nothing. ` +
      `Keep these room names exactly as written, in English and untranslated, because the page colours them: ${roomNames.join(", ")}. ` +
      `Keep "AirBnB" and people's first names as written. ` +
      `Return {"translations": [...]} with one translation per input text, in the same order.`,
    messages: [
      {
        role: "user",
        content: texts.map((t, i) => `<text index="${i}">\n${t}\n</text>`).join("\n\n"),
      },
    ],
  });
  if (response.stop_reason === "refusal") throw new Error("Claude declined to translate these reviews.");
  if (response.stop_reason === "max_tokens") throw new Error("The translation ran too long.");
  const raw = (response.content ?? [])
    .filter((b: any) => b.type === "text")
    .map((b: any) => b.text)
    .join("");
  const out = JSON.parse(raw)?.translations;
  // A list of the wrong length cannot be matched back to its texts. None of it
  // is kept, rather than putting one room's words under another's.
  if (!Array.isArray(out) || out.length !== texts.length) throw new Error("The translation came back mismatched.");
  return out.map((s: unknown) => String(s ?? "").trim());
};

// Swapped in tests; the real one calls Claude, and only with a key.
let translate: ReviewTranslator = (texts, language, roomNames) => translateWithClaude(texts, language, roomNames);
let translatorNeedsKey = true;
export const setReviewTranslator = (fn: ReviewTranslator) => {
  translate = fn;
  translatorNeedsKey = false;
};
export const resetReviewTranslator = () => {
  translate = (texts, language, roomNames) => translateWithClaude(texts, language, roomNames);
  translatorNeedsKey = true;
};

/** Translates whatever this host's guests can be shown and has no translation yet. */
export const ensureReviewTranslations = async (hostId: string): Promise<void> => {
  if (translatorNeedsKey && !process.env.ANTHROPIC_API_KEY) return;
  if (!mongoose.isValidObjectId(hostId)) return;
  const texts = await guestReviewTexts(hostId);
  if (!texts.length) return;
  const roomNames = (await Room.find({ host: hostId }, { name: 1 }).lean())
    .map((r: any) => String(r.name ?? ""))
    .filter(Boolean);
  const keys = texts.map(textKey);
  for (const lang of Object.keys(REVIEW_LANGS)) {
    const have = new Set(
      (await TTTranslation.find({ key: { $in: keys }, lang }, { key: 1 }).lean()).map((r: any) => r.key),
    );
    const missing = texts.filter((t) => !have.has(textKey(t)));
    if (!missing.length) continue;
    try {
      const done = await translate(missing, REVIEW_LANGS[lang], roomNames);
      const writes = missing
        .map((t, i) => ({ t, out: done[i] }))
        .filter(({ out }) => !!out)
        .map(({ t, out }) => ({
          updateOne: { filter: { key: textKey(t), lang }, update: { $set: { text: out } }, upsert: true },
        }));
      if (writes.length) await TTTranslation.bulkWrite(writes);
    } catch (err: any) {
      // One language failing leaves ITS guests on English, not the others.
      console.error(`[ReviewTranslate] ${lang}:`, err?.message ?? err);
    }
  }
};

// After the host changes the reviews: translated in the background, never
// holding up the host's save. One run per host at a time; a change during a
// run gets one more run after it, so the last change is always covered.
const running = new Map<string, { again: boolean; done: Promise<void> }>();
export const translateReviewsSoon = (hostId: string): Promise<void> => {
  const key = String(hostId);
  const r = running.get(key);
  if (r) {
    r.again = true;
    return r.done;
  }
  const state: { again: boolean; done: Promise<void> } = { again: false, done: Promise.resolve() };
  state.done = (async () => {
    try {
      do {
        state.again = false;
        await ensureReviewTranslations(key);
      } while (state.again);
    } catch (err: any) {
      console.error("[ReviewTranslate]", err?.message ?? err);
    } finally {
      running.delete(key);
    }
  })();
  running.set(key, state);
  return state.done;
};

// At startup: every host with reviews on record, so texts already there when
// this was built are translated without anyone having to touch them. Cheap
// on every later start: only texts with no translation are sent.
export const translateAllHostsReviews = async () => {
  const hosts = await TTReviews.find({}, { host: 1 }).lean();
  for (const h of hosts as any[]) if (h?.host) await translateReviewsSoon(String(h.host));
};

/** The guest's language's version of each text, where there is one. */
export const translationsFor = async (texts: string[], lang: string): Promise<Map<string, string>> => {
  const out = new Map<string, string>();
  if (!REVIEW_LANGS[lang]) return out;
  const keys = [...new Set(texts.filter(Boolean).map(textKey))];
  if (!keys.length) return out;
  const rows: any[] = await TTTranslation.find({ key: { $in: keys }, lang }, { key: 1, text: 1 }).lean();
  const byKey = new Map(rows.map((r) => [r.key, r.text]));
  for (const t of texts) {
    const hit = t ? byKey.get(textKey(t)) : undefined;
    if (hit) out.set(t, hit);
  }
  return out;
};
