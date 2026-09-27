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
- [ ] 2.6 On a failed action result, drop the optimistic move and show the failure in an
      assertive live region above the board, and verify the card returns to its original column
- [ ] 2.7 Verify a keyboard move (focus handle, Space, Arrow, Space) produces the same status
      change as a pointer drag

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
- [ ] 4.3 Run `npm run test:e2e` and confirm the suite passes from a clean e2e database
- [ ] 4.4 Run `npm run verify` and confirm it passes with no errors before marking the change
      complete
