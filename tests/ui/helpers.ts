import { Page } from "@playwright/test";

export const BASE = "http://localhost:4000";
export const API  = "http://localhost:8002";

export const GROOMER = { email: "demo@groomnice.com", password: "demo1234" };
export const ADMIN_KEY = "admin-dev";

export async function loginAsGroomer(page: Page) {
  await page.goto("/login");
  await page.getByPlaceholder("you@example.com").fill(GROOMER.email);
  await page.getByPlaceholder("••••••••").fill(GROOMER.password);
  await page.getByRole("button", { name: "Sign In" }).click();
  await page.waitForURL(/\/(dashboard|today|\?|$)/, { timeout: 10_000 });
}

export async function apiGet(path: string) {
  const r = await fetch(`${API}${path}`);
  return r.json();
}
