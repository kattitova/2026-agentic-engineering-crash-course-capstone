# 2026-09-21 — render-kanban-board (and the un-implemented add-drag-and-drop proposal)

**Reviewer:** reviewer sub-agent (`.claude/agents/reviewer.md`), separate session from the author
**Reviewed:** `git diff main...HEAD` — `app/page.tsx`, `app/layout.tsx`, `app/actions/applications.ts`,
`components/board/{Board,BoardColumn,ApplicationCard}.tsx`, `lib/applications/*`,
`prisma/schema.prisma`, `package.json`; commits `44ce47d`, `d52cd90`, `5a02436`, `80508cd`, `a91fe8b`;
plus the untracked proposal `openspec/changes/add-drag-and-drop/`.
**Verification run:** `npm run verify` — lint, typecheck and 30 unit tests in 3 files all pass.
**Verdict:** No critical findings. The board matches its spec and `npm run verify` is green.
3 major findings (unbounded field lengths, spec requirements with no test coverage at any level,
a crash path on an unknown status value), plus several minor ones.

> **Scope note.** The review was requested for the drag-and-drop feature. That feature is **not
> implemented**: every task in `openspec/changes/add-drag-and-drop/tasks.md` is unchecked,
> `lib/applications/move.ts` and `e2e/` do not exist, and no file carries a `"use client"`
> directive. The change directory is untracked. The review therefore covers the last feature that
> actually landed, `render-kanban-board`, and the shared `lib/` + server-action layer it sits on.
> Items that concern drag-and-drop are recorded as **risks to settle before implementation**, not
> as defects in shipped code.

## 1. Spec compliance

Each requirement in `openspec/specs/kanban-board/spec.md` maps to code:

| Requirement | Satisfied by |
| --- | --- |
| Five fixed columns in funnel order | `lib/applications/board.ts:21-32` (`COLUMN_ORDER` independent of enum order) |
| Every application in the column for its status, once | `lib/applications/board.ts:40-56` |
| Per-column count | `components/board/BoardColumn.tsx:18-20` |
| Card shows company (dominant) + position | `components/board/ApplicationCard.tsx:6-7` |
| Posting link only when stored | `components/board/ApplicationCard.tsx:8-30` |
| Empty-column message | `components/board/BoardColumn.tsx:23-24` |
| Data present on first paint, no loading placeholder | `app/page.tsx:4-5` (Server Component awaiting `listApplications()`) |

- **[Minor]** `app/page.tsx:18-36` — the disabled "Add application" button is not backed by any
  requirement in the kanban-board spec; the spec's own "Not in this change" list defers the form.
  It is honestly commented and visually inert, but `AGENTS.md` ("Scope") asks for no functionality
  beyond `spec.md`. A disabled control is borderline; it is recorded so the decision is on the record.
- **[Note]** `components/board/Board.tsx:9` — the grid collapses to 1/2/3 columns below `xl`, so
  "five columns in funnel order, left to right" holds only at ≥1280px. `spec.md` puts pixel-perfect
  mobile out of MVP scope, so this is acceptable, but the capability spec states the order
  unconditionally. Consider one sentence in the spec saying the order is a wide-viewport guarantee.
- **[Note]** `package.json` ships `@playwright/test`, a `test:e2e` script and three `@dnd-kit`
  packages while none of them is used yet. Harmless, but it is scope arriving before its change.

## 2. AGENTS.md compliance

- Strict TypeScript, **no `any`** anywhere in `app/`, `lib/` or `components/` (grep is clean).
- Logic is out of JSX: columns, grouping, status transitions and validation all live in
  `lib/applications/*.ts`; the three board components are pure presentation.
- Tailwind classes only; no per-component `.css`.
- `prisma/schema.prisma` is the sole model definition, and its header says so. No schema change in
  this diff, so the `db push` / `spec.md` rule is not engaged.
- Commit messages follow `type(scope): short description` and stay one logical change each.
- No `pnpm` or `yarn` command, no `pnpm-lock.yaml`.
- TDD order is evidenced for `board.ts`: archived task 1.1 records the red step before 1.2.

- **[Minor]** `.agent-log/actions.jsonl` is modified but uncommitted, and
  `openspec/changes/add-drag-and-drop/` is untracked. Neither is a rule violation, but the proposal
  should be committed before implementation starts so the "spec first" commit order is visible in
  history — which is exactly what `spec.md` says the rubric credits.

