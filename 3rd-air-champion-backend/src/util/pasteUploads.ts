import { MAX_TOTAL_PASTE } from "./reviewDraft";

// A review history that arrives in pieces.
//
// CloudFront in front of the API turns any request body of 8,192 bytes or more
// into the website's home page with a 200 (measured 2026-10-06: 8,000 bytes
// reach the server, 8,192 do not — for JSON, multipart, text and PUT alike),
// and no setting in this app can lift that. A pasted review history is hundreds
// of kilobytes, so TiMag sends it as many small parts, each well under the line,
// and this puts them back together for the draft.
//
// Held in MEMORY while the parts arrive, and gone after half an hour untouched
// or the moment the last part lands: the route then saves the assembled text as
// the room's kept review file (model/ttReviewSourceSchema). A restart in the
// middle simply loses an upload the host has to send again.

interface Upload {
  name: string;
  roomId: string;
  total: number;
  parts: Map<number, string>;
  chars: number;
  at: number;
}

const uploads = new Map<string, Upload>();

const TTL_MS = 30 * 60 * 1000;
// The most one request may carry, in characters. TiMag sends far less; this is
// only a guard so a part can never be the large body the front layer refuses.
export const MAX_PART_CHARS = 6000;
// Parts per upload: room for MAX_TOTAL_PASTE characters even at a small part size.
const MAX_PARTS = 6000;
// Everything one host has staged at once. Room for the whole house twice over.
const MAX_STAGED_CHARS = MAX_TOTAL_PASTE * 2;

const keyOf = (host: string, uploadId: string) => `${host}:${uploadId}`;

const sweep = () => {
  const cutoff = Date.now() - TTL_MS;
  for (const [key, u] of uploads) if (u.at < cutoff) uploads.delete(key);
};

const stagedBy = (host: string) => {
  let chars = 0;
  for (const [key, u] of uploads) if (key.startsWith(`${host}:`)) chars += u.chars;
  return chars;
};

export class UploadError extends Error {
  constructor(message: string) {
    super(message);
    // Without this, compiled for an older target, `instanceof UploadError` is
    // false and every refusal below surfaced as a 500 instead of a 400.
    Object.setPrototypeOf(this, UploadError.prototype);
  }
}

export const addPart = (
  host: string,
  p: { uploadId?: unknown; roomId?: unknown; index?: unknown; total?: unknown; text?: unknown; name?: unknown },
): { complete: boolean } => {
  sweep();
  const { uploadId, roomId, index, total, text } = p;
  const name = typeof p.name === "string" && p.name.trim() ? p.name.trim().slice(0, 200) : "Pasted text";
  if (typeof uploadId !== "string" || !/^[A-Za-z0-9-]{8,64}$/.test(uploadId)) throw new UploadError("Bad upload id.");
  if (typeof roomId !== "string" || !roomId) throw new UploadError("Which room is this for?");
  if (typeof total !== "number" || !Number.isInteger(total) || total < 1 || total > MAX_PARTS) throw new UploadError("Bad part count.");
  if (typeof index !== "number" || !Number.isInteger(index) || index < 0 || index >= total) throw new UploadError("Bad part number.");
  if (typeof text !== "string" || text.length > MAX_PART_CHARS) throw new UploadError("That part is too large.");

  const key = keyOf(host, uploadId);
  const u = uploads.get(key) ?? { name, roomId, total, parts: new Map<number, string>(), chars: 0, at: Date.now() };
  if (u.roomId !== roomId || u.total !== total) throw new UploadError("That part does not belong to this upload.");

  // A resent part (a retry after a dropped connection) replaces itself.
  const before = u.parts.get(index)?.length ?? 0;
  if (stagedBy(host) - before + text.length > MAX_STAGED_CHARS) {
    throw new UploadError("Too much is waiting to be read. Draft first, then send the rest.");
  }
  u.parts.set(index, text);
  u.chars += text.length - before;
  u.at = Date.now();
  uploads.set(key, u);
  return { complete: u.parts.size === u.total };
};

/** The assembled text, without removing it. Throws if a part is still missing. */
export const peekUpload = (host: string, uploadId: string): { roomId: string; name: string; text: string } => {
  sweep();
  const u = uploads.get(keyOf(host, uploadId));
  if (!u) throw new UploadError("That upload has expired. Choose the file again.");
  if (u.parts.size !== u.total) throw new UploadError("The upload did not finish. Choose the file again.");
  const pieces: string[] = [];
  for (let i = 0; i < u.total; i++) pieces.push(u.parts.get(i) ?? "");
  return { roomId: u.roomId, name: u.name, text: pieces.join("") };
};

export const dropUpload = (host: string, uploadId: string) => {
  uploads.delete(keyOf(host, uploadId));
};
