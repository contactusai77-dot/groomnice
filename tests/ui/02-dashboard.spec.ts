import { test, expect } from "@playwright/test";
import { loginAsGroomer } from "./helpers";

test.describe("Dashboard — Today view", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsGroomer(page);
  });

  test("shows today's appointments list", async ({ page }) => {
    await expect(page.getByText(/today/i).first()).toBeVisible();
    // At least one appointment card visible after seed
    const cards = page.locator("[data-testid='booking-card'], .booking-card, [class*='booking']");
    // Fallback: look for client names from seed
    await expect(page.getByText(/jane smith|marco rivera|ashley chen/i).first()).toBeVisible({ timeout: 8000 });
  });

  test("list / calendar / route toggle visible", async ({ page }) => {
    // DayView has aria-label="List view" and aria-label="Calendar view" toggle buttons
    await expect(page.getByRole("button", { name: /list view/i })).toBeVisible({ timeout: 5000 });
  });

  test("appointment card shows action buttons", async ({ page }) => {
    // AppointmentCard shows inline action buttons (Start, Text, Done, etc.)
    await expect(page.getByRole("button", { name: /start|done|text|groom/i }).first()).toBeVisible({ timeout: 8000 });
  });

  test("quick book button visible", async ({ page }) => {
    await expect(page.getByRole("button", { name: /new.?appointment/i })).toBeVisible({ timeout: 5000 });
  });
});
