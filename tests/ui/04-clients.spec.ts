import { test, expect } from "@playwright/test";
import { loginAsGroomer } from "./helpers";

test.describe("Clients", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsGroomer(page);
    await page.getByRole("button", { name: /clients/i }).click();
    await expect(page.getByText(/jane smith/i)).toBeVisible({ timeout: 8000 });
  });

  test("clients list loads with seed data", async ({ page }) => {
    await expect(page.getByText(/jane smith/i)).toBeVisible();
    await expect(page.getByText(/marco rivera/i)).toBeVisible();
  });

  test("search filters clients", async ({ page }) => {
    const search = page.getByPlaceholder(/search/i);
    await search.fill("jane");
    await expect(page.getByText(/jane smith/i)).toBeVisible();
    await expect(page.getByText(/marco rivera/i)).not.toBeVisible({ timeout: 3000 });
    await search.clear();
  });

  test("clicking client opens edit drawer", async ({ page }) => {
    await page.getByText(/jane smith/i).click();
    await expect(page.getByText(/edit client/i)).toBeVisible({ timeout: 5000 });
  });

  test("client has pet info visible", async ({ page }) => {
    await page.getByText(/jane smith/i).click();
    // "Pets" section header appears in the drawer
    await expect(page.getByText(/^pets$/i)).toBeVisible({ timeout: 5000 });
  });

  test("vaccine status badge visible", async ({ page }) => {
    // vaccine_ok or expired badge somewhere on client list
    await expect(page.getByText(/vaccine|rabies|expired|valid/i).first()).toBeVisible({ timeout: 5000 });
  });
});
