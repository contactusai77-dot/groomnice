import { expect, test } from "@playwright/test";

test.describe("Reports tab", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/reports");
    await page.waitForLoadState("networkidle");
  });

  test("loads and shows revenue cards", async ({ page }) => {
    await expect(page.getByText("Reports").first()).toBeVisible();
    await expect(page.getByText("Today").first()).toBeVisible();
    await expect(page.getByText("This Week")).toBeVisible();
    await expect(page.getByText("This Month").first()).toBeVisible();
  });

  test("revenue cards show dollar amounts", async ({ page }) => {
    const dollarAmounts = page.locator("text=/\\$\\d+/");
    const count = await dollarAmounts.count();
    expect(count).toBeGreaterThanOrEqual(3);
  });

  test("shows by-service breakdown", async ({ page }) => {
    await expect(page.getByText("This Month by Service")).toBeVisible();
    const serviceRow = page.getByText(/Full Groom|Bath|Nail Trim/).first();
    await expect(serviceRow).toBeVisible();
  });

  test("shows appointment history section", async ({ page }) => {
    await expect(page.getByText("Appointment History").first()).toBeVisible();
  });

  test("history shows past appointments from seed data", async ({ page }) => {
    // Seed creates 10 past completed bookings shown in the history list
    const historyRows = page.locator(".rounded-2xl").filter({ hasText: /completed|canceled/ });
    const count = await historyRows.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test("search filters history by client name", async ({ page }) => {
    const searchInput = page.getByPlaceholder("Search by client or pet…");
    await expect(searchInput).toBeVisible();
    await searchInput.fill("Jane");
    await page.waitForTimeout(400);
    await expect(page.getByText("Jane Smith").first()).toBeVisible();
  });

  test("search with no match shows empty state", async ({ page }) => {
    const searchInput = page.getByPlaceholder("Search by client or pet…");
    await searchInput.fill("zzznomatch");
    await page.waitForTimeout(400);
    await expect(page.getByText("No past appointments yet")).toBeVisible();
  });

  test("month revenue is at least as large as week revenue", async ({ page }) => {
    // Use the 3-column grid cards (revenue summary grid)
    const grid = page.locator(".grid.grid-cols-3");
    const weekCard = grid.locator(".rounded-2xl").filter({ hasText: "This Week" });
    const monthCard = grid.locator(".rounded-2xl").filter({ hasText: "This Month" });
    const weekText = await weekCard.textContent();
    const monthText = await monthCard.textContent();
    const weekMatch = weekText?.match(/\$(\d+)/);
    const monthMatch = monthText?.match(/\$(\d+)/);
    if (weekMatch && monthMatch) {
      expect(Number(monthMatch[1])).toBeGreaterThanOrEqual(Number(weekMatch[1]));
    }
  });
});
