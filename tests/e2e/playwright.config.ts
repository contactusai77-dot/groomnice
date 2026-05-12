import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./specs",
  timeout: 15_000,
  retries: 1,
  reporter: [["list"], ["html", { open: "never" }], ["json", { outputFile: "test-results.json" }]],

  // workers: 1 runs spec files sequentially so state mutations in one file
  // don't race with reads in another file. Each spec that mutates state
  // re-seeds via afterAll, so the next spec starts clean.
  workers: 1,

  use: {
    baseURL: "http://localhost:4001",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  globalSetup: "./global-setup.ts",

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile",
      // WebKit not available on Windows; emulate iPhone 14 viewport in Chromium
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
        userAgent: devices["iPhone 14"].userAgent,
      },
    },
  ],
});
