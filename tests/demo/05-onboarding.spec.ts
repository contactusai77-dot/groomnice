/**
 * Demo: Self-Onboarding
 * A brand-new groomer registers and is walked through the 5-step setup:
 * business type → client import → working hours → pricing → booking URL live.
 */
import { test, expect } from "@playwright/test";

test("self onboarding workflow", async ({ page }) => {
  // Register a fresh demo account (unique per run)
  const ts = Date.now();
  const email = `demo.onboard.${ts}@groomnice.test`;
  const password = "Demo1234!";
  const name = `Demo Salon ${ts % 10000}`;

  await page.goto("/register");
  await page.waitForTimeout(800);

  // Fill registration form
  await page.getByPlaceholder("Sarah Johnson").fill(name);
  await page.waitForTimeout(400);
  await page.getByPlaceholder("sarah@example.com").fill(email);
  await page.waitForTimeout(400);
  await page.getByPlaceholder("••••••••").fill(password);
  await page.waitForTimeout(400);

  // Slug auto-fills; pause so viewer sees it
  await page.waitForTimeout(700);

  await page.getByRole("button", { name: /create|sign up|register/i }).click();

  // New account should redirect to /onboarding
  await page.waitForURL(/\/(onboarding|dashboard|\?|$)/, { timeout: 10_000 });

  // If landed on dashboard (onboarding_complete already true), force /onboarding
  if (!page.url().includes("/onboarding")) {
    const token = await page.evaluate(() => localStorage.getItem("token") ?? "");
    await page.request.patch("http://localhost:4000/api/settings", {
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      data: JSON.stringify({ onboarding_complete: false }),
    });
    await page.goto("/onboarding");
  }

  await page.waitForTimeout(1000);

  // ── Step 1: Business type ──
  await expect(page.getByText(/mobile|shop|studio/i).first()).toBeVisible({ timeout: 8000 });
  await page.waitForTimeout(1000);

  // Choose "Shop / Studio"
  const shopBtn = page.getByRole("button", { name: /shop|studio/i });
  if (await shopBtn.isVisible({ timeout: 2000 })) {
    await shopBtn.click();
    await page.waitForTimeout(500);
  }

  // Next → Step 2
  await page.getByRole("button", { name: /next/i }).click();
  await page.waitForTimeout(1000);

  // ── Step 2: CSV import (skip) ──
  await expect(page.getByText(/import|csv|upload/i).first()).toBeVisible({ timeout: 6000 });
  await page.waitForTimeout(1200);

  // Skip CSV import
  const skipBtn = page.getByRole("button", { name: /skip|next.*without/i })
    .or(page.getByText(/skip/i));
  if (await skipBtn.isVisible({ timeout: 2000 })) {
    await skipBtn.click();
  } else {
    // The "Next →" at the bottom of step 2 skips import
    await page.getByRole("button", { name: /next/i }).click();
  }
  await page.waitForTimeout(1000);

  // ── Step 3: Working hours ──
  await expect(page.getByText(/working hours|schedule|days/i).first()).toBeVisible({ timeout: 6000 });
  await page.waitForTimeout(1000);

  // Toggle Saturday on to show interactivity
  const satBtn = page.getByRole("button", { name: /^sat$/i });
  if (await satBtn.isVisible({ timeout: 2000 })) {
    await satBtn.click();
    await page.waitForTimeout(500);
    await satBtn.click(); // toggle back off
    await page.waitForTimeout(500);
  }

  await page.getByRole("button", { name: /next/i }).click();
  await page.waitForTimeout(1000);

  // ── Step 4: Service pricing ──
  await expect(page.getByText(/service|pricing|price/i).first()).toBeVisible({ timeout: 6000 });
  await page.waitForTimeout(1000);

  // Nudge Full Groom price to show it's editable
  const priceInput = page.locator("input[type='number']").first();
  if (await priceInput.isVisible({ timeout: 2000 })) {
    await priceInput.click();
    await priceInput.selectText();
    await priceInput.fill("80");
    await page.waitForTimeout(700);
  }

  // Finish → Step 5 (launch pad)
  await page.getByRole("button", { name: /finish|launch|done|save/i }).click();
  await page.waitForTimeout(1500);

  // ── Step 5: Launch pad ──
  await expect(page.getByText(/booking.*link|your.*url|live|ready/i).first()).toBeVisible({ timeout: 8000 });
  await page.waitForTimeout(2500);

  // Show the booking URL chip
  const bookingUrl = page.locator("input[readonly]").or(page.getByText(/groomnice|localhost.*book/i).first());
  if (await bookingUrl.isVisible({ timeout: 3000 })) {
    await bookingUrl.scrollIntoViewIfNeeded();
    await page.waitForTimeout(1500);
  }
});
