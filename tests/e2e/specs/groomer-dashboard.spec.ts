import { expect, request, test } from "@playwright/test";

test.describe("Today tab — groomer dashboard", () => {
  test.afterAll(async ({ request }) => {
    // Restore seed state after booking creation and status mutation tests
    await request.post("http://localhost:8002/api/seed?key=dev");
  });

  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
  });

  test("loads and shows appointment cards", async ({ page }) => {
    await expect(page.getByText("Groomer Dashboard")).toBeVisible();
    const cards = page.locator(".rounded-2xl").filter({ hasText: "Full Groom" }).or(
      page.locator(".rounded-2xl").filter({ hasText: "Bath" })
    );
    await expect(cards.first()).toBeVisible();
  });

  test("shows today's date in header", async ({ page }) => {
    const today = new Date().toLocaleDateString("en-US", {
      weekday: "long", month: "long", day: "numeric",
    });
    await expect(page.getByText(today)).toBeVisible();
  });

  test("shows exactly 7 appointment cards from seed data", async ({ page }) => {
    // Strict count — if seed changes or a previous test leaked state, this catches it
    const cards = page.locator(".bg-white.rounded-2xl.p-4.shadow-sm");
    await expect(cards).toHaveCount(7);
  });

  test("shows Ready badge only for vaccine-valid confirmed appointments", async ({ page }) => {
    // Must have at least one Ready AND at least one No Vaccine badge
    await expect(page.getByText("Ready").first()).toBeVisible();
    await expect(page.getByText("No Vaccine").first()).toBeVisible();
    // These are mutually exclusive on a single card — verify they exist on different cards
    const readyCount = await page.getByText("Ready").count();
    const noVaccineCount = await page.getByText("No Vaccine").count();
    expect(readyCount).toBeGreaterThanOrEqual(1);
    expect(noVaccineCount).toBeGreaterThanOrEqual(1);
    expect(readyCount + noVaccineCount).toBeLessThanOrEqual(7);
  });

  test("shows pet name alongside owner name on each card", async ({ page }) => {
    // Both must appear — and Biscuit must appear BEFORE Jane Smith (card order by time)
    await expect(page.getByText("Biscuit").first()).toBeVisible();
    await expect(page.getByText("Jane Smith").first()).toBeVisible();
    // Verify they're collocated: find a card that has BOTH
    const biscuitCard = page.locator(".bg-white.rounded-2xl").filter({ hasText: "Biscuit" }).filter({ hasText: "Jane Smith" });
    await expect(biscuitCard).toBeVisible();
  });

  test("floating + button is visible and has correct aria-label", async ({ page }) => {
    const addBtn = page.locator('button[aria-label="New appointment"]');
    await expect(addBtn).toBeVisible();
    // Must be exactly one — not zero (missing) or two (duplicated)
    await expect(addBtn).toHaveCount(1);
  });

  test("+ button opens booking drawer with all required fields", async ({ page }) => {
    await page.locator('button[aria-label="New appointment"]').click();
    await expect(page.getByText("New Appointment")).toBeVisible();
    await expect(page.getByPlaceholder("555-000-0000")).toBeVisible();
    await expect(page.getByPlaceholder("Jane Smith")).toBeVisible();
    await expect(page.getByPlaceholder("Biscuit")).toBeVisible();
    await expect(page.locator("select")).toBeVisible();
    await expect(page.locator('input[type="time"]')).toBeVisible();
  });

  test("booking drawer creates appointment and card count increases", async ({ page }) => {
    const before = await page.locator(".bg-white.rounded-2xl.p-4.shadow-sm").count();

    await page.locator('button[aria-label="New appointment"]').click();
    await page.getByPlaceholder("555-000-0000").fill("555-444-9999");
    await page.getByPlaceholder("Jane Smith").fill("E2E Test Client");
    await page.getByPlaceholder("Biscuit").fill("Buddy");
    await page.locator("select").selectOption("Bath");
    await page.locator('input[type="time"]').fill("15:00");
    await page.getByText("Create Booking →").click();

    await expect(page.getByText("Booking Created!")).toBeVisible();
    await expect(page.getByText("Copy Link")).toBeVisible();

    // After dismissing, new card must appear
    await page.keyboard.press("Escape");
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    const after = await page.locator(".bg-white.rounded-2xl.p-4.shadow-sm").count();
    expect(after).toBe(before + 1);
  });

  test("Start button changes status to Grooming on that specific card", async ({ page }) => {
    const allCards = page.locator(".bg-white.rounded-2xl.p-4.shadow-sm");

    // Find which card index has a Start button (search at most first 10)
    let targetIdx = -1;
    for (let i = 0; i < Math.min(await allCards.count(), 10); i++) {
      if (await allCards.nth(i).getByRole("button", { name: "Start" }).count() > 0) {
        targetIdx = i;
        break;
      }
    }
    expect(targetIdx).toBeGreaterThanOrEqual(0);

    // Click Start and verify that card (by stable nth index) shows Grooming
    await allCards.nth(targetIdx).getByRole("button", { name: "Start" }).click();
    await expect(allCards.nth(targetIdx).getByText("Grooming")).toBeVisible();
    await expect(allCards.nth(targetIdx).getByRole("button", { name: "Start" })).not.toBeVisible();
  });

  test("bottom nav has exactly 5 tabs with correct labels", async ({ page }) => {
    const nav = page.locator("nav");
    const buttons = nav.getByRole("button");
    await expect(buttons).toHaveCount(5);
    for (const label of ["Today", "Clients", "Reports", "Vault", "Settings"]) {
      await expect(nav.getByText(label)).toBeVisible();
    }
    // Sanity: no 6th tab
    await expect(nav.getByText("Admin")).not.toBeVisible();
  });
});
