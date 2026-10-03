import { spawn } from "node:child_process";

/**
 * Starts the dev server against demo.db instead of dev.db.
 *
 * A script rather than `DATABASE_URL=... next dev` in package.json, because
 * that inline form does not work in the Windows shell npm uses. Extra arguments
 * are passed to `next dev`, e.g. `npm run demo -- -H 0.0.0.0` to open the demo
 * from a phone on the same network.
 */
const child = spawn("npx", ["next", "dev", ...process.argv.slice(2)], {
  stdio: "inherit",
  shell: process.platform === "win32",
  env: { ...process.env, DATABASE_URL: "file:./demo.db" },
});

child.on("exit", (code) => {
  process.exitCode = code ?? 0;
});
