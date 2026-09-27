# Review log

Independent review passes by a separate agent session (maker ≠ checker), as required by the
Definition of Done in `spec.md`. Each section records what was reviewed and what was found —
including the explicit statement when nothing critical was found.

## 2026-09-21 — render-kanban-board (and the un-implemented add-drag-and-drop proposal)

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

### 1. Spec compliance

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

### 2. AGENTS.md compliance

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

### 3. Edge cases

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

### 4. Test strength

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

### 5. Input safety

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

### 6. Accessibility

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

### 7. Consistency with earlier features

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

### Open questions

1. Is the disabled "Add application" button intended to stay until the add-application change, or
   should it be removed so the diff contains only what the spec requires?
2. Are field length limits a deliberate omission for the MVP, or simply not reached yet? If
   deliberate, that belongs in the "out of scope" list in `spec.md`.
3. Should `listApplications` keep its throwing shape, or join the `ActionResult` convention?
4. For drag-and-drop: ignore a second drag while one is pending, or accept it and reconcile on the
   latest server response? The answer changes both task 2.5 and the e2e test.

### Recommended follow-ups

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

## 2026-09-27 — disposition of the 2026-09-21 findings (`harden-kanban-board`)

Written by the author, not the reviewer. Every finding above is accounted for below as resolved,
deferred with a reason, or declined with a reason. The review itself fixed nothing, by design.

### Resolved in `harden-kanban-board`

| Finding | Resolution | Evidence |
| --- | --- | --- |
| §3 [Major] crash on an unknown status | `groupApplicationsByStatus` skips a row whose status is not one of the five | red test reproduced the reviewer's exact error, `Cannot read properties of undefined (reading 'push')` |
| §3/§5 [Major] long values distort the board | `break-words` + line clamp on company and position | measured in Chromium at 1440px with a 200-character unbroken value: horizontal overflow 613px before, 0px after |
| §4 [Major] no test covers the rendering requirements | 4 characterization tests in `BoardColumn.test.tsx` and `ApplicationCard.test.tsx` | each proved non-vacuous by mutation; deleting the empty-state message now fails `npm run verify` |
| §4 [Minor] weak `dotClass` assertion | pins the five colours and asserts uniqueness | giving Interview the Applied colour turns it red |
| §5 [Minor] `href` rendered without a second check | `isHttpUrl` exported and called in `ApplicationCard` | `javascript:alert(1)` renders no anchor |
| §6 [Minor] unlabelled count badge | `aria-label` such as "3 applications" | `getByLabelText(/3 applications/i)` |
| §6 [Minor] identical link names across cards | accessible name includes the company | `getByRole("link")` name contains "Acme Cloud" |
| §7 [Note] `listApplications` outside the `ActionResult` convention | moved to `lib/applications/queries.ts`; convention restated in `spec.md` | it was also an unintended public endpoint: the actions file carries a file-level `"use server"` |
| §1 [Note] column order stated unconditionally | spec now states it as a wide-viewport guarantee | delta spec, `kanban-board` |
| Open question 1 — disabled "Add application" | kept, recorded in the `spec.md` Spec change log | the route `AGENTS.md` prescribes for scope beyond the spec |
| Open question 3 — `listApplications` shape | keeps throwing; leaves the server-action file instead | see above |

### Found during this work, not in the review

- **The board page was prerendered as static content.** `next build` reported `/` as
  `○ (Static)`: Prisma on `better-sqlite3` is a synchronous driver, so the query completed during
  prerendering and the board was frozen at build time. §1 marked "data present on first paint" as
  satisfied from `app/page.tsx`, which is true under `next dev` and false in a production build.
  The "data changed elsewhere" scenario could not pass. Fixed with `connection()`; verified by
  inserting a row directly into `dev.db` and reloading the served production build without
  rebuilding.
- **A mechanism correction to §3.** A long unbroken value does not widen its grid column —
  Tailwind's `grid-cols-5` is `minmax(0, 1fr)`, so the track holds. The text overflows the track
  and pushes the document's scroll width out instead. The symptom the reviewer describes is real;
  the cause is different.
