import { test, expect } from "@playwright/test";

test.describe("Feedback (public)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/feedback");
  });

  test("feedback page loads", async ({ page }) => {
    await expect(page.getByText(/feedback|bug|feature|suggest/i).first()).toBeVisible({ timeout: 8000 });
  });

  test("can submit a bug report", async ({ page }) => {
    // Select bug type if options visible
    const bugOption = page.getByRole("radio", { name: /bug/i })
      .or(page.getByLabel(/bug/i))
      .or(page.getByText(/bug/i).first());
    if (await bugOption.isVisible({ timeout: 2000 })) await bugOption.click();

    await page.locator("textarea").fill("UI test: bug report submission check");

    await page.getByRole("button", { name: /send|submit/i }).click();
    await expect(page.getByText(/thank|sent|success|received/i)).toBeVisible({ timeout: 8000 });
  });
});
