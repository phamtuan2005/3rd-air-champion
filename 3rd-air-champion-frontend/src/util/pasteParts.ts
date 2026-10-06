import axios from "axios";
import { getToken } from "./authSession";
const BACKEND_ENDPOINT = import.meta.env.VITE_BACKEND_ENDPOINT || "";

// A long paste, sent in pieces.
//
// CloudFront in front of the API turns any request body of 8,192 bytes or more
// into the website's home page with a 200 — and the browser, seeing a page with
// no CORS headers, reports only a network error (measured 2026-10-06: 8,000 bytes
// reach the server, 8,192 do not, for JSON, file uploads and text alike). So the
// host's "Draft summaries" failed with "The draft didn't start" for any review
// history longer than a few paragraphs, and nothing in this app could lift it.
// Each part stays well under the line, and the server (util/pasteUploads) puts
// them back together.

// The server refuses a part longer than this (MAX_PART_CHARS there).
const PART_CHARS = 6000;
// What one request body may weigh. 8,192 is the line; this leaves room for the
// JSON around the text and for a proxy adding to it.
const MAX_BODY_BYTES = 7000;

const bodyBytes = (text: string) =>
  new TextEncoder().encode(JSON.stringify({ uploadId: "x".repeat(36), roomId: "x".repeat(24), index: 99999, total: 99999, text })).length;

/**
 * The text cut into parts that each fit in one request, in order, with nothing
 * lost: joined back together they are the text. A part is cut by what it WEIGHS
 * as sent, not by its length — a page of accented or non-Latin reviews weighs
 * two to four times as much as the same number of English characters.
 */
export const splitForUpload = (text: string): string[] => {
  const parts: string[] = [];
  let at = 0;
  while (at < text.length) {
    let size = Math.min(PART_CHARS, text.length - at);
    while (size > 1 && bodyBytes(text.slice(at, at + size)) > MAX_BODY_BYTES) size = Math.floor(size * 0.85);
    parts.push(text.slice(at, at + size));
    at += size;
  }
  return parts;
};

const newUploadId = () =>
  (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`).slice(0, 64);

const PARALLEL = 6;
const TRIES = 3;

const sendPart = async (body: object) => {
  for (let attempt = 1; ; attempt++) {
    try {
      await axios.post(`${BACKEND_ENDPOINT}/tt-host/reviews/upload`, body, {
        headers: { Authorization: `Bearer ${getToken() ?? ""}` },
      });
      return;
    } catch (e: any) {
      // A refusal in words (400) will not change on a retry; a dropped
      // connection might.
      if (e?.response?.status === 400 || attempt >= TRIES) throw e;
      await new Promise((r) => setTimeout(r, 300 * attempt));
    }
  }
};

/**
 * Sends one room's text to the server in parts and returns the id the draft
 * names it by. `onProgress` is told how many parts have arrived, of how many.
 */
export const uploadPasteText = async (
  roomId: string,
  text: string,
  onProgress?: (done: number, total: number) => void,
): Promise<string> => {
  const parts = splitForUpload(text);
  const uploadId = newUploadId();
  let done = 0;
  let next = 0;
  onProgress?.(0, parts.length);
  // A few at a time: hundreds of parts one by one would take minutes, all at
  // once would be hundreds of connections.
  await Promise.all(
    Array.from({ length: Math.min(PARALLEL, parts.length) }, async () => {
      while (next < parts.length) {
        const index = next++;
        await sendPart({ uploadId, roomId, index, total: parts.length, text: parts[index] });
        onProgress?.(++done, parts.length);
      }
    }),
  );
  return uploadId;
};
