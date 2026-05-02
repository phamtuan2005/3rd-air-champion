import { test, expect } from "@playwright/test";
// These tests run with saved auth storage state (see playwright.config.ts)
// Auth setup must have run first (TEST_EMAIL + TEST_PASSWORD set)

const LOAD_TIMEOUT = 20000; // allow time for fetchHost through Vite proxy to EC2

test.describe("Main view", () => {
    test.beforeEach(async ({ page }) => {
        await page.goto("/");
        // Wait for loading screen to disappear before asserting
        await expect(page.getByText("Loading...")).not.toBeVisible({ timeout: LOAD_TIMEOUT });
    });
    test("calendar is visible", async ({ page }) => {
        await expect(page.locator("[class*='calendar'], [class*='Calendar']").first()).toBeVisible({ timeout: 8000 });
    });
    test("navbar renders with Book button", async ({ page }) => {
        await expect(page.getByRole("button", { name: "Book" })).toBeVisible({ timeout: 8000 });
    });
});
test.describe("Booking modal", () => {
    test.beforeEach(async ({ page }) => {
        await page.goto("/");
        await expect(page.getByText("Loading...")).not.toBeVisible({ timeout: LOAD_TIMEOUT });
        await page.getByRole("button", { name: "Book" }).click();
    });
    test("opens when Book button is clicked", async ({ page }) => {
        await expect(page.locator("form").first()).toBeVisible({ timeout: 5000 });
    });
    test("has guest input field", async ({ page }) => {
        await expect(page.locator("input[placeholder*='guest' i], input[id*='guest' i]").first()).toBeVisible({ timeout: 5000 });
    });
    test("closes on cancel", async ({ page }) => {
        const cancelBtn = page.getByRole("button", { name: /cancel|close/i }).first();
        await cancelBtn.click();
        await expect(cancelBtn).not.toBeVisible({ timeout: 3000 });
    });
});
test.describe("Guest view", () => {
    test.beforeEach(async ({ page }) => {
        await page.goto("/");
        await expect(page.getByText("Loading...")).not.toBeVisible({ timeout: LOAD_TIMEOUT });
    });
    test("guest list section is present", async ({ page }) => {
        await expect(page.locator("[class*='overflow-y-scroll'], [class*='GuestView']").first()).toBeVisible({ timeout: 8000 });
    });
});
