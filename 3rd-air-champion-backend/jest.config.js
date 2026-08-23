/** @type {import('ts-jest').JestConfigWithTsJest} **/
module.exports = {
  testEnvironment: "node",
  // Only the TypeScript sources. `dist/` holds compiled copies of these same
  // tests from the last build, and jest was running BOTH — so a fixed source
  // test passed while its stale twin in dist failed, and the suite reported
  // failures nobody could reproduce by reading the code.
  roots: ["<rootDir>/src"],
  testPathIgnorePatterns: ["/node_modules/", "/dist/"],
  transform: {
    "^.+.tsx?$": ["ts-jest", {}],
  },
  setupFilesAfterEnv: [`<rootDir>/src/model/test/util/mongoDBMemoryServer.ts`],
};
