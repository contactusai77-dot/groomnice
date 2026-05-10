import { expect, test } from "@playwright/test";

test.describe("Today tab — groomer dashboard", () => {
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

  test("shows 7 appointment cards from seed data", async ({ page }) => {
    const cards = page.locator(".bg-white.rounded-2xl.p-4.shadow-sm");
    await expect(cards).toHaveCount(7);
  });

  test("shows status badges (Ready, No Vaccine, etc.)", async ({ page }) => {
    await expect(page.getByText("Ready").first()).toBeVisible();
    await expect(page.getByText("No Vaccine").first()).toBeVisible();
  });

  test("shows pet names and client names", async ({ page }) => {
    await expect(page.getByText("Biscuit")).toBeVisible();
    await expect(page.getByText("Jane Smith").first()).toBeVisible();
  });

  test("floating + button is visible", async ({ page }) => {
    const addBtn = page.locator('button[aria-label="New appointment"]');
    await expect(addBtn).toBeVisible();
  });

  test("+ button opens booking drawer", async ({ page }) => {
    await page.locator('button[aria-label="New appointment"]').click();
    await expect(page.getByText("New Appointment")).toBeVisible();
    await expect(page.getByPlaceholder("555-000-0000")).toBeVisible();
  });

  test("booking drawer creates a new appointment", async ({ page }) => {
    await page.locator('button[aria-label="New appointment"]').click();

    await page.getByPlaceholder("555-000-0000").fill("555-444-9999");
    await page.getByPlaceholder("Jane Smith").fill("E2E Test Client");
    await page.getByPlaceholder("Biscuit").fill("Buddy");

    await page.locator('select').selectOption("Bath");
    await page.locator('input[type="time"]').fill("15:00");

    await page.getByText("Create Booking →").click();

    await expect(page.getByText("Booking Created!")).toBeVisible();
    await expect(page.getByText("Copy Link")).toBeVisible();
  });

  test("Start button changes appointment to in_progress", async ({ page }) => {
    const startBtn = page.getByRole("button", { name: "Start" }).first();
    await startBtn.click();
    await expect(page.getByText("Grooming").first()).toBeVisible();
  });

  test("bottom nav has 5 tabs", async ({ page }) => {
    const nav = page.locator("nav");
    await expect(nav.getByRole("button")).toHaveCount(5);
    for (const label of ["Today", "Clients", "Reports", "Vault", "Settings"]) {
      await expect(nav.getByText(label)).toBeVisible();
    }
  });
});
