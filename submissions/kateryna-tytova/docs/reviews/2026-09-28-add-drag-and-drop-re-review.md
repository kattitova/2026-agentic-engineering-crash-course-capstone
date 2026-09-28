# 2026-09-28 — add-drag-and-drop (re-review)

**Reviewer:** reviewer sub-agent (separate session; maker ≠ checker)
**Mode:** re-review (follow-up to `docs/reviews/2026-09-27-add-drag-and-drop.md`)
**Reviewed:** `git diff 5239506..HEAD` — the fix commits `4f2a23e`, `9072969`, `3307800`,
`bc74998`, `3382545`, `45c7031`, i.e. `lib/applications/move.ts` + `move.test.ts`,
`components/board/{Board,DraggableCard,BoardColumn,ApplicationCard}.tsx`, the new
`components/board/useCardMoves.ts` + `useCardMoves.test.ts`, `e2e/move-card.spec.ts`,
`playwright.config.ts`, `spec.md`, plus the author's
`docs/reviews/2026-09-27-add-drag-and-drop-disposition.md` and the updated
`docs/reviews/decisions.md`. Every source file is committed; only `.agent-log/actions.jsonl` is
uncommitted.
**Verification run:** `npm run verify` — lint, typecheck and 72 tests in 7 files pass (30.1s; 58
tests before the fixes). `npm run test:e2e` was not run: it builds the app and resets `e2e.db`,
which is a write command. The e2e spec and the Playwright config were read instead.
**Verdict:** PASS WITH NOTES — 0 critical, 0 major, 1 minor (carried forward unchanged; the
re-review scope admits no new Minor findings, Notes or open questions)

## Previously decided — not re-raised

| Closed item | Status in the ledger |
| --- | --- |
| Maximum field lengths on `company`, `position`, `link`, `notes` | Deferred (`add-application`) — not cashed here |
| Unused `@dnd-kit/sortable` / `@dnd-kit/utilities`; disabled "Add application" button; `listApplications` outside `ActionResult`; `R20260927-7` red-then-green history | Declined |
| All `harden-kanban-board` and `render-kanban-board` fixes | Accepted |
| `R20260927-6` clamp/wrap assertions | Open by the author's own entry — carried below, not restated as new |

## Status of previous findings

- **`R20260927-8` — fixed (behaviour verified, not just the presence of a fix).** The rect
  reasoning moved out of the component into pure functions: `lib/applications/move.ts:78-95`
  (`columnAtPoint`) tests containment on **both** axes, and `:106-117` (`keyboardStep`) returns
  `{x: rect.left, y: rect.top}` of the funnel-adjacent column, so the vertical component the old
  getter never had is now carried. `components/board/Board.tsx:46-72` builds the rect list from
  dnd-kit's `droppableRects`, locates the card by the **centre** of its own rect rather than by a
  shared `left` edge, and falls back to the pick-up status only before the first key press. Traced
  through the wrapped case that failed before: at 1100px (`lg:grid-cols-3`) a card in Interview
  now receives Offer's `left` *and* Offer's `top`, so the card's rect lands wholly inside Offer and
  `rectIntersection` resolves `over` to Offer instead of Wishlist — the wrong status can no longer
  be stored, and Offer/Rejected are reachable by keyboard. The guard is real: `move.test.ts:99-112`
  asserts that two columns sharing a `left` on different rows are told apart, and `:122-128` pins
  `keyboardStep(TWO_ROWS, INTERVIEW, 1)` to `{x: 40, y: 289}`, which fails if either axis is
  dropped. Evidence caveat, recorded because hard rule 6 asks for behaviour: the new `wrapped`
  Playwright project (`playwright.config.ts:23-25`) moves Acme Cloud from Applied to Interview,
  which is a within-row step even at 1100px, so the cross-row case is guarded by the unit tests
  rather than by the browser project. The unit fixtures are measured from the running board and do
  discriminate, so the finding is fixed; the e2e project widens the sensor-wiring coverage but is
  not what catches this defect.