- **`app/error.tsx` cannot catch a first-request failure.** React error boundaries need a Suspense
  boundary to recover into. Adding one (`app/loading.tsx`) does make the fallback render, and puts
  a loading placeholder in the first paint, which the board's spec forbids. The boundary is kept
  for failures after the app is running; the limit is recorded in `spec.md` and in the change's
  design.

### Deferred, with a reason

- **§3/§5 [Major] no maximum field lengths.** Deferred to `add-application`, where the form lives
  and where `maxLength` naturally belongs. No gap is left open: `createApplication` and
  `updateApplication` have no caller today, so the only write paths are `prisma/seed.ts` and the
  tests. The CSS half of the finding was not deferred — a long value can no longer distort the
  board whatever its length.
- **§3 and §6 [Notes] on drag-and-drop concurrency and `KeyboardSensor`.** These are decisions for
  `add-drag-and-drop`, not defects in shipped code, and belong in that change's design.
- **§2 [Minor] commit the proposal before implementation.** Applies to `add-drag-and-drop`.

### Declined

- **§1 [Note] unused `@playwright/test` and `@dnd-kit` packages.** Left in place. They are the
  dependencies of `add-drag-and-drop`, which is already proposed; removing and reinstalling them
  would churn the lockfile for no behavioural gain. `@playwright/test` earned its keep here anyway:
  it measured the layout fix above.

## 2026-09-27 — harden-kanban-board (implemented, uncommitted) + add-drag-and-drop (still only proposed)

**Reviewer:** reviewer sub-agent (separate session; maker ≠ checker)
**Reviewed:** the working tree against `HEAD` (`a91fe8b`) — `git diff` over
`app/actions/applications.ts`, `app/page.tsx`, `components/board/{ApplicationCard,BoardColumn}.tsx`,
`lib/applications/{board.ts,board.test.ts,validation.ts}`, `spec.md`, `package.json`,
`vitest.config.mts`, plus the untracked `app/error.tsx`, `lib/applications/queries.ts`,
`components/board/{ApplicationCard,BoardColumn}.test.tsx`, and both untracked change directories
`openspec/changes/harden-kanban-board/` and `openspec/changes/add-drag-and-drop/`.
**Verification run:** `npm run verify` — lint, typecheck and 41 unit/component tests in 5 files all
pass (2.3s).
**Verdict:** No critical findings. 2 major (the column-count label is placed where assistive
technology is specified to ignore it, and its test cannot tell; the per-request-render requirement
has no automated protection), plus several minor items and a set of risks to settle before
`add-drag-and-drop` is implemented.

