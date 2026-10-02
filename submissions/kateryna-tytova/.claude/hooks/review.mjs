#!/usr/bin/env node
// Opens a review agent in its own Windows Terminal window, on a named OpenSpec change.
//
//   node .claude/hooks/review.mjs add-drag-and-drop
//   node .claude/hooks/review.mjs add-drag-and-drop --bg
//   node .claude/hooks/review.mjs edit-and-delete-application --agent proposal-reviewer
//
// Two agents, one launcher, because the thing that makes a review worth having is the same for
// both: it runs as the main thread of a fresh session (`claude --agent <name>`), so it starts with
// no knowledge of how the work came to be. `reviewer` reviews the diff after apply;
// `proposal-reviewer` reviews the artifacts after propose. See AGENTS.md -> "Independent review".
//
// Printed by the review-ready hook when a change has no unchecked tasks left. Run by hand — it is
// never launched automatically, so a review pass is only ever spent on purpose.
//
// Arguments are passed as an argv array, never through a shell string, so a change name needs no
// quoting and cannot be reinterpreted.
//
// There is deliberately NO way to add anything to the prompt. A review agent is told which change
// to look at and nothing else: what to look for belongs in its agent definition, which it reads
// cold, and not in a prompt written by the session whose work is under review. A handed-over list
// of suspicions turns an independent pass into the execution of someone else's checklist — the
// agent then finds what it was pointed at, and the author's blind spots become the review's. So
// anything after the change name that is not a known flag is refused, rather than appended.
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..", "..");

// Per agent: the settings file that enforces what its own definition only promises, and the one
// sentence of scope it is given. Both prompts name the ledger and the earlier passes, because
// "do not raise what is already settled" is the rule most easily lost in a cold session.
const AGENTS = {
  reviewer: {
    settings: "reviewer-settings.json",
    outputDir: "docs/reviews/",
    prompt: (change) =>
      `Review the OpenSpec change "${change}". Follow your agent definition: resolve the scope and ` +
      `the mode first, read docs/reviews/decisions.md and the previous reviews before raising ` +
      `anything, and write the result to its own file under docs/reviews/ with an explicit verdict.`,
  },
  "proposal-reviewer": {
    settings: "proposal-reviewer-settings.json",
    outputDir: "docs/proposal-reviews/",
    prompt: (change) =>
      `Review the proposal for the OpenSpec change "${change}" — its artifacts, not its code. ` +
      `Follow your agent definition: resolve the scope and the pass first, read ` +
      `docs/reviews/decisions.md and any earlier pass under docs/proposal-reviews/ before raising ` +
      `anything, and write the result to its own file under docs/proposal-reviews/ with an ` +
      `explicit verdict.`,
  },
};

const usage = [
  "usage: node .claude/hooks/review.mjs <change-name> [--agent <name>] [--bg]",
  `  --agent   ${Object.keys(AGENTS).join(" | ")}   (default: reviewer)`,
  "  --bg      background session instead of a terminal window",
  "",
  "The prompt is fixed. The agent is given the change name and nothing else, on purpose.",
].join("\n");

const args = process.argv.slice(2);
const background = args.includes("--bg");

// Parse positionally so an unknown flag, or a second bare word that looks like an instruction,
// stops the launch instead of being silently ignored or passed along.
const positional = [];
let agentName = "reviewer";
for (let i = 0; i < args.length; i += 1) {
  const arg = args[i];
  if (arg === "--bg") continue;
  if (arg === "--agent") {
    agentName = args[i + 1] ?? "";
    i += 1;
    continue;
  }
  if (arg.startsWith("--agent=")) {
    agentName = arg.slice("--agent=".length);
    continue;
  }
  if (arg.startsWith("-")) {
    console.error(`Unknown option "${arg}".\n\n${usage}`);
    process.exit(1);
  }
  positional.push(arg);
}

if (positional.length === 0) {
  console.error(usage);
  process.exit(1);
}

if (positional.length > 1) {
  console.error(`Expected one change name, got ${positional.length}: ${positional.join(", ")}.`);
  console.error("Extra words are not appended to the prompt — see the comment at the top of this");
  console.error("file. If the agent needs to know something, it belongs in its definition.");
  process.exit(1);
}

const agent = AGENTS[agentName];
if (!agent) {
  console.error(`No review agent named "${agentName}". Known: ${Object.keys(AGENTS).join(", ")}.`);
  process.exit(1);
}

const [change] = positional;
const changeDir = join(root, "openspec", "changes", change);
if (!existsSync(changeDir)) {
  console.error(`No active change "${change}" under openspec/changes/.`);
  console.error("Archived changes live under openspec/changes/archive/ and are named by date.");
  process.exit(1);
}

// Auto mode, so the review runs without stopping to confirm each read, git command and test run.
// The permission prompts it replaces were the only HARD stop on a review agent editing what it
// reviews — "never fix anything" and "never edit the proposal" are prompt-level contracts, not
// enforced ones — so each agent's settings file denies writes to every path its role forbids, and
// denies the git and install commands it has no business running. Deny rules outrank auto mode, so
// what is left is exactly that review's own output directory and its index.
//
// This is also why launching one of these agents as an in-process sub-agent is not equivalent: a
// sub-agent inherits the parent session's permissions, and the settings file below never applies.
const settings = join(root, ".claude", agent.settings);
const prompt = agent.prompt(change);
const base = ["--agent", agentName, "--settings", settings, "--permission-mode", "auto"];
const claudeArgs = background ? [...base, "--bg", "-p", prompt] : [...base, prompt];

if (background) {
  const child = spawn("claude", claudeArgs, { cwd: root, stdio: "inherit", shell: true });
  child.on("exit", (code) => process.exit(code ?? 0));
} else {
  // wt.exe parses options that follow the command, so the session is wrapped in `cmd /k`, which
  // takes the rest of the line verbatim and leaves the window open once the review finishes.
  const child = spawn(
    "wt.exe",
    ["new-tab", "--title", `${agentName}: ${change}`, "-d", root, "cmd", "/k", "claude", ...claudeArgs],
    { cwd: root, detached: true, stdio: "ignore" },
  );
  child.unref();
  console.log(`Opened a ${agentName} window for "${change}" — output goes to ${agent.outputDir}`);
}
