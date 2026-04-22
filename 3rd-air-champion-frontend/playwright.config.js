import { defineConfig, devices } from "@playwright/test";
import { STORAGE_STATE } from "./tests/e2e/constants";
export default defineConfig({
    testDir: "./tests/e2e",
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    reporter: "html",
    use: {
        baseURL: "http://localhost:5173",
        trace: "on-first-retry",
    },
    projects: [
        // 1. Run auth setup first — logs in once and saves storage state
        {
            name: "setup",
            testMatch: /auth\.setup\.ts/,
        },
        // 2. All other tests reuse the saved auth state
        {
            name: "chromium",
            use: {
                ...devices["Desktop Chrome"],
                storageState: STORAGE_STATE,
            },
            dependencies: ["setup"],
        },
        // 3. Public tests (login page) run without auth state
        {
            name: "chromium-public",
            use: { ...devices["Desktop Chrome"] },
            testMatch: /smoke\.spec\.ts/,
        },
    ],
    webServer: {
        command: "npm run dev",
        url: "http://localhost:5173",
        reuseExistingServer: !process.env.CI,
    },
});
