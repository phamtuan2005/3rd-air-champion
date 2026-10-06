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

// Per room. A listing with years of reviews pastes to a few hundred thousand
// characters; past this the newest reviews (AirBnB lists them first) say what
// a guest needs to know, and the host is told the paste was cut.
export const MAX_PASTE = 120_000;

export interface PastedRoom {
  roomId: string;
  name: string;
  text: string;
}

export interface ReviewDraft {
  house: string;
  rooms: { roomId: string; summary: string }[];
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
        },
        required: ["roomId", "summary"],
        additionalProperties: false,
      },
    },
    reviewsRead: { type: "integer" },
  },
  required: ["house", "rooms", "reviewsRead"],
  additionalProperties: false,
});

// The pasted reviews as the model reads them: each room's text under its name
// and id, so it can tell the rooms apart and hand each summary back by id.
export const reviewPrompt = (rooms: PastedRoom[]) =>
  rooms
    .map((r) => `<room id="${r.roomId}" name="${r.name.replace(/"/g, "'")}">\n${r.text.slice(0, MAX_PASTE)}\n</room>`)
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
  const known = new Set(roomIds);
  return {
    house: String(parsed.house ?? "").trim(),
    // Only rooms that were asked about, once each, in the order pasted.
    rooms: roomIds.map((roomId) => ({
      roomId,
      summary: String((parsed.rooms ?? []).find((r: any) => r?.roomId === roomId && known.has(roomId))?.summary ?? "").trim(),
    })),
    reviewsRead: Number.isFinite(parsed.reviewsRead) ? Math.max(0, Math.round(parsed.reviewsRead)) : 0,
  };
};
