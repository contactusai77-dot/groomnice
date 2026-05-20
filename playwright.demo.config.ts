import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/demo",
  outputDir: "./demo/recordings",
  retries: 0,
  workers: 1,
  timeout: 120_000,
  use: {
    baseURL: "http://localhost:4000",
    video: "on",
    viewport: { width: 1280, height: 800 },
    actionTimeout: 15_000,
    navigationTimeout: 15_000,
  },
  reporter: [["list"]],
});
