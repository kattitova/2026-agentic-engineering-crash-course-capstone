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
  projects: [
    // 1280px is exactly the xl breakpoint, so this project only ever sees the
    // five columns on one row.
    { name: "wide", use: { ...devices["Desktop Chrome"] } },
    // Below xl the grid wraps and Offer lands directly under Wishlist at the
    // same left edge. A keyboard step across that boundary is the case a review
    // pass found broken, and the wide project cannot see it.
    { name: "wrapped", use: { ...devices["Desktop Chrome"], viewport: { width: 1100, height: 900 } } },
  ],
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
