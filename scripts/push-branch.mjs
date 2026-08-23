import { execSync, spawnSync } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

const REPO = "phamtuan2005/3rd-air-champion";
const BASE = "main";
const BRANCH_PREFIX = "tibook/";
const ROOT = join(__dirname, "..");
const FRONTEND = join(ROOT, "3rd-air-champion-frontend");

// Anh-Tuan's workflow: one branch per piece of work cut from main, pushed here
// and opened as a pull request into main. CI runs the typecheck, tests and
// build; once green the author merges it themselves. Nothing goes straight to
// main — that is what leaves CI standing between a mistake and the deployed app.
//
//   node scripts/push-branch.mjs                 # check, push, print PR link
//   node scripts/push-branch.mjs --skip-checks   # CI runs these anyway
//   node scripts/push-branch.mjs --sync          # bring main level with origin
//   node scripts/push-branch.mjs --dry-run       # say what it would do, do nothing

const DRY = process.argv.includes("--dry-run");
const SKIP_CHECKS = process.argv.includes("--skip-checks");
const SYNC = process.argv.includes("--sync");

// The same three CI runs, kept local so a mistake costs seconds not a round trip
const CHECKS = ["npx tsc --noEmit -p tsconfig.app.json", "npx vitest run src/util", "npm run build"];

const git = (cmd) => execSync(`git ${cmd}`, { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const tryGit = (cmd) => { try { return git(cmd); } catch { return null; } };

const run = (cmd, cwd = ROOT) => {
  console.log(`   $ ${cmd}`);
  return DRY ? true : spawnSync(cmd, { cwd, shell: true, stdio: "inherit" }).status === 0;
};

const fail = (msg) => {
  console.error(`\n❌ ${msg}\n`);
  process.exit(1);
};

// 1. Check where we are before touching anything
console.log("🔎 Checking the repository...");

const branch = tryGit("rev-parse --abbrev-ref HEAD") ?? fail("not a git repository.");
const origin = tryGit("remote get-url origin") ?? fail("no `origin` remote.");

// A fork was a previous arrangement here; a stale remote would send work somewhere nobody looks
if (!origin.includes(REPO)) {
  fail(`origin points at ${origin}\n   Work goes to ${REPO} directly:\n   git remote set-url origin https://github.com/${REPO}.git`);
}

if (SYNC) {
  if (git("status --porcelain")) fail("commit or stash your changes before syncing.");
  console.log(`⬇  Bringing ${BASE} level with origin...`);
  if (!run("git fetch origin")) fail("could not reach origin.");
  if (!run(`git switch ${BASE}`)) fail(`could not switch to ${BASE}.`);
  if (!run(`git merge --ff-only origin/${BASE}`)) fail(`${BASE} has local commits on it. It should only track origin.`);
  console.log(`✅ ${BASE} is level with origin.`);
  process.exit(0);
}

if (branch === BASE) fail(`you are on ${BASE}, which is never pushed.\n   git switch -c ${BRANCH_PREFIX}what-youre-doing`);

const dirty = git("status --porcelain");
if (dirty) fail(`the working tree has uncommitted changes:\n${dirty.split("\n").map((l) => "   " + l).join("\n")}\n   Commit them — a pull request should be a finished thought.`);

const name = tryGit("config user.name");
const email = tryGit("config user.email");
if (!name || !email) fail("git has no user.name / user.email set for this repo.");

console.log(`   branch  ${branch}`);
console.log(`   author  ${name} <${email}>`);
console.log(`   PR into ${REPO} ${BASE}${DRY ? "   (dry run — nothing will change)" : ""}`);

if (!branch.startsWith(BRANCH_PREFIX)) {
  console.log(`   ! branches are ${BRANCH_PREFIX}<what-youre-doing> by convention`);
  console.log(`     git branch -m ${BRANCH_PREFIX}${branch.replace(/^tibook[-/]?/, "")}`);
}

// A branch cut from a stale main is a conflict waiting to happen, and CI would
// be testing it against a main it was never built on
if (!DRY) {
  const fetched = tryGit("fetch origin --quiet") !== null;
  const behind = fetched ? tryGit(`rev-list --count HEAD..origin/${BASE}`) : null;
  if (behind && behind !== "0") {
    console.log(`   ! ${BASE} has moved on by ${behind} commit(s) since this branch was cut`);
    console.log(`     git merge origin/${BASE}`);
  }
}

// 2. Run what CI will run, so it fails here rather than there
if (SKIP_CHECKS) {
  console.log("🧪 Checks skipped — CI still runs them.");
} else {
  console.log("🧪 Running the checks CI will run...");
  for (const cmd of CHECKS) if (!run(cmd, FRONTEND)) fail("that failed. Nothing has been pushed.");
  console.log("   ✓ typecheck, tests, build");
}

// 3. Push the branch
console.log(`⬆  Pushing ${branch}...`);
if (!run(`git push -u origin ${branch}`)) {
  fail("the push failed. Usually GitHub credentials — run this from a terminal that can open a login window.");
}

// 4. Hand over the pull request
if (!DRY) {
  console.log("✅ Pushed.");
  console.log(`   https://github.com/${REPO}/compare/${BASE}...${branch}?expand=1`);
  console.log("   CI runs the typecheck, tests and build. Once it is green, merge it yourself.");
}
