import axios from "axios";
import { getToken } from "./authSession";
import { scrub, TTAnswer, TTCategory, TTReviews } from "./askTT";
import { shouldCountVisit } from "./tibookVisitOperations";
const BACKEND_ENDPOINT = import.meta.env.VITE_BACKEND_ENDPOINT || "";

/* ---- Guest side (TiBook). No token: the guest has no login. ---- */

// Not from the dev server, for the reason recordTiBookVisit gives: `npm run
// dev` proxies /api to PRODUCTION, and a developer trying TT out would fill the
// host's real log with test questions. The same switch turns it on against a
// local backend: VITE_COUNT_TIBOOK_VISITS_IN_DEV=true.
const skippedHere = () =>
  !shouldCountVisit({
    dev: import.meta.env.DEV,
    countInDev: import.meta.env.VITE_COUNT_TIBOOK_VISITS_IN_DEV === "true",
  });

// What leaves the phone for the log: the question with TT's own scrub run
// over it (the backend scrubs again), cut to the length the backend keeps.
//
// Plus one shape TT's answers do not need scrubbed but a question does: a door
// code typed without its "#" ("my code 4821 doesn't work"). Years stay — guests
// write them in dates. The backend applies the same rule (util/ttQuestions.ts).
export const loggedQuestion = (question: string) =>
  scrub(question)
    .replace(/\b(?!(?:19|20)\d{2}\b)\d{4,8}\b/g, "(hidden)")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300);

/**
 * Tells the house what a guest asked TT, and whether TT could answer.
 *
 * Fire and forget, AFTER the answer is on screen. A guest never waits on it,
 * and a failure is never shown to them — the log is for the host, not for
 * the conversation.
 */
export const logTTQuestion = (hostId: string | undefined, question: string, answer: TTAnswer, returning: boolean) => {
  const q = loggedQuestion(question);
  if (!hostId || !q || skippedHere()) return;
  axios
    .post(`${BACKEND_ENDPOINT}/tt/question`, {
      host: hostId,
      question: q,
      answered: answer.answered,
      category: answer.category,
      returning,
    })
    .catch(() => {});
};

// The review summaries the host published. Empty until they do — TT then says
// it has no summary yet rather than inventing one.
export const fetchPublishedReviews = async (hostId: string): Promise<Pick<TTReviews, "house" | "rooms">> => {
  const response = await axios.get(`${BACKEND_ENDPOINT}/tt/reviews/${hostId}`);
  const data = response.data;
  // CloudFront can answer a failure with index.html and a 200 (see
  // authenticateJWT): a web page is not a summary.
  if (typeof data?.house !== "string" || !Array.isArray(data?.rooms)) return { house: "", rooms: {} };
  return {
    house: data.house,
    rooms: Object.fromEntries(data.rooms.map((r: { roomId: string; summary: string }) => [r.roomId, r.summary])),
  };
};

/* ---- Host side (TiMag). Behind the JWT gate and requireManager. ---- */

const authed = () => ({ headers: { Authorization: `Bearer ${getToken()}` } });

export type QuestionSpan = "week" | "month" | "year" | "all";

export interface GroupedQuestion {
  question: string;
  count: number;
  lastAsked: string;
}

export interface CategoryGroup {
  category: TTCategory;
  count: number;
  questions: GroupedQuestion[];
}

export interface TTQuestionStats {
  span: QuestionSpan;
  total: number;
  answered: { count: number; categories: CategoryGroup[] };
  unanswered: { count: number; categories: CategoryGroup[] };
  fromReturning: number;
}

export const fetchTTQuestions = async (span: QuestionSpan): Promise<TTQuestionStats> => {
  const response = await axios.get(`${BACKEND_ENDPOINT}/tt-host/questions`, { ...authed(), params: { span } });
  if (typeof response.data?.total !== "number") throw new Error("The questions did not come back");
  return response.data;
};

// The same questions for a guest the host gave the stats code to, read from
// TiBook. No token: the code is the proof, checked like the visitor numbers.
export const fetchTTQuestionsAsViewer = async (code: string, span: QuestionSpan): Promise<TTQuestionStats> => {
  const response = await axios.post(`${BACKEND_ENDPOINT}/tibook-stats-viewer/tt-questions`, { code, span });
  if (typeof response.data?.total !== "number") throw new Error("The questions did not come back");
  return response.data;
};

export interface SummarySet {
  house: string;
  rooms: { roomId: string; summary: string }[];
}

export interface ReviewsState {
  published: SummarySet & { at: string | null };
  draft: SummarySet & {
    status: "none" | "drafting" | "ready" | "failed";
    error: string;
    reviewsRead: number;
    startedAt: string | null;
  };
  // The house's rooms in service, to paste each one's reviews against.
  houseRooms?: { roomId: string; name: string; airbnbUrl: string }[];
  // The review files kept on the server, one per room — name, size and date,
  // never the text.
  sources?: { roomId: string; name: string; chars: number; savedAt: string | null }[];
}

const asReviewsState = (data: any): ReviewsState => {
  if (!data?.published || !data?.draft) throw new Error("The reviews did not come back");
  return data;
};

export const fetchReviewsState = async (): Promise<ReviewsState> =>
  asReviewsState((await axios.get(`${BACKEND_ENDPOINT}/tt-host/reviews`, authed())).data);

