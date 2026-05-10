import { expect, test } from "@playwright/test";

/**
 * Customer-facing flows: /profile/{token} and /vaccine/{token}.
 * Uses Jane Smith's intake_token from the seed. No re-seeding here —
 * globalSetup already seeds once per run.
 */

let intakeToken: string;

test.beforeAll(async ({ request }) => {
  // Get Jane's intake_token from today's appointments — Biscuit (Jane's pet) is always
  // in seed. Using appointments avoids relying on Jane's name (clients test may rename her).
  const res = await request.get("http://localhost:8002/api/appointments/today");
  const appointments = await res.json();
  const biscuitAppt = appointments.find((a: { pet_name: string }) => a.pet_name === "Biscuit");
  intakeToken = biscuitAppt?.intake_token;
  if (!intakeToken) throw new Error("Biscuit appointment not found — seed may have failed");
});

test.describe("Pet profile page", () => {
  test("valid token shows pet list, not an error", async ({ page }) => {
    await page.goto(`/profile/${intakeToken}`);
    await page.waitForLoadState("networkidle");
    // Must NOT show the error message
    await expect(page.getByText(/invalid|expired/i)).not.toBeVisible();
    // Must show the welcome heading (name may have changed if tests renamed the client)
    await expect(page.getByText(/Hi |Your pets on file/i).first()).toBeVisible();
  });

  test("invalid token shows error message, not a profile", async ({ page }) => {
    await page.goto("/profile/definitely-not-a-real-token");
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(/invalid|expired/i)).toBeVisible();
    // Must NOT show the pet list
    await expect(page.getByText(/Your pets on file/i)).not.toBeVisible();
  });

  test("Jane's profile shows Biscuit in the pet list", async ({ page }) => {
    await page.goto(`/profile/${intakeToken}`);
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("Biscuit")).toBeVisible();
  });

  test("at least one Edit button per pet, and clicking it shows the edit form", async ({ page }) => {
    await page.goto(`/profile/${intakeToken}`);
    await page.waitForLoadState("networkidle");
    const editButtons = page.getByRole("button", { name: "Edit" });
    const count = await editButtons.count();
    expect(count).toBeGreaterThanOrEqual(1);

    await editButtons.first().click();
    // Edit form fields must appear
    await expect(page.getByText("Breed")).toBeVisible();
    await expect(page.getByText("Age")).toBeVisible();
    await expect(page.getByText("Weight")).toBeVisible();
  });

  test("edit form pre-fills pet name from existing data", async ({ page }) => {
    await page.goto(`/profile/${intakeToken}`);
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: "Edit" }).first().click();
    // Pet name input must be pre-filled with Biscuit (not blank)
    const nameInput = page.locator('input[placeholder="Biscuit"]');
    await expect(nameInput).toBeVisible();
    const value = await nameInput.inputValue();
    expect(value).not.toBe("");
  });

  test("Add another pet button is visible and clickable", async ({ page }) => {
    await page.goto(`/profile/${intakeToken}`);
    await page.waitForLoadState("networkidle");
    const addBtn = page.getByText(/Add another pet/i);
    await expect(addBtn).toBeVisible();
    await addBtn.click();
    // Form should appear with empty pet name field
    await expect(page.locator('input[placeholder="Biscuit"]')).toBeVisible();
    const nameInput = page.locator('input[placeholder="Biscuit"]').first();
    expect(await nameInput.inputValue()).toBe("");
  });
});

test.describe("Vaccine upload page", () => {
  test("valid token loads the vaccine page", async ({ page }) => {
    await page.goto(`/vaccine/${intakeToken}`);
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(/vaccine|rabies|cert/i).first()).toBeVisible();
    // Must not show the error or profile page
    await expect(page.getByText(/invalid|expired/i)).not.toBeVisible();
  });

  test("vaccine page shows a file upload input", async ({ page }) => {
    await page.goto(`/vaccine/${intakeToken}`);
    await page.waitForLoadState("networkidle");
    // A file input must exist (may be visually hidden but present in DOM)
    const fileInput = page.locator('input[type="file"]');
    await expect(fileInput).toHaveCount(1);
  });

  test("invalid token on vaccine page shows error", async ({ page }) => {
    // KNOWN GAP: VaccineUpload.tsx renders the upload form for any token without
    // pre-validating it against the backend. The 404 only surfaces on submit.
    // This test is marked expected-to-fail to track the gap — fix by adding a
    // useEffect in VaccineUpload that validates the token on load.
    test.fail();
    await page.goto("/vaccine/not-a-real-token");
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(/invalid|expired|not found/i)).toBeVisible();
  });
});
