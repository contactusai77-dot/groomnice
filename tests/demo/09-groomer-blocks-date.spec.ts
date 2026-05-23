/**
 * Demo: Groomer Blocks a Date (Day Override)
 *
 * The groomer is taking a day off. Shows the full flow:
 *
 *   • Opens Settings → Day Overrides
 *   • Blocks today (which has existing appointments)
 *   • Pending requests are auto-declined (green notice)
 *   • Confirmed appointments shown as amber warning — reschedule manually
 *   • Client booking page no longer shows that date
 */
import { test, expect } from "@playwright/test";
import { loginAsGroomer, seedFresh, showCaption } from "./helpers";

const TODAY = new Date().toISOString().slice(0, 10);

let groomerSlug = "";

test.beforeAll(async ({ request }) => {
  const token = await seedFresh(request);
  const me = await request.get("/api/auth/me", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const groomer = await me.json();
  groomerSlug = groomer.slug ?? "demo";

  // Create a pending_review booking for today so auto-decline fires
  const slotsRes = await request.get(`/api/book/${groomerSlug}/slots`);
  const slots = await slotsRes.json() as any[];
  const todaySlots = slots.find((s: any) => s.date === TODAY);
  if (todaySlots && todaySlots.slots.length > 0) {
    await request.post(`/api/book/${groomerSlug}`, {
      data: {
        name: "Test Client",
        phone: "5550001111",
        pet_name: "Max",
        service_type: "Bath",
        slot_date: TODAY,
        slot_time: todaySlots.slots[0],
      },
    });
  }
});

test("groomer blocks a date — auto-declines pending, warns on confirmed", async ({ page }) => {
  await loginAsGroomer(page);

  await showCaption(page, "Groomer is taking the day off — time to block the date", 2800, "scenario");

  // Navigate to Settings
  await page.getByRole("button", { name: /settings/i }).click();
  await page.waitForTimeout(1000);

  // Scroll to Day Overrides section
  const overridesHeading = page.getByText(/day overrides/i).first();
  await expect(overridesHeading).toBeVisible({ timeout: 8000 });
  await overridesHeading.scrollIntoViewIfNeeded();
  await page.waitForTimeout(1000);

  await showCaption(page, "Day Overrides — block specific dates without touching the weekly schedule", 3000, "note");
  await page.waitForTimeout(600);

  // Fill today's date (seed has appointments → conflict warning)
  const dateInput = page.locator("input[type='date']");
  await expect(dateInput).toBeVisible({ timeout: 5000 });
  await dateInput.fill(TODAY);
  await page.waitForTimeout(500);

  await showCaption(page, "Selecting today — it already has appointments booked", 2400, "note");

  const blockBtn = page.getByRole("button", { name: /^block$/i });
  await blockBtn.hover();
  await page.waitForTimeout(600);
  await blockBtn.click();
  await page.waitForTimeout(1800);

  // ── Auto-declined pending requests ──────────────────────────────────────────
  const autoDeclined = page.getByText(/auto-declined/i).first();
  if (await autoDeclined.isVisible({ timeout: 5000 })) {
    await autoDeclined.scrollIntoViewIfNeeded();
    await page.waitForTimeout(800);
    await showCaption(
      page,
      "Pending requests auto-declined — they were never confirmed, so no action needed",
      3200,
      "note"
    );
    await page.waitForTimeout(600);
  }

  // ── Confirmed bookings warning ──────────────────────────────────────────────
  const conflictWarning = page.getByText(/confirmed appointment/i).first();
  if (await conflictWarning.isVisible({ timeout: 3000 })) {
    await conflictWarning.scrollIntoViewIfNeeded();
    await page.waitForTimeout(800);
    await showCaption(
      page,
      "⚠️  Confirmed bookings still need manual rescheduling — shown here with client names",
      3200,
      "note"
    );
    await page.waitForTimeout(600);
    await page.mouse.wheel(0, 150);
    await page.waitForTimeout(800);
  }

  // ── Blocked date in list ────────────────────────────────────────────────────
  const blockedTag = page.getByText(/blocked/i).first();
  if (await blockedTag.isVisible({ timeout: 5000 })) {
    await blockedTag.scrollIntoViewIfNeeded();
    await page.waitForTimeout(800);
    await showCaption(page, "Date is blocked — flagged in settings, unblockable any time", 2600, "note");
  }

  await page.waitForTimeout(800);

  // ── Client booking page — today is gone ────────────────────────────────────
  await showCaption(
    page,
    "Now checking the client booking page — blocked date should be gone",
    2800,
    "scenario"
  );

  await page.goto(`/book/${groomerSlug}`);
  await page.waitForTimeout(1200);

  await showCaption(
    page,
    "Client sees only open dates — blocked day never appears",
    3000,
    "note"
  );

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
    "✅ Blocked date hidden automatically — no client can accidentally book it",
    3200,
    "scenario"
  );
  await page.waitForTimeout(1500);
});
