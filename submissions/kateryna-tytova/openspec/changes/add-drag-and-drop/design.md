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
the handle, Space to pick up, Left/Right to choose a column, Space to drop — is what the e2e
test drives.

Alternative considered: driving the pointer sensor from Playwright with synthetic mouse moves.
Rejected — it needs intermediate move events and timing fudges, which is where drag e2e tests
usually become flaky. The keyboard path exercises the same `onDragEnd` handler and the same
server action, so it tests the behaviour that matters rather than the input device.

### The keyboard sensor needs a column-aware `coordinateGetter`

Registering `KeyboardSensor` is not enough, and this is the point the plan previously glossed.
dnd-kit's default keyboard coordinate getter translates the drag by a flat **25 pixels** per arrow
key (`@dnd-kit/core/dist/core.cjs.development.js:1114-1131`, verified by reading it). Board columns
measure 259px at a 1440px viewport, so a single arrow press lands the pointer inside the column it
started in: the drag never reaches a neighbouring droppable.

`KeyboardSensor` therefore takes a custom `coordinateGetter`. On Left/Right it reads the droppable
rects from the sensor context, finds the column adjacent to the active card's current column in
funnel order, and returns that rect's centre. Up/Down return `undefined`, which dnd-kit treats as
"no movement": vertical position inside a column carries no meaning, since ordering within a column
is out of scope.

Alternative considered: `sortableKeyboardCoordinates` from `@dnd-kit/sortable`. Rejected — it
resolves coordinates between *sortable items*, and the columns here are plain droppables with no
sortable context. Alternative considered: leaving the default and pressing the arrow key enough
times to cross a column. Rejected outright — it makes the number of key presses depend on the
viewport, which is neither operable for a real keyboard user nor a test that means anything.

Below `xl` the grid wraps onto several rows. Left/Right still walk funnel order, which is also
reading order there, so the interaction stays coherent without special-casing the layout.

### A card with a move in flight cannot be moved again

While a card's status write is outstanding, that card's drag handle is disabled. Other cards stay
draggable: they are different rows, so their writes cannot race each other.

This answers the question left open across two review passes. Each `updateApplicationStatus` call
is internally transactional, so the database cannot be corrupted — but two overlapping calls for
one card settle in completion order, which need not be the order the user dragged in, and the
optimistic state can come to rest on the earlier result. Gating removes the race rather than
resolving it.

Alternative considered: accepting every drag and reconciling on the latest *issued* move. Rejected
— it means tracking an issue sequence per card and discarding responses that arrive out of order,
which is real machinery for a case reachable only by deliberately shaking a card back and forth in
a local single-user tracker. Gating is trivially correct and can be asserted directly: the handle
is disabled.

The pending card is tracked by id rather than by `useTransition`'s single `isPending`, which would
freeze the whole board while any one card was being written.

### A move that finds nothing must not put the card back

`updateApplicationStatus` returns `NOT_FOUND` *before* `revalidatePath`
(`app/actions/applications.ts:57-64`). The failure path in this change drops the optimistic move, so
the card would reappear in the column it came from — a column it no longer belongs to, because the
row is gone — and nothing would remove it until the next reload. That is exactly what "the board
stays truthful after a failure" forbids.

`updateApplicationStatus` therefore revalidates the board path on the `NOT_FOUND` branch too. The
visible result is a brief return followed by the card disappearing, which is honest: the rollback
and the revalidation are two different facts arriving in order.

Alternative considered: `router.refresh()` on the client after any failed move. Rejected as the
primary fix — it is blunter, it re-fetches on failures where the board is not stale at all, and it
leaves the same hole for any other caller of the action. The server-side revalidation is precise
and benefits the delete flow a later change will add.

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
  same `onDragEnd` handler; the risk is limited to sensor wiring. That is no longer purely
  dnd-kit's code, since the keyboard path now carries a custom `coordinateGetter`, so the pointer
  path gets at least one manual check recorded in tasks.
- **The custom `coordinateGetter` drifts from the column definitions** → it derives adjacency from
  `BOARD_COLUMNS`, the same exhaustive table the board renders from, rather than from a second list
  of its own. A new status fails to compile there first.
- **Gating hides a stuck write** → if an action never settles, that card's handle stays disabled
  with no explanation. The failure path clears the pending card on both success and failure, and
  the live region reports the failure, so the only way to strand a handle is a promise that never
  resolves.
- **Cards carry a link and a drag handle in a small area** → the handle is a separate control
  with its own hit area, sized to stay comfortably tappable.

## Open Questions

None. Two questions carried from the review passes are answered above rather than left open: a
second drag of a card with a move in flight is refused at the handle, and a move that finds no row
revalidates instead of restoring the card. The keyboard step size is settled by the custom
`coordinateGetter`.
