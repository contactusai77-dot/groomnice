/**
 * Demo: Groomer Reviews & Confirms an Online Booking
 *
 * A client has submitted a booking request.
 * The groomer sees:
 *   • Pulsing amber banner at the top — "X booking requests waiting"
 *   • Pending card with the client's date + service
 *   • Taps Confirm → client gets a confirmation SMS
 *
 * Pre-seeded: online booking created via POST /api/book/{slug} in beforeAll.
 */
import { test, expect } from "@playwright/test";
import { loginAsGroomer, seedFresh, showCaption } from "./helpers";

test.beforeAll(async ({ request }) => {
  const token = await seedFresh(request);

  const me = await request.get("/api/auth/me", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const { slug } = await me.json();

  // Get a future slot and create a pending_review booking
  const slotsRes = await request.get(`/api/book/${slug}/slots`);
  const slots = await slotsRes.json() as any[];
  const firstDay = slots[0];

  if (firstDay) {
    await request.post(`/api/book/${slug}`, {
      data: {
        name: "Rachel Green",
        phone: "5559876543",
        pet_name: "Phoebe",
        service_type: "Bath & Cut",
        slot_date: firstDay.date,
        slot_time: firstDay.slots[0],
      },
    });
  }
});

test("groomer reviews and confirms an online booking", async ({ page }) => {
  await loginAsGroomer(page);

  await showCaption(page, "Client just requested a booking — groomer must approve it", 3000, "scenario");

  // ── Pulsing banner ──────────────────────────────────────────────────────────
  const banner = page.locator(".animate-pulse").first();
  if (await banner.isVisible({ timeout: 5000 })) {
    await banner.scrollIntoViewIfNeeded();
    await page.waitForTimeout(1000);
    await showCaption(
      page,
      "Pulsing alert — groomer can't miss it. No approval = no confirmation for the client.",
      3200,
      "note"
    );
    await page.waitForTimeout(600);
  }

  // ── Pending card ────────────────────────────────────────────────────────────
  for (let i = 0; i < 3; i++) {
    const pendingCard = page.locator(".border-amber-200").first();
    if (await pendingCard.isVisible({ timeout: 3000 })) break;
    await page.mouse.wheel(0, 250);
    await page.waitForTimeout(500);
  }

  const pendingCard = page.locator(".border-amber-200").first();
  if (await pendingCard.isVisible({ timeout: 5000 })) {
    await pendingCard.scrollIntoViewIfNeeded();
    await page.waitForTimeout(1000);

    await showCaption(
      page,
      "Pending card shows date, service, and client — amber border flags it needs action",
      2800,
      "note"
    );
    await page.waitForTimeout(600);
  }

  // Hover Decline briefly to show both options
  const declineBtn = page.getByRole("button", { name: /^decline$/i }).first();
  if (await declineBtn.isVisible({ timeout: 3000 })) {
    await declineBtn.hover();
    await page.waitForTimeout(600);
  }

  // ── Confirm ─────────────────────────────────────────────────────────────────
  const confirmBtn = page.getByRole("button", { name: /^confirm$/i }).first();
  if (await confirmBtn.isVisible({ timeout: 3000 })) {
    await confirmBtn.hover();
    await page.waitForTimeout(800);
    await showCaption(page, "Groomer taps Confirm — client gets a confirmation SMS instantly", 2600, "note");
    await confirmBtn.click();
    await page.waitForTimeout(1800);
  }

  await showCaption(
    page,
    "✅ Confirmed — amber card clears, client is notified. Groomer controls every booking.",
    3400,
    "scenario"
  );
  await page.waitForTimeout(1200);
});
