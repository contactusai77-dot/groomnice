/**
 * Demo: Requests Tab — All Pending Bookings in One Place
 *
 *   • Client books online → request appears in Requests tab
 *   • Bell icon shows a red badge with the pending count
 *   • Groomer taps Requests → sees all pending cards with date/time/service
 *   • Confirms one → card disappears, badge drops
 *   • Empty state shown when all actioned
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

  // Create two pending bookings for different days
  const slotsRes = await request.get(`/api/book/${slug}/slots`);
  const slots = await slotsRes.json() as any[];

  for (let i = 0; i < Math.min(2, slots.length); i++) {
    const day = slots[i];
    if (!day?.slots?.length) continue;
    await request.post(`/api/book/${slug}`, {
      data: {
        name: i === 0 ? "Rachel Green" : "Monica Geller",
        phone: i === 0 ? "5559871111" : "5559872222",
        pet_name: i === 0 ? "Phoebe" : "Rufus",
        service_type: i === 0 ? "Bath & Cut" : "Full Groom",
        slot_date: day.date,
        slot_time: day.slots[0],
      },
    });
  }
});

test("requests tab shows pending bookings with confirm and decline", async ({ page }) => {
  await loginAsGroomer(page);

  await showCaption(page, "Groomer opens the dashboard — new bookings waiting", 2800, "scenario");
  await page.waitForTimeout(1000);

  // ── Badge on Requests tab ────────────────────────────────────────────────────
  const requestsTab = page.getByRole("button", { name: /requests/i });
  await expect(requestsTab).toBeVisible({ timeout: 8000 });

  await showCaption(
    page,
    "Red badge on the Requests tab — groomer sees it instantly without opening anything",
    3200,
    "note"
  );
  await page.waitForTimeout(1200);

  // ── Tap Requests tab ─────────────────────────────────────────────────────────
  await requestsTab.click();
  await page.waitForTimeout(1000);

  await showCaption(page, "All pending requests in one place — date, time, service, client", 3000, "note");
  await page.waitForTimeout(1000);

  // Show both cards
  const cards = page.locator(".border-amber-200");
  const cardCount = await cards.count();
  if (cardCount > 1) {
    await cards.nth(1).scrollIntoViewIfNeeded();
    await page.waitForTimeout(800);
    await cards.nth(0).scrollIntoViewIfNeeded();
    await page.waitForTimeout(600);
  }

  await showCaption(page, "Each card shows the full request — one tap to approve or decline", 2800, "note");
  await page.waitForTimeout(800);

  // ── Confirm first request ────────────────────────────────────────────────────
  const firstConfirm = page.getByRole("button", { name: /^confirm$/i }).first();
  await expect(firstConfirm).toBeVisible({ timeout: 5000 });
  await firstConfirm.hover();
  await page.waitForTimeout(600);
  await showCaption(page, "Groomer taps Confirm — client gets notified instantly", 2200, "note");
  await firstConfirm.click();
  await page.waitForTimeout(1500);

  await showCaption(page, "Card disappears, badge drops — stays in sync automatically", 2800, "note");
  await page.waitForTimeout(1000);

  // ── Decline second request ───────────────────────────────────────────────────
  const declineBtn = page.getByRole("button", { name: /^decline$/i }).first();
  if (await declineBtn.isVisible({ timeout: 3000 })) {
    await declineBtn.hover();
    await page.waitForTimeout(600);
    await showCaption(page, "Or decline — client sees 'Not Available' and can rebook", 2400, "note");
    await declineBtn.click();
    await page.waitForTimeout(1500);
  }

  // ── Empty state ──────────────────────────────────────────────────────────────
  const empty = page.getByText(/no pending requests/i);
  if (await empty.isVisible({ timeout: 5000 })) {
    await showCaption(
      page,
      "✅ All clear — groomer has full control, nothing falls through the cracks",
      3400,
      "scenario"
    );
  }
  await page.waitForTimeout(1500);
});
