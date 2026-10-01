# Design

## Context

See `proposal.md` — Why. What matters for the approach is what already exists:

- `updateApplication(id, input)` and `deleteApplication(id)` in `app/actions/applications.ts`
  validate their arguments, return `ActionResult` and never reject. Both already distinguish
  "not found" (Prisma `P2025`) from an unclassifiable failure, and both already have unit tests.
- `createApplicationFromForm` is the `useActionState` shape over `createApplication`:
  `(prevState, formData) => ActionResult`.
- `AddApplicationForm` takes its action as a **prop** rather than importing it, so the form can be
  rendered in jsdom without pulling Prisma in. It is controlled, so a refusal keeps what was typed.
- `AddApplicationDialog` uses a native `<dialog>` with `showModal()`; the focus trap, Escape, the
  inert background and focus restoration are the browser's.
- `useCardMoves` owns the board's visible list: `useOptimistic(applications, applyMove)`, a pending
  set keyed by card id, and one error string. `Board` renders that error in a single
  `role="alert" aria-live="assertive"` region.
- `e2e/long-value-layout.spec.ts` measures that a 200-character company name does not widen its
  column. The card header is the measured area, and this change adds controls to it.

Two gaps in the existing actions are relevant. `updateApplicationStatus` calls `revalidatePath` on
its not-found branch — deliberately, so the board stops showing a card for a row that is gone.
`updateApplication` and `deleteApplication` return `NOT_FOUND` **without** revalidating, so a
not-found edit or deletion would leave the stale card on the board. The specs require it to go.

## Goals / Non-Goals

**Goals:**

- One form implementation for adding and editing, so validation, refusal messages, length limits and
  keyboard behaviour cannot drift between the two modes.
- One source of truth for what the board shows, even though two kinds of change (a move and a
  deletion) now act on it optimistically.
- Per-card controls that do not interfere with the drag handle or with the measured card layout.

**Non-Goals:**

- No undo for a deletion. The confirmation step is what the specs ask for; a restore path would need
  soft deletes in the data model, which is a separate change.
- No optimistic edit. The form stays open until the write settles, so the board never shows a value
  that is not stored.
- No bulk edit or bulk delete, and no editing of status, `appliedDate` or `statusChangedAt` — see
  the `application-form` delta.

## Decisions

### Generalise the form rather than write a second one

`AddApplicationForm` becomes `ApplicationForm`, taking `initialValues` (defaulting to empty) and a
submit label alongside the `action` prop it already takes. Its `Values` state seeds from
`initialValues`, so the pre-filled edit case is the same controlled form with a different starting
point.

Alternative considered: a separate `EditApplicationForm`. Rejected — the `application-form` delta
requires identical validation, identical refusal behaviour and identical keyboard behaviour in both
modes, and two components is exactly how those drift. The existing form's tests then cover both
modes by construction.

The dialog is likewise generalised: `ApplicationDialog` renders either "Add application" or
"Edit application" with the matching action, and the form is mounted only while the dialog is open —
the existing reason (a reopened dialog starts clean) is also what guarantees that opening the dialog
on a second application does not show the first one's values.

### The id is a prop of the form, and the action re-validates it

The hidden field has to sit inside the `<form>`, and the `<form>` belongs to `ApplicationForm` — so
the dialog cannot place it there. `ApplicationForm` therefore takes an optional `id` prop and
renders `<input type="hidden" name="id">` only when it has one; absent, the form is in add mode and
submits no id. `ApplicationDialog` passes the id of the application it was opened on.

Alternative considered: carrying the id inside `initialValues`. Rejected — `initialValues` is
exactly the four fields the person edits, and widening it to hold a non-editable identifier would
blur what the form is for. The distinction also keeps the add case honest: no id, no hidden field.

`updateApplicationFromForm(prevState, formData)` reads that field, mirroring
`createApplicationFromForm`. `updateApplication` already treats its `id` as untrusted (`isValidId`)
and already returns `INVALID_ID` for anything else, so a tampered hidden field is refused by the
same check that guards a direct action call.

Alternative considered: `updateApplication.bind(null, id)` in the client component. Rejected — the
bound shape does not match what `useActionState` passes, and it creates a new action reference per
render for no gain.

### One dialog per board, not one per card

`Board` holds `editingId: string | null` and `deletingId: string | null`, and renders one
`ApplicationDialog` and one `ConfirmDeleteDialog`. `ApplicationCard` gains `onEdit` and `onDelete`
callbacks, passed down through `BoardColumn` and `DraggableCard` the way `isMovePending` already is.

