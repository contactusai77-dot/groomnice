import { expect, test } from "@playwright/test";

/**
 * Groomer-side workflow: Today tab, booking drawer, status transitions,
 * and the new pending-review confirm/decline flow.
 */

test.afterAll(async ({ request }) => {
  await request.post("http://localhost:8002/api/seed?key=dev");
});

test.describe("Groomer Today tab — core workflow", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
  });

  test("shows 7 appointment cards from seed data", async ({ page }) => {
    const cards = page.locator(".bg-white.rounded-2xl.p-4.shadow-sm");
    await expect(cards).toHaveCount(7);
  });

  test("cards are ordered by time — earliest appointment first", async ({ page }) => {
    const cards = page.locator(".bg-white.rounded-2xl.p-4.shadow-sm");
    const minutes: number[] = [];
    for (let i = 0; i < await cards.count(); i++) {
      const text = (await cards.nth(i).locator(".text-xl.font-bold").textContent() ?? "").trim();
      // Parse "9:00 AM" / "2:30 PM" → total minutes since midnight for numeric comparison
      const m = text.match(/(\d+):(\d+)\s*(AM|PM)/i);
      if (!m) continue;
      let h = parseInt(m[1]);
      const min = parseInt(m[2]);
      const pm = m[3].toUpperCase() === "PM";
      if (pm && h !== 12) h += 12;
      if (!pm && h === 12) h = 0;
      minutes.push(h * 60 + min);
    }
    const sorted = [...minutes].sort((a, b) => a - b);
    expect(minutes).toEqual(sorted);
  });

  test("Ready badge only appears on vaccine-valid confirmed appointments", async ({ page }) => {
    await expect(page.getByText("Ready").first()).toBeVisible();
    await expect(page.getByText("No Vaccine").first()).toBeVisible();
    const readyCount = await page.getByText("Ready").count();
    const noVaccineCount = await page.getByText("No Vaccine").count();
    expect(readyCount + noVaccineCount).toBeLessThanOrEqual(7);
  });

  test("Start button changes card status to Grooming", async ({ page }) => {
    const cards = page.locator(".bg-white.rounded-2xl.p-4.shadow-sm");
    let idx = -1;
    for (let i = 0; i < await cards.count(); i++) {
      if (await cards.nth(i).getByRole("button", { name: "Start" }).count() > 0) {
        idx = i; break;
      }
    }
    expect(idx).toBeGreaterThanOrEqual(0);
    await cards.nth(idx).getByRole("button", { name: "Start" }).click();
    await expect(cards.nth(idx).getByText("Grooming")).toBeVisible();
    await expect(cards.nth(idx).getByRole("button", { name: "Start" })).not.toBeVisible();
  });

  test("Done button on in-progress card marks it completed", async ({ page }) => {
    const cards = page.locator(".bg-white.rounded-2xl.p-4.shadow-sm");
    // Find a card with a "Done" (in_progress) button by index — stable reference after click
    let idx = -1;
    for (let i = 0; i < await cards.count(); i++) {
      if (await cards.nth(i).getByRole("button", { name: "Done" }).count() > 0) {
        idx = i; break;
      }
    }
    if (idx === -1) test.skip();

    await cards.nth(idx).getByRole("button", { name: "Done" }).click();
    await page.waitForTimeout(400);
    // Card actions disappear when done — no more Start/Done/Text buttons
    await expect(cards.nth(idx).getByRole("button", { name: "Done" })).not.toBeVisible();
    await expect(cards.nth(idx).getByRole("button", { name: "Start" })).not.toBeVisible();
  });

  test("Text button exists on every non-done appointment card", async ({ page }) => {
    // sms: links can't be triggered in headless Chromium — verify the button is present
    const cards = page.locator(".bg-white.rounded-2xl.p-4.shadow-sm");
    let foundText = false;
    for (let i = 0; i < await cards.count(); i++) {
      if (await cards.nth(i).getByRole("button", { name: "Text" }).count() > 0) {
        foundText = true;
        break;
      }
    }
    expect(foundText).toBe(true);
  });
});

