import { defineConfig, devices } from "@playwright/test";

const PORT = 3210;
const BASE_URL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  // The suite mutates one shared database, so the specs cannot overlap.
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env["CI"],
  reporter: process.env["CI"] ? "list" : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // A production build, not `next dev`, for two reasons: Next refuses a second
    // dev server for the same directory, so a run would fail whenever one is
    // already open; and a build removes the first-compile delay that otherwise
    // shows up as a timeout on the first test.
    command: `npm run e2e:db && npm run build && npx next start --port ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: false,
    timeout: 180_000,
    stdout: "pipe",
    stderr: "pipe",
    // Points the built app at the disposable database. dev.db is the developer's
    // real tracker and the suite must never reach it.
    env: { DATABASE_URL: "file:./e2e.db" },
  },
});