Alternative considered: a dialog inside each card. Rejected — it puts one `<dialog>` and one form
state per application in the tree, and the native focus restoration has to work from a control that
is about to be unmounted (a deleted card). With a board-level dialog, the browser restores focus to
the card's control when it still exists, and does nothing when it does not, which is what the
`application-delete` delta asks for.

### The confirmation is a `<dialog>`, not `window.confirm`

Same `showModal()` pattern as the existing dialog: it is styleable, it can be driven in jsdom, it
can name the application in its heading, and it cannot be suppressed by the browser the way a
native confirm can. `window.confirm` would also block the event loop, which rules out showing a
pending state while the deletion is stored.

### One optimistic list, two kinds of change

`useCardMoves` becomes `useBoardCards`, with a single `useOptimistic` over a discriminated change:

```
type BoardChange = { kind: "move"; cardId: string; to: ApplicationStatus }
                 | { kind: "remove"; cardId: string }
```

and one reducer that either re-statuses or filters out the card. The pending set and the error string
stay as they are, shared by both kinds.

Alternative considered: a second hook `useCardDeletions` with its own `useOptimistic`. Rejected —
two `useOptimistic` calls over the same server list give two candidate values for "what the board
shows", and reconciling them is a bug waiting for the case where a card is moved and deleted in the
same breath. One reducer makes that case a sequence of changes over one list.

The hook keeps its current test seam: the action is reached through a module import that the tests
mock, dnd-kit stays out of it, and the new deletion path is unit-testable the same way the move path
is.

The hook's predicate is renamed with it: `isMovePending` becomes `isCardBusy`, because after the
merge it answers "this card has a write in flight", which a deletion satisfies too. `ApplicationCard`
keeps its own `isMovePending` prop name — there it governs the drag handle specifically, and that is
still what it means. `Board` passes `isCardBusy` into it, since a card with any write outstanding is
a card that must not be dragged.

### Edit failures are reported in the form, deletion failures on the board

The `kanban-board` delta splits this by where the person is looking. An edit failure arrives while
the form is open, so the form's existing alert region carries it — no new surface. A deletion failure
arrives after the confirmation has closed, so it goes to the board's existing assertive region,
through the same `error` state the failed-move path uses. Setting `error` to `null` at the start of
each change is what makes a later success clear an earlier message, and what makes a second failure
announce rather than be mistaken for the first.

### Revalidate on the not-found branches

`updateApplication` and `deleteApplication` gain `revalidatePath(BOARD_PATH)` before returning
`NOT_FOUND`, matching `updateApplicationStatus`. Without it, a card for a row that no longer exists
stays on the board until a manual reload, which both deltas forbid. For the deletion path the
optimistic removal has already taken the card off screen; the revalidation is what makes that
removal survive the transition settling.

### What the native `<dialog>` covers, and what is therefore not unit-tested

Both dialogs use `showModal()`, so the focus trap, Escape, the inert background and focus
restoration are the browser's — the same reasoning `AddApplicationDialog` already records. jsdom
does not implement any of it, so the scenarios that depend on it ("Focus does not escape the open
form", "Focus does not escape the confirmation") are not unit-testable and are deliberately left to
the platform rather than reimplemented to be assertable. They are verified in the e2e run, where a
real browser is doing the trapping. A scenario with no task against it in this area is that, not an
oversight; anything that would need hand-written focus management would instead need a test.

### Card layout

The two new controls join the drag handle in one `shrink-0` group in the card header, so the company
heading remains the only flexible item and keeps the `line-clamp-3 break-words` behaviour the layout
test measures. Each control carries an `aria-label` naming the application, as the posting link and
the drag handle already do.

## Risks / Trade-offs

- **Three controls in the card header reduce the width left for a long company name, and could
  change the measured layout** → `e2e/long-value-layout.spec.ts` runs in both viewports and is the
  check; if the header grows too tight, the controls move to a footer row rather than the heading
  losing its clamp.
- **Renaming `useCardMoves` and `AddApplicationForm` touches files this change is not otherwise
  about, including their tests** → done as its own commit, before the feature commits, so a
  behavioural regression is not hidden inside a rename diff (`AGENTS.md`: one commit = one logically
  complete change).
- **A board-level dialog means the card's edit control and the form are far apart in the tree** →
  the id in the hidden field is the only coupling, and it is re-validated server-side.
- **No undo: a confirmed deletion is final** → accepted, and the confirmation names the application
  so the person can see what they are about to lose. Recorded in `spec.md` as a deliberate MVP
  boundary.
- **Deleting a card while its move is still being stored** → the optimistic removal wins on screen
  and the move's write may still land on a row that is being deleted. The move action already handles
  a missing row (`NOT_FOUND`, with revalidation), so the outcome is a reported failure and a board
  that matches storage, not a crash.
