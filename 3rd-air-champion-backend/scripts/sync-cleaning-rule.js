#!/usr/bin/env node
//
// Copy TiMag's cleaning rule into the backend, so TiWork answers "which rooms
// need cleaning" with the SAME code rather than its own version of it.
//
// TiWork showed Henry 4 rooms for a morning TiMag showed 3. TiMag's Plan tab
// never counts assignments directly: it walks the entries getCleaningEntriesFor
// produces and credits whoever is assigned to each, so an assignment on a room
// that does not turn over is simply not counted. The backend had no such rule
// at all and listed every assignment it found.
//
// The obvious fix -- write the rule again in the backend -- is the one thing
// not to do: two implementations of one question are two chances to answer it
// differently, which is exactly the bug being fixed. The backend cannot import
// the frontend file either, because its tsconfig has rootDir "./src" and
// reaching outside it would move dist/server.js and break the deploy runbook.
//
// So the frontend file stays the ONE source and this copies it in, following
// its relative imports so nothing is missed by hand. tests/generatedCleaningRule
// fails if the copy drifts from the source, and `npm run build` regenerates it,
// so what ships is always what TiMag runs.
//
// date-fns differs between the two projects (frontend ^3.6.0, backend ^4.1.0).
// The rule uses only addDays and startOfToday, which behave identically in both.
//
// Usage:  node scripts/sync-cleaning-rule.js          write the copy
//         node scripts/sync-cleaning-rule.js --check  fail if it is stale

const fs = require("fs");
const path = require("path");

const SRC_ROOT = path.resolve(__dirname, "../../3rd-air-champion-frontend/src");
const OUT_ROOT = path.resolve(__dirname, "../src/shared/generated");
const ENTRY = "util/cleaningTasks.ts";

const header = (relPath) =>
  [
    "// GENERATED FILE — DO NOT EDIT.",
    "//",
    `// Copied from 3rd-air-champion-frontend/src/${relPath} by`,
    "// scripts/sync-cleaning-rule.js, so TiMag and TiWork decide which rooms",
    "// need cleaning with one piece of code instead of two that can disagree.",
    "//",
    "// Change the rule in the FRONTEND file and run `npm run build` (or",
    "// `node scripts/sync-cleaning-rule.js`). Editing this copy is undone by",
    "// the next build, and the drift test will fail in the meantime.",
    "",
    "",
  ].join("\n");

// Follow relative imports out of the entry file, so a rule that grows a new
// dependency later is copied whole rather than half.
const collect = (relPath, seen = new Map()) => {
  if (seen.has(relPath)) return seen;
  const abs = path.join(SRC_ROOT, relPath);
  const source = fs.readFileSync(abs, "utf8");
  seen.set(relPath, source);

  const importRe = /from\s+"(\.[^"]+)"/g;
  let m;
  while ((m = importRe.exec(source)) !== null) {
    const target = path.posix.normalize(path.posix.join(path.posix.dirname(relPath), m[1]));
    collect(`${target}.ts`, seen);
  }
  return seen;
};

const files = collect(ENTRY);
const check = process.argv.includes("--check");
const stale = [];

for (const [relPath, source] of files) {
  const outPath = path.join(OUT_ROOT, relPath);
  const contents = header(relPath) + source;

  if (check) {
    const current = fs.existsSync(outPath) ? fs.readFileSync(outPath, "utf8") : null;
    if (current !== contents) stale.push(relPath);
    continue;
  }

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, contents);
}

if (check) {
  if (stale.length > 0) {
    console.error(
      "The copied cleaning rule is out of date:\n" +
        stale.map((f) => `  - ${f}`).join("\n") +
        "\n\nRun: node scripts/sync-cleaning-rule.js",
    );
    process.exit(1);
  }
  console.log(`cleaning rule copy is current (${files.size} files)`);
} else {
  console.log(`cleaning rule copied (${files.size} files) -> src/shared/generated`);
}
