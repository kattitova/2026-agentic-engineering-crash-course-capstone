# 2026-09-27 — harden-kanban-board (implemented, uncommitted) + add-drag-and-drop (still only proposed)

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

## 1. Spec compliance

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

## 2. AGENTS.md compliance

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

## 3. Edge cases

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

## 4. Test strength

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

## 5. Input safety

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

## 6. Accessibility

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

## 7. Consistency with earlier features

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

## Open questions

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

## Recommended follow-ups

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