// Starts Claude on a draft; the answer comes back through fetchReviewsState.
// Drafts from the review files KEPT for these rooms (sent earlier with
// uploadPasteText). Ids only: the text never travels in this request.
export const startReviewDraft = async (roomIds: string[]): Promise<void> => {
  await axios.post(`${BACKEND_ENDPOINT}/tt-host/reviews/draft`, { rooms: roomIds.map((roomId) => ({ roomId })) }, authed());
};

// One guest's review, kept per room, guest and stay. Small (2,000 characters at
// most) so the request stays under CloudFront's 8 KB. Resolves to whether it was
// ADDED — false when the same review was already on file for that room.
export interface ReviewEntryInput {
  roomId: string;
  guestId?: string;
  guestName?: string;
  stayDate?: string; // yyyy-MM-dd
  reviewMonth?: string; // yyyy-MM, from the date on a pasted AirBnB review
  stars?: number;
  text: string;
}

export const MAX_REVIEW_CHARS = 2000;

export const addReviewEntry = async (entry: ReviewEntryInput): Promise<{ added: boolean }> => {
  const response = await axios.post(`${BACKEND_ENDPOINT}/tt-host/reviews/entry`, entry, authed());
  return { added: response.data?.added === true };
};

export interface ReviewEntryRow {
  id: string;
  roomId: string;
  guestName: string;
  stayDate: string;
  reviewMonth: string;
  stars: number | null;
  snippet: string;
  addedAt: string | null;
}

export interface ReviewEntryFull {
  id: string;
  roomId: string;
  guestName: string;
  stayDate: string;
  reviewMonth: string;
  stars: number | null;
  text: string;
  addedAt: string | null;
}

// One review in full (the list carries only a snippet of each).
export const fetchReviewEntry = async (id: string): Promise<ReviewEntryFull> =>
  (await axios.get(`${BACKEND_ENDPOINT}/tt-host/reviews/entry/${id}`, authed())).data;

// Takes one review off the record (and out of the room's file, if it was written there).
export const deleteReviewEntry = async (id: string): Promise<void> => {
  await axios.delete(`${BACKEND_ENDPOINT}/tt-host/reviews/entry/${id}`, authed());
};

export const fetchReviewEntries = async (): Promise<ReviewEntryRow[]> => {
  const response = await axios.get(`${BACKEND_ENDPOINT}/tt-host/reviews/entries`, authed());
  return Array.isArray(response.data?.entries) ? response.data.entries : [];
};

// Splitting a room's page of reviews into individual ones (Claude does it, on
// the server; see ReviewSplitPanel).
export interface SplitPreviewRow {
  guestName: string;
  stars: number | null;
  month: string;
  when: string;
  snippet: string;
  onFile: boolean;
}

export interface ReviewSplitState {
  status: "none" | "running" | "ready" | "failed";
  done?: number;
  total?: number;
  error?: string;
  reviews?: SplitPreviewRow[];
}

export const startReviewSplit = async (roomId: string): Promise<void> => {
  await axios.post(`${BACKEND_ENDPOINT}/tt-host/reviews/split`, { roomId }, authed());
};

export const fetchReviewSplit = async (roomId: string): Promise<ReviewSplitState> =>
  (await axios.get(`${BACKEND_ENDPOINT}/tt-host/reviews/split/${roomId}`, authed())).data;

export const addReviewSplit = async (roomId: string): Promise<{ added: number; skipped: number }> => {
  const r = await axios.post(`${BACKEND_ENDPOINT}/tt-host/reviews/split/${roomId}/add`, {}, authed());
  return { added: r.data?.added ?? 0, skipped: r.data?.skipped ?? 0 };
};

export const discardReviewSplit = async (roomId: string): Promise<void> => {
  await axios.delete(`${BACKEND_ENDPOINT}/tt-host/reviews/split/${roomId}`, authed());
};

// What the reviews add up to, worked out on the server by arithmetic — no model.
export interface ReviewStats {
  total: number;
  rooms: { room: string; name: string; reviews: number; withStars: number; average: number | null }[];
  low: {
    roomName: string;
    guestName: string;
    stars: number | null;
    stayDate: string;
    reviewMonth: string;
    snippet: string;
    cleaners: string[];
    basis: "night" | "month" | "none";
  }[];
  topic: {
    key: string;
    label: string;
    rooms: { room: string; name: string; count: number }[];
    snippets: { roomName: string; guestName: string; stars: number | null; snippet: string }[];
  } | null;
  // What TiBook's TT tells guests, as published.
  published: { house: string; rooms: { room: string; name: string; summary: string }[]; at: string | null };
}

export const fetchReviewStats = async (topic?: string | null): Promise<ReviewStats> =>
  (await axios.get(`${BACKEND_ENDPOINT}/tt-host/reviews/stats`, { ...authed(), params: topic ? { topic } : {} })).data;

// Takes a room's kept review file off the server.
export const deleteReviewSource = async (roomId: string): Promise<void> => {
  await axios.delete(`${BACKEND_ENDPOINT}/tt-host/reviews/source/${roomId}`, authed());
};

export const publishReviews = async (set: SummarySet): Promise<ReviewsState> =>
  asReviewsState((await axios.put(`${BACKEND_ENDPOINT}/tt-host/reviews`, set, authed())).data);
