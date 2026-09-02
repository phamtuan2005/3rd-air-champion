import { S3Client, PutObjectCommand, DeleteObjectsCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { readFileSync, readdirSync, statSync } from "fs";
import { join, relative } from "path";
import { lookup } from "mime-types";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

const BUCKET = "3rd-air-champion";
const REGION = "us-east-2";
const DIST_DIR = join(__dirname, "dist");

// Uses ~/.aws/credentials by default; override with AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY env vars if needed
const s3 = new S3Client({ region: REGION });

// Files browsers must always revalidate
const NO_CACHE = new Set(["index.html", "sw.js", "manifest.webmanifest", "registerSW.js"]);

const getCacheControl = (key) => {
  if (NO_CACHE.has(key)) return "no-cache, no-store, must-revalidate";
  // Vite hashes asset filenames — safe to cache for 1 year
  if (/\.[a-f0-9]{8,}\.(js|css|woff2?|png|svg|ico|webp)$/.test(key)) return "public, max-age=31536000, immutable";
  return "public, max-age=3600";
};

const getAllFiles = (dir) => {
  const results = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) results.push(...getAllFiles(full));
    else results.push(full);
  }
  return results;
};

const toS3Key = (filePath) => relative(DIST_DIR, filePath).replace(/\\/g, "/");

// 1. Retire files the new build has replaced — but NOT straight away.
//
// This used to empty the bucket before uploading, and that is what left phones
// on a blank page after a deploy. A device holding the previous index.html (a
// PWA serves it from its own cache) then asked for an assets/index-<old>.js that
// had just been deleted — and CloudFront answers a missing path with index.html
// and a 200, so the browser parsed HTML as JavaScript and rendered nothing.
// Desktop never showed it: index.html is uploaded no-cache, so a plain reload
// fetched the current hashes.
//
// Vite hashes every asset filename, so old and new can sit side by side without
// colliding. Anything the new build still contains is simply overwritten below;
// anything it does not is left alone for a GRACE PERIOD, which is the window a
// device has to pick up the new shell before its old one stops working.
const GRACE_DAYS = 30;
console.log(`🗑  Retiring files older than ${GRACE_DAYS} days...`);

const built = new Set(getAllFiles(DIST_DIR).map(toS3Key));
const cutoff = Date.now() - GRACE_DAYS * 24 * 60 * 60 * 1000;

let continuationToken;
const keysToDelete = [];
do {
  const list = await s3.send(new ListObjectsV2Command({ Bucket: BUCKET, ContinuationToken: continuationToken }));
  for (const obj of list.Contents ?? []) {
    // Still part of the build: it is about to be overwritten, never deleted.
    if (built.has(obj.Key)) continue;
    if (obj.LastModified && obj.LastModified.getTime() < cutoff) keysToDelete.push({ Key: obj.Key });
  }
  continuationToken = list.NextContinuationToken;
} while (continuationToken);

if (keysToDelete.length > 0) {
  await s3.send(new DeleteObjectsCommand({ Bucket: BUCKET, Delete: { Objects: keysToDelete } }));
  console.log(`   Deleted ${keysToDelete.length} file(s) past the grace period.`);
} else {
  console.log("   Nothing old enough to delete.");
}

// 2. Upload all dist files
const files = getAllFiles(DIST_DIR);
console.log(`⬆  Uploading ${files.length} files...`);
await Promise.all(
  files.map((filePath) => {
    const key = toS3Key(filePath);
    const body = readFileSync(filePath);
    const contentType = lookup(filePath) || "application/octet-stream";
    const cacheControl = getCacheControl(key);
    return s3
      .send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: body, ContentType: contentType, CacheControl: cacheControl }))
      .then(() => console.log(`   ✓ ${key}`));
  }),
);

console.log("✅ Deploy complete!");