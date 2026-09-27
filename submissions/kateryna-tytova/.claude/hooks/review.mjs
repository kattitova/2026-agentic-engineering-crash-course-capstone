#!/usr/bin/env node
// Opens the reviewer sub-agent in its own Windows Terminal window, on a named OpenSpec change.
//
//   node .claude/hooks/review.mjs add-drag-and-drop
//   node .claude/hooks/review.mjs add-drag-and-drop --bg    (background session instead of a window)
//
// Printed by the review-ready hook when a change has no unchecked tasks left. Run by hand — it is
// never launched automatically, so a review pass is only ever spent on purpose.
//
// Arguments are passed as an argv array, never through a shell string, so a change name needs no
// quoting and cannot be reinterpreted. The reviewer runs as the main thread of a fresh session
// (`claude --agent reviewer`), which is what keeps maker != checker: it starts with no knowledge of
// how the code came to be.
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..", "..");
const args = process.argv.slice(2);
const background = args.includes("--bg");
const change = args.find((a) => !a.startsWith("-"));

if (!change) {
  console.error("usage: node .claude/hooks/review.mjs <change-name> [--bg]");
  process.exit(1);
}

const changeDir = join(root, "openspec", "changes", change);
if (!existsSync(changeDir)) {
  console.error(`No active change "${change}" under openspec/changes/.`);
  console.error("Archived changes live under openspec/changes/archive/ and are named by date.");
  process.exit(1);
}

const prompt =
  `Review the OpenSpec change "${change}". Follow your agent definition: resolve the scope and ` +
  `the mode first, read docs/reviews/decisions.md and the previous reviews before raising ` +
  `anything, and write the result to its own file under docs/reviews/ with an explicit verdict.`;

// The reviewer's window is interactive on purpose: it will ask for permission for the commands it
// runs, and those prompts are worth seeing. Its own frontmatter already limits which tools it has.
const claudeArgs = background
  ? ["--agent", "reviewer", "--bg", "-p", prompt]
  : ["--agent", "reviewer", prompt];

if (background) {
  const child = spawn("claude", claudeArgs, { cwd: root, stdio: "inherit", shell: true });
  child.on("exit", (code) => process.exit(code ?? 0));
} else {
  // wt.exe parses options that follow the command, so the session is wrapped in `cmd /k`, which
  // takes the rest of the line verbatim and leaves the window open once the review finishes.
  const child = spawn(
    "wt.exe",
    ["new-tab", "--title", `review: ${change}`, "-d", root, "cmd", "/k", "claude", ...claudeArgs],
    { cwd: root, detached: true, stdio: "ignore" },
  );
  child.unref();
  console.log(`Opened a reviewer window for "${change}".`);
}
