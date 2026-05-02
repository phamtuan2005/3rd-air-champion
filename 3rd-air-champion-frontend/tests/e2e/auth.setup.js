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
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.fill("#email", email);
    await page.fill("#password", password);
    await page.getByRole("button", { name: "Login" }).click();
    await page.waitForURL("/", { timeout: 15000 });
    // Save immediately after redirect — token is now in localStorage
    await page.context().storageState({ path: STORAGE_STATE });
});
