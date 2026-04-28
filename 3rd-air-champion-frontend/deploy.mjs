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

const s3 = new S3Client({ region: REGION });

const getAllFiles = (dir) => {
  const results = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) results.push(...getAllFiles(full));
    else results.push(full);
  }
  return results;
};

const toS3Key = (filePath) =>
  relative(DIST_DIR, filePath).replace(/\\/g, "/");

// 1. List and delete all existing objects
console.log("🗑  Clearing bucket...");
let continuationToken;
const keysToDelete = [];
do {
  const list = await s3.send(new ListObjectsV2Command({ Bucket: BUCKET, ContinuationToken: continuationToken }));
  for (const obj of list.Contents ?? []) keysToDelete.push({ Key: obj.Key });
  continuationToken = list.NextContinuationToken;
} while (continuationToken);

if (keysToDelete.length > 0) {
  await s3.send(new DeleteObjectsCommand({ Bucket: BUCKET, Delete: { Objects: keysToDelete } }));
  console.log(`   Deleted ${keysToDelete.length} old files.`);
}

// 2. Upload all dist files
const files = getAllFiles(DIST_DIR);
console.log(`⬆  Uploading ${files.length} files...`);
await Promise.all(
  files.map((filePath) => {
    const key = toS3Key(filePath);
    const body = readFileSync(filePath);
    const contentType = lookup(filePath) || "application/octet-stream";
    return s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: body, ContentType: contentType }))
      .then(() => console.log(`   ✓ ${key}`));
  })
);

console.log("✅ Deploy complete!");