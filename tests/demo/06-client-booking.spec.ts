/**
 * Demo: Client Online Self-Booking
 *
 * Shows the client-facing booking experience:
 *   • Visits the groomer's public booking page (no login needed)
 *   • Sees 30 days of real-time availability
 *   • Picks service → date → time
 *   • Fills name / phone / pet name
 *   • Submits → confirmation screen
 *
 * The public booking page is /book/{slug} — no auth required.
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

  // ── Service picker ────────────────────────────────────────────────────────────
  const bathCutBtn = page.getByRole("button", { name: /^Bath & Cut$/i });
  await expect(bathCutBtn).toBeVisible({ timeout: 8000 });
  await bathCutBtn.click();
  await page.waitForTimeout(700);

  await showCaption(page, "Picks a service — Full Groom, Bath, Nail Trim, and more", 2600, "note");
  await page.waitForTimeout(400);

  // ── Date pills — 30 days of availability ─────────────────────────────────────
  await showCaption(page, "30 days of real-time availability — only open slots shown", 2800, "note");

  const dateScroller = page.locator(".overflow-x-auto").first();
  await expect(dateScroller).toBeVisible({ timeout: 8000 });

  // Scroll the date strip slowly to show breadth
  await dateScroller.evaluate(el => { el.scrollLeft += 120; });
  await page.waitForTimeout(800);
  await dateScroller.evaluate(el => { el.scrollLeft = 0; });
  await page.waitForTimeout(600);

  // Click the first available date pill
  const firstDate = dateScroller.locator("button").first();
  await expect(firstDate).toBeVisible({ timeout: 5000 });
  await firstDate.click();
  await page.waitForTimeout(800);

  // ── Time slot grid ────────────────────────────────────────────────────────────
  await showCaption(page, "Open slots appear — already-booked times are hidden", 2600, "note");

  const timeGrid = page.locator(".grid.grid-cols-3").first();
  await expect(timeGrid.locator("button").first()).toBeVisible({ timeout: 8000 });

  // Hover a couple of slots for visual effect
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

  // ── Next: client details form ────────────────────────────────────────────────
  await page.getByRole("button", { name: /next/i }).click();
  await page.waitForTimeout(900);

  await showCaption(page, "Client enters their details — takes 20 seconds", 2600, "note");

  await page.getByPlaceholder("Jane Smith").fill("Rachel Green");
  await page.waitForTimeout(400);
  await page.getByPlaceholder(/555/).fill("5559876543");
  await page.waitForTimeout(400);
  await page.getByPlaceholder("Biscuit").fill("Phoebe");
  await page.waitForTimeout(600);

  // ── Submit ────────────────────────────────────────────────────────────────────
  const submitBtn = page.getByRole("button", { name: /request appointment/i });
  await submitBtn.hover();
  await page.waitForTimeout(600);

  await showCaption(page, "One tap to send the request — groomer reviews it instantly", 2600, "note");
  await submitBtn.click();
  await page.waitForTimeout(1500);

  // ── Confirmation ──────────────────────────────────────────────────────────────
  await expect(page.getByText(/request sent/i)).toBeVisible({ timeout: 8000 });
  await page.waitForTimeout(800);

  await showCaption(
    page,
    "✅ Request sent — client gets a text confirmation + vaccine upload link",
    3200,
    "scenario"
  );
  await page.waitForTimeout(1500);
});
