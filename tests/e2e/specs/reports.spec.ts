import { expect, test } from "@playwright/test";

test.describe("Reports tab", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/reports");
    await page.waitForLoadState("networkidle");
  });

  test("loads page with Reports heading and three revenue cards", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Reports" })).toBeVisible();
    // Exactly three period cards in the summary grid
    const grid = page.locator(".grid.grid-cols-3");
    await expect(grid.locator(".rounded-2xl")).toHaveCount(3);
  });

  test("each revenue card shows a non-negative dollar amount", async ({ page }) => {
    const grid = page.locator(".grid.grid-cols-3");
    for (const label of ["Today", "This Week", "This Month"]) {
      const card = grid.locator(".rounded-2xl").filter({ hasText: label });
      await expect(card).toBeVisible();
      // Must show a dollar value like $0 or $120 — NOT just any $ on the page
      const text = await card.textContent();
      expect(text).toMatch(/\$\d+/);
    }
  });

  test("month revenue is always >= week >= today", async ({ page }) => {
    const grid = page.locator(".grid.grid-cols-3");
    function extractDollar(text: string | null) {
      const m = text?.match(/\$(\d+)/);
      return m ? Number(m[1]) : -1;
    }
    const todayAmt = extractDollar(await grid.locator(".rounded-2xl").filter({ hasText: "Today" }).textContent());
    const weekAmt = extractDollar(await grid.locator(".rounded-2xl").filter({ hasText: "This Week" }).textContent());
    const monthAmt = extractDollar(await grid.locator(".rounded-2xl").filter({ hasText: "This Month" }).textContent());
    expect(weekAmt).toBeGreaterThanOrEqual(todayAmt);
    expect(monthAmt).toBeGreaterThanOrEqual(weekAmt);
  });

  test("by-service section shows named services with revenue", async ({ page }) => {
    await expect(page.getByText("This Month by Service")).toBeVisible();
    // Seed has Full Groom and Bath — at least one must appear
    const svcRow = page.getByText(/Full Groom|Bath|Nail Trim/).first();
    await expect(svcRow).toBeVisible();
    // Each service row shows a dollar amount
    const dollarInSection = page.locator(".bg-white.rounded-2xl.p-4").filter({ hasText: "by Service" }).locator("text=/\\$\\d+/");
    await expect(dollarInSection.first()).toBeVisible();
  });

  test("appointment history section always renders (not gated on revenue load)", async ({ page }) => {
    await expect(page.getByText("Appointment History").first()).toBeVisible();
  });

  test("history shows exactly 10 past completed entries from seed", async ({ page }) => {
    // Seed creates exactly 10 past bookings — any variance catches seed or query bugs
    const rows = page.locator(".space-y-2 > .rounded-2xl");
    await expect(rows).toHaveCount(10);
  });

  test("each history row shows date, pet, client, service, and price", async ({ page }) => {
    const firstRow = page.locator(".space-y-2 > .rounded-2xl").first();
    await expect(firstRow).toBeVisible();
    const rowText = await firstRow.textContent();
    // Should include a month abbreviation (Jan/Feb/etc), a name, a service, and a price
    expect(rowText).toMatch(/Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec/);
    expect(rowText).toMatch(/\$\d+/);
    expect(rowText).toMatch(/Full Groom|Bath|Nail Trim|Teeth Brushing|De-Shed|Puppy Bath/);
  });

  test("search filters history and hides non-matching rows", async ({ page }) => {
    const totalBefore = await page.locator(".space-y-2 > .rounded-2xl").count();
    expect(totalBefore).toBe(10);

    await page.getByPlaceholder("Search by client or pet…").fill("Jane");
    await page.waitForTimeout(400);

    const filtered = await page.locator(".space-y-2 > .rounded-2xl").count();
    expect(filtered).toBeGreaterThanOrEqual(1);
    // Filtered list must be SMALLER than unfiltered
    expect(filtered).toBeLessThan(totalBefore);
    // Jane Smith must be visible
    await expect(page.getByText("Jane Smith").first()).toBeVisible();
  });

  test("search with no match shows empty state, not history rows", async ({ page }) => {
    await page.getByPlaceholder("Search by client or pet…").fill("zzznomatch");
    await page.waitForTimeout(400);
    await expect(page.getByText("No past appointments yet")).toBeVisible();
    // No rows should remain
    const count = await page.locator(".space-y-2 > .rounded-2xl").count();
    expect(count).toBe(0);
  });
});
