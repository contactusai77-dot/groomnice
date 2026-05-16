import { expect, test } from "@playwright/test";

const API = "http://localhost:8002";

test.describe("Settings — Gap Fill Waitlist", () => {
  test.afterAll(async ({ request }) => {
    // Remove any entries added during tests
    const r = await request.get(`${API}/api/waitlist`);
    const entries = await r.json();
    for (const e of entries) {
      await request.delete(`${API}/api/waitlist/${e.id}`);
    }
    await request.post(`${API}/api/seed?key=dev`);
  });

  test.beforeEach(async ({ page }) => {
    await page.goto("/settings");
    await page.waitForLoadState("networkidle");
  });

  test("Gap Fill Waitlist section heading is visible", async ({ page }) => {
    await expect(page.getByText("Gap Fill Waitlist")).toBeVisible();
  });

  test("section explains when clients are notified", async ({ page }) => {
    await expect(page.getByText(/slot opens due to a cancellation/i)).toBeVisible();
  });

  test("name, phone inputs and Add button are present", async ({ page }) => {
    await expect(page.getByPlaceholder("Name")).toBeVisible();
    await expect(page.getByPlaceholder("Phone")).toBeVisible();
    await expect(page.getByRole("button", { name: "Add" })).toBeVisible();
  });

  test("adding an entry shows it in the list", async ({ page }) => {
    await page.getByPlaceholder("Name").fill("E2E Waitlist User");
    await page.getByPlaceholder("Phone").fill("555-800-0001");
    await page.getByRole("button", { name: "Add" }).click();
    await page.waitForTimeout(400);

    await expect(page.getByText("E2E Waitlist User")).toBeVisible();
    await expect(page.getByText("555-800-0001")).toBeVisible();
  });

  test("name and phone inputs clear after adding", async ({ page }) => {
    await page.getByPlaceholder("Name").fill("Clear Test");
    await page.getByPlaceholder("Phone").fill("555-800-0002");
    await page.getByRole("button", { name: "Add" }).click();
    await page.waitForTimeout(400);

    await expect(page.getByPlaceholder("Name")).toHaveValue("");
    await expect(page.getByPlaceholder("Phone")).toHaveValue("");
  });

  test("remove button deletes the entry from the list", async ({ page }) => {
    // Add an entry to remove
    await page.getByPlaceholder("Name").fill("Remove Me E2E");
    await page.getByPlaceholder("Phone").fill("555-800-0003");
    await page.getByRole("button", { name: "Add" }).click();
    await page.waitForTimeout(400);
    await expect(page.getByText("Remove Me E2E")).toBeVisible();

    // Click the remove button on that entry's row
    const entryRow = page.locator(".flex.items-center.gap-3").filter({ hasText: "Remove Me E2E" });
    await entryRow.getByRole("button", { name: "Remove" }).click();
    await page.waitForTimeout(400);

    await expect(page.getByText("Remove Me E2E")).not.toBeVisible();
  });

  test("multiple entries are all visible after adding", async ({ page }) => {
    await page.getByPlaceholder("Name").fill("Multi A");
    await page.getByPlaceholder("Phone").fill("555-800-0011");
    await page.getByRole("button", { name: "Add" }).click();
    await page.waitForTimeout(300);

    await page.getByPlaceholder("Name").fill("Multi B");
    await page.getByPlaceholder("Phone").fill("555-800-0012");
    await page.getByRole("button", { name: "Add" }).click();
    await page.waitForTimeout(300);

    await expect(page.getByText("Multi A")).toBeVisible();
    await expect(page.getByText("Multi B")).toBeVisible();
  });

  test("entries persist after page reload", async ({ page }) => {
    await page.getByPlaceholder("Name").fill("Persist Test");
    await page.getByPlaceholder("Phone").fill("555-800-0020");
    await page.getByRole("button", { name: "Add" }).click();
    await page.waitForTimeout(400);

    await page.reload();
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("Persist Test")).toBeVisible();
  });

  test("gap fill toggle is still visible alongside the waitlist", async ({ page }) => {
    // Verify existing automation toggle still renders (no layout regression)
    await expect(page.getByText("Send 'Fill My Gap' text on cancel")).toBeVisible();
  });
});
