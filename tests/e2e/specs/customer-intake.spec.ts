import { expect, test } from "@playwright/test";

/**
 * Customer-facing flows: /profile/{token} and /vaccine/{token}.
 * Token is the client's intake_token — exposed via /api/clients.
 */

let intakeToken: string;

test.beforeAll(async ({ request }) => {
  // Re-seed so we have a known state
  await request.post("http://localhost:8002/api/seed?key=dev");

  // Get Jane Smith's intake token (first client that has one)
  const res = await request.get("http://localhost:8002/api/clients");
  const clients = await res.json();
  const jane = clients.find((c: { name: string }) => c.name === "Jane Smith");
  intakeToken = jane?.intake_token;
  if (!intakeToken) throw new Error("No intake_token found for Jane Smith in seed data");
});

test.describe("Pet profile page", () => {
  test("loads pet profile for valid token", async ({ page }) => {
    await page.goto(`/profile/${intakeToken}`);
    await page.waitForLoadState("networkidle");
    // Should show either the list of pets or the intake form
    const title = page.getByText(/Hi Jane|Your pets on file|Your Pet/i).first();
    await expect(title).toBeVisible();
  });

  test("shows pet name in list", async ({ page }) => {
    await page.goto(`/profile/${intakeToken}`);
    await page.waitForLoadState("networkidle");
    // Jane has Biscuit (profile_complete=true), so list phase shows
    await expect(page.getByText("Biscuit")).toBeVisible();
  });

  test("shows Edit button for existing pet", async ({ page }) => {
    await page.goto(`/profile/${intakeToken}`);
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("button", { name: "Edit" }).first()).toBeVisible();
  });

  test("edit pet shows form with breed and age fields", async ({ page }) => {
    await page.goto(`/profile/${intakeToken}`);
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: "Edit" }).first().click();
    await expect(page.getByText("Breed")).toBeVisible();
    await expect(page.getByText("Age")).toBeVisible();
    await expect(page.getByText("Weight")).toBeVisible();
  });

  test("edit pet shows current pet name in input", async ({ page }) => {
    await page.goto(`/profile/${intakeToken}`);
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: "Edit" }).first().click();
    const petNameInput = page.locator('input[placeholder="Biscuit"]');
    await expect(petNameInput).toBeVisible();
  });

  test("shows Add Pet button", async ({ page }) => {
    await page.goto(`/profile/${intakeToken}`);
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(/Add another pet/i)).toBeVisible();
  });

  test("invalid token shows error", async ({ page }) => {
    await page.goto("/profile/invalid-token-xyz");
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(/invalid|expired/i)).toBeVisible();
  });
});

test.describe("Vaccine upload page", () => {
  test("loads vaccine page for valid token", async ({ page }) => {
    await page.goto(`/vaccine/${intakeToken}`);
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(/vaccine|rabies|cert/i).first()).toBeVisible();
  });

  test("shows file upload UI", async ({ page }) => {
    await page.goto(`/vaccine/${intakeToken}`);
    await page.waitForLoadState("networkidle");
    const uploadArea = page.locator('input[type="file"]').or(
      page.getByText(/upload|drag|photo|camera/i).first()
    );
    await expect(uploadArea.first()).toBeVisible();
  });
});
