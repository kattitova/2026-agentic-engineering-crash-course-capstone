# Proposal

## Why

The board shows applications but cannot change them. Moving an application forward means
editing the database by hand, which is exactly the friction the tool exists to remove. Dragging
a card between columns is the product's central interaction, and it is also the one the
Definition of Done names: the project needs at least one passing e2e test covering a card
moving between columns, and that test cannot exist until the interaction does.

The server side is already finished and tested: `updateApplicationStatus` decides the new
status, sets `appliedDate` on the first move into APPLIED, and leaves `statusChangedAt`
untouched when a card is dropped back into its own column.

## What Changes

- Cards become draggable between columns. Dropping a card in a different column changes that
  application's status through the existing `updateApplicationStatus` server action.
- Dropping a card back into the column it came from changes nothing, including the
  "N days in this status" clock that a later change will display.
- The card moves immediately on drop and is reconciled with the server result, so the board
  never appears frozen while the write completes.
- If the write fails, the card returns to its original column and the board reports the failure
  instead of silently showing a state the database does not have.
- Cards can also be moved with the keyboard, so the interaction works without a pointer.
- The board gains its first client component. The page stays a Server Component and keeps
  loading the data.
- Playwright gains configuration, and the suite gains an e2e test that moves a card between
  columns and asserts the move survives a reload.
- E2E runs against a disposable database, never the developer's `dev.db`.

Not in this change:

- Reordering cards inside a column. Position within a column carries no meaning in the data
  model, so there is nothing to persist.
- The "N days in this status" badge and the stale flag, the stats row, and the add/edit/delete
  forms. Each remains its own change.

## Capabilities

### New Capabilities

<!-- None: this extends the existing board capability. -->

### Modified Capabilities

- `kanban-board`: adds requirements for moving an application between columns — the status
  change itself, the no-op move, failure recovery, and keyboard operation. The existing display
  requirements are unchanged.

## Impact

- **Code**: `components/board/Board.tsx` becomes a client component hosting the drag context;
  `components/board/BoardColumn.tsx` gains a drop target and `ApplicationCard.tsx` a drag
  handle. `app/page.tsx` is unchanged beyond what it already passes down.
- **Server actions**: none changed. `updateApplicationStatus` is called as it stands.
- **Data**: no schema change, no migration.
- **Dependencies**: none added. `@dnd-kit/core` is already installed and unused until now.
  `@dnd-kit/sortable` stays unused, since within-column ordering is out of scope.
- **Tests**: new Playwright config, an e2e spec, and an npm script that prepares the throwaway
  e2e database. `npm run verify` stays lint + typecheck + unit tests, so the e2e suite does not
  slow the inner loop.
- **Docs**: `spec.md` MVP item 3 becomes implemented, and the Definition of Done's e2e
  requirement is met.
