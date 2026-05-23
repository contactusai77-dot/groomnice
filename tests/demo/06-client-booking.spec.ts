/**
 * Demo: Client Online Self-Booking
 *
 * Shows the client-facing booking experience:
 *   • Visits the groomer's public booking page (no login needed)
 *   • Picks service → date → time → fills details
 *   • Submits → "Request Sent" screen
 *   • Groomer must approve before it's confirmed (approval shown in 07)
 */
import { test, expect } from "@playwright/test";
import { seedFresh, showCaption } from "./helpers";

let slug = "";

test.beforeAll(async ({ request }) => {
  const token = await seedFresh(request);
  const me = await request.get("/api/auth/me", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const groomer = await me.json();
  slug = groomer.slug ?? "demo";
});

test("client self-books online appointment", async ({ page }) => {
  await page.goto(`/book/${slug}`);
  await page.waitForTimeout(1000);

  await showCaption(page, "Client visits the groomer's public booking page — no account needed", 3000, "scenario");

  // ── Service picker ──────────────────────────────────────────────────────────
  const bathCutBtn = page.getByRole("button", { name: /^Bath & Cut$/i });
  await expect(bathCutBtn).toBeVisible({ timeout: 8000 });
  await bathCutBtn.click();
  await page.waitForTimeout(700);

  await showCaption(page, "Picks a service — Full Groom, Bath, Nail Trim, and more", 2600, "note");
  await page.waitForTimeout(400);

  // ── Date pills ──────────────────────────────────────────────────────────────
  await showCaption(page, "30 days of real-time availability — blocked dates never appear", 2800, "note");

  const dateScroller = page.locator(".overflow-x-auto").first();
  await expect(dateScroller).toBeVisible({ timeout: 8000 });

  await dateScroller.evaluate(el => { el.scrollLeft += 120; });
  await page.waitForTimeout(800);
  await dateScroller.evaluate(el => { el.scrollLeft = 0; });
  await page.waitForTimeout(600);

  const firstDate = dateScroller.locator("button").first();
  await expect(firstDate).toBeVisible({ timeout: 5000 });
  await firstDate.click();
  await page.waitForTimeout(800);

  // ── Time slot grid ──────────────────────────────────────────────────────────
  await showCaption(page, "Open slots appear — already-booked times are hidden", 2600, "note");

  const timeGrid = page.locator(".grid.grid-cols-3").first();
  await expect(timeGrid.locator("button").first()).toBeVisible({ timeout: 8000 });

  const slotBtns = timeGrid.locator("button");
  const count = await slotBtns.count();
  if (count > 1) {
    await slotBtns.nth(0).hover();
    await page.waitForTimeout(400);
    await slotBtns.nth(1).hover();
    await page.waitForTimeout(400);
  }
  await slotBtns.first().click();
  await page.waitForTimeout(700);

  // ── Next: client details form ───────────────────────────────────────────────
  await page.getByRole("button", { name: /next/i }).click();
  await page.waitForTimeout(900);

  await showCaption(page, "Client enters their details — takes 20 seconds", 2600, "note");

  await page.getByPlaceholder("Jane Smith").fill("Rachel Green");
  await page.waitForTimeout(400);
  await page.getByPlaceholder(/555/).fill("5559876543");
  await page.waitForTimeout(400);
  await page.getByPlaceholder("Biscuit").fill("Phoebe");
  await page.waitForTimeout(600);

  // Tick the consent checkbox
  const checkbox = page.locator("input[type='checkbox']");
  if (await checkbox.isVisible({ timeout: 2000 })) {
    await checkbox.check();
    await page.waitForTimeout(400);
  }

  // ── Submit ──────────────────────────────────────────────────────────────────
  const submitBtn = page.getByRole("button", { name: /request appointment/i });
  await submitBtn.hover();
  await page.waitForTimeout(600);

  await showCaption(page, "Submits the request — groomer will review and approve", 2600, "note");
  await submitBtn.click();
  await page.waitForTimeout(1500);

  // ── Confirmation screen ─────────────────────────────────────────────────────
  await expect(page.getByText(/request sent/i)).toBeVisible({ timeout: 8000 });
  await page.waitForTimeout(800);

  await showCaption(
    page,
    "✅ Request sent — client gets a text. Confirmed only after groomer approves.",
    3400,
    "scenario"
  );
  await page.waitForTimeout(1500);
});
