/**
 * Demo: Pet Temperament
 * Shows temperament badges on the client list and how a groomer updates
 * a pet's temperament to trigger the 🔴 aggressive / 🟡 anxious warning.
 */
import { test, expect } from "@playwright/test";
import { loginAsGroomer } from "./helpers";

test("pet temperament workflow", async ({ page }) => {
  await loginAsGroomer(page);

  // Navigate to Clients
  await page.getByRole("button", { name: /clients/i }).click();
  await expect(page.getByText(/jane smith/i)).toBeVisible({ timeout: 8000 });
  await page.waitForTimeout(1000);

  // Scroll through the client list so viewer sees all clients + badges
  await page.mouse.wheel(0, 200);
  await page.waitForTimeout(700);
  await page.mouse.wheel(0, -200);
  await page.waitForTimeout(800);

  // Open Jane Smith's drawer
  await page.getByText(/jane smith/i).first().click();
  await expect(page.getByText(/edit client/i)).toBeVisible({ timeout: 5000 });
  await page.waitForTimeout(1000);

  // Scroll to the Pets section
  const petsSection = page.getByText(/^pets$/i);
  await expect(petsSection).toBeVisible({ timeout: 5000 });
  await petsSection.scrollIntoViewIfNeeded();
  await page.waitForTimeout(800);

  // Show the temperament dropdown
  const tempSelect = page.locator("select").filter({ hasText: /friendly|anxious|aggressive/i }).first();
  if (await tempSelect.isVisible({ timeout: 3000 })) {
    await tempSelect.scrollIntoViewIfNeeded();
    await page.waitForTimeout(700);

    // Change to aggressive
    await tempSelect.selectOption("aggressive");
    await page.waitForTimeout(600);

    // Save the change
    const saveBtn = page.getByRole("button", { name: /save|update/i }).last();
    if (await saveBtn.isVisible({ timeout: 2000 })) {
      await saveBtn.click();
      await page.waitForTimeout(1000);
    }
  }

  // Close drawer and show the updated badge on the client card
  const closeBtn = page.getByRole("button", { name: /close|done|×|✕/i }).first();
  if (await closeBtn.isVisible({ timeout: 2000 })) {
    await closeBtn.click();
  } else {
    await page.keyboard.press("Escape");
  }
  await page.waitForTimeout(1200);

  // Show aggressive badge (🔴) on client card
  const aggressiveBadge = page.getByText("🔴").or(page.locator("[title*='Aggressive']"));
  if (await aggressiveBadge.isVisible({ timeout: 3000 })) {
    await aggressiveBadge.scrollIntoViewIfNeeded();
    await aggressiveBadge.hover();
    await page.waitForTimeout(1200);
  }

  // Restore to friendly
  await page.getByText(/jane smith/i).first().click();
  await expect(page.getByText(/edit client/i)).toBeVisible({ timeout: 5000 });
  const tempSelect2 = page.locator("select").filter({ hasText: /friendly|anxious|aggressive/i }).first();
  if (await tempSelect2.isVisible({ timeout: 3000 })) {
    await tempSelect2.selectOption("friendly");
    const saveBtn2 = page.getByRole("button", { name: /save|update/i }).last();
    if (await saveBtn2.isVisible({ timeout: 2000 })) await saveBtn2.click();
  }
  await page.waitForTimeout(800);
});
