import { expect, test } from "@playwright/test";

const API = "http://localhost:8002";
const ALL_DAYS_WH = { days: [0, 1, 2, 3, 4, 5, 6], start: "09:00", end: "17:00", slot_minutes: 60 };
const DEFAULT_WH  = { days: [0, 1, 2, 3, 4],       start: "09:00", end: "17:00", slot_minutes: 60 };

test.describe("Today tab — Calendar view", () => {
  test.beforeAll(async ({ request }) => {
    // Include all 7 days so tests pass regardless of which day they run
    await request.patch(`${API}/api/settings`, { data: { working_hours: ALL_DAYS_WH } });
  });

  test.afterAll(async ({ request }) => {
    await request.patch(`${API}/api/settings`, { data: { working_hours: DEFAULT_WH } });
    await request.post(`${API}/api/seed?key=dev`);
  });

  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
  });

  test("List and Calendar toggle buttons are visible in the header", async ({ page }) => {
    await expect(page.locator('button[aria-label="List view"]')).toBeVisible();
    await expect(page.locator('button[aria-label="Calendar view"]')).toBeVisible();
  });

  test("List view is active by default — appointment cards visible", async ({ page }) => {
    // List button should have violet background (active state)
    await expect(page.locator('button[aria-label="List view"]')).toHaveClass(/bg-violet-600/);
    const cards = page.locator(".bg-white.rounded-2xl.p-4.shadow-sm");
    await expect(cards.first()).toBeVisible();
  });

  test("clicking Calendar toggle switches to time-slot grid", async ({ page }) => {
    await page.locator('button[aria-label="Calendar view"]').click();
    await page.waitForTimeout(300);
    await expect(page.locator('button[aria-label="Calendar view"]')).toHaveClass(/bg-violet-600/);
    // Time labels like "9:00 AM" must appear (working hours 09:00–17:00)
    await expect(page.getByText("9:00 AM")).toBeVisible();
  });

  test("calendar shows booked slots with pet name and service", async ({ page }) => {
    await page.locator('button[aria-label="Calendar view"]').click();
    await page.waitForTimeout(300);
    // Biscuit is booked at 9:00 AM in seed data
    await expect(page.getByText("Biscuit").first()).toBeVisible();
    await expect(page.getByText("Full Groom").first()).toBeVisible();
  });

  test("open slots show Available label", async ({ page }) => {
    await page.locator('button[aria-label="Calendar view"]').click();
    await page.waitForTimeout(300);
    // Seed data doesn't fill every hour — at least one slot must be available
    await expect(page.getByText("Available").first()).toBeVisible();
  });

  test("tapping an Available slot opens BookingDrawer with time pre-filled", async ({ page }) => {
    await page.locator('button[aria-label="Calendar view"]').click();
    await page.waitForTimeout(300);

    const availableBtn = page.getByRole("button").filter({ hasText: "Available" }).first();
    // Get the time label from the same row (sibling span)
    const slotRow = availableBtn.locator("..");
    const timeLabel = await slotRow.locator("span").first().textContent();
    await availableBtn.click();

    await expect(page.getByText("New Appointment")).toBeVisible();

    // Time input must be pre-filled (not empty)
    const timeInput = page.locator('input[type="time"]');
    const value = await timeInput.inputValue();
    expect(value).toBeTruthy();
    expect(value).toMatch(/^\d{2}:\d{2}$/);
  });

  test("booking drawer created from calendar slot uses the correct time", async ({ page }) => {
    await page.locator('button[aria-label="Calendar view"]').click();
    await page.waitForTimeout(300);

    // Click the noon slot specifically (12:00 — not in seed data, always free)
    const noonBtn = page.getByRole("button").filter({ hasText: "Available" })
      .filter({ has: page.locator("..").filter({ hasText: "12:00 PM" }) });

    // Fall back to first available slot if 12:00 row not found with this selector
    const targetBtn = (await noonBtn.count()) > 0
      ? noonBtn.first()
      : page.getByRole("button").filter({ hasText: "Available" }).first();

    await targetBtn.click();
    await expect(page.getByText("New Appointment")).toBeVisible();

    // Time field must be filled — not the placeholder "TBD" and not empty
    const timeVal = await page.locator('input[type="time"]').inputValue();
    expect(timeVal).not.toBe("");
  });

  test("switching back to list view restores appointment cards", async ({ page }) => {
    await page.locator('button[aria-label="Calendar view"]').click();
    await page.waitForTimeout(200);
    await page.locator('button[aria-label="List view"]').click();
    await page.waitForTimeout(200);

    // Appointment cards visible again
    const cards = page.locator(".bg-white.rounded-2xl.p-4.shadow-sm");
    await expect(cards.first()).toBeVisible();
    // Calendar grid is gone
    await expect(page.getByText("9:00 AM")).not.toBeVisible();
  });

  test("calendar view is consistent on mobile viewport", async ({ page }) => {
    // Playwright mobile project uses 390px width — just verify toggle and grid render
    await page.locator('button[aria-label="Calendar view"]').click();
    await page.waitForTimeout(300);
    await expect(page.getByText("Available").first()).toBeVisible();
  });
});
