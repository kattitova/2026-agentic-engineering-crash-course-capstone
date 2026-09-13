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
