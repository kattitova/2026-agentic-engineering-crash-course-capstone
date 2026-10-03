# Tasks

Two orderings here are deliberate, not stylistic.

`spec.md` is updated **first**, in group 1. `AGENTS.md` → "Scope" asks for
`spec.md` to be updated before functionality that is not in it, and a chooser
that sets status widens MVP item 3 ("**Drag** a card between columns",
`spec.md:52`). Writing the entry last would make the history say the opposite of
the rule.

`movableColumns` is business logic, so `AGENTS.md` requires its test to fail
before the implementation exists. Groups 2 and 3 are split for that reason.

## 1. Record the scope first

- [x] 1.1 Add a `spec.md` change-log entry dated to the day of the commit,
  recording (a) that moving a card now has a third activator while `status`,
  `appliedDate` and `statusChangedAt` keep one owner — a refinement of the
  2026-09-29 and 2026-10-01 entries (`spec.md:148`, `spec.md:197-200`), not a
  reversal of them — and (b) that touch drag is knowingly left broken, with the
  stacked-column reason, so the next reader finds a decision rather than a defect.
  Verify the entry names both and that it is in place before any code is written.

## 2. The offered columns, red first

- [x] 2.1 Add failing tests to `lib/applications/move.test.ts` for a
  `movableColumns(from)` that does not exist yet: it returns the four columns a
  card is not in, in funnel order, for each of the five statuses; it never
  includes `from`; and it returns four entries for every status. Verify by running
  `npm test` and seeing these tests fail to resolve the import, not pass.
- [x] 2.2 Implement `movableColumns` in `lib/applications/move.ts` beside
  `planCardMove`, deriving from `BOARD_COLUMNS` so the five and their order stay
  in one place. Verify the 2.1 tests now pass with `npm test`.

## 3. The chooser dialog

- [x] 3.1 Create `components/board/MoveCardDialog.tsx` as a native `<dialog>`
  driven by `showModal()`/`close()`, following `ConfirmDeleteDialog.tsx`: props are
  the `JobApplication` (`null` closes it), `onChoose(application, to)` and
  `onCancel`; it is labelled by a heading naming the company, lists
  `movableColumns(application.status)` as buttons in funnel order, and shows the
  current status as text that is not a button. Mount its contents only while open,
  as `ConfirmDeleteDialog` does, so the heading never names a dismissed card. Use
  `showModal()`, never `show()` — 5.3 is the task that can tell the difference.
  Verified by 3.2.
- [x] 3.2 Add `components/board/MoveCardDialog.test.tsx` covering what jsdom can
  see: the heading names the application; the four other statuses are offered as
  controls and the current one is not; the offered order is funnel order; choosing
  one calls `onChoose` with that status; `onCancel` fires on a dismiss control and
  `onChoose` does not. Note in the file that Escape, the inert background and
  focus restoration are **not** covered here — jsdom implements neither
  `showModal()` nor `close()`, so they are stubbed, exactly as
  `ConfirmDeleteDialog.test.tsx:30-36` already records — and name the e2e tasks
  that do cover them. Verify with `npm test`.

## 4. Wiring the second gesture

- [x] 4.1 Add `activationConstraint: { distance: 5 }` to the existing
  `useSensor(PointerSensor)` in `Board.tsx`, with a comment recording *why* it is
  load-bearing — `handleStart()` is what installs dnd-kit's document-level click
  suppressor, so without the constraint the handle's `onClick` can never fire.
  Verified by 4.8 and 5.1.
- [x] 4.2 Add an `onMove?: (application: JobApplication) => void` prop to
  `ApplicationCard`, called from the drag handle's `onClick`. Leave the handle's
  `aria-label` as `Move <company>` — `e2e/keyboard-move.ts:29` and
  `e2e/move-card.spec.ts:42` select it by that exact string, and the spec asks
  only that it name the application it moves. Keep the prop optional so the card
  still renders outside a `DndContext`. Verified by 4.6.
- [x] 4.3 Thread `onMove` through `DraggableCard` and `BoardColumn` the way
  `onEdit` and `onDelete` are already threaded, keeping both renderable without a
  `DndContext`. Verify `npm run typecheck` passes, and by 4.7.
- [x] 4.4 Hold the chooser's open state in `Board.tsx` as the `JobApplication`
  itself — not its id — for the reason `editing` and `deleting` already do: an
  optimistic move rewrites `shown` the moment a column is chosen. Mount
  `MoveCardDialog` beside the edit and delete dialogs. Verified by 4.7.
- [x] 4.5 Focus the card's handle **before** opening the chooser, so the dialog
  has a correct element to restore focus to on dismissal. A click does not focus
  a button in WebKit — Safari and iOS, the device this change exists for — so
  relying on the click to have focused it would make focus-after-dismissal pass
  in Chromium and fail on the target device. Verified by 5.4.
