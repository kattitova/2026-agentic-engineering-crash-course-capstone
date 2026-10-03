# Agent Rules — Job Application Tracker

This is a living context file for the AI agent (Claude Code / Cursor, etc.)
helping build this project. Follow these rules by default; if a task clearly
calls for deviating from them, ask first instead of silently ignoring them.

> Update this file as soon as the agent's behavior suggests a new rule is
> needed (e.g. the agent did something wrong once — add a rule here that
> would have prevented it, then treat the next matching commit as evidence
> the rule worked).

## Stack and style

- TypeScript in strict mode (`strict: true`), no `any` except in documented,
  commented exceptions.
- Components are functional, hooks-based. Logic that can be tested in
  isolation (calculations, validation, data transforms) belongs in separate
  `.ts` files outside of React components, not inline in JSX.
- Styling is Tailwind classes only — no separate `.css` file per component.

## Package manager

- This project uses npm exclusively. Do not run, suggest, or generate
  `pnpm` or `yarn` commands here — even if a reference file or course example
  uses them.
- Use `npm install` to add dependencies, `npm run <script>` to run scripts
  defined in `package.json`, and `npx <package>` for one-off tool
  invocations (e.g. `npx prisma db push`).
- If a script or scaffolding file copied from course materials references
  `pnpm` (e.g. `pnpm hooks:selftest`), add the same script name to this
  project's `package.json` under `"scripts"` and run it as
  `npm run hooks:selftest` instead. Don't install pnpm or add a
  `pnpm-lock.yaml` to this project.

## Data / Prisma

- The single source of truth for the data model is `prisma/schema.prisma`.
  Don't define or change the model shape anywhere else.
- Never change `prisma/schema.prisma` without, in the same commit, running
  `npx prisma db push` and committing the generated client (if it's tracked
  in git).
- Any data model change must be reflected in `spec.md` (the "Data model"
  section or the "Spec change log") in the same or the next commit.

## Tests

- A new UI interaction (drag&drop, a form, a button that mutates data) is
  not considered done until it has at least one test.
- Before marking a task complete, run `npm run verify` — it must pass with
  no errors.
- For new business logic (calculations, status transitions, validation),
  write a test that's expected to fail (red) first, then write the
  implementation that makes it pass (green). Don't write the test to match
  an already-finished implementation.

## Independent review

Two gates, and neither is run by the session whose work it checks — maker ≠ checker is the whole
point, so a session never reviews its own output even when it is confident.

- **After `propose`, before `apply`**: offer the `proposal-reviewer` agent
  (`.claude/agents/proposal-reviewer.md`) on the finished artifacts. It checks the plan — scope
  against `spec.md`, requirement coverage and testability, whether the Impact section's claims
  still match the real code, task ordering and red-first compliance, design decisions — and
  returns PASS / PASS WITH NOTES / **REVISE PROPOSAL**. It writes under `docs/proposal-reviews/`
  and may not edit the artifacts. A REVISE PROPOSAL verdict goes to `/opsx:update`, not to apply.
  Offer it once; the user may decline, and declining is not recorded anywhere.
- **After `apply`, before `archive`**: the `reviewer` agent (`.claude/agents/reviewer.md`) on the
  diff, as the Definition of Done in `spec.md` requires. The last task of every change asks for it.
  `reviewer` reviews a diff only; a change that is proposed but not implemented goes to
  `proposal-reviewer` instead, and neither agent covers the other's stage.

### Order on the way out of `apply`

`npm run verify` → `openspec verify` → the `reviewer` pass → fix → re-review → `archive`.

The two cheap mechanical gates come **first**, and the reason is concrete: on
`edit-and-delete-application` the review pass was spent discovering that `design.md` had drifted
from the implementation (commit `c0b4a32`), which is exactly what `openspec verify` is built to
catch — and `openspec verify` then had to run anyway, after the fixes. A review session is the
expensive opinion; it must never be the first thing to notice that the artifacts and the code
disagree. So: an independent review is never requested while `npm run verify` or `openspec verify`
is unrun or failing, and both are re-run after the review's findings are fixed.

### Always offer, never launch silently

Launching any review agent is **offered to the user and waited on**, every time — including when
tasks.md carries it as a task. A task like "request a review pass from a separate agent session"
means *do not forget to ask*, not *spawn it without asking*; the user decides when a review
session is spent, and a pass that runs unbidden on a diff the author has not finished reading is
wasted. The same applies to a re-review after fixes: offer it, do not start it.

A task that could be read as authorizing a silent launch is a proposal defect —
`proposal-reviewer` flags it under its task checklist.

### How a review is launched, and what it is told

`node .claude/hooks/review.mjs <change> [--agent reviewer|proposal-reviewer] [--bg]` — by hand,
after a human yes. Both agents go through that launcher, and not through the Agent tool, because an
in-process sub-agent **inherits this session's permissions**: `--settings` never applies, so the
deny rules that are the only enforced version of "never fix anything" and "never edit the proposal"
are silently absent. Their agent definitions are prompt-level contracts; the settings file is the
part that actually holds.

**A review agent is given the change name and nothing else.** What to look for lives in its
definition, which it reads cold. Handing it a list of things to check — even an accurate one, even
framed as "don't take the artifacts on trust" — converts an independent pass into the execution of
a checklist written by the session under review: it then finds what it was pointed at, and the
author's blind spots become the review's. The launcher therefore has no way to add to the prompt and
refuses extra arguments rather than appending them. If a pass was nonetheless steered, the review
file says so in its header, and its "found nothing" is worth less than a neutral one's.

Each agent has a sibling settings file (`.claude/reviewer-settings.json`,
`.claude/proposal-reviewer-settings.json`) that denies the writes its role forbids, for running it
as a standalone session: `claude --settings .claude/proposal-reviewer-settings.json`.

Both offers are written into the vendored skills — `.claude/skills/openspec-propose/SKILL.md` and
`.claude/skills/openspec-apply-change/SKILL.md` — which are generated files. If `openspec update`
ever overwrites them, this section is the rule that survives, so re-add both offers from here.

## Git / commits

- Commit message format: `type(scope): short description`
  (e.g. `feat(board): add drag-and-drop between columns`).
- One commit = one logically complete change; don't mix a refactor and a new
  feature in the same commit.

## Scope

- Don't add functionality that isn't in `spec.md` without first updating
  `spec.md` and briefly explaining why it's needed now.
- If a task looks bigger than "one feature at a time," break it into smaller
  steps and propose a plan before writing code.

## OpenSpec tooling

Two things cost a session's time once each; both are environment facts, not
decisions.

- **The `openspec` CLI needs Node 22.** The shell here resolves `node` to
  v16.13.2 from `PATH`, and the package fails to parse under it
  (`import ... with {type: 'json'}`). Run OpenSpec commands with
  `export PATH="/c/Program Files/nvm/v22.13.1:$PATH"` first, even though
  `nvm list` reports 22 as current.
- **A successful `openspec archive` leaves its lock behind.** It writes
  `openspec/changes/archive/.openspec-archive.lock` and does not remove it, so
  the *next* archive fails with `archive_target_exists` naming a change that was
  never started. Observed three times. Before deleting it: read the `pid` inside
  and confirm that process is gone, confirm no partial archive directory exists
  for the change, and confirm the active change directory is intact. It is
  gitignored, because it was once committed and then blocked archiving for
  anyone who cloned the repo.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
