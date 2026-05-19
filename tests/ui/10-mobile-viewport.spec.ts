import { test, expect } from "@playwright/test";
import { loginAsGroomer } from "./helpers";

// Runs at iPhone 14 viewport dimensions (Chromium, not WebKit — WebKit not installed)
test.use({ viewport: { width: 390, height: 844 } });

test.describe("Mobile viewport sanity", () => {

  test("login page usable on mobile", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByPlaceholder("you@example.com")).toBeVisible();
  });

  test("dashboard scrollable on mobile", async ({ page }) => {
    await loginAsGroomer(page);
    await expect(page.getByText(/today|jane smith|marco/i).first()).toBeVisible({ timeout: 8000 });
  });

  test("online booking usable on mobile", async ({ page }) => {
    await page.goto("/book/demo");
    await expect(page.getByText(/book|appointment|slot/i).first()).toBeVisible({ timeout: 8000 });
  });

  test("feedback form usable on mobile", async ({ page }) => {
    await page.goto("/feedback");
    await expect(page.getByText(/feedback|bug|suggest/i).first()).toBeVisible({ timeout: 8000 });
  });
});
