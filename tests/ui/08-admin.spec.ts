import { test, expect } from "@playwright/test";
import { ADMIN_KEY } from "./helpers";

test.describe("Admin Dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/admin");
    // Enter admin key if gate is shown
    const keyInput = page.getByPlaceholder(/key|admin/i).or(page.getByRole("textbox")).first();
    if (await keyInput.isVisible({ timeout: 3000 })) {
      await keyInput.fill(ADMIN_KEY);
      await page.getByRole("button", { name: /enter|submit|unlock/i }).click();
    }
  });

  test("admin overview loads with stats", async ({ page }) => {
    await expect(page.getByText(/groomers|clients|bookings|revenue/i).first()).toBeVisible({ timeout: 8000 });
  });

  test("groomer list visible", async ({ page }) => {
    await expect(page.getByText(/demo groomer|demo@groomnice/i).first()).toBeVisible({ timeout: 8000 });
  });

  test("test suite tab visible", async ({ page }) => {
    await expect(page.getByRole("button", { name: /test suite|tests/i })).toBeVisible({ timeout: 5000 });
  });

  test("test suite tab shows run button", async ({ page }) => {
    await page.getByRole("button", { name: /test suite|tests/i }).click();
    await expect(page.getByRole("button", { name: /run tests/i })).toBeVisible({ timeout: 5000 });
  });
});