## 3. Edge cases

- **[Major]** `lib/applications/board.ts:52` — `grouped[application.status].push(application)`
  assumes the stored status is one of the five keys. SQLite does not enforce the enum at the
  database level; a row written by hand, by a seed script, or by a future migration with a status
  such as `ARCHIVED` makes the lookup `undefined` and the expression throws
  "Cannot read properties of undefined (reading push)". Because this runs in a Server Component,
  the whole board page fails instead of one card being skipped. A guard (`isApplicationStatus`
  already exists in `lib/applications/status.ts:5`) would turn a total outage into a dropped card.
- **[Major]** Empty / very long values. Nothing bounds `company`, `position`, `link` or `notes` —
  not `prisma/schema.prisma`, not `validateApplicationInput`. A 50 000-character company name is
  accepted, stored, and then rendered by `ApplicationCard.tsx:6` with no `break-words`,
  `line-clamp-*` or `truncate`, so a single long unbroken token widens its grid column and distorts
  the whole board. Empty and whitespace-only values are handled correctly
  (`lib/applications/validation.ts:22-40`).
- **[Note]** Same-column drop is already correct on the server:
  `lib/applications/status.ts:30-32` returns `null` and `app/actions/applications.ts:62` then
  writes nothing, so `statusChangedAt` is not reset. The client half of this guard
  (`planCardMove`, task 1.2) does not exist yet.
- **[Note]** Deleted-while-in-flight is handled: `updateApplicationStatus` reads inside the
  transaction and returns `{ ok: false, error: "Application not found" }`
  (`app/actions/applications.ts:56-66`); `updateApplication` and `deleteApplication` map Prisma
  `P2025` to the same result. No unhandled rejection.
- **[Note — before implementing drag-and-drop]** Two fast drags of the same card. Each
  `updateApplicationStatus` call is internally transactional, so the database cannot be corrupted,
  but there is **no optimistic-concurrency check**: the second write wins regardless of order, and
  with `useOptimistic` (task 2.5) two overlapping transitions can settle on the earlier server
  response and leave the card in a column the database does not agree with. Decide now whether the
  handler ignores a drag while one is pending, or reconciles strictly on the latest result.

## 4. Test strength

30 tests across `board.test.ts`, `status.test.ts` and `validation.test.ts`. The grouping and
status-transition tests are genuine: "loses and duplicates nothing" (`board.test.ts:96-111`) and
the same-status no-op case would both fail if the logic were inverted.

- **[Major]** No test — unit, component or e2e — exercises the rendering requirements. Delete the
  empty-state message from `BoardColumn.tsx:24`, drop the count badge, or render the posting link
  unconditionally, and `npm run verify` stays green. Four spec requirements (count, empty column,
  link only when stored, card identifies company and role) rest entirely on manual verification
  recorded in the archived tasks. This is the largest regression hole in the change.
- **[Minor]** `board.test.ts:55-59` — `expect(column.dotClass.trim()).not.toBe("")` only catches an
  empty string. Two columns sharing one colour, or a typo'd Tailwind class, passes. Asserting the
  exact five-class list, or at least their uniqueness, would make it a real guard.
- **[Note]** `validation.test.ts` is strong where it matters: it pins `javascript:alert(1)` and
  `ftp://` as rejected, so the URL-scheme guard cannot regress unnoticed.

## 5. Input safety

- `company` / `position`: required, trimmed, non-string rejected (`validation.ts:22-28`, `54-61`).
- `link`: parsed with `new URL` and restricted to `http:` / `https:` (`validation.ts:42-49`) — the
  constraint from Day 1 is intact and applied on both write paths (`createApplication`,
  `updateApplication`).
- `notes`: type-checked, trimmed, blank collapses to `null`.
- Server actions treat their arguments as untrusted: `isValidId` and `isApplicationStatus` guard
  `updateApplicationStatus` (`app/actions/applications.ts:19-21`, `48-53`), with the reason
  commented.

- **[Major — same finding as §3]** No maximum length on any field. Add explicit limits (a suggestion
  only, the author decides the numbers) and reflect them in the `spec.md` data model, since
  `AGENTS.md` requires the model and its constraints to be described there.
