import { test, expect } from "@playwright/test";
import { loginAsGroomer } from "./helpers";

test.describe("Quick Booking", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsGroomer(page);
  });

  test("quick book form opens", async ({ page }) => {
    await page.getByRole("button", { name: /new.?appointment/i }).click();
    await expect(page.locator("input[type='tel']")).toBeVisible({ timeout: 5000 });
  });

  test("quick book creates appointment", async ({ page }) => {
    await page.getByRole("button", { name: /new.?appointment/i }).click();

    const phone = `555${Math.floor(Math.random() * 9000000 + 1000000)}`;
    await page.locator("input[type='tel']").fill(phone);

    const nameInput = page.getByPlaceholder("Jane Smith");
    if (await nameInput.isVisible()) await nameInput.fill("UI Test Client");

    const petInput = page.getByPlaceholder("Biscuit");
    if (await petInput.isVisible()) await petInput.fill("UI Dog");

    const timeInput = page.locator("input[type='time']");
    if (await timeInput.isVisible()) await timeInput.fill("14:00");

    await page.getByRole("button", { name: /book|save|confirm/i }).last().click();
    await expect(page.getByRole("heading", { name: /booking created/i })).toBeVisible({ timeout: 8000 });
  });
});
