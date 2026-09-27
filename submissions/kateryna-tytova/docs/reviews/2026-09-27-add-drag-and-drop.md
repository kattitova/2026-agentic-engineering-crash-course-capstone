# 2026-09-27 — add-drag-and-drop

**Reviewer:** reviewer sub-agent (separate session; maker ≠ checker)
**Mode:** full review (first review of the implemented change; the 2026-09-21 pass and the
2026-09-27 re-review only looked at the *plan*, so this is not a follow-up to a review of this
code)
**Reviewed:** commits `d411bb3`, `9e3681a`, `64c33b6`, `a4318a4`, `295f9a1`, `3ffcb1a`,
`ef2380d`, `bde7219`, `5239506` — i.e. `git diff 3dfc8d9..HEAD` limited to the change's files:
`lib/applications/move.ts` + `move.test.ts`, `components/board/{Board,DraggableCard,BoardColumn,ApplicationCard}.tsx`,
`components/board/ApplicationCard.test.tsx`, `app/actions/applications.ts`,
`playwright.config.ts`, `scripts/seed-e2e.ts`, `e2e/move-card.spec.ts`, `package.json`,
`.gitignore`, and `openspec/changes/add-drag-and-drop/{proposal,design,tasks}.md` +
`specs/kanban-board/spec.md`. All 4 task groups are checked and all source is committed; the only
uncommitted file is `.agent-log/actions.jsonl`.
**Verification run:** `npm run verify` — lint, typecheck and 58 tests in 6 files pass (2.53s).
`npm run test:e2e` was **not** run: it builds the app and resets `e2e.db`, which is a write
command and outside a reviewer's permitted commands. The e2e spec was read instead.
**Verdict:** CHANGES REQUESTED — 0 critical, 3 major, 3 minor

Finding IDs continue the 2026-09-27 sequence at `R20260927-8` rather than restarting at 1, because
three earlier passes on this date already issued `R20260927-1` … `R20260927-7` and an ID must stay
unique for the ledger to refer to it.

## Previously decided — not re-raised

Read from `docs/reviews/decisions.md`. This table is not a findings list and does not affect the
verdict.

| Closed item | Status in the ledger | Handling here |
| --- | --- | --- |
| No maximum length on `company`, `position`, `link`, `notes` | Deferred (`add-application`) | Not cashed — that change is not under review |
| Unused `@playwright/test` / `@dnd-kit` packages | Declined | Not raised (`@dnd-kit/sortable` and `@dnd-kit/utilities` are still unused; same decision) |
| Disabled "Add application" button without a requirement | Declined | Not raised |
| `listApplications` outside the `ActionResult` convention | Declined (convention scoped: actions return, loaders throw) | Not raised; `lib/applications/queries.ts` still throws, consistently |
| `R20260927-4` concurrent drags / `R20260927-3` 25px keyboard step / `R20260927-5` `NOT_FOUND` before `revalidatePath` | Deferred to this change, **cashed on 2026-09-27 in the design** | Closed as design decisions; I review only whether the *implementation* matches them, which is where `R20260927-8` and `R20260927-10` below come from |
| All 2026-09-21 / 2026-09-27 Accepted (fixed) items | Accepted | Not raised |
| `R20260927-7` red-then-green unverifiable from history | Declined | Not raised — and for this change the history does show it (`d411bb3`/`9e3681a`, `64c33b6`/`a4318a4`, `295f9a1`/`3ffcb1a`) |

**Deferrals cashed in and found satisfied — no finding:**

- `R20260927-2` (Major, deferred here) — `e2e/move-card.spec.ts:115-138` inserts a row straight
  into `e2e.db` and asserts it appears after a reload. With `await connection()` removed from
  `lib/applications/queries.ts` the page would prerender at build time and the reload would still
  show the pre-insert board, so the check does discriminate. The deferral is satisfied; not raised.
- The count-announcement guard (`4.2b`, carried by the author) — `e2e/move-card.spec.ts:140-157`
  reads the real accessibility tree over CDP and asserts both that a node named `N application(s)`
  exists and that **no** node is named by a bare digit. That is the dimension jsdom could not see.
  Satisfied; not raised.
