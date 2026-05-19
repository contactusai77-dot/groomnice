/**
 * Demo: Dynamic Pricing
 * Shows the groomer setting custom per-service prices that immediately
 * apply to all new bookings — "Full Groom" bumped from $75 → $85.
 */
import { test, expect } from "@playwright/test";
import { loginAsGroomer } from "./helpers";

test("dynamic pricing workflow", async ({ page }) => {
  await loginAsGroomer(page);

  // Navigate to Settings
  await page.getByRole("button", { name: /settings/i }).click();
  await page.waitForTimeout(1000);

  // Scroll to Service Pricing section
  const pricingHeader = page.getByText(/service pricing/i);
  await expect(pricingHeader).toBeVisible({ timeout: 8000 });
  await pricingHeader.scrollIntoViewIfNeeded();
  await page.waitForTimeout(1000);

  // Find all price inputs and highlight them by hovering each
  const priceInputs = page.locator("input[type='number']");
  const count = await priceInputs.count();
  for (let i = 0; i < Math.min(count, 3); i++) {
    await priceInputs.nth(i).hover();
    await page.waitForTimeout(400);
  }
  await page.waitForTimeout(500);

  // Update "Full Groom" price (first input)
  const fullGroomInput = priceInputs.first();
  await fullGroomInput.click();
  await fullGroomInput.selectText();
  await page.waitForTimeout(400);
  await fullGroomInput.fill("85");
  await page.waitForTimeout(500);

  // Blur to trigger save
  await fullGroomInput.blur();

  // Show the "Saved ✓" flash
  await expect(page.getByText(/saved/i)).toBeVisible({ timeout: 5000 });
  await page.waitForTimeout(1500);

  // Update De-shed price to show multiple services can be tuned
  const deshedInput = priceInputs.nth(5); // De-shed is typically last
  if (await deshedInput.isVisible({ timeout: 2000 })) {
    await deshedInput.scrollIntoViewIfNeeded();
    await deshedInput.click();
    await deshedInput.selectText();
    await page.waitForTimeout(400);
    await deshedInput.fill("80");
    await deshedInput.blur();
    await expect(page.getByText(/saved/i)).toBeVisible({ timeout: 5000 });
    await page.waitForTimeout(1200);
  }

  // Restore Full Groom to original value
  await fullGroomInput.scrollIntoViewIfNeeded();
  await fullGroomInput.click();
  await fullGroomInput.selectText();
  await fullGroomInput.fill("75");
  await fullGroomInput.blur();
  await page.waitForTimeout(800);
});
