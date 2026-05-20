/**
 * Demo: Groomer Blocks a Date (Day Override)
 *
 * The groomer is taking a day off next week. Shows the full flow:
 *
 *   • Groomer opens Settings → Day Overrides section
 *   • Picks a date that already has bookings
 *   • Blocks it — warning shows the existing appointments to reschedule
 *   • Blocked date appears in the list
 *   • Client booking page no longer shows that date
 *
 * Today's date is blocked (seed creates appointments for today)
 * so the conflict warning is guaranteed to appear.
 */
import { test, expect } from "@playwright/test";
import { loginAsGroomer, seedFresh, showCaption } from "./helpers";

const TODAY = new Date().toISOString().slice(0, 10);

function addDays(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

let groomerSlug = "";

test.beforeAll(async ({ request }) => {
  const token = await seedFresh(request);
  const me = await request.get("/api/auth/me", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const groomer = await me.json();
  groomerSlug = groomer.slug ?? "demo";
});

test("groomer blocks a date — conflict warning + client sees updated availability", async ({ page }) => {
  await loginAsGroomer(page);

  await showCaption(page, "Groomer needs to take a day off — let's block it", 2800, "scenario");

  // Navigate to Settings
  await page.getByRole("button", { name: /settings/i }).click();
  await page.waitForTimeout(1000);

  // Scroll to Day Overrides section
  const overridesHeading = page.getByText(/day overrides/i).first();
  await expect(overridesHeading).toBeVisible({ timeout: 8000 });
  await overridesHeading.scrollIntoViewIfNeeded();
  await page.waitForTimeout(1000);

  await showCaption(page, "Day Overrides — block specific dates without changing weekly schedule", 3000, "note");
  await page.waitForTimeout(600);

  // Fill the date input with TODAY (seed has appointments today → conflict warning)
  const dateInput = page.locator("input[type='date']");
  await expect(dateInput).toBeVisible({ timeout: 5000 });
  await dateInput.fill(TODAY);
  await page.waitForTimeout(500);

  await showCaption(page, "Selecting today — which already has appointments booked", 2400, "note");

  const blockBtn = page.getByRole("button", { name: /^block$/i });
  await blockBtn.hover();
  await page.waitForTimeout(600);
  await blockBtn.click();
  await page.waitForTimeout(1500);

  // ── Conflict warning should appear ───────────────────────────────────────────
  const conflictWarning = page.getByText(/existing appointment/i).first();
  if (await conflictWarning.isVisible({ timeout: 5000 })) {
    await conflictWarning.scrollIntoViewIfNeeded();
    await page.waitForTimeout(800);

    await showCaption(
      page,
      "⚠️  Warning: existing bookings on this day — groomer must reschedule them",
      3400,
      "note"
    );
    await page.waitForTimeout(600);

    // Show the list of affected clients
    await page.mouse.wheel(0, 150);
    await page.waitForTimeout(1000);
  }

  // ── Blocked date appears in list ──────────────────────────────────────────────
  const blockedTag = page.getByText(/blocked/i).first();
  if (await blockedTag.isVisible({ timeout: 5000 })) {
    await blockedTag.scrollIntoViewIfNeeded();
    await page.waitForTimeout(800);
    await showCaption(page, "Date is blocked — flagged in the groomer's settings", 2600, "note");
  }

  await page.waitForTimeout(800);

  // ── Show client booking page — today is gone ──────────────────────────────────
  await showCaption(
    page,
    "Now let's check the client booking page — blocked date should be gone",
    2800,
    "scenario"
  );

  await page.goto(`/book/${groomerSlug}`);
  await page.waitForTimeout(1200);

  await showCaption(
    page,
    "Client booking page — today no longer appears in available dates",
    3000,
    "note"
  );

  // Scroll the date strip to show available dates
  const dateScroller = page.locator(".overflow-x-auto").first();
  if (await dateScroller.isVisible({ timeout: 5000 })) {
    await dateScroller.evaluate(el => { el.scrollLeft += 100; });
    await page.waitForTimeout(700);
    await dateScroller.evaluate(el => { el.scrollLeft += 100; });
    await page.waitForTimeout(700);
    await dateScroller.evaluate(el => { el.scrollLeft = 0; });
    await page.waitForTimeout(600);
  }

  await showCaption(
    page,
    "✅ Blocked date hidden automatically — no client can book it",
    3200,
    "scenario"
  );
  await page.waitForTimeout(1500);
});