- 2026-09-21 §2 (Minor, "commit the proposal before implementation") — `2ea816c` committed the
  proposal before the first implementation commit. Satisfied.
- `R20260927-6` (Minor, deferred here) is cashed and **still open**; see the non-blocking list. It
  is raised once, at the severity the deferral named.

## 1. Spec compliance

- **[Major]** `R20260927-8` `components/board/Board.tsx:27-53` — the keyboard
  `coordinateGetter` only ever changes `x`; `y` is returned unchanged (`y: collisionRect.top`,
  line 52). The board grid is `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5`
  (`Board.tsx:120`), so below a 1280px viewport the five columns occupy two or more rows. Concrete
  failure: at a 1024–1279px viewport (three columns per row) a card in **Interview** is picked up
  and ArrowRight is pressed. `adjacentColumn` returns `OFFER`, which is the first column of row 2,
  so `droppableRects.get("OFFER").left` equals **Wishlist's** left. The returned coordinates are
  Offer's `x` with row 1's `y`, i.e. the card is placed over the *Wishlist* column; Space then
  stores `WISHLIST`. The same `x`-only reasoning breaks the "where is the card now" lookup at
  lines 38-41, which matches a column by `rect.left === collisionRect.left` — below `xl` several
  columns share a `left`, so `.find` returns the first of them (row 1) and the next arrow press
  walks from the wrong column. What the user loses: below 1280px the keyboard path cannot reach
  Offer or Rejected at all, and an ArrowRight across a row boundary stores a status the person did
  not choose. The delta spec scenario "One key press moves one column" requires the card to be
  over the adjacent column "whatever the width of the columns", and `design.md` claims "Below `xl`
  the grid wraps onto several rows. Left/Right still walk funnel order" — the code has no vertical
  component, so it cannot. Related, and not filed separately per one-requirement-one-Major: this
  rect→column logic lives inline in a client component instead of `lib/` (AGENTS.md), which is why
  it has no unit test and the row case went unnoticed.
- **[Major]** `R20260927-9` `components/board/Board.tsx:65,88,95` — the "a card with a move in
  flight cannot be moved again" guard is a single `pendingCardId`, not a set. Concrete failure:
  drag card A (`setPendingCardId(A)`), then, while A's write is still outstanding, drag card B —
  line 88 overwrites the state with `B`, so A's handle is re-enabled
  (`BoardColumn.tsx:65` compares `application.id === pendingCardId`) and A can be dragged a second
  time with its first write unsettled; line 95 then clears the state on whichever write settles
  first, regardless of which card it belonged to. The spec requirement "A card cannot be moved
  again while its move is being stored … so two moves of one card cannot settle out of the order
  they were made in" is therefore not enforced in the interleaved case, and the stored status can
  come to rest on the earlier of the two drags. No test covers the wiring either: the only
  assertions are `ApplicationCard.test.tsx:96-107`, which pass `isMovePending` in by hand and
  never exercise `Board`'s bookkeeping, so removing `pendingCardId={pendingCardId}` from
  `Board.tsx:126` keeps all 58 unit tests and all four e2e tests green.
- **[Major]** `R20260927-10` `components/board/Board.tsx:92-94`, `e2e/move-card.spec.ts` — the
  whole "A failed move reports the failure and leaves the board truthful" requirement (three
  scenarios: write fails → rollback + message; truthful after reload; application deleted in
  flight → not restored) has no test at any level. There is no `Board` test file, the e2e spec
  covers only the happy path plus the two deferred guards, and `app/actions/applications.ts:62`
  (the new `revalidatePath` on the `NOT_FOUND` branch) has no test either. The behaviour is a spec
  requirement and a plausible edit breaks it silently: drop the `if (!result.ok)` branch, or the
  new `revalidatePath`, and every check still passes while the board shows a card in a column the
  database does not have, with no message. A jsdom `Board` test with the action module mocked can
  reach all three scenarios, so this is not a jsdom limitation like `4.2a`/`4.2b`.
