/**
 * Demo: MoeGo → Groomnice Data Transfer (Self-Onboarding)
 *
 * A new groomer registers, lands in the onboarding wizard, and imports a
 * MoeGo-style CSV export.  The importer auto-maps columns and creates 6 clients
 * in one click — no re-typing, no data loss.
 *
 * CSV fixtures/moego-export.csv contains 6 clients with:
 *   - Client First/Last Name (mapped → client_name)
 *   - Mobile Phone           (mapped → client_phone)
 *   - Pet Name + Pet Breed   (mapped → pet_name, breed)
 *   - Rabies Expiry Date     (mapped → rabies_expiry)
 *   - Grooming Notes         (mapped → notes)
 */
import * as path from "path";
import { test, expect } from "@playwright/test";

const CSV_PATH = path.join(__dirname, "fixtures", "moego-export.csv");

test("moego to groomnice data transfer", async ({ page }) => {
  // Register a fresh demo groomer (unique per run)
  const ts = Date.now();
  const email = `moego.demo.${ts}@groomnice.test`;
  const password = "Transfer2024!";
  const bizName = `MoeGo Migrator ${ts % 10000}`;

  await page.goto("/register");
  await page.waitForTimeout(800);

  await page.getByPlaceholder("Sarah Johnson").fill(bizName);
  await page.waitForTimeout(400);
  await page.getByPlaceholder("sarah@example.com").fill(email);
  await page.waitForTimeout(400);
  await page.getByPlaceholder("••••••••").fill(password);
  await page.waitForTimeout(600);

  await page.getByRole("button", { name: /create|sign up|register/i }).click();
  await page.waitForURL(/\/(onboarding|dashboard|\?|$)/, { timeout: 12_000 });

  // If redirected to dashboard instead of onboarding, force it
  if (!page.url().includes("/onboarding")) {
    await page.evaluate(async () => {
      const t = localStorage.getItem("token") ?? "";
      await fetch("/api/settings", {
        method: "PATCH",
        headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
        body: JSON.stringify({ onboarding_complete: false }),
      });
    });
    await page.goto("/onboarding");
  }
  await page.waitForTimeout(1000);

  // ── Step 1: Business type — choose "Shop / Studio" ──────────────────────────
  await expect(page.getByText(/mobile|shop|studio/i).first()).toBeVisible({ timeout: 8000 });
  await page.waitForTimeout(800);
  const shopBtn = page.getByRole("button", { name: /shop|studio/i });
  if (await shopBtn.isVisible({ timeout: 2000 })) {
    await shopBtn.click();
    await page.waitForTimeout(500);
  }
  await page.getByRole("button", { name: /next/i }).click();
  await page.waitForTimeout(1000);

  // ── Step 2: CSV import — the MoeGo handoff ───────────────────────────────────
  await expect(page.getByText(/import|csv|upload/i).first()).toBeVisible({ timeout: 8000 });
  await page.waitForTimeout(1000);

  // Upload the MoeGo CSV via the hidden file input
  const fileInput = page.locator("input[type='file'][accept='.csv']");
  await fileInput.setInputFiles(CSV_PATH);
  await page.waitForTimeout(2000);

  // Show the column-mapping preview that appears after upload
  const mappingArea = page.getByText(/client name|phone|pet name|breed/i).first();
  if (await mappingArea.isVisible({ timeout: 8000 })) {
    await mappingArea.scrollIntoViewIfNeeded();
    await page.waitForTimeout(1500);
  }

  // Scroll through sample rows to show the data
  await page.mouse.wheel(0, 250);
  await page.waitForTimeout(800);
  await page.mouse.wheel(0, 250);
  await page.waitForTimeout(800);
  await page.mouse.wheel(0, -400);
  await page.waitForTimeout(600);

  // Click "Apply import"
  const applyBtn = page.getByRole("button", { name: /apply|import/i });
  if (await applyBtn.isVisible({ timeout: 5000 })) {
    await applyBtn.click();
    await page.waitForTimeout(2000);
  }

  // Show import result: "X clients imported"
  const importResult = page.getByText(/imported|client.*added|success/i).first();
  if (await importResult.isVisible({ timeout: 8000 })) {
    await importResult.scrollIntoViewIfNeeded();
    await page.waitForTimeout(1500);
  }

  // ── Step 3: Working hours ────────────────────────────────────────────────────
  await page.getByRole("button", { name: /next/i }).click();
  await page.waitForTimeout(1000);

  await expect(page.getByText(/working hours|schedule|days/i).first()).toBeVisible({ timeout: 6000 });
  await page.waitForTimeout(1000);

  await page.getByRole("button", { name: /next/i }).click();
  await page.waitForTimeout(1000);

  // ── Step 4: Service pricing ──────────────────────────────────────────────────
  await expect(page.getByText(/service|pricing/i).first()).toBeVisible({ timeout: 6000 });
  await page.waitForTimeout(1000);

  await page.getByRole("button", { name: /finish|launch|done|save/i }).click();
  await page.waitForTimeout(1500);

  // ── Step 5: Launch pad — show live booking URL ───────────────────────────────
  await expect(page.getByText(/booking.*link|your.*url|live|ready/i).first()).toBeVisible({ timeout: 8000 });
  await page.waitForTimeout(2500);
});