- [x] 4.6 In `Board.tsx`, make the choice handler close the chooser, then call
  `planCardMove(application.id, application.status, to)` and pass a non-null result
  to `moveCard`, so a menu move and a drop share one validation and one write.
  Set `focusCardId` to the moved card, as `handleDragEnd` does for a keyboard
  move; leave it `null` on a dismissal, so nothing races the browser's own
  `<dialog>` restoration for the same focus. Verified by 4.7 and 5.5.
- [x] 4.7 Extend `components/board/ApplicationCard.test.tsx` to assert the handle
  calls `onMove` with its application on click, and that neither `onEdit` nor
  `onDelete` fires — the spec's "a move is not an edit or a deletion". Verify with
  `npm test`.
- [x] 4.8 Extend `components/board/Board.test.tsx` to assert the chooser opens for
  the clicked card, that choosing a column calls the status action once with that
  status, and that a card already busy cannot be moved by the chooser — through
  the disabled handle, not through `moveCard`, since the hook has no pending guard
  of its own. Verify with `npm test`.
- [x] 4.9 Add a jsdom regression test for the constraint itself: inside `Board`,
  fire `pointerdown` → `pointerup` → `click` on a handle with no movement between
  them and assert the chooser opens. The click-versus-drag decision is made from
  pointer event coordinates, not from layout, so this is reachable without real
  rects — and it is the only cheap test that fails if 4.1 is reverted. Verify with
  `npm test`; if jsdom does not deliver what dnd-kit's activator needs from a
  pointer event, drop this task and say so, leaving 5.1 as the cover.

## 5. End-to-end — the platform's behaviour and the pointer

Each of these covers something no component test in this project can see. The
first exists because the sensor config is the thing most likely to be edited
next; the rest because `showModal()` and focus restoration are the browser's.

- [x] 5.1 Add an e2e test that drags a card between two columns with
  `page.mouse.down/move/up` — the first pointer drag in the suite; every existing
  move goes through `moveRightWithKeyboard`. Assert the card lands in the target
  column and the move survives a reload. Move in several steps so the 5px
  threshold is crossed the way a real pointer crosses it. Verify with
  `npm run test:e2e`.
- [x] 5.2 In the same spec, press and release the handle with the pointer moving
  only a pixel or two and assert the chooser opens and no move was made — the
  spec's "a click with incidental movement". Verify with `npm run test:e2e`.
- [x] 5.3 Add an e2e test for the chooser's modality, following
  `e2e/edit-and-delete.spec.ts:233-268`: Escape closes it and the application is
  unchanged, and a Tab trail never lands on a focusable element outside the open
  dialog. Reuse that file's `tabTrail` helper rather than copying it. This is what
  fails if `show()` is ever used in place of `showModal()`. Verify with
  `npm run test:e2e`.
- [x] 5.4 Assert focus is on the card's `Move <company>` handle after the chooser
  is dismissed **without** a move. Verify with `npm run test:e2e`.
- [x] 5.5 Add an e2e test for a *failed* menu move: with the status write made to
  fail, choose a column and assert the card returns to its original column and the
  board's failure message is shown. This is the spec's "the same failure handling
  whatever the means", and it is the one test that fails if the choice handler ever
  bypasses `moveCard` and writes directly. Verify with `npm run test:e2e`.
- [x] 5.6 Add an e2e test that taps the handle, chooses a column, asserts the card
  moved, reloads and asserts it is still there; then assert focus is on the moved
  card's handle in its new column. Note the ordering: focus lands once the card is
  no longer busy, so assert after it has settled, not immediately after the click.
  Verify with `npm run test:e2e`.
- [x] 5.7 Run `npm run test:e2e` in full and confirm the existing keyboard suite is
  untouched. `KeyboardSensor` takes no `activationConstraint`, so this is expected
  to pass unchanged; a failure here means 4.1 did more than intended.

## 6. The one check that stays manual

- [x] 6.1 Check the chooser on a real touch device or a device-emulating browser:
  tapping the handle opens it, choosing a column moves the card, and the drag
  gesture still fails as the proposal says it knowingly does. Record the result in
  this change's `apply-notes.md`, stating that it was a manual check and on which
  device — nothing in CI runs a real touchscreen, so this result has to live
  somewhere a reader can find it.

## 7. Gates

- [x] 7.1 Run `npm run verify` and make it pass with no errors.
- [x] 7.2 Run `openspec verify --change move-card-by-menu` (with Node 22 on
  `PATH`) and resolve anything it reports, so no review pass is spent discovering
  that the artifacts and the code disagree.
- [x] 7.3 **Ask the user** whether to run the `reviewer` agent on the diff, and
  wait for their answer. Do not launch it. If they say yes, it is run by hand as
  `node .claude/hooks/review.mjs move-card-by-menu --agent reviewer`, with the
  change name as its only argument. Verify this task by having asked and received
  an answer — a decline is a complete answer.
- [x] 7.4 If a review was run and raised findings, fix them, then re-run both
  `npm run verify` and `openspec verify`, and **ask** before any re-review rather
  than starting one.
