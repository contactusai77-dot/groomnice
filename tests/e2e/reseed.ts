import { test } from "@playwright/test";

/**
 * Teardown: runs after chromium project finishes.
 * Re-seeds the backend so mobile project gets clean data.
 * Must be a separate file from setup.ts to prevent Playwright from caching it.
 */
test("reseed after chromium", async ({ request }) => {
  const res = await request.post("http://localhost:8002/api/seed?key=dev");
  if (!res.ok()) {
    throw new Error(`Reseed failed: ${res.status()} ${await res.text()}`);
  }
  const data = await res.json();
  console.log(`\n  Reseeded DB for mobile run: ${data.date}\n`);
});
