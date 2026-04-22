import { test as setup, expect } from "@playwright/test";
import { STORAGE_STATE } from "./constants";
setup("authenticate", async ({ page }) => {
    const email = process.env.TEST_EMAIL;
    const password = process.env.TEST_PASSWORD;
    if (!email || !password) {
        console.warn("TEST_EMAIL / TEST_PASSWORD not set — skipping auth setup");
        return;
    }
    await page.goto("/login");
    await page.fill("#email", email);
    await page.fill("#password", password);
    await page.getByRole("button", { name: "Login" }).click();
    await page.waitForURL("/", { timeout: 10000 });
    await expect(page.getByRole("button", { name: "Book" })).toBeVisible({ timeout: 10000 });
    // Save auth state (localStorage token) so other tests can reuse it
    await page.context().storageState({ path: STORAGE_STATE });
});
