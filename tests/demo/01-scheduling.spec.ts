/**
 * Demo: Groomer Scheduling
 * Shows the day view → appointment cards → creating a new booking end-to-end.
 */
import { test, expect } from "@playwright/test";
import { loginAsGroomer } from "./helpers";

test("groomer scheduling workflow", async ({ page }) => {
  await loginAsGroomer(page);

  // Show today's appointment list
  await expect(page.getByText(/today|dashboard/i).first()).toBeVisible({ timeout: 8000 });
  await page.waitForTimeout(1200);

  // Hover over the first appointment card to reveal action buttons
  const firstCard = page.locator(".rounded-2xl, .rounded-xl").filter({ hasText: /am|pm/i }).first();
  if (await firstCard.isVisible({ timeout: 3000 })) {
    await firstCard.hover();
    await page.waitForTimeout(1000);
  }

  // Open the New Appointment drawer
  await page.getByRole("button", { name: /new.?appointment/i }).click();
  await expect(page.locator("input[type='tel']")).toBeVisible({ timeout: 6000 });
  await page.waitForTimeout(800);

  // Fill in client phone
  const phone = `555${Math.floor(Math.random() * 9000000 + 1000000)}`;
  await page.locator("input[type='tel']").fill(phone);
  await page.waitForTimeout(500);

  // Client name
  const nameInput = page.getByPlaceholder("Jane Smith");
  if (await nameInput.isVisible({ timeout: 2000 })) {
    await nameInput.fill("Demo Client");
    await page.waitForTimeout(400);
  }

  // Pet name
  const petInput = page.getByPlaceholder("Biscuit");
  if (await petInput.isVisible({ timeout: 2000 })) {
    await petInput.fill("Coco");
    await page.waitForTimeout(400);
  }

  // Appointment time
  const timeInput = page.locator("input[type='time']");
  if (await timeInput.isVisible({ timeout: 2000 })) {
    await timeInput.fill("10:00");
    await page.waitForTimeout(400);
  }

  // Pause so viewer sees the filled form
  await page.waitForTimeout(1000);

  // Submit
  await page.getByRole("button", { name: /book|save|confirm/i }).last().click();

  // Confirm booking created
  await expect(page.getByRole("heading", { name: /booking created/i })).toBeVisible({ timeout: 8000 });
  await page.waitForTimeout(2000);
});
