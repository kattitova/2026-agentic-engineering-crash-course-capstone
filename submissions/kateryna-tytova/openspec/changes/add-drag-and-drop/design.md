# Design

## Context

See proposal.md — Why. The board renders from a Server Component and has no client code at all
today. `updateApplicationStatus(id, status)` already exists, runs the status decision inside a
transaction and calls `revalidatePath("/")`; its logic is covered by unit tests.

Constraints that shape the approach:

- A card already contains a link to the job posting. Any drag activation has to coexist with
  clicking that link.
- The e2e test must be reliable enough to gate the Definition of Done, and pointer-based
  drag simulation against a custom drag implementation is the classic source of flaky tests.
- `next dev` in Next 16 refuses to start a second instance for the same directory, so an e2e
  run cannot assume it may start a dev server while the developer has one open.
- The seeded `dev.db` is the developer's real tracker data; tests must not write to it.

## Goals / Non-Goals

**Goals:**

- Keep the page a Server Component; make only what needs pointer events a client component.
- Make the interaction operable by keyboard, which also makes it testable deterministically.
- Keep the board's displayed state and the stored state from diverging, including on failure.

**Non-Goals:**

- Ordering cards inside a column. `@dnd-kit/sortable` stays unused.
- Touch-specific tuning beyond what the pointer sensor already provides.
- Animated drop transitions.

## Decisions

### `Board` becomes the only client component

`app/page.tsx` keeps loading applications on the server and passes them down. `Board` gains
`"use client"` and owns the drag context; `BoardColumn` becomes a drop target and
`ApplicationCard` renders a drag handle. Both stay presentational.

Alternative considered: making the whole page client-side and fetching through the action.
Rejected — it reintroduces a loading state and ships the data twice.

### A dedicated drag handle, not a draggable card

The whole card is not the drag source. A small handle button on the card is.

Two reasons. First, the card contains a link; making the card itself draggable turns every
attempted link click into a possible drag. Second, the spec requires the move control to be
reachable and announced as a control, which a real `<button>` gives for free.

Alternative considered: making the card draggable with a pointer activation distance so a
click still registers. Rejected — it solves the pointer case but leaves no keyboard affordance,
and "did I click or drag?" stays ambiguous at small movements.

### Pointer and keyboard sensors, keyboard as the tested path

dnd-kit's `PointerSensor` and `KeyboardSensor` are both registered. The keyboard path — focus
the handle, Space to pick up, arrow keys to choose a column, Space to drop — is what the e2e
test drives.

Alternative considered: driving the pointer sensor from Playwright with synthetic mouse moves.
Rejected — it needs intermediate move events and timing fudges, which is where drag e2e tests
usually become flaky. The keyboard path exercises the same `onDragEnd` handler and the same
server action, so it tests the behaviour that matters rather than the input device.

### Optimistic move, reconciled by revalidation

The card moves as soon as it is dropped, using `useOptimistic` over the applications passed
from the server. The server action runs in a transition; `revalidatePath("/")` inside the
action re-renders the page with stored data, which replaces the optimistic state.

On failure the optimistic state is dropped, the card reappears in its original column, and an
error message is shown in a live region above the board.

Alternative considered: awaiting the action and letting revalidation move the card. Rejected —
a SQLite round trip plus a re-render is visible as a stall on the one interaction the product
is built around.

### A no-op move never reaches the server

If a card is dropped on the column it already belongs to, the handler returns before calling the
action. The server already treats this case correctly, but not calling it keeps `updatedAt`
untouched and avoids a pointless write.

### E2E runs a production build against a throwaway database

Playwright's `webServer` builds the app and serves it with `DATABASE_URL` pointing at a
disposable e2e database, seeded to a known state before the run.

Two reasons for a build rather than `next dev`: Next 16 refuses a second dev server for the same
directory, so an e2e run would fail whenever a dev server is already open; and a build removes
first-compile delays that otherwise show up as timeouts on the first test.

`npm run verify` keeps its current three steps. The e2e suite stays behind `npm run test:e2e`
so the inner loop is not slowed by a build.

## Risks / Trade-offs

- **Optimistic state and revalidated data disagree** → the optimistic value is derived from the
  server-provided list each render, so once revalidation lands, stored data wins by
  construction rather than by manual reconciliation.
- **The e2e build makes the first run slow** → accepted; it buys determinism and avoids the
  dev-server collision. The unit suite, not the e2e suite, stays the fast feedback loop.
- **A failure message that no one notices** → the message goes in an assertive live region
  above the board, and the card visibly returns, so the failure is legible without it.
- **Keyboard-only e2e coverage could hide a pointer-only regression** → both sensors end in the
  same `onDragEnd` handler; the risk is limited to sensor wiring, which is dnd-kit's code.
- **Cards carry a link and a drag handle in a small area** → the handle is a separate control
  with its own hit area, sized to stay comfortably tappable.

## Open Questions

None that block implementation.
