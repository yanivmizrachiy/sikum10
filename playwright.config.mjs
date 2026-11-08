import { defineConfig, devices } from "@playwright/test";
const port = Number(process.env.SIKUM10_PORT || 8765);
const origin = "http://127.0.0.1:" + port;
export default defineConfig({
  testDir: "./tests",
  testMatch: "site.spec.mjs",
  timeout: 30000,
  expect: { timeout: 8000 },
  use: { baseURL: origin, trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], locale: "he-IL" } }],
  webServer: {
    command: (process.platform === "win32" ? "python" : "python3") + " -m http.server " + port + " --bind 127.0.0.1",
    url: origin,
    reuseExistingServer: !process.env.CI,
    timeout: 20000
  },
  reporter: "list",
  outputDir: "test-results"
});
