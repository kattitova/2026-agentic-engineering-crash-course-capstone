# 2026-10-03 — move-card-by-menu

**Reviewer:** reviewer sub-agent (separate session; maker ≠ checker)
**Mode:** full review (no earlier code review of this change exists; the 2026-10-02 pass in
`docs/proposal-reviews/` was a proposal review, read for context only)
**Launched:** as an in-process sub-agent through the Agent tool, not through
`.claude/hooks/review.mjs`, so `.claude/reviewer-settings.json` was not in force and the
"never fix anything" rule held at the prompt level only. The prompt gave the change name plus
context: the commit list, how to diff (`bf0292a..HEAD`, since `main` does not hold this
project's history), today's date, the ID scheme and permission to run `npm run verify`. It listed
**no** things to check, so the checklist below was not steered.
**Reviewed:** `git diff bf0292a..HEAD` excluding `.agent-log`: commits `8f9725e` (spec.md entry),
`adb5b87` (proposal review record), `0dc28bc` (`tabTrail` moved to `e2e/tab-trail.ts`),
`0e8a998` (the implementation), `cc434ae` and `bb10eaf` (logs). Working tree clean.
Code read: `components/board/{ApplicationCard,Board,BoardColumn,DraggableCard,MoveCardDialog}.tsx`,
`lib/applications/move.ts`, their tests, `e2e/move-by-menu.spec.ts`, `e2e/tab-trail.ts`,
`e2e/edit-and-delete.spec.ts`, plus `useBoardCards.ts` and `ConfirmDeleteDialog.tsx` for context.
**Verification run:** `npm run verify` stops at typecheck on `app/layout.tsx(20,50): Cannot find
name 'LayoutProps'`. That is Next's generated route type: this checkout has no `.next/`, and the
line is not touched by this change (last changed in `f52b1c8`). `npx tsc --noEmit` reports that
one error and nothing else. `npm run test` passes: 16 files, 315 tests. Lint passes.
`npm run test:e2e` was **not** run. It needs `npm run e2e:db`, which does a
`prisma db push --force-reset`, a write this role may not perform. The e2e claims below come from
reading the code and `apply-notes.md`, not from watching a run.
**Verdict:** PASS WITH NOTES — 0 critical, 0 major, 2 minor

## Previously decided — not re-raised

| Ledger entry | Why it is relevant here | Status |
| --- | --- | --- |
| `R20260927-7`: red-then-green order cannot be read out of git history | `movableColumns` and its test land in the same commit (`0e8a998`). `apply-notes.md` records that the 4.9 test was run red. The ledger closes this class. | Declined |
| `R20260927-12`: focus lost after a keyboard move | A chooser move reuses that `focusCardId` mechanism. Context only. | Accepted |
| `R20261001-1`: `moveCard` has no pending guard of its own | This is why the busy-card test goes through the disabled handle (`Board.test.tsx`, "cannot be moved again by any means"). That is the right thing to do. | Accepted |
| `R20260929-3` / `R20261001-3`: commit hygiene, not rewritten | `bb10eaf` "chore: add logs" carries a non-log file. Raised only as an open question below, not as a commit-type finding. | Accepted |

No Deferred entry names this change, a menu move or touch input.

## 1. Spec compliance

Each requirement in `specs/kanban-board/spec.md` maps to code and to a test:

| Requirement / scenario | Code | Evidence |
| --- | --- | --- |
| Moved without dragging; survives reload | `ApplicationCard.tsx` handle `onClick` → `Board.tsx` `openMove` → `MoveCardDialog` → `chooseMove` | `Board.test.tsx` "writes once…", "closes the chooser and shows the card…"; e2e "moves a card by tapping…" (DB poll + reload) |
| No press-and-hold device | Chooser offered unconditionally | `apply-notes.md` 6.1 (emulated Pixel 7, manual) |
| Names the card; four others in funnel order; current shown, not offered | `MoveCardDialog.tsx` heading + `movableColumns` (`move.ts`) | `move.test.ts` (all five statuses, order vs `BOARD_COLUMNS`), `MoveCardDialog.test.tsx` |
| Dismissed without change, no message; Escape; background inert | `onClose={onCancel}`, `showModal()`; dismissal sets no focus target | `Board.test.tsx` "moves nothing… when it is dismissed"; e2e trap/trial-click/Escape test |
| Focus after a move / after a dismissal | `chooseMove` sets `focusCardId`; handle focused in `onClick` before opening | e2e "leaves focus on the moved card's handle…", two "gives focus back…" tests; `ApplicationCard.test.tsx` "is focused before the callback runs" |
| Press-and-move drags; activation and incidental drift open the chooser; keyboard still picks up | `PointerSensor` `activationConstraint: { distance: 5 }` | jsdom "Board telling a click from a drag" (2 tests); e2e pointer drag, 2px drift, keyboard move with no dialog |
| Same guarantees whatever the means: hold, other cards movable, rollback + message | `chooseMove` → `planCardMove` → `moveCard` | `Board.test.tsx` failure, rejection, busy and other-card tests; e2e SQLite-trigger failure |
| A move is not an edit or a deletion | separate callbacks | `ApplicationCard.test.tsx`, `Board.test.tsx` |

No code exists without a requirement behind it.

Not done, and stated plainly in the artifacts rather than hidden: task 6.1 is unticked. It was
checked on an emulated device only. A real phone, WebKit, and "touch drag still fails" were not
observed. Each of these is a manual check, not a code requirement, so it is not a finding.

## 2. AGENTS.md compliance

No findings. No `any`. `movableColumns` lives in `lib/applications/move.ts`. Styling is Tailwind
only. No schema change and no lockfile change. The `spec.md` entry landed in its own commit
before the code, which is what the proposal pass asked for (`P20261002-3`). The `tabTrail` move
is a separate `refactor` commit, apart from the feature. Every new interaction has tests at
component level and in e2e.

## 3. Edge cases

No findings. Each case was reasoned through against the code:

- **Two moves in quick succession of one card.** After a choice, the handle is disabled until
  the write settles, so the chooser cannot reopen for that card and a drag cannot start. Both
  paths are tested.
- **A drop into the card's own column.** The chooser does not offer that column, and
  `planCardMove` returns `null` for it anyway, so nothing is written and `statusChangedAt` is
  untouched.
- **A deletion in flight against the card.** While the chooser is open the background is inert,
  and a busy card's handle is disabled, so the chooser cannot be opened against a card whose
  write is outstanding. A row deleted elsewhere falls to the action's existing `NOT_FOUND` path.
- **The `onClose` handler firing twice.** `onClose={onCancel}` also fires after a choice,
  because the effect calls `close()`. It sets `moving` to `null` a second time, which changes
  nothing.
- **Form fields.** None are touched.
- **A status outside the enum.** Such a card is never rendered (`groupApplicationsByStatus`), and
  `currentLabel` falls back to the raw value.
- **A drag past 5px.** dnd-kit's click suppressor still swallows the click that follows a real
  drag.

## 4. Test strength

The mutations were reasoned against the new tests:

- Removing the activation distance fails both jsdom "tap" tests. `apply-notes.md` records this
  as observed, and it agrees with the code path: `handleStart()` installs the capture-phase
  click stop.
- Removing the `focus()` call in the handle fails "is focused before the callback runs". jsdom
  does not focus on click, so the assertion is real.
- Bypassing `moveCard` fails the Board and e2e failure-path tests.
- Using `show()` fails the e2e trap test. `apply-notes.md` records this mutation as run.
- Offering the current column fails `move.test.ts` and `MoveCardDialog.test.tsx`.

- **[Minor]** `R20261003-2` `components/board/ApplicationCard.test.tsx:506-512`: "does nothing
  when clicked on a card rendered without a chooser" asserts only `not.toThrow()`. Deleting the
  `onMove === undefined` guard would fail typecheck, not this test, and any wrong behaviour that
  does not throw passes it. It reads as coverage of the "renders outside a `DndContext`" goal
  while pinning nothing observable. What is lost is a little reader confidence, not behaviour.

## 5. Input safety

No findings. The chooser renders `company` and the status label as React text only. The chosen
`to` comes from a fixed list and still goes through `planCardMove`, and the server action
validates it again. No write path for `company`/`position`/`notes`/`link` is touched.

## 6. Accessibility

What holds:

- The handle keeps the name `Move <company>`, on a `<button>`, so the name survives.
- The keyboard sensor is unchanged.
- The dialog is named by its heading.
- Choices are 44px targets.
- The failure message reaches the board's existing alert region.
- Focus is restored after both a move and a dismissal, and both are pinned in e2e.

- **[Minor]** `R20261003-1` `components/board/MoveCardDialog.tsx:50-55, 65-67`: the "Currently
  in <column>." paragraph is not wired as the dialog's description. `ConfirmDeleteDialog` sets
  `aria-describedby` on its body text (`ConfirmDeleteDialog.tsx:56`); this dialog sets only
  `aria-labelledby`. When it opens, focus lands on the first choice, so what is computed for
  assistive technology is the name "Move Acme Cloud to…" and then "Wishlist, button". The one
  fact the spec says the chooser SHALL show, where the card is now, is in the DOM but outside the
  dialog's accessible name and description. A screen-reader user has to browse to find it. This
  is also a divergence from the sibling dialog's convention (§7, not reported twice).

## 7. Consistency with earlier features

No further findings. `MoveCardDialog` follows `ConfirmDeleteDialog` in these ways:

- the `useEffect` that drives `showModal`/`close`;
- `useId` for the title;
- content mounted only while open;
- the same container classes;
- `onClose={onCancel}`.

The one difference is under `R20261003-1`. Board state holds the object, not the id, matching
`editing` and `deleting`. The prop threading matches `onEdit`/`onDelete`. The comment style
matches the rest of the board.

## Open questions

1. **`.vitest/json/output.json` is tracked** (added in `bb10eaf`, "chore: add logs"). It is a
   Vitest JSON report from 06:22 UTC today recording `success: false`, with 4 of 47 tests failing.
   They are the two rollback tests and the two click-versus-drag tests of this change, which
   looks like the red phase. Nothing in `vitest.config.mts` writes it. If it is meant as evidence
   of red-first, the author may want it referenced from `apply-notes.md`. If it is not, a
   committed report that says the suite fails will mislead the next reader.
2. **Task 7.2 (`openspec verify`) is unchecked.** `AGENTS.md` → "Order on the way out of
   `apply`" puts it before the review pass. This review found no artifact/code drift, but it was
   not built to be that check.
3. **A screen reader's activation is a click.** In browse mode (NVDA/JAWS) and with VoiceOver's
   double-tap, activating the handle usually dispatches a `click` rather than a Space/Enter
   `keydown`. For those users the handle would open the chooser, not pick the card up. That is
   arguably the better outcome, but dnd-kit's `aria-describedby` instructions on the handle still
   describe only the Space/Enter pick-up. Not verified with a screen reader. The author should
   decide whether the instructions should mention the chooser.
4. The Firefox/WebKit Space-`keyup` question and the WebKit focus question are already recorded
   in `design.md` and `apply-notes.md`. They are listed here only to show they were seen, not
   reopened.

## Blocking follow-ups

None — this change is clear to ship.

## Non-blocking suggestions (shipping does not depend on these)

- `R20261003-1`: describe the chooser by its "Currently in …" line, as `ConfirmDeleteDialog`
  does with its body.
- `R20261003-2`: the no-throw test for a card without `onMove` pins nothing observable.
