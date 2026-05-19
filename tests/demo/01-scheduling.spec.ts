/**
 * Demo: Smart Scheduling
 *
 * Pre-seeded day: 7 appointments 9 AM–3:30 PM across 6 clients.
 * Rex (German Shepherd) → aggressive 🔴  |  Luna (Poodle) → anxious 🟡
 * Shows: badge-rich list view → start/complete a grooming → calendar overlay.
 */
import { test, expect } from "@playwright/test";
import { getClients, loginAsGroomer, seedFresh, setPetTemperament } from "./helpers";

test.beforeAll(async ({ request }) => {
  const token = await seedFresh(request);

  // Set temperament flags on specific pets so badges are visible in recording
  const clients = await getClients(request, token);
  const tom   = clients.find(c => c.name === "Tom Bradley");
  const marco = clients.find(c => c.name === "Marco Rivera");

  const rex  = tom?.pets?.[0];
  const luna = marco?.pets?.[0];

  if (rex)  await setPetTemperament(request, token, rex,  "aggressive");
  if (luna) await setPetTemperament(request, token, luna, "anxious");
});

test("smart scheduling workflow", async ({ page }) => {
  await loginAsGroomer(page);

  // ── Full schedule overview ───────────────────────────────────────────────────
  await expect(page.getByText(/today|dashboard/i).first()).toBeVisible({ timeout: 8000 });
  await page.waitForTimeout(1200);

  // Slowly scroll down so all appointment cards are seen
  await page.mouse.wheel(0, 300);
  await page.waitForTimeout(900);
  await page.mouse.wheel(0, 300);
  await page.waitForTimeout(900);
  await page.mouse.wheel(0, -600);
  await page.waitForTimeout(600);

  // ── Show temperament badges by hovering first few cards ──────────────────────
  const cards = page.locator(".bg-white.rounded-2xl");
  const firstCard = cards.first();
  if (await firstCard.isVisible({ timeout: 3000 })) {
    await firstCard.hover();
    await page.waitForTimeout(800);
  }

  // Scroll to the Rex card (aggressive 🔴) — Tom Bradley at 11:30
  const aggressiveBadge = page.locator("text=🔴").first();
  if (await aggressiveBadge.isVisible({ timeout: 3000 })) {
    await aggressiveBadge.scrollIntoViewIfNeeded();
    await page.waitForTimeout(1000);
  }

  // Scroll to Luna (anxious 🟡) — Marco Rivera at 10:00
  const anxiousBadge = page.locator("text=🟡").first();
  if (await anxiousBadge.isVisible({ timeout: 3000 })) {
    await anxiousBadge.scrollIntoViewIfNeeded();
    await page.waitForTimeout(1000);
  }

  // ── Mark Priya/Coco "Done" (she's currently in_progress at 13:00) ────────────
  await page.mouse.wheel(0, 200);
  await page.waitForTimeout(500);
  const doneBtn = page.getByRole("button", { name: /^done$/i }).first();
  if (await doneBtn.isVisible({ timeout: 5000 })) {
    await doneBtn.scrollIntoViewIfNeeded();
    await doneBtn.hover();
    await page.waitForTimeout(700);
    await doneBtn.click();
    await page.waitForTimeout(1200);
  }

  // Re-ensure we're still on the dashboard (DayView re-fetches settings on update)
  await page.waitForURL(/\/(dashboard|today|\?|$)/, { timeout: 8000 });

  // ── Switch to Calendar view to show day's visual schedule ───────────────────
  await page.mouse.wheel(0, -999);
  await page.waitForTimeout(700);
  await expect(page.locator('button[aria-label="Calendar view"]')).toBeVisible({ timeout: 8000 });
  await page.locator('button[aria-label="Calendar view"]').click();
  await page.waitForTimeout(1500);

  // Hover over a filled time slot
  const slot = page.locator(".bg-violet-100, .bg-violet-600, .bg-violet-50").first();
  if (await slot.isVisible({ timeout: 3000 })) {
    await slot.hover();
    await page.waitForTimeout(1200);
  }

  // ── Return to List view ──────────────────────────────────────────────────────
  await page.locator('button[aria-label="List view"]').click();
  await page.waitForTimeout(1500);
});