- **`R20260927-9` — fixed.** `components/board/useCardMoves.ts:36-58` holds a
  `ReadonlySet<string>` and each write deletes **its own** card id from the set on settle, so a
  second card's move no longer overwrites the first card's hold. `useCardMoves.test.ts:95-126`
  drives exactly the interleaved sequence from the finding — hold `a`, start `b`, settle `b` — and
  asserts `isMovePending("a")` is still true, then false only after `a` itself settles. Reverting
  to a single id fails that test. The prop chain was reworked to match:
  `BoardColumn.tsx:13,21,69` now takes an `isMovePending(cardId)` predicate, and
  `Board.tsx:73,124` passes the hook's, so the wiring the earlier version left untested is now
  exercised through the hook.
- **`R20260927-10` — fixed.** Extracting the coordination into `useCardMoves` made the failure
  path reachable without dnd-kit, and it is now asserted at the level that matters:
  `useCardMoves.test.ts:128-147` settles the action with `{ok: false}` and checks all three
  consequences — the error message is exposed, the optimistic move is dropped (card `a` is back at
  `APPLIED`), and the card is released. `:149-168` pins that a new move clears a stale message, and
  `:170-183` that the action is called once with the card id and the new status. Deleting the
  `if (!result.ok)` branch, or the rollback behaviour, now fails. Residual, stated for accuracy and
  not as a finding: the one line that is still uncovered is `revalidatePath` on the `NOT_FOUND`
  branch (`app/actions/applications.ts:62`); that scenario needs a row deleted mid-write, which no
  UI can do until `add-application`/delete exists, so it is unreachable for a user today.
- **`R20260927-11` — fixed.** `spec.md:123-137` records MVP item 3 as implemented and names the
  three non-obvious decisions (coordinate getter, held-card set, `NOT_FOUND` revalidation) plus the
  Definition of Done's e2e requirement.
- **`R20260927-12` — fixed.** `DraggableCard.tsx:39-45` focuses the handle once the card is
  released, `ApplicationCard.tsx:60` forwards the ref onto the real `<button>`, and
  `Board.tsx:97-101` sets the focus target only when `activatorEvent instanceof KeyboardEvent`, so
  a pointer drag does not produce an unasked-for ring. Pinned by an effect assertion, not an
  attribute one: `e2e/move-card.spec.ts:112-122` expects the "Move Acme Cloud" button
  `toBeFocused()` after a keyboard move.

## Regressions introduced by the fixes

None found.

- `npm run verify` passes with 14 more tests than before and no lint or type error; no `any`
  entered the diff.
- `BoardColumn`'s new `isMovePending` defaults to `() => false` and `focusCardId` to `null`
  (`BoardColumn.tsx:21-24`), so the existing component tests that render a column outside a
  `DndContext` still behave as they did — and they still pass.
- The focus effect cannot loop or steal focus: it runs only while `shouldRestoreFocus && !isMovePending`,
  and `onFocusRestored` (a stable `useCallback` in `Board.tsx:77`) clears the target on the same
  pass.
- `MeasuringStrategy.Always` (`Board.tsx:114`) only changes when droppables are measured; the drop
  decision still goes through `planCardMove`, so the same-column no-op and the unknown-target
  rejection are untouched, and their tests still pass.
- The optimistic list is still derived from the server prop inside the hook
  (`useCardMoves.ts:33`), so revalidated data continues to win by construction; the action file
  changed only in the previously reviewed `NOT_FOUND` branch.
- Nothing in the fix diff touches the input-safety guards: `isHttpUrl` on the render path and the
  double status validation (client `planCardMove`, server `isApplicationStatus`) are unchanged.

## New Critical or Major defects inside the fix diff

None.

## Open questions

None — the re-review scope does not admit new ones, and the three the previous pass raised are
answered in `docs/reviews/2026-09-27-add-drag-and-drop-disposition.md` (a 1100px project was added;
the dnd-kit announcement coupling is accepted with a stated failure mode; `resetBoard` is left as
is because the schema is force-reset per run).

## Blocking follow-ups

None — this change is clear to ship.

## Non-blocking suggestions — shipping does not depend on any of these

Carried forward unchanged, not restated as a new finding.

- **[Minor]** `R20260927-6` `components/board/ApplicationCard.test.tsx:57-60` — the clamp/wrap
  assertions still match class substrings, so `line-clamp-3` → `line-clamp-1` passes. The author
  records in `decisions.md` that the deferral to Playwright was not honoured (the suite measures
  page overflow, not clamp depth) and carries it as the one open item, which is the right handling.