- **[Minor]** `ApplicationCard.tsx:9` renders `application.link` into `href` with no second check.
  Every current write path validates, so this is defence in depth rather than a live hole — but
  `prisma/seed.ts` and any direct database edit bypass `validateApplicationInput`, and a stored
  `javascript:` URL would then be one click from executing. Re-checking the scheme at render, or
  reusing `isHttpUrl`, closes it.

## 6. Accessibility

- Columns are `<section>`s with an `<h2>` heading; the status dot and both inline SVGs are
  `aria-hidden`; the posting link carries `rel="noopener noreferrer"`. All correct.

- **[Minor]** `BoardColumn.tsx:18-20` — the count badge is a bare number next to the heading. A
  screen-reader user hears "Applied" then "3" with nothing tying them together. An `aria-label`
  such as "3 applications" (or visually-hidden text) would fix it.
- **[Minor]** `ApplicationCard.tsx:9-14` — "View posting" opens in a new tab with no announcement,
  and the accessible name is identical on every card. With several cards in a column, a link list
  reads as "View posting" five times over. Naming the company in the accessible name would
  disambiguate it.
- **[Note — before implementing drag-and-drop]** Keyboard operation is currently **impossible**,
  because the interaction does not exist. `@dnd-kit/core` is installed but no `DndContext`,
  no `KeyboardSensor` and no drag handle are wired anywhere. Tasks 2.1, 2.3 and 2.7 cover this;
  the point to hold the implementation to is that installing `@dnd-kit` is not the same as enabling
  its keyboard sensor — `KeyboardSensor` must be passed to `useSensors` explicitly, the handle must
  be a focusable element with an accessible name that includes the application, and the failure
  message must land in an assertive live region (task 2.6).

## 7. Consistency with earlier features

- All four mutating server actions return `ActionResult` (`{ ok: false, error }`) rather than
  throwing, matching the Day 1 convention; `NOT_FOUND` and `INVALID_ID` are shared constants.
- `lib/applications/board.ts` follows the established shape: exported types, an exhaustive
  `Record<ApplicationStatus, …>` table with a comment explaining what it buys, and a documented
  pure function.
- Comment style (a short "why", not a restatement of the code) is consistent throughout.

- **[Note]** `listApplications` (`app/actions/applications.ts:27-29`) is the one action that does
  **not** return `ActionResult`: it returns `JobApplication[]`, and a database failure propagates as
  an exception that takes the page down rather than rendering a board-level error. That may well be
  deliberate for a Server Component read path, where an error boundary is the idiomatic answer — but
  it is the single place where the `{ ok: false }` convention does not hold, and it is worth either a
  one-line comment saying why, or a change of shape.

## Open questions

1. Is the disabled "Add application" button intended to stay until the add-application change, or
   should it be removed so the diff contains only what the spec requires?
2. Are field length limits a deliberate omission for the MVP, or simply not reached yet? If
   deliberate, that belongs in the "out of scope" list in `spec.md`.
3. Should `listApplications` keep its throwing shape, or join the `ActionResult` convention?
4. For drag-and-drop: ignore a second drag while one is pending, or accept it and reconcile on the
   latest server response? The answer changes both task 2.5 and the e2e test.

## Recommended follow-ups

Ordered by severity. **Nothing here was fixed by this review** — by design; the reviewer documents,
the author decides.

1. Guard `groupApplicationsByStatus` against a status outside the enum so one bad row cannot take
   the whole board down (§3).
2. Add maximum lengths for `company`, `position`, `link` and `notes` in validation, and card-level
   text wrapping/truncation so a long value cannot distort the layout; record the limits in
   `spec.md` (§3, §5).
3. Add rendering tests (or the e2e spec planned in the drag-and-drop change) covering the count
   badge, the empty state and the conditional posting link, so those four spec requirements can
   regress loudly (§4).
4. Strengthen the `dotClass` assertion to pin the five colours or at least their uniqueness (§4).
5. Label the count badge and give each posting link a per-card accessible name (§6).
6. Commit the `add-drag-and-drop` proposal before implementation, so the spec-first order shows in
   git history (§2).
7. Decide the concurrency and keyboard-sensor questions above before writing the drag handler
   (§3, §6).
