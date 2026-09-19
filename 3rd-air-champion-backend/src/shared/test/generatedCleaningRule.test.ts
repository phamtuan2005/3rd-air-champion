import { spawnSync } from "child_process";
import path from "path";

// One rule, not two.
//
// TiWork once answered "which rooms need cleaning" with its own logic and told
// Henry he had 4 rooms on a morning TiMag showed 3. The fix was to run TiMag's
// rule here instead — copied in by scripts/sync-cleaning-rule.js, because the
// backend's tsconfig cannot reach outside src to import it directly.
//
// A copy is only as good as the thing that notices when it goes stale. This is
// that thing: it fails the moment the frontend rule changes and the copy has
// not been regenerated, which is the exact state in which the two apps would
// start disagreeing again — quietly, and about a cleaner's morning.
//
// If this fails, do NOT edit the copy. Run:
//   node scripts/sync-cleaning-rule.js
describe("the cleaning rule copied from TiMag", () => {
  it("is identical to the frontend source it came from", () => {
    const script = path.resolve(__dirname, "../../../scripts/sync-cleaning-rule.js");
    const result = spawnSync(process.execPath, [script, "--check"], { encoding: "utf8" });

    const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
    expect(output).not.toMatch(/out of date/);
    expect(result.status).toBe(0);
  });
});
