/**
 * Demo: Groomer Routing
 * Mobile groomers get an optimized daily route — stops ordered by proximity
 * with a one-tap "Open in Maps" button for turn-by-turn navigation.
 */
import { test, expect } from "@playwright/test";
import { loginAsGroomer } from "./helpers";

test("groomer routing workflow", async ({ page }) => {
  await loginAsGroomer(page);

  // Enable mobile mode so the Route view toggle appears
  await page.evaluate(async () => {
    const t = localStorage.getItem("token") ?? "";
    await fetch("/api/settings", {
      method: "PATCH",
      headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
      body: JSON.stringify({ is_mobile: true }),
    });
  });

  // Reload so the updated settings take effect
  await page.reload();
  await page.waitForURL(/\/(dashboard|today|\?|$)/, { timeout: 10_000 });
  await page.waitForTimeout(1000);

  // Confirm all 3 toggle buttons are visible
  await expect(page.locator('button[aria-label="List view"]')).toBeVisible({ timeout: 8000 });
  await page.waitForTimeout(800);

  // Hover Calendar then Route toggle to show the UI
  await page.locator('button[aria-label="Calendar view"]').hover();
  await page.waitForTimeout(500);
  await page.locator('button[aria-label="Route view"]').hover();
  await page.waitForTimeout(600);

  // Click Route view
  await page.locator('button[aria-label="Route view"]').click();
  await page.waitForTimeout(2000);

  // Show route view content (stops or no-address prompt)
  const routeContent = page.locator(".space-y-2").first()
    .or(page.locator(".rounded-2xl").filter({ hasText: /stop|appointment|address|map/i }).first());
  if (await routeContent.isVisible({ timeout: 5000 })) {
    await routeContent.scrollIntoViewIfNeeded();
    await page.waitForTimeout(1000);
  }

  // Hover "Open in Maps" if available
  const mapsBtn = page.locator("text=Open in Maps");
  if (await mapsBtn.isVisible({ timeout: 2000 })) {
    await mapsBtn.hover();
    await page.waitForTimeout(1000);
  }

  // Hover Refresh button
  const refreshBtn = page.getByRole("button", { name: /refresh/i });
  if (await refreshBtn.isVisible({ timeout: 2000 })) {
    await refreshBtn.hover();
    await page.waitForTimeout(700);
  }

  await page.waitForTimeout(1000);

  // Restore is_mobile to false
  await page.evaluate(async () => {
    const t = localStorage.getItem("token") ?? "";
    await fetch("/api/settings", {
      method: "PATCH",
      headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
      body: JSON.stringify({ is_mobile: false }),
    });
  });
});