> **Scope note.** Two changes are present. `harden-kanban-board` **is implemented**: all 28 tasks in
> its `tasks.md` are checked and the code for every one of them is in the working tree — but *none of
> it is committed*. `git log` still ends at `a91fe8b`, and the change directory itself is untracked,
> so the commit-per-pair structure that its own `tasks.md` prescribes ("Each fix is paired with its
> own test, and the pair is one commit") exists nowhere in history. `add-drag-and-drop` is **not
> implemented**: every task is unchecked, `lib/applications/move.ts`, `playwright.config.ts` and
> `e2e/` do not exist, and no file carries `"use client"` except `app/error.tsx`. Its proposal is
> reviewed below as a set of risks to flag before implementation, not as delivered code.

### 1. Spec compliance

Mapping of `openspec/changes/harden-kanban-board/specs/kanban-board/spec.md` to code:

| Requirement (ADDED/MODIFIED) | Satisfied by | Tested by |
| --- | --- | --- |
| Board tolerates an unrecognised stored status | `lib/applications/board.ts:57-59` | `lib/applications/board.test.ts:105-114` |
| Column count announced as a number of applications | `components/board/BoardColumn.tsx:19-26` | `components/board/BoardColumn.test.tsx:33-43` (see §6 — the assertion does not prove the announcement) |
| Card readable at any value length (wrap + clamp) | `ApplicationCard.tsx:15-20` | `ApplicationCard.test.tsx:50-60` (class-level only, acknowledged) |
| Posting link re-checked for http(s) at render | `ApplicationCard.tsx:8-9`, `validation.ts:43-50` | `ApplicationCard.test.tsx:30-36` |
| Each card's link names its application | `ApplicationCard.tsx:28` | `ApplicationCard.test.tsx:38-48` |
| Data read per request, not at build time | `lib/applications/queries.ts:17` (`await connection()`) | nothing — see §4 |
| Column order is a wide-viewport guarantee | `components/board/Board.tsx:9` (`xl:grid-cols-5`) | not tested (layout; jsdom cannot) |
| Empty column message / count / conditional link / company+position | unchanged components | `BoardColumn.test.tsx:48-79`, `ApplicationCard.test.tsx:65-79` |

`connection()` is a real export of this Next version (`node_modules/next/server.d.ts:22`), and
`app/error.tsx`'s `{ error, retry }` signature matches
`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/error.md` exactly, including
`retry` rather than the older `reset`. Both claims in the change's design hold.

- **[Note]** `openspec/specs/kanban-board/spec.md` (the canonical capability spec) still carries the
  pre-harden wording — five requirements were modified in the delta and one added. That is correct
  for an unarchived change, but the canonical spec and the code disagree until the change is
  archived, and the change cannot be archived while it is uncommitted (§2).
- **[Note]** No code exists without a requirement behind it, with one documented exception:
  `app/error.tsx` and the still-disabled "Add application" button, both recorded in the `spec.md`
  Spec change log (`spec.md:92-121`), which is the route `AGENTS.md` prescribes. The two open
  questions from the 2026-09-21 pass are answered there rather than left hanging.

### 2. AGENTS.md compliance

- No `any` in `app/`, `lib/` or `components/` outside `app/generated/prisma/**` (generated client).
- Logic stays in `lib/`: the status guard is in `lib/applications/board.ts`, the scheme predicate in
  `lib/applications/validation.ts`; the components only call them.
- Tailwind classes only; no new `.css`.
- No schema change, so the `prisma db push` / `spec.md` data-model rule is not engaged.
- npm only: `package-lock.json` updated, no `pnpm-lock.yaml`, no `yarn.lock`, no pnpm/yarn command
  anywhere in `package.json`.
- `npm run verify` passes (see header).

- **[Minor]** Nothing is committed. `git log` ends at `a91fe8b`; the entire change — 12 modified
  files, 5 new ones, both proposal directories — sits in the working tree. This breaks two rules at
  once: "one commit = one logically complete change" cannot be satisfied retroactively by one large
  commit, and the change's own task list asserts a commit per fix+test pair that history does not
  contain. It also repeats §2 of the previous pass ("commit the proposal before implementation"), now
  for `harden-kanban-board` as well as `add-drag-and-drop`.
- **[Minor]** The red-then-green order claimed by tasks 1.1, 1.3, 4.1, 4.3, 4.4 and 4.5, and the
  mutation checks claimed by 5.1-5.4, are unverifiable for the same reason: with no commits there is
  no history in which the failing test precedes the implementation. The tests read as if the order
  was followed and the comments name the red step, but a reviewer can only take that on trust.
- **[Minor]** `@testing-library/jest-dom` was installed (task 3.1) and is imported nowhere —
  `grep -rn "jest-dom"` over `.ts`/`.tsx`/`.mts` outside `node_modules` returns nothing. Both test
  files use bare `toBeDefined()`/`toBeNull()` instead of its matchers. A devDependency that no test
  loads is dead weight, and its absence from any setup file means a future test author will expect
  `toBeInTheDocument()` to work and find that it does not.

### 3. Edge cases

- **A status value the enum does not cover:** handled. `groupApplicationsByStatus`
  (`lib/applications/board.ts:56-61`) skips the row, the five keys are pre-seeded, and the column
  counts derive from the same grouped lists, so counts cannot disagree with the cards shown. The
  previous pass's crash path (`Cannot read properties of undefined (reading 'push')`) is closed and
  pinned by a test.
- **A card dropped into the status it already holds:** still a true no-op on the server —
  `planStatusChange` returns `null` (`lib/applications/status.ts:30-32`) and
  `updateApplicationStatus` then writes nothing (`app/actions/applications.ts:58`), so
  `statusChangedAt` is not reset. Unchanged by this change and still correct.
- **An application deleted while an action against it is in flight:** `updateApplicationStatus` reads
  inside the transaction and returns `NOT_FOUND`; `updateApplication`/`deleteApplication` map Prisma
  `P2025` to the same result. No unhandled rejection. See the add-drag-and-drop note below for the
  UI consequence.
- **Empty / whitespace-only values:** rejected for `company` and `position`, collapsed to `null` for
  `link` and `notes` (`validation.ts:22-40`). Correct.
- **Very long values:** no maximum length on any field — explicitly deferred to `add-application`
  with a reason recorded in the proposal and in `docs/review-log.md`. Accepted as deferred, not as
  resolved. The layout half is fixed (`break-words` + `line-clamp-*`).
- **[Note]** A dropped unknown-status row is silent by design. The consequence worth keeping in view:
  the application is invisible on the board *and* absent from every count, so the board cannot be
  used to notice that a row was lost. The design argues this trade explicitly; recorded, not disputed.

Risks to settle before `add-drag-and-drop` is implemented (no code exists yet):

- **[Major — against the plan]** Open question 4 of the previous pass — two drags of the same card in
  quick succession — is still unanswered. `design.md` says the optimistic value is "derived from the
  server-provided list each render, so stored data wins by construction", which addresses divergence
  *after* both writes land but not ordering *between* them: two overlapping `updateApplicationStatus`
  calls are independently transactional and last-write-wins by completion order, which need not be
  drag order. No task in `tasks.md` covers a second drag while one is pending (2.4-2.7 each describe
  a single move). Either gate the handle while a move is in flight or reconcile strictly on the
  latest issued move, and put that decision in a task.
- **[Major — against the plan]** Task 2.7 and the e2e spec assume "focus handle, Space, Arrow, Space"
  moves a card to the next column. `@dnd-kit/core`'s default keyboard coordinate getter translates
  the drag by **25px per arrow key** (`node_modules/@dnd-kit/core/dist/core.cjs.development.js:1116-1131`).
  With column widths in the hundreds of pixels, one arrow press will not reach the neighbouring
  droppable, so the planned keyboard path — which the design nominates as *the* tested path — needs a
  custom `coordinateGetter` (or an equivalent column-to-column mapping) to work at all. As written,
  the e2e test will fail or, worse, be "fixed" by pressing the arrow key an arbitrary number of times.
- **[Note — against the plan]** Deleted-while-dragging: `updateApplicationStatus` returns `NOT_FOUND`
  *before* `revalidatePath` (`app/actions/applications.ts:61-64`). So on the failure path planned in
  task 2.6, the optimistic move is dropped and the card reappears in its original column — a column
  it no longer belongs to, because the row is gone — and no revalidation removes it. The board then
  shows a card that does not exist until the next reload, which is exactly what the "board stays
  truthful after a failure" requirement forbids. Worth an explicit decision (revalidate on
  `NOT_FOUND`, or refresh the router after any failed move).

