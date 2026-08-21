import { defineConfig } from "vitest/config";

// Unit tests only.
//
// `tests/e2e/` belongs to Playwright, which owns its own runner. Without this,
// a bare `vitest run` picks those files up and fails on them — two red files
// that mean nothing, next to the ones that do. Anyone new reads a failing suite
// as "the tests are broken here" and stops trusting them, which is worse than
// having none.
//
// Run the e2e ones with `npm run test:e2e`.
export default defineConfig({
  test: {
    include: ["src/**/*.test.{ts,tsx}"],
    environment: "node",
  },
});
