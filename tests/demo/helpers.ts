import { Page } from "@playwright/test";

export const GROOMER = {
  email: "demo@groomnice.com",
  password: "demo1234",
};

export async function loginAsGroomer(page: Page) {
  await page.goto("/login");
  await page.waitForTimeout(700);
  await page.getByPlaceholder("you@example.com").fill(GROOMER.email);
  await page.waitForTimeout(400);
  await page.getByPlaceholder("••••••••").fill(GROOMER.password);
  await page.waitForTimeout(400);
  await page.getByRole("button", { name: "Sign In" }).click();
  await page.waitForURL(/\/(dashboard|today|\?|$)/, { timeout: 10_000 });
  await page.waitForTimeout(1000);
}
