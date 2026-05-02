import { test, expect } from "@playwright/test";
// Public tests — no auth required
test.describe("Login page", () => {
    test.beforeEach(async ({ page }) => {
        await page.goto("/login");
    });
    test("shows login form", async ({ page }) => {
        await page.getByRole("button", { name: "Sign in" }).click();
        await expect(page.locator("#email")).toBeVisible();
        await expect(page.locator("#password")).toBeVisible();
        await expect(page.getByRole("button", { name: "Login" })).toBeVisible();
    });
    test("shows error on invalid credentials", async ({ page }) => {
        await page.getByRole("button", { name: "Sign in" }).click();
        await page.fill("#email", "wrong@example.com");
        await page.fill("#password", "Wrong1password!");
        await page.getByRole("button", { name: "Login" }).click();
        await expect(page.locator("p.text-red-500")).toBeVisible({ timeout: 8000 });
    });
    test("redirects to / after successful login", async ({ page }) => {
        const email = process.env.TEST_EMAIL;
        const password = process.env.TEST_PASSWORD;
        test.skip(!email || !password, "TEST_EMAIL / TEST_PASSWORD not set");
        await page.getByRole("button", { name: "Sign in" }).click();
        await page.fill("#email", email);
        await page.fill("#password", password);
        await page.getByRole("button", { name: "Login" }).click();
        await expect(page).toHaveURL("/", { timeout: 10000 });
    });
});