- Everything else maps. "Card dropped on another column" / "survives a reload" / "counts follow the
  move": `e2e/move-card.spec.ts:87-113`. "Dropping a card in its own column changes nothing" and
  "Drag cancelled": `planCardMove` returns `null` for an equal status and for `over === undefined`
  (`lib/applications/move.ts:30`), so no action runs and `statusChangedAt` is untouched; covered by
  `move.test.ts:15-23`. "First move into Applied records the application date": `planStatusChange`
  unchanged, covered by `status.test.ts:20-39`. "Card is reachable / announced as a control":
  `ApplicationCard.tsx:56-63` is a real `<button>` with an `aria-label`. No code was found that
  exists without a requirement behind it; nothing in the delta spec is unimplemented outside
  `R20260927-8`.

## 2. AGENTS.md compliance

- **[Minor]** `R20260927-11` — the proposal's Impact section says "`spec.md` MVP item 3 becomes
  implemented, and the Definition of Done's e2e requirement is met", but `spec.md` gained neither a
  status note nor a Spec change log entry for this change, while every earlier decision of this
  kind was logged there. Documentation drifts from the proposal; no behaviour is affected.
- No `any` in `app/`, `lib/`, `components/`, `e2e/`, `scripts/` outside the generated client;
  strict mode passes. Tailwind only, no new `.css`. `prisma/schema.prisma` untouched, so no
  `db push` obligation. npm only — the new `e2e:db`/`test:e2e` scripts are npm scripts and the
  seeder shells out through `npx`. Commit subjects all follow `type(scope): description` and split
  red from green (`295f9a1` test → `3ffcb1a` feat, `d411bb3` → `9e3681a`, `64c33b6` → `a4318a4`),
  which is the red-then-green evidence AGENTS.md asks for. The new UI interaction has tests (see §4
  for where they stop).

## 3. Edge cases

- A card dragged twice in quick succession: gated by the handle, but only for the non-interleaved
  case — reported once as `R20260927-9`.
- A card dropped into the status it already has: true no-op. `planCardMove` returns `null` before
  any await (`move.ts:30`), so no write happens and `updatedAt`/`statusChangedAt` are untouched.
- Deleted while an action is in flight: `updateApplicationStatus` now revalidates on the
  `NOT_FOUND` branch (`app/actions/applications.ts:59-66`), so the rollback is followed by a
  re-render without the row. Code-correct; untested — counted under `R20260927-10`.
- Empty / whitespace / very long values: no new form field in this change; the clamp and
  `break-words` from `harden-kanban-board` still hold, and maximum lengths remain deferred to
  `add-application`.
- A status the enum does not cover: `groupApplicationsByStatus` skips it and `planCardMove`
  rejects an unknown `over.id` (`move.ts:30`), with `updateApplicationStatus` re-checking on the
  server (`applications.ts:47`). Defence at both ends.
- One more case checked and found sound: `handleDragEnd` reads the source status from
  `active.data.current.status` and bails when it is not a status (`Board.tsx:77-80`), so a drag
  whose data went missing cannot write.

## 4. Test strength

- `lib/applications/move.test.ts` is strong: `:35-44` walks every status pair and asserts
  `plan === null` **iff** `from === to`, so inverting the same-column check fails; `:66-74` walks
  `adjacentColumn` and compares the traversal to `BOARD_COLUMNS`, so a reversed or wrapping
  implementation fails. `:59-64` pins both ends against wrapping.
- `ApplicationCard.test.tsx:88-107` asserts the handle's accessible name and both the disabled and
  the enabled state, so an inverted `isMovePending` fails. These are effect assertions, not
  attribute restatements.
- `e2e/move-card.spec.ts:87-102` asserts the card's new column, its absence from the old one, and
  both count labels — deleting the action call fails it.
- The two coverage holes are the untested failure path (`R20260927-10`) and the untested
  `pendingCardId` wiring (folded into `R20260927-9`); neither is restated here as a separate
  finding.

## 5. Input safety

No findings. This change adds one write path (a status, not free text). The droppable id arrives
from the DOM and is validated twice — `isApplicationStatus` in `planCardMove` (`move.ts:30`) and
again inside the server action (`applications.ts:47`) — and the id is validated by `isValidId`.
`ApplicationCard.tsx:29-30` still re-checks `link` with `isHttpUrl` on the render path, so a
`javascript:` URL written straight into the database is not turned into an `href`; the guard is
unchanged and still shared with the write path.

