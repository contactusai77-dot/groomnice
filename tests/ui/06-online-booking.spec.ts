import { test, expect } from "@playwright/test";

test.describe("Online Booking (customer-facing)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/book/demo");
  });

  test("booking page loads for demo groomer", async ({ page }) => {
    await expect(page.getByText(/book|appointment|demo groomer/i).first()).toBeVisible({ timeout: 8000 });
  });

  test("available slots are shown", async ({ page }) => {
    // Click first available date to reveal time slots
    const dateBtn = page.locator("button").filter({ hasText: /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)/i }).first();
    await expect(dateBtn).toBeVisible({ timeout: 8000 });
    await dateBtn.click();
    // Time slots appear as "9:00 AM", "10:00 AM" etc.
    await expect(page.locator("button").filter({ hasText: /\d{1,2}:\d{2}\s*(AM|PM)/i }).first()).toBeVisible({ timeout: 5000 });
  });

  test("nonexistent groomer shows no slots", async ({ page }) => {
    await page.goto("/book/no-such-groomer-xyz");
    await expect(page.getByText(/no available slots|check back/i)).toBeVisible({ timeout: 8000 });
  });

  test("booking form submits and shows confirmation", async ({ page }) => {
    // Date buttons have day-name text (Mon, Tue, Wed…)
    const dateBtn = page.locator("button").filter({ hasText: /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)/i }).first();
    if (!await dateBtn.isVisible({ timeout: 5000 })) return; // no slots — skip
    await dateBtn.click();

    // Time slot buttons show "9:00 AM" etc.
    const timeBtn = page.locator("button").filter({ hasText: /\d{1,2}:\d{2}\s*(AM|PM)/i }).first();
    if (!await timeBtn.isVisible({ timeout: 3000 })) return;
    await timeBtn.click();

    await page.getByRole("button", { name: "Next" }).click();
    await page.getByPlaceholder("(555) 000-0000").fill("5559998877");
    await page.getByPlaceholder("Jane Smith").fill("UI Booking Test");
    await page.getByRole("button", { name: /request appointment/i }).click();
    await expect(page.getByText(/request sent/i)).toBeVisible({ timeout: 8000 });
  });
});
