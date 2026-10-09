import Anthropic from "@anthropic-ai/sdk";

// Claude drafting what guests say about TT House, from the AirBnB reviews the
// host pasted into TiMag. A DRAFT: the host reads and edits it before anything
// reaches a guest (see ttReviewsSchema), so this is a first pass that saves the
// host reading three hundred reviews, not the last word.
//
// One call, no tools, structured output. It runs when the host presses the
// button — a few cents, a few times a year — never when a guest asks TT
// anything. TiBook's TT stays model-free (askTT.ts); it only shows what the
// host published.

const MODEL = "claude-opus-5-5";

// What the host pasted is read WHOLE — a review history is never quietly cut
// to its newest part (2026-10-06: a 120,000-character cut per room was there,
// and the host, who wanted every review read, did not want it). The only limit
// is the model's own: it reads about a million tokens, so this total, across all
// rooms, stays well inside that even for text that costs more tokens per
// character than English does. Over it, the host is TOLD and asked to paste
// fewer — never cut for them.
export const MAX_TOTAL_PASTE = 2_500_000;

export interface PastedRoom {
  roomId: string;
  name: string;
  text: string;
  // The room's newest DATED review, handed over on its own so the model never
  // has to guess which one is newest — `text` holds it too, among the rest.
  // Absent when the newest review on record carries no date: "latest" said of
  // a review nobody can date would be a guess.
  latest?: LatestReview;
}

export interface LatestReview {
  text: string;
  month: string; // yyyy-MM
  stars: number | null;
}

export interface DraftedRoom {
  roomId: string;
  summary: string;
  // The newest review in a sentence or two; "" when the room has none dated.
  latest: string;
  latestMonth: string;
  latestStars: number | null;
}

export interface ReviewDraft {
  house: string;
  rooms: DraftedRoom[];
  reviewsRead: number;
}

const systemPrompt = [
  "You write short summaries of guest reviews for TT House, a five-room short-stay house in Silicon Valley.",
  "The summaries are shown to people deciding whether to book, by the house's booking assistant.",
  "",
  "WHAT TO WRITE",
  "- One summary of the whole house, drawn from every room's reviews.",
  "- One summary per room, drawn only from that room's reviews. If a room has no reviews, its summary is an empty string.",
  "- Each summary is 2 to 4 sentences, plain text, warm and factual. No Markdown, no bullet points, no emoji.",
  "- Say what guests say most often, in their own terms: cleanliness, the host, the bed, quiet, location, value.",
  "- Be honest. If several guests mention the same drawback (a shared bathroom, street noise), say so kindly in one clause.",
  "  A summary that hides a known drawback becomes a bad review later.",
  "- Only what the reviews say. Do not invent amenities, numbers or praise.",
  "",
  "THE LATEST REVIEW",
  "- A room may carry a <latest-review>: its newest review, on its own. Summarise THAT review alone, as latest,",
  "  in 1 or 2 sentences, in the third person ('The latest guest found the bed comfortable and the room spotless').",
  "- Keep its tone: a mixed or poor review is summarised as mixed or poor, never softened.",
  "- If a room has no <latest-review>, its latest is an empty string. Do not pick one yourself.",
  "",
  "PRIVACY — THESE ARE OTHER PEOPLE'S WORDS",
  "- Never name a reviewer, and never name the host or anyone else a review names. Say 'guests' and 'the host'.",
  "- No quotations long enough to identify a reviewer, no dates of stays, no reviewers' home cities or jobs.",
  "- Leave out anything about a particular person rather than about the place.",
  "",
  "Also count how many separate reviews you read across everything pasted, as reviewsRead.",
].join("\n");

const outputSchema = (roomIds: string[]) => ({
  type: "object",
  properties: {
    house: { type: "string" },
    rooms: {
      type: "array",
      items: {
        type: "object",
        properties: {
          roomId: { type: "string", enum: roomIds },
          summary: { type: "string" },
          latest: { type: "string" },
        },
        required: ["roomId", "summary", "latest"],
        additionalProperties: false,
      },
    },
    reviewsRead: { type: "integer" },
  },
  required: ["house", "rooms", "reviewsRead"],
  additionalProperties: false,
});

// The pasted reviews as the model reads them: each room's text under its name
// and id, so it can tell the rooms apart and hand each summary back by id. The
// newest review comes first and on its own, marked as such.
export const reviewPrompt = (rooms: PastedRoom[]) =>
  rooms
    .map((r) => {
      const latest = r.latest
        ? `<latest-review month="${r.latest.month}"${r.latest.stars != null ? ` stars="${r.latest.stars}"` : ""}>\n${r.latest.text}\n</latest-review>\n`
        : "";
      return `<room id="${r.roomId}" name="${r.name.replace(/"/g, "'")}">\n${latest}${r.text}\n</room>`;
    })
    .join("\n\n");

/**
 * The model's draft for these rooms.
 *
 * `client` is injectable so the route can be tested without the network.
 */
export const draftReviewSummaries = async (
  rooms: PastedRoom[],
  client: Pick<Anthropic, "beta"> = new Anthropic(),
): Promise<ReviewDraft> => {
  const roomIds = rooms.map((r) => r.roomId);
  const response = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 16000,
    // Summarising is routine work; medium is Opus 5.5's own default, said
    // out loud so a later model change does not silently move it.
    output_config: { effort: "medium", format: { type: "json_schema", schema: outputSchema(roomIds) } },
    // If the model declines (reviews can quote anything), the API retries on
    // its default fallback model inside the same call instead of failing.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: systemPrompt,
    messages: [{ role: "user", content: reviewPrompt(rooms) }],
  });

  if (response.stop_reason === "refusal") throw new Error("Claude declined to summarise these reviews.");
  if (response.stop_reason === "max_tokens") throw new Error("The summary ran too long. Try pasting fewer reviews.");

  const text = (response.content ?? [])
    .filter((b: any) => b.type === "text")
    .map((b: any) => b.text)
    .join("");
  const parsed = JSON.parse(text);
  return {
    house: String(parsed.house ?? "").trim(),
    // Only rooms that were asked about, once each, in the order pasted.
    rooms: rooms.map(({ roomId, latest }) => {
      const said = (parsed.rooms ?? []).find((r: any) => r?.roomId === roomId);
      // A latest the model wrote for a room that HAS no dated newest review
      // is dropped: guests would be shown it with no month to stand on.
      const latestText = latest ? String(said?.latest ?? "").trim() : "";
      return {
        roomId,
        summary: String(said?.summary ?? "").trim(),
        latest: latestText,
        // The month and stars are the record's, never the model's.
        latestMonth: latestText ? latest!.month : "",
        latestStars: latestText ? latest!.stars : null,
      };
    }),
    reviewsRead: Number.isFinite(parsed.reviewsRead) ? Math.max(0, Math.round(parsed.reviewsRead)) : 0,
  };
};