## 6. Accessibility

- **[Minor]** `R20260927-12` `components/board/Board.tsx:88`, `components/board/BoardColumn.tsx:60-66`
  — focus is neither preserved nor restored after a move. Setting `pendingCardId` disables the
  handle the user is standing on (a disabled button is dropped from the tab order and loses focus),
  and the card is re-rendered under a different `<section>`, so React unmounts the old button and
  mounts a new one. A keyboard user who completes a move lands back on the document body and has
  to tab in from the start of the page to move the next card. Small gap; the move itself works.
- Otherwise sound: `KeyboardSensor` is registered *with* a custom `coordinateGetter`
  (`Board.tsx:73`), not merely installed — its correctness below `xl` is `R20260927-8`. The handle
  is a real `<button>` whose `aria-label` survives into the tree, and dnd-kit's attributes do not
  overwrite it. Failures go to an always-rendered `role="alert" aria-live="assertive"` region
  (`Board.tsx:108-118`), so the region exists before the message. Counts are announced as
  "N applications" with the digit `aria-hidden` and verified in a real accessibility tree
  (`e2e/move-card.spec.ts:140-157`). The icon-only handle and the link both have names; the SVGs
  are `aria-hidden`. No `outline-none` anywhere, so the focus ring survives.

## 7. Consistency with earlier features

No findings. `updateApplicationStatus` keeps returning `ActionResult` and the new branch returns
rather than throws; the read path still throws, per the scoped convention in `decisions.md`. New
logic went to `lib/applications/move.ts` beside `board.ts`/`status.ts` with the same
"why, not what" comment style, and adjacency is derived from `BOARD_COLUMNS` rather than from a
second order table, so a new status still fails to compile in `COLUMN_DEFINITIONS` first. The one
divergence from the established layout — logic living inline in `Board.tsx` — is noted inside
`R20260927-8`.

## Open questions

- `playwright.config.ts:17` uses `devices["Desktop Chrome"]` (1280×720), which is exactly the `xl`
  breakpoint, so the suite only ever exercises the single-row layout. Is a second project at a
  narrower viewport worth it, independently of how `R20260927-8` is resolved?
- `e2e/move-card.spec.ts:42,72-80` synchronises on dnd-kit's internal live-region id and on its
  default announcement wording. Deliberate (the comment argues it), but it couples the suite to
  library copy that a minor upgrade may reword — is that trade-off the one you want long term?
- `resetBoard` (`e2e/move-card.spec.ts:25`) restores `status` only; `appliedDate` and
  `statusChangedAt` keep whatever the previous test wrote, and the `DELETE … NOT IN (?, ?, ?)`
  placeholder list is hand-sized to today's three seeded rows. Harmless now because
  `npm run e2e:db` force-resets the schema per run — worth deciding before a fourth row arrives.

## Blocking follow-ups

1. **[Major]** `R20260927-8` — the keyboard `coordinateGetter` never changes `y`, so below a
   1280px viewport an arrow press across a row boundary puts the card over the wrong column and
   stores the wrong status, and Offer/Rejected are unreachable by keyboard.
2. **[Major]** `R20260927-9` — the in-flight guard is one `pendingCardId`, so moving a second card
   re-enables the first card's handle before its write settles, defeating the spec's ordering
   guarantee; the wiring is untested.
3. **[Major]** `R20260927-10` — the "failed move reports the failure and leaves the board
   truthful" requirement (three scenarios, including the deleted-row case and the new
   `revalidatePath` branch) has no test at any level.

## Non-blocking suggestions — shipping does not depend on any of these

- **[Minor]** `R20260927-11` — `spec.md` gained no note or change-log entry for MVP item 3 even
  though the proposal's Impact section promises one.
- **[Minor]** `R20260927-12` — focus is lost after a keyboard move (handle disabled, then the card
  remounts under another column).
- **[Minor]** `R20260927-6` (deferral cashed in, severity as the ledger named it) — the clamp/wrap
  assertions in `components/board/ApplicationCard.test.tsx:57-60` still match class substrings, and
  the Playwright suite this was deferred to landed without the measured check that would replace
  them; the recorded manual Chromium observation remains the only real evidence.