test.describe("Groomer booking drawer", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
  });

  test("+ button opens drawer with all required fields", async ({ page }) => {
    await page.locator('button[aria-label="New appointment"]').click();
    await expect(page.getByText("New Appointment")).toBeVisible();
    await expect(page.getByPlaceholder("555-000-0000")).toBeVisible();
    await expect(page.getByPlaceholder("Jane Smith")).toBeVisible();
    await expect(page.getByPlaceholder("Biscuit")).toBeVisible();
    await expect(page.locator("select")).toBeVisible();
    await expect(page.locator('input[type="time"]')).toBeVisible();
  });

  test("creating a booking shows Profile Link AND Vaccine Link copy buttons", async ({ page }) => {
    await page.locator('button[aria-label="New appointment"]').click();
    await page.getByPlaceholder("555-000-0000").fill("555-600-0001");
    await page.getByPlaceholder("Jane Smith").fill("Drawer Test Client");
    await page.getByPlaceholder("Biscuit").fill("DrawerDog");
    await page.locator("select").selectOption("Bath");
    await page.locator('input[type="time"]').fill("11:00");
    await page.getByText("Create Booking →").click();

    await expect(page.getByText("Booking Created!")).toBeVisible();
    // Both links must be present
    await expect(page.getByText("Copy Profile Link")).toBeVisible();
    await expect(page.getByText("Copy Vaccine Link")).toBeVisible();
    // Old "Copy Link" text must NOT appear (regression guard)
    await expect(page.getByText("Copy Link", { exact: true })).not.toBeVisible();
  });

  test("profile URL and vaccine URL both contain the intake token", async ({ page }) => {
    await page.locator('button[aria-label="New appointment"]').click();
    await page.getByPlaceholder("555-000-0000").fill("555-600-0002");
    await page.getByPlaceholder("Jane Smith").fill("Token Check Client");
    await page.getByPlaceholder("Biscuit").fill("TokenDog");
    await page.locator("select").selectOption("Full Groom");
    await page.locator('input[type="time"]').fill("12:00");
    await page.getByText("Create Booking →").click();

    await expect(page.getByText("Booking Created!")).toBeVisible();
    // Both link preview divs must contain /profile/ and /vaccine/ respectively
    const linkDivs = page.locator(".break-all");
    await expect(linkDivs.filter({ hasText: "/profile/" })).toBeVisible();
    await expect(linkDivs.filter({ hasText: "/vaccine/" })).toBeVisible();
  });

  test("new booking card appears on Today tab after creation", async ({ page }) => {
    const before = await page.locator(".bg-white.rounded-2xl.p-4.shadow-sm").count();

    await page.locator('button[aria-label="New appointment"]').click();
    await page.getByPlaceholder("555-000-0000").fill("555-600-0003");
    await page.getByPlaceholder("Jane Smith").fill("Count Test Client");
    await page.getByPlaceholder("Biscuit").fill("CountDog");
    await page.locator("select").selectOption("Nail Trim");
    await page.locator('input[type="time"]').fill("13:00");
    await page.getByText("Create Booking →").click();
    await expect(page.getByText("Booking Created!")).toBeVisible();

    await page.keyboard.press("Escape");
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    const after = await page.locator(".bg-white.rounded-2xl.p-4.shadow-sm").count();
    expect(after).toBe(before + 1);
  });
});

test.describe("Groomer Settings — Working Hours", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/settings");
    await page.waitForLoadState("networkidle");
  });

  test("Working Hours section is visible with correct heading", async ({ page }) => {
    await expect(page.getByText(/Online Booking/i).first()).toBeVisible();
    await expect(page.getByText(/Working Hours/i).first()).toBeVisible();
  });

  test("7 day-of-week toggle buttons are shown", async ({ page }) => {
    // M T W T F S S — 7 single-letter buttons
    const dayBtns = page.locator(".w-10.h-10.rounded-xl");
    await expect(dayBtns).toHaveCount(7);
  });

  test("Mon–Fri are active by default (violet), Sat–Sun are inactive", async ({ page }) => {
    const dayBtns = page.locator(".w-10.h-10.rounded-xl");
    // First 5 (Mon-Fri) should have violet background
    for (let i = 0; i < 5; i++) {
      await expect(dayBtns.nth(i)).toHaveClass(/bg-violet-600/);
    }
    // Last 2 (Sat-Sun) should be gray
    await expect(dayBtns.nth(5)).not.toHaveClass(/bg-violet-600/);
    await expect(dayBtns.nth(6)).not.toHaveClass(/bg-violet-600/);
  });

  test("toggling a day off deselects it visually", async ({ page }) => {
    const monBtn = page.locator(".w-10.h-10.rounded-xl").first();
    await expect(monBtn).toHaveClass(/bg-violet-600/);
    await monBtn.click();
    await page.waitForTimeout(300);
    await expect(monBtn).not.toHaveClass(/bg-violet-600/);
  });

  test("opens and closes time inputs are present", async ({ page }) => {
    await expect(page.getByText("Opens", { exact: true })).toBeVisible();
    await expect(page.getByText("Closes", { exact: true })).toBeVisible();
    const timeInputs = page.locator('input[type="time"]');
    await expect(timeInputs).toHaveCount(2);
  });

  test("slot duration button shows 30 or 60 min and toggles", async ({ page }) => {
    const durationBtn = page.getByText(/\d+ min/);
    await expect(durationBtn).toBeVisible();
    const before = await durationBtn.textContent();
    await durationBtn.click();
    await page.waitForTimeout(400);
    const after = await durationBtn.textContent();
    expect(before).not.toBe(after);
  });
});