### 4. Test strength

41 tests, 5 files. The new ones are mostly genuine: deleting the status guard makes
`board.test.ts:105-114` fail with the exact error the previous pass predicted; the `dotClass`
assertion now pins all five classes and their uniqueness, so a duplicate or a typo fails; removing
the scheme re-check makes `ApplicationCard.test.tsx:30-36` fail because an anchor appears.

- **[Major]** The new "data is read when the page is requested, not when it is built" requirement is
  protected by nothing automated. Delete `await connection()` from `lib/applications/queries.ts:17`
  and `npm run verify` stays green; the only evidence is the manual `next build` observation in tasks
  2.2-2.3 and 2.5. This is structurally the same finding the change was created to fix for four
  display requirements, left open for the one requirement the change itself discovered. A build-output
  assertion, or an e2e check that a row inserted directly into the database appears on reload, would
  close it. (Recorded as Major rather than Minor because the regression is silent and the symptom —
  stale data in production only — is the hardest class of bug this project can ship.)
- **[Major]** `BoardColumn.test.tsx:42` (`getByLabelText(/3 applications/i)`) asserts that an
  `aria-label` attribute is present on *some* element, not that the count is announced. It passes
  against a placement that assistive technology is specified to ignore — see §6. The test therefore
  cannot catch the defect it was written for, which is precisely the "test that would not catch the
  regression it is supposed to catch" category.
