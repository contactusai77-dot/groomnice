import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/ui",
  timeout: 30_000,
  retries: 1,
  workers: 1, // sequential — one shared server

  reporter: [
    ["list"],
    ["html", { outputFolder: "tests/ui-results/html", open: "never" }],
    ["json", { outputFile: "tests/ui-results/results.json" }],
  ],

  use: {
    baseURL: "http://localhost:4000",
    headless: true,
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    trace: "on-first-retry",
    viewport: { width: 1280, height: 800 },
  },

  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile",
      use: { ...devices["iPhone 14"] },
    },
  ],
});
