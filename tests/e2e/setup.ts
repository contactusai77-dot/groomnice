import { test } from "@playwright/test";

/**
 * Runs as a Playwright project dependency — seeds the backend before each
 * browser project so state-mutating tests in one project don't bleed into the next.
 */
test("seed database", async ({ request }) => {
  const res = await request.post("http://localhost:8002/api/seed?key=dev");
  if (!res.ok()) {
    throw new Error(`Seed failed: ${res.status()} ${await res.text()}`);
  }
  const data = await res.json();
  console.log(`\n  Seeded DB for date: ${data.date}\n`);
});