- **[Minor]** `ApplicationCard.test.tsx:50-60` asserts only that the class strings contain
  `break-words` and `line-clamp-`. The file says so itself, and task 4.6 records a manual layout
  check. Acceptable given jsdom, but it means a change from `line-clamp-3` to `line-clamp-1` (a real
  readability regression) passes, and so does moving the classes to an element that is not the one
  holding the long text.
- **[Minor]** `expect(screen.getByText(...)).toBeDefined()` recurs in both files
  (`ApplicationCard.test.tsx:68-69`, `BoardColumn.test.tsx:42,56,62,68`). `getByText`/`getByLabelText`
  already throw when nothing matches, so the assertion itself is always true — the test works by
  side effect of the query. It does fail on regression, so this is style, not a hole, but the
  intent-revealing form (`toBeInTheDocument()` from the jest-dom package already installed, or
  `queryBy…` plus an explicit assertion) would make that visible.
- **[Note]** No test at any level exercises `app/error.tsx` or the throwing-loader convention. The
  design documents that a first-request failure is not recoverable; the covered case (failure after
  the app is running) is verified by hand only. Low value to automate now, recorded for completeness.
- **[Note]** The unknown-status tolerance is covered at the `lib/` level only. That is the right
  level, and `Board.tsx` is a thin pass-through, so no gap.

### 5. Input safety

- `company`, `position`: required, trimmed, non-string rejected (`validation.ts:22-28`, `55-62`).
- `link`: parsed with `new URL` and restricted to `http:`/`https:` (`validation.ts:43-50`), applied on
  both write paths (`createApplication`, `updateApplication`) — the guard is intact.
- `notes`: type-checked, trimmed, blank collapses to `null`.
- Server actions still treat arguments as untrusted (`isValidId`, `isApplicationStatus`).
- **Read-back path now re-checked**, which was the previous pass's §5 minor: `ApplicationCard.tsx:8-9`
  runs the stored value through the same `isHttpUrl` before rendering an anchor, so a `javascript:`
  URL inserted by `prisma/seed.ts` or a hand edit renders no link. One predicate, two call sites — no
  duplicated security logic.

- **[Minor]** Unbounded lengths remain, on every field, in both validation and the schema. Deferred
  with a stated reason (`add-application`), and the reason holds today only because
  `createApplication`/`updateApplication` have no caller. The moment the form lands, the limits must
  land with it; until then this stays an open Major from the previous pass, deferred rather than
  resolved.
- **[Note]** `notes` is stored but never rendered, so no second check is needed there yet. When a
  card or a detail view starts showing `notes`, remember it is untrusted stored text like `link` was.

### 6. Accessibility

- Both inline SVGs and the status dot are `aria-hidden`; the posting link keeps
  `rel="noopener noreferrer"`; columns are `<section>` with an `<h2>`; the error boundary has a real
  `<h1>` and a real `<button>`. No focus outline is suppressed anywhere.
- Each card's link now has a per-card accessible name (`ApplicationCard.tsx:28`) that still contains
  its visible text ("View posting at Acme Cloud" contains "View posting"), so WCAG 2.5.3 Label in
  Name holds. This closes the previous pass's §6 minor properly.

- **[Major]** `components/board/BoardColumn.tsx:19-26` — the `aria-label` is on a bare `<span>`,
  which maps to ARIA's `generic` role, and `generic` is specified as *name prohibited*: browsers
  are expected to drop the label from the accessibility tree, and Chrome and Firefox do. The likely
  result for a screen-reader user is unchanged from before the fix — "Applied", then "3" — so the
  new requirement ("the count is announced as a number of applications rather than as a bare 3") is
  probably still unmet in a real browser, while both the test and `npm run verify` say it is met.
  Placements that do work: visually-hidden text inside the badge, folding the count into the `<h2>`,
  or giving the badge a role that permits naming. Worth re-checking in a browser accessibility
  inspector before archiving the change, since this is the finding the change was written to fix.
- **[Minor]** `ApplicationCard.tsx:12` — each card is an `<article>` with no accessible name, so it
  is announced as an unnamed "article" boundary. `aria-labelledby` pointing at the `<h3>` would make
  card-by-card navigation say which application it is on.
