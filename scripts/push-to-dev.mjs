#!/usr/bin/env node
//
// Puts the current branch onto `dev` and pushes it.
//
//   node scripts/push-to-dev.mjs                 # check, merge into dev, push
//   node scripts/push-to-dev.mjs --skip-checks   # skip typecheck/tests/build
//   node scripts/push-to-dev.mjs --dry-run       # say what it would do, do nothing
//
// `dev` is where work lands in this repo. main is deliberately out of reach
// here: CLAUDE.md reserves it for pull requests, and deploys are Anh-Tuan's.
// This script will refuse to run while main is checked out.
//
// It runs the three checks TIBOOK.md asks for before a push, because the point
// of a shared branch is that what lands on it works. --skip-checks exists for
// when they have just been run by hand, not as the normal way to use this.

import { execSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FRONTEND = path.join(ROOT, "3rd-air-champion-frontend");

const args = process.argv.slice(2);
const DRY = args.includes("--dry-run");
const SKIP_CHECKS = args.includes("--skip-checks");

const say = (s) => console.log(s);
const die = (s) => { console.error(`\n✖ ${s}\n`); process.exit(1); };

const git = (cmd, opts = {}) =>
  execSync(`git ${cmd}`, { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...opts }).trim();

const run = (cmd, cwd) => {
  say(`  $ ${cmd}`);
  if (DRY) return true;
  const r = spawnSync(cmd, { cwd, shell: true, stdio: "inherit" });
  return r.status === 0;
};

// ---------------------------------------------------------------- guard rails

let branch;
try {
  branch = git("rev-parse --abbrev-ref HEAD");
} catch {
  die("not a git repository");
}

if (branch === "main") {
  die(
    "you are on main. This script does not push main — CLAUDE.md keeps it for\n" +
    "  pull requests. Make a branch first:  git switch -c my-change",
  );
}

const dirty = git("status --porcelain");
if (dirty) {
  die(
    "the working tree has uncommitted changes:\n\n" +
    dirty.split("\n").map((l) => "    " + l).join("\n") +
    "\n\n  Commit them first — pushing half a change to a shared branch is how\n" +
    "  somebody else pulls a broken tree.",
  );
}

// An unset author writes commits nobody can be asked about later.
const who = (() => {
  try { return `${git("config user.name")} <${git("config user.email")}>`; } catch { return ""; }
})();
if (!who || who.startsWith(" <")) die("git has no user.name / user.email set for this repo.");

say(`\nbranch : ${branch}`);
say(`author : ${who}`);
say(`target : dev${DRY ? "   (dry run — nothing will change)" : ""}\n`);

// -------------------------------------------------------------------- checks

if (SKIP_CHECKS) {
  say("checks : skipped (--skip-checks)\n");
} else {
  say("checks :");
  const checks = [
    ["npx tsc --noEmit -p tsconfig.app.json", FRONTEND],
    ["npx vitest run src/util", FRONTEND],
    ["npm run build", FRONTEND],
  ];
  for (const [cmd, cwd] of checks) {
    if (!run(cmd, cwd)) die(`that failed. Nothing has been pushed.`);
  }
  say("");
}

// ------------------------------------------------------------ merge and push

say("dev    :");
if (!run("git fetch origin", ROOT)) die("could not reach origin.");

const devExistsLocally = (() => {
  try { git("rev-parse --verify dev"); return true; } catch { return false; }
})();

// Take dev from the remote, so this never pushes a stale local copy.
if (devExistsLocally) {
  if (!run("git switch dev", ROOT)) die("could not switch to dev.");
  if (!run("git merge --ff-only origin/dev", ROOT)) {
    die("local dev has diverged from origin/dev. Sort that out by hand first.");
  }
} else {
  if (!run("git switch -c dev --track origin/dev", ROOT)) die("could not create a local dev from origin/dev.");
}

// --no-ff so dev's history still shows the branch this arrived on.
if (!run(`git merge --no-ff ${branch} -m "merge: ${branch} into dev"`, ROOT)) {
  die(
    `merging ${branch} into dev hit a conflict.\n` +
    "  Resolve it, commit, then run:  git push origin dev",
  );
}

if (!run("git push origin dev", ROOT)) {
  die(
    "the merge worked but the push did not — usually GitHub credentials.\n" +
    "  dev is ready locally; finish it with:  git push origin dev",
  );
}

if (!DRY) {
  say(`\n✔ ${branch} is on dev and pushed.`);
  say(`  you are now on dev; go back with:  git switch ${branch}\n`);
}
