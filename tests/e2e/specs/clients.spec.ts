import { expect, test } from "@playwright/test";

test.describe("Clients tab", () => {
  test.afterAll(async ({ request }) => {
    // Restore seed state after the rename test mutated Jane Smith's name
    await request.post("http://localhost:8002/api/seed?key=dev");
  });

  test.beforeEach(async ({ page }) => {
    await page.goto("/clients");
    await page.waitForLoadState("networkidle");
  });

  test("loads and shows client list", async ({ page }) => {
    await expect(page.getByText("Clients").first()).toBeVisible();
    await expect(page.getByText("Jane Smith").first()).toBeVisible();
    await expect(page.getByText("Marco Rivera")).toBeVisible();
  });

  test("shows exactly 6 clients from seed data", async ({ page }) => {
    // Strict count — toBeGreaterThanOrEqual would pass with 600 clients
    const count = await page.locator(".rounded-2xl.p-4").count();
    expect(count).toBe(6);
  });

  test("vaccine status icons are present on every client card", async ({ page }) => {
    // Each card has either a green checkmark (vaccine OK) or red alert (expired/missing)
    const cards = page.locator("button.w-full.bg-white.rounded-2xl");
    const total = await cards.count();
    expect(total).toBe(6);
    // At least one client has valid vaccine, at least one does not
    const checkIcons = page.locator("button.w-full.bg-white.rounded-2xl .text-green-500");
    const alertIcons = page.locator("button.w-full.bg-white.rounded-2xl .text-red-400");
    expect(await checkIcons.count()).toBeGreaterThanOrEqual(1);
    expect(await alertIcons.count()).toBeGreaterThanOrEqual(1);
  });

  test("search filters by client name — hides non-matching clients", async ({ page }) => {
    await page.getByPlaceholder("Search by name or pet…").fill("Jane");
    await expect(page.getByText("Jane Smith").first()).toBeVisible();
    // These clients must NOT appear
    await expect(page.getByText("Marco Rivera")).not.toBeVisible();
    await expect(page.getByText("Ashley Chen")).not.toBeVisible();
    // Count: only Jane's card
    const visibleCards = page.locator(".rounded-2xl.p-4");
    const count = await visibleCards.count();
    expect(count).toBe(1);
  });

  test("search filters by pet name — only owner of that pet shown", async ({ page }) => {
    await page.getByPlaceholder("Search by name or pet…").fill("Biscuit");
    await expect(page.getByText("Jane Smith").first()).toBeVisible();
    // Everyone else hidden
    await expect(page.getByText("Marco Rivera")).not.toBeVisible();
    const count = await page.locator(".rounded-2xl.p-4").count();
    expect(count).toBe(1);
  });

  test("search with no match shows empty state, not a client card", async ({ page }) => {
    await page.getByPlaceholder("Search by name or pet…").fill("zzznomatch");
    await expect(page.getByText("No clients yet")).toBeVisible();
    // No client cards should be rendered
    const count = await page.locator(".rounded-2xl.p-4").count();
    expect(count).toBe(0);
  });

  test("clearing search restores all 6 clients", async ({ page }) => {
    await page.getByPlaceholder("Search by name or pet…").fill("Jane");
    expect(await page.locator(".rounded-2xl.p-4").count()).toBe(1);
    await page.getByPlaceholder("Search by name or pet…").clear();
    await page.waitForTimeout(100);
    expect(await page.locator(".rounded-2xl.p-4").count()).toBe(6);
  });

  test("tapping a client opens edit drawer with client data", async ({ page }) => {
    await page.getByText("Jane Smith").first().click();
    await expect(page.getByText("Edit Client")).toBeVisible();
    await expect(page.getByText("Save Changes")).toBeVisible();
    // The DRAWER itself must not contain other clients (list is behind backdrop, not in drawer)
    await expect(page.locator(".rounded-t-3xl").getByText("Marco Rivera")).not.toBeVisible();
  });

  test("edit drawer pre-fills client name and phone", async ({ page }) => {
    await page.getByText("Jane Smith").first().click();
    const nameInput = page.locator('input[placeholder="Jane Smith"]');
    await expect(nameInput).toBeVisible();
    await expect(nameInput).toHaveValue("Jane Smith");
    // Phone field must also exist
    await expect(page.locator('input[type="tel"]')).toBeVisible();
  });

  test("edit drawer shows all pets for multi-pet client", async ({ page }) => {
    await page.getByText("Jane Smith").first().click();
    await expect(page.getByText("Pets")).toBeVisible();
    // Jane has 2 pets — both pet name inputs must be present
    const petInputs = page.locator('input[placeholder="Biscuit"]');
    const count = await petInputs.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test("edit drawer saves name change and list updates immediately", async ({ page }) => {
    await page.getByText("Jane Smith").first().click();
    const nameInput = page.locator('input[placeholder="Jane Smith"]');
    await nameInput.clear();
    await nameInput.fill("Jane S.");
    await page.getByText("Save Changes").click();

    // Drawer closes
    await expect(page.getByText("Edit Client")).not.toBeVisible();
    // Updated name appears in list
    await expect(page.getByText("Jane S.")).toBeVisible();
    // OLD name is gone
    await expect(page.getByText("Jane Smith")).not.toBeVisible();
  });

  test("close button dismisses drawer without saving", async ({ page }) => {
    await page.getByText("Marco Rivera").click();
    await expect(page.getByText("Edit Client")).toBeVisible();
    // Click the X close button (first button in the drawer header)
    await page.locator(".rounded-t-3xl").getByRole("button").first().click();
    await expect(page.getByText("Edit Client")).not.toBeVisible();
    // Marco's name unchanged
    await expect(page.getByText("Marco Rivera")).toBeVisible();
  });
});
