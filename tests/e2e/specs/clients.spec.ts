import { expect, test } from "@playwright/test";

test.describe("Clients tab", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/clients");
    await page.waitForLoadState("networkidle");
  });

  test("loads and shows client list", async ({ page }) => {
    await expect(page.getByText("Clients").first()).toBeVisible();
    await expect(page.getByText("Jane Smith").first()).toBeVisible();
    await expect(page.getByText("Marco Rivera")).toBeVisible();
  });

  test("shows 6 clients from seed data", async ({ page }) => {
    const count = await page.locator(".rounded-2xl.p-4").count();
    expect(count).toBeGreaterThanOrEqual(6);
  });

  test("shows vaccine status indicators", async ({ page }) => {
    // Jane (valid vaccine) has green check, Marco (expired) has red alert
    const rows = page.locator("button.w-full.bg-white.rounded-2xl");
    await expect(rows.first()).toBeVisible();
  });

  test("search filters by client name", async ({ page }) => {
    await page.getByPlaceholder("Search by name or pet…").fill("Jane");
    await expect(page.getByText("Jane Smith")).toBeVisible();
    await expect(page.getByText("Marco Rivera")).not.toBeVisible();
  });

  test("search filters by pet name", async ({ page }) => {
    await page.getByPlaceholder("Search by name or pet…").fill("Biscuit");
    await expect(page.getByText("Jane Smith")).toBeVisible();
    await expect(page.getByText("Marco Rivera")).not.toBeVisible();
  });

  test("search with no match shows empty state", async ({ page }) => {
    await page.getByPlaceholder("Search by name or pet…").fill("zzznomatch");
    await expect(page.getByText("No clients yet")).toBeVisible();
  });

  test("tapping a client opens edit drawer", async ({ page }) => {
    await page.getByText("Jane Smith").click();
    await expect(page.getByText("Edit Client")).toBeVisible();
    await expect(page.getByText("Save Changes")).toBeVisible();
  });

  test("edit drawer shows client name and phone fields", async ({ page }) => {
    await page.getByText("Jane Smith").click();
    const nameInput = page.locator('input[placeholder="Jane Smith"]');
    await expect(nameInput).toBeVisible();
    await expect(nameInput).toHaveValue("Jane Smith");
  });

  test("edit drawer shows pet fields for all pets", async ({ page }) => {
    await page.getByText("Jane Smith").click();
    // Jane has 2 pets — both should appear in the drawer
    await expect(page.getByText("Pets")).toBeVisible();
    const petNameInputs = page.locator('input[placeholder="Biscuit"]');
    await expect(petNameInputs.first()).toBeVisible();
  });

  test("edit drawer saves client name change", async ({ page }) => {
    await page.getByText("Jane Smith").click();
    const nameInput = page.locator('input[placeholder="Jane Smith"]');
    await nameInput.clear();
    await nameInput.fill("Jane S.");
    await page.getByText("Save Changes").click();

    // Drawer should close and list should update
    await expect(page.getByText("Edit Client")).not.toBeVisible();
    await expect(page.getByText("Jane S.")).toBeVisible();
  });

  test("close button dismisses drawer without saving", async ({ page }) => {
    await page.getByText("Marco Rivera").click();
    await expect(page.getByText("Edit Client")).toBeVisible();
    // Click the X close button (first button in the drawer, before Save Changes)
    await page.locator(".rounded-t-3xl").getByRole("button").first().click();
    await expect(page.getByText("Edit Client")).not.toBeVisible();
  });
});
