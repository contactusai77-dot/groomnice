/**
 * Demo: Real-time Booking Confirmation (No SMS / No Refresh Needed)
 *
 *   1. Client submits a booking → spinning "Waiting for groomer" screen
 *   2. Groomer tab: pulsing alert appears, groomer taps Confirm
 *   3. Client tab: flips to "Confirmed!" automatically (5s poll)
 *
 * Two pages open in the same browser context so client state is preserved.
 */
import { test, expect } from "@playwright/test";
import { loginAsGroomer, seedFresh, showCaption } from "./helpers";

let slug = "";

test.beforeAll(async ({ request }) => {
  const token = await seedFresh(request);
  const me = await request.get("/api/auth/me", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const groomer = await me.json();
  slug = groomer.slug ?? "demo";
});

test("client and groomer stay in sync without refresh", async ({ page, context }) => {

  // ── CLIENT: fill out and submit a booking ───────────────────────────────────
  await page.goto(`/book/${slug}`);
  await page.waitForTimeout(800);

  await showCaption(page, "CLIENT — opens booking page on their phone", 2800, "scenario");

  await page.getByRole("button", { name: /^Full Groom$/i }).click();
  await page.waitForTimeout(400);

  const dateScroller = page.locator(".overflow-x-auto").first();
  await expect(dateScroller).toBeVisible({ timeout: 8000 });
  await dateScroller.locator("button").first().click();
  await page.waitForTimeout(500);

  const timeGrid = page.locator(".grid.grid-cols-3").first();
  await expect(timeGrid.locator("button").first()).toBeVisible({ timeout: 8000 });
  await timeGrid.locator("button").first().click();
  await page.waitForTimeout(400);

  await page.getByRole("button", { name: /next/i }).click();
  await page.waitForTimeout(600);

  await page.getByPlaceholder("Jane Smith").fill("Sarah Connor");
  await page.waitForTimeout(300);
  await page.getByPlaceholder(/555/).fill("5551234567");
  await page.waitForTimeout(300);
  await page.getByPlaceholder("Biscuit").fill("Rex");
  await page.waitForTimeout(300);

  const checkbox = page.locator("input[type='checkbox']");
  if (await checkbox.isVisible({ timeout: 2000 })) {
    await checkbox.check();
    await page.waitForTimeout(300);
  }

  await showCaption(page, "Submits the request — groomer must approve before it's confirmed", 2400, "note");
  await page.getByRole("button", { name: /request appointment/i }).click();
  await page.waitForTimeout(1500);

  // ── Client sees pending/waiting screen ──────────────────────────────────────
  await expect(page.getByText(/request sent/i)).toBeVisible({ timeout: 8000 });
  await showCaption(
    page,
    "Spinning — this page polls every 5 seconds and flips to 'Confirmed!' automatically",
    3600,
    "note"
  );
  await page.waitForTimeout(1200);

  // ── GROOMER: open dashboard in a new tab (client page stays alive) ───────────
  const groomerPage = await context.newPage();
  await loginAsGroomer(groomerPage);

  await showCaption(groomerPage, "GROOMER — opens dashboard", 2400, "scenario");

  // Pulsing banner
  const banner = groomerPage.locator(".animate-pulse").first();
  if (await banner.isVisible({ timeout: 6000 })) {
    await banner.scrollIntoViewIfNeeded();
    await showCaption(
      groomerPage,
      "Pulsing alert — new request visible immediately, no manual refresh",
      3000,
      "note"
    );
    await groomerPage.waitForTimeout(1000);
  }

  // Pending card
  const pendingCard = groomerPage.locator(".border-amber-200").first();
  if (await pendingCard.isVisible({ timeout: 5000 })) {
    await pendingCard.scrollIntoViewIfNeeded();
    await groomerPage.waitForTimeout(600);
    await showCaption(groomerPage, "Pending card — one tap to approve or decline", 2600, "note");
    await groomerPage.waitForTimeout(600);
  }

  // Confirm
  const confirmBtn = groomerPage.getByRole("button", { name: /^confirm$/i }).first();
  if (await confirmBtn.isVisible({ timeout: 5000 })) {
    await confirmBtn.hover();
    await groomerPage.waitForTimeout(600);
    await showCaption(groomerPage, "Groomer taps Confirm", 1800, "note");
    await confirmBtn.click();
    await groomerPage.waitForTimeout(1200);
    await showCaption(groomerPage, "✅ Confirmed — now watch the client page update on its own", 3000, "scenario");
    await groomerPage.waitForTimeout(800);
  }

  // ── CLIENT: switch back — poll fires within 5s ──────────────────────────────
  await page.bringToFront();
  await showCaption(page, "Back to client — waiting for the automatic update…", 2400, "note");

  // Wait for the 5s poll to fire and update the UI
  await expect(page.getByText(/confirmed!/i)).toBeVisible({ timeout: 12000 });
  await page.waitForTimeout(800);

  await showCaption(
    page,
    "✅ 'Confirmed!' — no refresh, no SMS, no app. Just works.",
    4000,
    "scenario"
  );
  await page.waitForTimeout(1500);

  await groomerPage.close();
});
