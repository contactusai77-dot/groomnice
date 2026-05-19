import { test, expect } from "@playwright/test";
import { loginAsGroomer, GROOMER } from "./helpers";

test.describe("Auth", () => {
  test("login page loads", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByPlaceholder("you@example.com")).toBeVisible();
    await expect(page.getByPlaceholder("••••••••")).toBeVisible();
  });

  test("wrong password shows error", async ({ page }) => {
    await page.goto("/login");
    await page.getByPlaceholder("you@example.com").fill(GROOMER.email);
    await page.getByPlaceholder("••••••••").fill("wrongpassword");
    await page.getByRole("button", { name: "Sign In" }).click();
    await expect(page.getByText(/invalid|incorrect|wrong|error/i)).toBeVisible({ timeout: 5000 });
  });

  test("valid login reaches dashboard", async ({ page }) => {
    await loginAsGroomer(page);
    await expect(page).toHaveURL(/\/(dashboard|today|\?|$)/);
  });

  test("protected route redirects to login when unauthenticated", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/login/, { timeout: 5000 });
  });
});
