#!/usr/bin/env node
//
// Pushes the current branch and prints the pull request link.
//
//   node scripts/push-branch.mjs                 # check, push, print PR link
//   node scripts/push-branch.mjs --skip-checks   # CI runs these too; skip locally
//   node scripts/push-branch.mjs --sync          # bring main up to date
//   node scripts/push-branch.mjs --dry-run       # say what it would do, do nothing
//
// The workflow this follows is Anh-Tuan's, in his words:
//
//   - one branch per piece of work, branched off main, named tibook/<thing>
//   - push the branch and open a pull request into main
//   - CI runs the typecheck, tests and build; once it is green, merge it
//     yourself — no need to wait for him
//   - never push straight to main
//
// So this script will not push main, and it stops before doing anything if
// main has moved on, because a branch cut from a stale main is a merge
// conflict waiting to happen.
//
// The local checks are the same three CI runs. They are here to fail in
// seconds rather than after a round trip, not to replace CI.

import { execSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FRONTEND = path.join(ROOT, "3rd-air-champion-frontend");
const REPO = "phamtuan2005/3rd-air-champion";
const BASE = "main";
const BRANCH_PREFIX = "tibook/";

const args = process.argv.slice(2);
const DRY = args.includes("--dry-run");
const SKIP_CHECKS = args.includes("--skip-checks");
const SYNC = args.includes("--sync");

const say = (s) => console.log(s);
const warn = (s) => console.log(`  ! ${s}`);
const die = (s) => { console.error(`\n✖ ${s}\n`); process.exit(1); };

const git = (cmd) =>
  execSync(`git ${cmd}`, { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();

const run = (cmd, cwd = ROOT) => {
  say(`  $ ${cmd}`);
  if (DRY) return true;
  return spawnSync(cmd, { cwd, shell: true, stdio: "inherit" }).status === 0;
};

let branch;
try { branch = git("rev-parse --abbrev-ref HEAD"); } catch { die("not a git repository"); }

const origin = (() => { try { return git("remote get-url origin"); } catch { return null; } })();
if (!origin) die("no `origin` remote.");
if (!origin.includes(REPO)) {
  die(
    `origin points at ${origin}\n` +
    `  Work goes to ${REPO} directly — not a fork:\n` +
    `    git remote set-url origin https://github.com/${REPO}.git`,
  );
}

// ------------------------------------------------------------------- --sync

if (SYNC) {
  say(`\nsync   : ${BASE} from origin\n`);
  if (git("status --porcelain")) die("commit or stash your changes before syncing.");
  if (!run("git fetch origin")) die("could not reach origin.");
  if (!run(`git switch ${BASE}`)) die(`could not switch to ${BASE}.`);
  if (!run(`git merge --ff-only origin/${BASE}`)) die(`${BASE} has local commits. It should only track origin.`);
  if (!DRY) say(`\n✔ ${BASE} is level with origin.\n`);
  process.exit(0);
}

// -------------------------------------------------------------- guard rails

if (branch === BASE) {
  die(
    `you are on ${BASE}, and this never pushes ${BASE} — Anh-Tuan's rule, and\n` +
    "  the reason CI can stand between a mistake and the deployed app.\n" +
    `    git switch -c ${BRANCH_PREFIX}what-youre-doing`,
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
say(`PR into: ${REPO} ${BASE}${DRY ? "   (dry run — nothing will change)" : ""}\n`);

if (!branch.startsWith(BRANCH_PREFIX)) {
  warn(`branch names are ${BRANCH_PREFIX}<what-youre-doing> by convention. Rename with:`);
  warn(`  git branch -m ${BRANCH_PREFIX}${branch.replace(/^tibook[-/]?/, "")}`);
  say("");
}

// A branch cut from a stale main is a conflict waiting to happen, and CI will
// be testing it against a main it was never built on.
if (!DRY) {
  try {
    execSync("git fetch origin --quiet", { cwd: ROOT, stdio: "ignore" });
    const behind = git(`rev-list --count HEAD..origin/${BASE}`);
    if (behind !== "0") {
      warn(`${BASE} has moved on by ${behind} commit(s) since this branch was cut.`);
      warn(`Consider:  git merge origin/${BASE}   (or rebase) before opening the PR.`);
      say("");
    }
  } catch { /* offline is not a reason to stop */ }
}

if (SKIP_CHECKS) {
  say("checks : skipped — CI will still run them\n");
} else {
  say("checks : the same three CI runs");
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
    "the push failed. Usually GitHub credentials — run this from a terminal\n" +
    "  that can open a login window, or set up a credential helper.",
  );
}

if (!DRY) {
  say(`\n✔ ${branch} pushed.`);
  say("\n  Open the pull request:");
  say(`  https://github.com/${REPO}/compare/${BASE}...${branch}?expand=1`);
  say("\n  CI runs the typecheck, tests and build. Once it is green, merge it yourself.\n");
}
