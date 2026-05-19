/**
 * Demo: Dynamic Pricing Based on Pet Features + Temperament
 *
 * Shows the AI Price Estimate button in the booking drawer.
 * Three comparisons (price-estimate API mocked for consistency):
 *
 *   Scenario A — Bichon Frise / friendly / normal coat    → $65, 60 min
 *   Scenario B — Labradoodle  / anxious  / normal coat    → $82, 80 min  (+15% +20 min)
 *   Scenario C — German Shepherd / aggressive / matted    → $138, 110 min (+25% +30 min +extra)
 */
import { test, expect } from "@playwright/test";
import { loginAsGroomer, seedFresh } from "./helpers";

function mockPriceResponse(temperament: string, coat: string) {
  if (temperament === "aggressive" || coat === "matted") {
    return { price: 138, duration_minutes: 110, notes: "Aggressive dog requires muzzle + matted coat needs extra de-tangling" };
  }
  if (temperament === "anxious") {
    return { price: 82, duration_minutes: 80, notes: "Anxious temperament adds extra handling time and 15% surcharge" };
  }
  return { price: 65, duration_minutes: 60, notes: "Standard full groom for small-medium breed — well-behaved dog" };
}

test.beforeAll(async ({ request }) => {
  await seedFresh(request);
});

test("dynamic pricing workflow", async ({ page }) => {
  // Intercept the price-estimate endpoint to ensure consistent demo output
  await page.route("**/api/price-estimate", async route => {
    const body = JSON.parse(route.request().postData() ?? "{}");
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(mockPriceResponse(body.temperament, body.coat_condition)),
    });
  });

  await loginAsGroomer(page);

  // ── Open New Appointment drawer ──────────────────────────────────────────────
  await page.getByRole("button", { name: /new.?appointment/i }).click();
  await expect(page.locator("input[type='tel']")).toBeVisible({ timeout: 6000 });
  await page.waitForTimeout(800);

  // Fill breed and service (shared across all 3 scenarios)
  const breedInput = page.getByPlaceholder("Golden Retriever");
  await breedInput.fill("Bichon Frise");
  await page.waitForTimeout(500);

  const serviceSelect = page.locator("select").filter({ hasText: /full groom/i });
  await serviceSelect.selectOption("Full Groom");
  await page.waitForTimeout(400);

  // ── Scenario A: Friendly + normal coat ──────────────────────────────────────
  const tempSelect = page.locator("select").filter({ hasText: /friendly|anxious|aggressive/i });
  await tempSelect.selectOption("friendly");
  const coatSelect = page.locator("select").filter({ hasText: /normal|matted|long/i });
  await coatSelect.selectOption("normal");
  await page.waitForTimeout(600);

  await page.getByRole("button", { name: /ai price estimate/i }).click();
  await expect(page.getByText(/\$65/)).toBeVisible({ timeout: 8000 });
  await page.waitForTimeout(1800);

  // ── Scenario B: Anxious → price and time go up ───────────────────────────────
  await breedInput.clear();
  await breedInput.fill("Labradoodle");
  await page.waitForTimeout(400);
  await tempSelect.selectOption("anxious");
  await page.waitForTimeout(600);

  await page.getByRole("button", { name: /ai price estimate/i }).click();
  await expect(page.getByText(/\$82/)).toBeVisible({ timeout: 8000 });
  await page.waitForTimeout(1800);

  // ── Scenario C: Aggressive + matted coat → premium pricing ──────────────────
  await breedInput.clear();
  await breedInput.fill("German Shepherd");
  await page.waitForTimeout(400);
  await tempSelect.selectOption("aggressive");
  await coatSelect.selectOption("matted");
  await page.waitForTimeout(600);

  await page.getByRole("button", { name: /ai price estimate/i }).click();
  await expect(page.getByText(/\$138/)).toBeVisible({ timeout: 8000 });
  await page.waitForTimeout(2500);
});
