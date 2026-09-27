#!/usr/bin/env node
// Claude Code PostToolUse hook: announces when an OpenSpec change has no unchecked tasks left.
//
// There is no "openspec apply finished" event — apply is a skill, so a hook on the Skill tool
// would fire when it STARTS. The signal used instead is the tasks file itself: the moment an
// active change under openspec/changes/ has at least one `- [x]` and no `- [ ]` left, the change
// is implemented and ready for an independent review pass.
//
// The hook itself never launches anything: an automatic review would spend a full pass without
// being asked for. It tells the user (systemMessage) and tells the agent (additionalContext) to
// OFFER the review, so agreeing in one word is enough and the launch still needs a human yes.
// Either way the reviewer runs as a separate cold process (see .claude/hooks/review.mjs).
//
// Announced once per change per task-set signature, tracked in .agent-log/review-ready.json, so
// editing the file again stays quiet — but adding new tasks and finishing those announces again.
// The hook never blocks the agent: any error -> exit 0 silently.
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

let raw = "";
process.stdin.setEncoding("utf8");
for await (const chunk of process.stdin) raw += chunk;

let ev = {};
try {
  ev = JSON.parse(raw || "{}");
} catch {
  process.exit(0);
}

const root = process.env.CLAUDE_PROJECT_DIR || ev.cwd || process.cwd();
const changesDir = join(root, "openspec", "changes");
const statePath = join(root, ".agent-log", "review-ready.json");

// The tasks file is edited by Edit, by Write, and — depending on the session — by a shell
// command. Rather than guess which, scan every active change: a handful of small files.
function activeChanges() {
  try {
    return readdirSync(changesDir, { withFileTypes: true })
      .filter((e) => e.isDirectory() && e.name !== "archive")
      .map((e) => e.name);
  } catch {
    return [];
  }
}

function progress(change) {
  const path = join(changesDir, change, "tasks.md");
  if (!existsSync(path)) return null;
  let text = "";
  try {
    text = readFileSync(path, "utf8");
  } catch {
    return null;
  }
  const done = (text.match(/^\s*-\s\[x\]/gim) ?? []).length;
  const open = (text.match(/^\s*-\s\[ \]/gim) ?? []).length;
  return { done, open };
}

let state = {};
try {
  state = JSON.parse(readFileSync(statePath, "utf8"));
} catch {
  state = {};
}

const ready = [];
for (const change of activeChanges()) {
  const p = progress(change);
  if (!p || p.open > 0 || p.done === 0) continue;
  // Signature = the task count that was complete when announced. New tasks change it.
  const signature = String(p.done);
  if (state[change] === signature) continue;
  state[change] = signature;
  ready.push({ change, done: p.done });
}

if (ready.length === 0) process.exit(0);

try {
  mkdirSync(join(root, ".agent-log"), { recursive: true });
  writeFileSync(statePath, JSON.stringify(state, null, 2) + "\n");
} catch {
  // Losing the state file only means the notice repeats; never fail the hook over it.
}

const names = ready.map(({ change }) => change);

const systemMessage = ready
  .map(
    ({ change, done }) =>
      `${change}: all ${done} tasks complete — ready for an independent review pass.\n` +
      `  If you would rather start it yourself:  node .claude/hooks/review.mjs ${change}`,
  )
  .join("\n");

// Given to the model so the user can simply agree instead of typing the command. The wording is
// deliberately restrictive: this session implemented the change, so it must not review its own
// work, and it must not spend a review pass without being told to.
const additionalContext =
  `Every task is now complete for: ${names.join(", ")}. ` +
  `Finish reporting the implementation first, then offer the user an independent review pass in ` +
  `one short line and stop for their answer. Do NOT launch it on your own initiative, and do NOT ` +
  `review the change yourself in this session — you are the maker here, and the project requires ` +
  `maker != checker. If the user agrees, run ` +
  names.map((c) => `\`node .claude/hooks/review.mjs ${c}\``).join(" and ") +
  ` via Bash. That opens the reviewer as a separate session with its own cold context, which is ` +
  `the point; do not substitute an in-session subagent unless the user asks for one.`;

process.stdout.write(
  JSON.stringify({
    systemMessage,
    suppressOutput: true,
    hookSpecificOutput: {
      hookEventName: "PostToolUse",
      additionalContext,
    },
  }),
);
