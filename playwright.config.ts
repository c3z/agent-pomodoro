import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  retries: 1,
  reporter: [["list"], ["html"]],
  use: {
    baseURL: process.env.STAGING_URL || "http://localhost:5173",
    screenshot: "only-on-failure",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
  webServer: process.env.STAGING_URL
    ? undefined
    : {
        command: "npm run dev",
        env: { VITE_CLERK_PUBLISHABLE_KEY: "" },
        port: 5173,
        reuseExistingServer: true,
        timeout: 30_000,
      },
});
