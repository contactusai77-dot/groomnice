import { test, expect } from "@playwright/test";
import { loginAsGroomer } from "./helpers";

test.describe("Settings", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsGroomer(page);
    await page.getByRole("button", { name: /settings/i }).click();
  });

  test("settings page loads with pricing", async ({ page }) => {
    await expect(page.getByText(/full groom|bath|nail trim/i).first()).toBeVisible({ timeout: 8000 });
  });

  test("working hours section visible", async ({ page }) => {
    await expect(page.getByText(/working hours|hours|schedule/i).first()).toBeVisible({ timeout: 5000 });
  });

  test("deposit toggle visible", async ({ page }) => {
    await expect(page.getByText(/deposit/i).first()).toBeVisible({ timeout: 5000 });
  });

  test("waitlist section visible", async ({ page }) => {
    await expect(page.getByText(/waitlist|gap fill/i).first()).toBeVisible({ timeout: 5000 });
  });

  test("can update a service price", async ({ page }) => {
    // Prices save on blur — no explicit save button
    const first = page.locator("input[type='number']").first();
    await first.fill("80");
    await first.blur();
    await expect(page.getByText(/saved/i)).toBeVisible({ timeout: 5000 });
    // Restore
    await first.fill("75");
    await first.blur();
  });
});
