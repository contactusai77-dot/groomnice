/**
 * Demo: MoeGo → Groomnice Data Transfer (Self-Onboarding)
 *
 * Shows realistic data discrepancy handling:
 *   - "Client First Name" + "Client Last Name" are separate MoeGo columns →
 *     the importer does NOT auto-combine them; groomer manually maps one column
 *   - Derek O'Brien has no Rabies Expiry Date → flagged as issue after import
 *   - All other columns (Mobile Phone, Pet Name, Breed, Notes) auto-map correctly
 *
 * CSV fixtures/moego-export.csv contains 6 clients.
 */
import * as path from "path";
import { test, expect } from "@playwright/test";
import { showCaption } from "./helpers";

const CSV_PATH = path.join(__dirname, "fixtures", "moego-export.csv");

test("moego to groomnice data transfer — with discrepancy handling", async ({ page }) => {
  const ts = Date.now();
  const email = `moego.demo.${ts}@groomnice.test`;
  const password = "Transfer2024!";
  const bizName = `Happy Paws Studio`;

  // ── Register a fresh groomer ──────────────────────────────────────────────────
  await page.goto("/register");
  await page.waitForTimeout(800);

  await showCaption(page, "Migrating 6 clients from MoeGo to Groomnice", 2800, "scenario");

  await page.getByPlaceholder("Sarah Johnson").fill(bizName);
  await page.waitForTimeout(400);
  await page.getByPlaceholder("sarah@example.com").fill(email);
  await page.waitForTimeout(400);
  await page.getByPlaceholder("••••••••").fill(password);
  await page.waitForTimeout(600);

  await page.getByRole("button", { name: /create|sign up|register/i }).click();
  await page.waitForURL(/\/(onboarding|dashboard|\?|$)/, { timeout: 12_000 });

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

  // ── Step 1: Business type ─────────────────────────────────────────────────────
  await expect(page.getByText(/mobile|shop|studio/i).first()).toBeVisible({ timeout: 8000 });
  await page.waitForTimeout(800);
  const shopBtn = page.getByRole("button", { name: /shop|studio/i });
  if (await shopBtn.isVisible({ timeout: 2000 })) {
    await shopBtn.click();
    await page.waitForTimeout(500);
  }
  await page.getByRole("button", { name: /next/i }).click();
  await page.waitForTimeout(1000);

  // ── Step 2: CSV upload ────────────────────────────────────────────────────────
  await expect(page.getByText(/import|csv|upload/i).first()).toBeVisible({ timeout: 8000 });
  await page.waitForTimeout(800);

  await showCaption(page, "Step 1: Upload MoeGo CSV export — no reformatting needed", 2800, "scenario");

  const fileInput = page.locator("input[type='file'][accept='.csv']");
  await fileInput.setInputFiles(CSV_PATH);
  await page.waitForTimeout(2200);

  // ── Show column mapping ───────────────────────────────────────────────────────
  const mappingArea = page.getByText(/client name|phone|pet name|breed/i).first();
  if (await mappingArea.isVisible({ timeout: 8000 })) {
    await mappingArea.scrollIntoViewIfNeeded();
    await page.waitForTimeout(1000);
  }

  await showCaption(
    page,
    "Groomnice auto-detects column types from MoeGo headers",
    2800,
    "note"
  );
  await page.waitForTimeout(600);

  // Highlight the discrepancy: First/Last Name columns
  await showCaption(
    page,
    "⚠️  Data discrepancy: MoeGo splits name into 'First Name' + 'Last Name'",
    3200,
    "note"
  );

  // Scroll to see the column selects
  await page.mouse.wheel(0, 250);
  await page.waitForTimeout(900);

  // Manually map "Client First Name" to client_name
  const selects = page.locator("select");
  const count = await selects.count();
  if (count > 0) {
    // First select likely corresponds to first CSV column (Client First Name)
    await selects.first().scrollIntoViewIfNeeded();
    await page.waitForTimeout(600);
    await showCaption(page, "Groomer maps 'Client First Name' → Client Name field", 2600, "note");
    await selects.first().selectOption("client_name");
    await page.waitForTimeout(1200);
  }

  await page.mouse.wheel(0, 250);
  await page.waitForTimeout(700);

  await showCaption(
    page,
    "Phone, Pet Name, Breed, Notes — all auto-mapped correctly ✅",
    2800,
    "note"
  );

  await page.mouse.wheel(0, -600);
  await page.waitForTimeout(600);

  // ── Apply import ──────────────────────────────────────────────────────────────
  await showCaption(page, "Applying import — 6 clients transferred in one click", 2600, "scenario");

  const applyBtn = page.getByRole("button", { name: /apply|import/i });
  if (await applyBtn.isVisible({ timeout: 5000 })) {
    await applyBtn.scrollIntoViewIfNeeded();
    await applyBtn.hover();
    await page.waitForTimeout(600);
    await applyBtn.click();
    await page.waitForTimeout(2200);
  }

  // ── Import result + issues panel ──────────────────────────────────────────────
  const importResult = page.getByText(/imported|client.*added|success/i).first();
  if (await importResult.isVisible({ timeout: 8000 })) {
    await importResult.scrollIntoViewIfNeeded();
    await page.waitForTimeout(1000);
  }

  await showCaption(page, "6 clients imported — let's check for issues", 2400, "note");

  // Click the issues / warnings button if visible
  const issuesBtn = page.getByRole("button", { name: /issue|warning|problem/i });
  if (await issuesBtn.isVisible({ timeout: 4000 })) {
    await issuesBtn.scrollIntoViewIfNeeded();
    await issuesBtn.hover();
    await page.waitForTimeout(700);
    await issuesBtn.click();
    await page.waitForTimeout(1400);

    await showCaption(
      page,
      "⚠️  Derek O'Brien — no Rabies Expiry Date on file (flagged for follow-up)",
      3400,
      "note"
    );
    await page.waitForTimeout(800);
  }

  await showCaption(
    page,
    "All client records transferred — Vaccine Vault tracks compliance going forward",
    3000,
    "scenario"
  );
  await page.waitForTimeout(800);

  // ── Continue onboarding ───────────────────────────────────────────────────────
  await page.getByRole("button", { name: /next/i }).click();
  await page.waitForTimeout(1000);

  await expect(page.getByText(/working hours|schedule|days/i).first()).toBeVisible({ timeout: 6000 });
  await page.waitForTimeout(1000);

  await page.getByRole("button", { name: /next/i }).click();
  await page.waitForTimeout(1000);

  await expect(page.getByText(/service|pricing/i).first()).toBeVisible({ timeout: 6000 });
  await page.waitForTimeout(1000);

  await page.getByRole("button", { name: /finish|launch|done|save/i }).click();
  await page.waitForTimeout(1500);

  await expect(page.getByText(/booking.*link|your.*url|live|ready/i).first()).toBeVisible({ timeout: 8000 });
  await page.waitForTimeout(2000);
});
