# Tasks

## 1. Move planning in lib (TDD)

- [ ] 1.1 Write `lib/applications/move.test.ts` for a `planCardMove(cardId, fromStatus, toStatus)`
      helper covering same-column drops, unknown drop targets and real moves, and verify it
      fails because the module does not exist yet (red step)
- [ ] 1.2 Implement `lib/applications/move.ts` so a drop on the card's own column and a drop
      outside any column both resolve to "no move", and verify the tests pass
- [ ] 1.3 Run `npm run verify` and confirm lint, typecheck and unit tests pass

## 2. Drag-and-drop interaction

- [ ] 2.1 Convert `components/board/Board.tsx` to a client component hosting dnd-kit's
      `DndContext` with pointer and keyboard sensors, and verify the board still renders every
      column and card unchanged
- [ ] 2.1a Give `KeyboardSensor` a custom `coordinateGetter` that moves Left/Right to the adjacent
      column in `BOARD_COLUMNS` order and ignores Up/Down, and verify **one** arrow press carries a
      picked-up card over the neighbouring column. dnd-kit's default getter moves a flat 25px per
      press and columns measure ~259px, so without this the card never leaves its own column
- [ ] 2.2 Make `BoardColumn` a drop target keyed by its status, and verify a dragged card
      highlights the column under it
- [ ] 2.3 Add a drag handle button to `ApplicationCard` with an accessible name naming the
      application, and verify the handle is reachable by keyboard and the posting link still
      opens on click
- [ ] 2.4 Handle drag end: ignore no-op moves via `planCardMove`, otherwise call
      `updateApplicationStatus`, and verify a pointer drag to another column changes the status
      in the database
- [ ] 2.5 Apply the move optimistically with `useOptimistic` inside a transition, and verify the
      card appears in the target column immediately on drop
- [ ] 2.5a Track the card whose write is outstanding and disable that card's drag handle until it
      settles, and verify the handle is disabled during the write, that it is re-enabled on both
      success and failure, and that a different card stays draggable throughout
- [ ] 2.6 On a failed action result, drop the optimistic move and show the failure in an
      assertive live region above the board, and verify the card returns to its original column
- [ ] 2.6a Revalidate the board path on `updateApplicationStatus`'s `NOT_FOUND` branch, and verify
      that deleting an application while its move is in flight leaves no card behind: the rollback
      puts it back and the revalidation then removes it, without a reload
- [ ] 2.7 Verify a keyboard move (focus handle, Space, Arrow, Space) produces the same status
      change as a pointer drag
- [ ] 2.8 Verify the pointer path by hand once, since the e2e suite drives the keyboard path and the
      two now diverge at the `coordinateGetter` rather than sharing all of dnd-kit's sensor code

## 3. E2E setup

- [ ] 3.1 Add `playwright.config.ts` with a `webServer` that builds and serves the app with
      `DATABASE_URL` pointing at a disposable e2e database, and verify `npx playwright test
      --list` resolves the config
- [ ] 3.2 Add an npm script that creates and seeds the e2e database to a known state, and verify
      running it twice leaves the same data
- [ ] 3.3 Verify the e2e database file is gitignored and that running the suite leaves `dev.db`
      untouched

## 4. E2E test and verification

- [ ] 4.1 Write `e2e/move-card.spec.ts` moving a card between columns with the keyboard, and
      verify it asserts both the new column and the updated column counts
- [ ] 4.2 Extend that spec to reload the page and verify the move persisted
- [ ] 4.2a Add an e2e check that a row inserted directly into the e2e database appears on reload
      without rebuilding, and verify it fails when `await connection()` is removed from
      `lib/applications/queries.ts`. This is the automated guard deferred here from
      `harden-kanban-board`, where the requirement could only be checked by hand
- [ ] 4.2b Add an e2e check that the column count badge is announced as "N applications" in the
      accessibility tree and that the bare digit is not, and verify it fails when the hidden count
      is written as `{count} {word}` instead of one template literal. Also deferred here: jsdom
      normalises whitespace across text nodes, so no component test can tell the two apart
- [ ] 4.3 Run `npm run test:e2e` and confirm the suite passes from a clean e2e database
- [ ] 4.4 Run `npm run verify` and confirm it passes with no errors before marking the change
      complete
