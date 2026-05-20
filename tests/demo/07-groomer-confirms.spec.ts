/**
 * Demo: Groomer Reviews & Confirms an Online Booking
 *
 * A client has just submitted an online booking request.
 * The groomer sees it on the dashboard as a "Pending Review" card
 * (amber border) and confirms it with one tap.
 *
 * Pre-seeded: online booking created via POST /api/book/{slug} in beforeAll.
 */
import { test, expect } from "@playwright/test";
import { loginAsGroomer, seedFresh, showCaption } from "./helpers";

test.beforeAll(async ({ request }) => {
  const token = await seedFresh(request);

  // Get groomer slug for public booking endpoint
  const me = await request.get("/api/auth/me", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const { slug } = await me.json();

  // Get tomorrow's first available slot
  const slotsRes = await request.get(`/api/book/${slug}/slots`);
  const slots = await slotsRes.json() as any[];
  const firstDay = slots[0];

  if (firstDay) {
    // Create a pending_review online booking as a "client"
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

  await showCaption(page, "A client just booked online — new request on the dashboard", 3000, "scenario");

  // Scroll down to find the pending card (it may not be first)
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
      "Pending Review card — amber border flags it needs groomer action",
      2800,
      "note"
    );
    await page.waitForTimeout(600);
  }

  // Hover Confirm and Decline briefly to show both options
  const declineBtn = page.getByRole("button", { name: /^decline$/i }).first();
  if (await declineBtn.isVisible({ timeout: 3000 })) {
    await declineBtn.hover();
    await page.waitForTimeout(600);
  }

  const confirmBtn = page.getByRole("button", { name: /^confirm$/i }).first();
  if (await confirmBtn.isVisible({ timeout: 3000 })) {
    await confirmBtn.hover();
    await page.waitForTimeout(800);
    await showCaption(page, "Groomer taps Confirm — client gets an SMS notification", 2600, "note");
    await confirmBtn.click();
    await page.waitForTimeout(1800);
  }

  // Card should update — amber border gone
  await showCaption(
    page,
    "✅ Booking confirmed — card updates instantly, client is notified by text",
    3200,
    "scenario"
  );
  await page.waitForTimeout(1200);
});