- **[Minor]** `ApplicationCard.tsx:22-24` — the link opens a new tab (`target="_blank"`) with nothing
  in its accessible name saying so. Not required by the spec; still a small surprise for a
  screen-reader or keyboard user.
- **[Minor]** `components/board/BoardColumn.tsx:12` — the `<section>` has no `aria-labelledby`, so it
  is not exposed as a named region and the column headings do not become navigable landmarks. Cheap
  to add, and it would help exactly the keyboard flow `add-drag-and-drop` is about to introduce.
- **[Note]** Keyboard operation of the board remains impossible, because the interaction does not
  exist yet. `@dnd-kit/core` is installed and still unused. The 25px-per-arrow-key finding in §3 is
  the concrete thing to settle before task 2.7 is attempted; "`KeyboardSensor` is registered" will
  not be enough.
- **[Note]** `app/error.tsx` renders its own `<main>`, as does `app/page.tsx`. Because the boundary
  replaces the page, there is no duplicate landmark at runtime. Verified by reading the tree, not
  assumed.

### 7. Consistency with earlier features

- The mutation/loader split is now explicit and exception-free: the four mutating actions return
  `ActionResult` and never throw; `listApplications` is an ordinary async function in
  `lib/applications/queries.ts` with a comment saying why, and `app/error.tsx` is the other half.
  This resolves the previous pass's §7 note in the cleaner of the two directions, and it is written
  down in `spec.md` rather than only in a design file.
- `lib/applications/queries.ts` follows the established `lib/` shape and comment style (a "why", not
  a restatement). The exhaustive `Record<ApplicationStatus, …>` tables in `board.ts` are untouched
  and still the place a new status fails to compile first.
- `grep -rn "listApplications" app/actions` returns nothing, as task 2.1 required.

- **[Minor]** `components/board/BoardColumn.test.tsx:10` uses a non-null assertion
  (`BOARD_COLUMNS.find(…)!`). It is the only `!` assertion in the project's own source, and it is
  avoidable (`BOARD_COLUMNS[1]`, or a locally-declared column literal). Test code, low stakes, but
  the codebase has so far earned the right to say it contains no unchecked assertions.
- **[Note]** The two component test files duplicate an eight-field `application()` factory and the
  `afterEach(cleanup)` comment verbatim. `design.md` explains why a shared setup file was rejected
  (it would also load in the `node` environment), which is convincing for the cleanup call; a shared
  *fixture* module imported only by `.test.tsx` files would not have that problem. Third copy is the
  point to act.

### Open questions

1. Has the count badge's `aria-label` been checked in a browser accessibility inspector (Chrome
   DevTools → Accessibility, or NVDA/VoiceOver)? If it is dropped as §6 predicts, both the fix and
   its test need to move, and the requirement's wording ("announced") suggests the test should assert
   something that survives the generic-role rule.
2. Is `harden-kanban-board` intended to be committed as the pairs its `tasks.md` describes, or has
   the decision been made to land it as one commit? If the latter, the task list overstates what
   history will show, and that is worth a line in the change before archiving.
3. Should the per-request-render requirement get an automated guard now (build-output assertion, or
   the e2e reload check), or is it accepted as manual-only until the Playwright suite exists?
4. Repeat of the previous pass's question 4, still unanswered in `add-drag-and-drop/design.md`: while
   one move is in flight, is a second drag of the same card ignored, or accepted and reconciled on
   the latest issued move?

### Recommended follow-ups

Ordered by severity. **Nothing here was fixed by this review** — the reviewer documents, the author
decides.

1. Re-check the column-count label in a real accessibility tree and move it somewhere `generic` does
   not forbid a name; then make the test assert the announcement rather than the attribute (§6, §4).
2. Give the "read per request, not per build" requirement an automated guard, so removing
   `await connection()` fails `npm run verify` or the e2e suite rather than shipping stale data (§4).
3. Commit the change — proposal first, then the fix+test pairs — so the TDD and commit-granularity
   claims in `tasks.md` become checkable, and the change becomes archivable (§2).
4. Before writing the drag handler: decide the concurrent-drag rule, and plan for a custom
   `coordinateGetter`, since dnd-kit's default arrow key moves 25px and will not reach the next
   column (§3).
5. Decide what a `NOT_FOUND` failure should do to the board — as it stands a card deleted mid-move
   reappears and stays until reload (§3).
