import { test, expect } from "@playwright/test";
import { loginAsGroomer } from "./helpers";

test.describe("Vaccine Vault", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsGroomer(page);
    await page.getByRole("button", { name: /vault/i }).click();
  });

  test("vault tab loads", async ({ page }) => {
    await expect(page.getByText(/vault|vaccine/i).first()).toBeVisible({ timeout: 8000 });
  });

  test("shows pending submissions or empty state", async ({ page }) => {
    // Either submissions list or empty state message
    await expect(
      page.getByText(/pending|needs review|no submissions|upload|clear/i).first()
    ).toBeVisible({ timeout: 8000 });
  });
});
