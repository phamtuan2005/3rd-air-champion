#!/usr/bin/env node
//
// Pushes the current branch to YOUR fork and prints the pull request link.
//
//   node scripts/push-to-fork.mjs                 # check, push, print PR link
//   node scripts/push-to-fork.mjs --skip-checks   # skip typecheck/tests/build
//   node scripts/push-to-fork.mjs --sync          # bring main up to date from upstream
//   node scripts/push-to-fork.mjs --dry-run       # say what it would do, do nothing
//
// The shape this assumes, which is Anh-Tuan's:
//
//   origin    your fork          MortiMotri/3rd-air-champion     <- you push here
//   upstream  Anh-Tuan's repo    phamtuan2005/3rd-air-champion   <- you PR into here
//
// Branches go to the fork; the work reaches Anh-Tuan as a pull request he can
// read as a diff. Nothing here can write to his repository, which is the point
// of the arrangement — so this script never pushes to upstream, and refuses to
// push main anywhere.
//
// Set the remotes up once with:
//   git remote set-url origin   https://github.com/MortiMotri/3rd-air-champion.git
//   git remote add     upstream https://github.com/phamtuan2005/3rd-air-champion.git

import { execSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FRONTEND = path.join(ROOT, "3rd-air-champion-frontend");
const UPSTREAM_OWNER = "phamtuan2005";
const REPO = "3rd-air-champion";
const UPSTREAM_BASE = "main";

const args = process.argv.slice(2);
const DRY = args.includes("--dry-run");
const SKIP_CHECKS = args.includes("--skip-checks");
const SYNC = args.includes("--sync");

const say = (s) => console.log(s);
const die = (s) => { console.error(`\n✖ ${s}\n`); process.exit(1); };

const git = (cmd) =>
  execSync(`git ${cmd}`, { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();

const run = (cmd, cwd = ROOT) => {
  say(`  $ ${cmd}`);
  if (DRY) return true;
  return spawnSync(cmd, { cwd, shell: true, stdio: "inherit" }).status === 0;
};

const remoteUrl = (name) => {
  try { return git(`remote get-url ${name}`); } catch { return null; }
};

// ---------------------------------------------------------------- guard rails

let branch;
try { branch = git("rev-parse --abbrev-ref HEAD"); } catch { die("not a git repository"); }

const origin = remoteUrl("origin");
const upstream = remoteUrl("upstream");
if (!origin) die("no `origin` remote. See the remote setup at the top of this file.");
if (!upstream) {
  die(
    "no `upstream` remote — this repo is not set up for the fork workflow yet:\n" +
    `    git remote set-url origin   https://github.com/<you>/${REPO}.git\n` +
    `    git remote add     upstream https://github.com/${UPSTREAM_OWNER}/${REPO}.git`,
  );
}
if (origin.includes(`${UPSTREAM_OWNER}/${REPO}`)) {
  die(
    "`origin` still points at Anh-Tuan's repository, not your fork.\n" +
    "  Pushing there is exactly what the fork arrangement is meant to prevent:\n" +
    `    git remote set-url origin https://github.com/<you>/${REPO}.git`,
  );
}

// -------------------------------------------------------------------- --sync

if (SYNC) {
  say(`\nsync   : ${UPSTREAM_BASE} from upstream\n`);
  if (git("status --porcelain")) die("commit or stash your changes before syncing.");
  if (!run("git fetch upstream")) die("could not reach upstream.");
  if (!run(`git switch ${UPSTREAM_BASE}`)) die(`could not switch to ${UPSTREAM_BASE}.`);
  if (!run(`git merge --ff-only upstream/${UPSTREAM_BASE}`)) {
    die(`${UPSTREAM_BASE} has local commits on it. It should only ever track upstream.`);
  }
  if (!DRY) say(`\n✔ ${UPSTREAM_BASE} is level with upstream.\n`);
  process.exit(0);
}

// ------------------------------------------------------------ push a branch

if (branch === UPSTREAM_BASE) {
  die(
    `you are on ${UPSTREAM_BASE}, which tracks Anh-Tuan's repository and should\n` +
    "  carry no work of its own. Put your change on a branch:\n" +
    "    git switch -c my-change",
  );
}

const dirty = git("status --porcelain");
if (dirty) {
  die(
    "the working tree has uncommitted changes:\n\n" +
    dirty.split("\n").map((l) => "    " + l).join("\n") +
    "\n\n  Commit them first — a pull request should be a finished thought.",
  );
}

const who = (() => {
  try { return `${git("config user.name")} <${git("config user.email")}>`; } catch { return ""; }
})();
if (!who || who.startsWith(" <")) die("git has no user.name / user.email set for this repo.");

say(`\nbranch : ${branch}`);
say(`author : ${who}`);
say(`origin : ${origin}`);
say(`PR into: ${UPSTREAM_OWNER}/${REPO} ${UPSTREAM_BASE}${DRY ? "   (dry run — nothing will change)" : ""}\n`);

if (SKIP_CHECKS) {
  say("checks : skipped (--skip-checks)\n");
} else {
  say("checks :");
  for (const cmd of [
    "npx tsc --noEmit -p tsconfig.app.json",
    "npx vitest run src/util",
    "npm run build",
  ]) {
    if (!run(cmd, FRONTEND)) die("that failed. Nothing has been pushed.");
  }
  say("");
}

say("push   :");
if (!run(`git push -u origin ${branch}`)) {
  die(
    "the push failed. Two usual reasons:\n" +
    "    - the fork does not exist yet: open Anh-Tuan's repo on GitHub and click Fork\n" +
    "    - GitHub credentials: run this from a terminal that can open a login window",
  );
}

// The owner is whoever the fork belongs to, read straight off the remote.
const forkOwner = origin.match(/github\.com[/:]([^/]+)\//)?.[1] ?? "<you>";
const prUrl =
  `https://github.com/${UPSTREAM_OWNER}/${REPO}/compare/${UPSTREAM_BASE}...` +
  `${forkOwner}:${REPO}:${branch}?expand=1`;

if (!DRY) {
  say(`\n✔ ${branch} is on your fork.`);
  say("\n  Open the pull request:");
  say(`  ${prUrl}\n`);
}