6. Either use `@testing-library/jest-dom` (a setup import for the `.test.tsx` files) or drop the
   dependency; and replace the `toBeDefined()` pattern with an assertion that states the intent
   (§2, §4).
7. Small a11y polish: name each card's `<article>`, label the column `<section>`, say that the
   posting link opens a new tab (§6).
8. Carry the unbounded-field-length finding into `add-application` as a blocking item, not a
   nice-to-have — it is the last unresolved Major from 2026-09-21 (§5).

## 2026-09-27 — disposition of the second review pass (`harden-kanban-board`)

Written by the author. The change was still uncommitted and unarchived when the review ran, so
these findings were folded into the change itself rather than into a new one — which is the
difference from 2026-09-21, when the reviewed feature had already been archived.

### Resolved in `harden-kanban-board`

| Finding | Resolution | Evidence |
| --- | --- | --- |
| §6/§4 [Major] count label on a name-prohibited `generic` | visually hidden text; the digit is `aria-hidden` | Chrome accessibility tree via CDP: `StaticText "1 application"`, bare digit no longer present |
| §2/§4 [Minor] `@testing-library/jest-dom` installed and unused | imported in both component test files; `toBeDefined()` replaced by `toBeInTheDocument`, `toHaveAttribute`, `toHaveAccessibleName` | 45 tests pass |
| §7 [Minor] non-null assertion in a test | destructuring instead of `find(…)!` | no `!` assertion left in the project's own source |
| §6 [Minor] unnamed card `<article>` | `aria-labelledby` pointing at the company heading | tree lists one named article per card |
| §6 [Minor] unnamed column `<section>` | `aria-labelledby` pointing at the column heading | tree lists five named regions |
| §6 [Minor] new tab not announced | accessible name says "(opens in a new tab)" | `toHaveAccessibleName(/opens in a new tab/i)` |

### Corrections to the review

- **§6 overstates the browser behaviour.** It says Chrome and Firefox drop a name from a `generic`
  role. Chrome does not: the probe returned `role=generic name="1 application" ignored=false`. The
  recommendation was still followed, because ARIA specifies `generic` as name-prohibited and a name
  there is not something to depend on — but the finding's stated mechanism did not reproduce.
- **A defect the review could not have seen, found while fixing it.** Written as
  `{count} {word}`, JSX emits three text nodes, and the accessibility tree then holds "1" and
  "application" separately with no node named "1 application". The hidden text has to be one
  template literal. Testing Library normalises whitespace across text nodes, so the jsdom test
  passes either way: **the test added for this requirement cannot distinguish the working fix from
  the broken one.** The browser probe is the real evidence, and that limit is recorded here rather
  than hidden behind a green suite.

### Accepted and acted on

- **§4 [Major] the per-request-render requirement has no automated guard.** Accepted. Deferred to
  the Playwright suite in `add-drag-and-drop`, as a check that a row inserted directly into the
  database appears on reload. A source-inspecting unit test and a build-output assertion in
  `npm run verify` were both considered and rejected, with reasons in the change's design. Until the
  suite exists, the requirement rests on a recorded manual check — stated plainly rather than
  implied.
- **§2 [Minor] nothing committed.** Acted on: the change is being committed as logical groups of
  files. This does not manufacture the red-then-green history that `tasks.md` describes — that
  cannot be reconstructed after the fact, and pretending otherwise would be worse than saying so.
  The commits give granularity, not TDD evidence.

### Carried to `add-drag-and-drop`, not fixed here

- **[Major] the concurrent-drag rule**, unanswered across two review passes.
- **[Major] dnd-kit's default arrow key moves 25px.** Verified independently at
  `node_modules/@dnd-kit/core/dist/core.cjs.development.js:1114-1131`. Columns measure 259px at
  1440px viewport, so the planned "Space, Arrow, Space" keyboard path needs a custom
  `coordinateGetter` or it cannot reach the next column at all.
- **[Note] `NOT_FOUND` does not revalidate**, so a card deleted mid-move returns to a column it no
  longer belongs to and stays until reload.

### Carried to `add-application`

- **Unbounded field lengths**, the last unresolved Major from 2026-09-21, as a blocking item.
