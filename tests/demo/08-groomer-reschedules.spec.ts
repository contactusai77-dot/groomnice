/**
 * Demo: Groomer Reschedules an Appointment
 *
 * Something came up — the groomer needs to move Jane Smith's 9 AM slot
 * to a different time. Shows the reschedule flow from the dashboard:
 *
 *   • Groomer finds the appointment card
 *   • Clicks "Reschedule"
 *   • Picks a new date from a 14-day rolling picker
 *   • Picks an open time slot (taken slots are hidden)
 *   • Confirms — card refreshes with new time
 *
 * The /api/availability/slots endpoint is mocked so the demo shows
 * a consistent set of open slots regardless of server state.
 */
import { test, expect } from "@playwright/test";
import { loginAsGroomer, seedFresh, showCaption } from "./helpers";

const MOCK_OPEN_SLOTS = ["10:00", "11:00", "13:00", "14:00", "16:00"];
const TOMORROW = (() => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10); })();

function addDays(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

test.beforeAll(async ({ request }) => {
  await seedFresh(request);
});

test("groomer reschedules an existing appointment", async ({ page }) => {
  // Mock before any navigation so all slot/reschedule requests are intercepted
  await page.route("**/api/availability/slots*", route =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ date: TOMORROW, slots: MOCK_OPEN_SLOTS }),
    })
  );
  await page.route("**/api/bookings/*/reschedule", route =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ success: true, appointment_date: `${TOMORROW}T11:00:00` }),
    })
  );

  await loginAsGroomer(page);

  await showCaption(page, "Something came up — groomer needs to move an appointment", 2800, "scenario");

  // Scroll to the first confirmed appointment card
  await page.mouse.wheel(0, -999);
  await page.waitForTimeout(500);

  let rescheduleBtn = page.getByRole("button", { name: /reschedule/i }).first();
  // Scroll until we find the reschedule button
  for (let i = 0; i < 4; i++) {
    if (await rescheduleBtn.isVisible({ timeout: 2000 })) break;
    await page.mouse.wheel(0, 250);
    await page.waitForTimeout(400);
  }

  await expect(rescheduleBtn).toBeVisible({ timeout: 8000 });
  await rescheduleBtn.scrollIntoViewIfNeeded();
  await page.waitForTimeout(800);

  await showCaption(page, "Every appointment card has a Reschedule button", 2400, "note");

  await rescheduleBtn.hover();
  await page.waitForTimeout(600);
  await rescheduleBtn.click();
  await page.waitForTimeout(1200);

  // ── Reschedule modal ──────────────────────────────────────────────────────────
  const modal = page.locator(".fixed.inset-0");
  await expect(modal).toBeVisible({ timeout: 8000 });
  await page.waitForTimeout(500);

  await showCaption(page, "14-day date picker — groomer scrolls to the right date", 2600, "note");

  // Pick 2nd date pill (tomorrow)
  const dateScroller = modal.locator(".overflow-x-auto").first();
  await expect(dateScroller).toBeVisible({ timeout: 5000 });
  const datePills = dateScroller.locator("button");
  await datePills.nth(1).hover();
  await page.waitForTimeout(400);
  await datePills.nth(1).click();
  await page.waitForTimeout(1200);

  // Time slots should now be visible (mocked)
  await showCaption(page, "Only open slots shown — already-booked times are hidden", 2600, "note");

  const timeGrid = modal.locator(".grid.grid-cols-3");
  await expect(timeGrid.locator("button").first()).toBeVisible({ timeout: 8000 });
  await page.waitForTimeout(600);

  // Hover first two slots for visual effect
  const slotBtns = timeGrid.locator("button");
  await slotBtns.nth(0).hover();
  await page.waitForTimeout(400);
  await slotBtns.nth(1).hover();
  await page.waitForTimeout(400);
  await slotBtns.nth(1).click();
  await page.waitForTimeout(600);

  // ── Confirm ───────────────────────────────────────────────────────────────────
  const saveBtn = modal.getByRole("button", { name: /confirm reschedule/i });
  await expect(saveBtn).toBeEnabled({ timeout: 5000 });
  await saveBtn.hover();
  await page.waitForTimeout(600);

  await showCaption(page, "Groomer confirms — one tap moves the appointment", 2400, "note");
  await saveBtn.click();
  await page.waitForTimeout(1800);

  // Modal closes after save — wait for it to disappear
  await page.waitForTimeout(2000);
  await showCaption(
    page,
    "✅ Appointment rescheduled — card updates with new date and time",
    3000,
    "scenario"
  );
  await page.waitForTimeout(1200);
});
